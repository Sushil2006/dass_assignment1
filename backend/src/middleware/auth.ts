import type { NextFunction, Request, Response } from "express";
import { ObjectId } from "mongodb";
import { AUTH_COOKIE_NAME } from "../config/cookies";
import { getDb } from "../db/client";
import type { UserDoc, UserRole } from "../db/models";
import { verifyJwt } from "../utils/jwt";

// reads jwt from auth cookie, verifies it and sets req.user = {id, role}
export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token || typeof token !== "string") {
    res.status(401).json({ error: { message: "Not authenticated" } });
    return;
  }

  try {
    const payload = verifyJwt(token); // verifyJwt is defined in utils/jwt.ts
    // if invalid token, error thrown, and handled in the catch block

    // block disabled organizers on every authenticated request
    // special check only for organizer role, because only organizers could be disabled at some point --> so we have to look up the DB and check if the organizer is disabled or not
    // technically, a JWT with a valid signature can be used even if the user no longer exists in DB
    // eg: a stolen JWT still works until it expires, because we don't re-check participants/admins
    if (payload.role === "organizer") {
      const users = getDb().collection<UserDoc>("users");
      const organizer = await users.findOne({
        _id: new ObjectId(payload.userId),
        role: "organizer",
      });

      if (!organizer) {
        res.status(401).json({ error: { message: "Not authenticated" } });
        return;
      }

      if (organizer.isDisabled === true) {
        res
          .status(403)
          .json({ error: { message: "Organizer account is disabled" } });
        return;
      }
    }

    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch (err) {
    // treat jwt/objectid parse failures as unauthenticated requests
    if (
      err instanceof Error &&
      (err.message === "Invalid token" ||
        err.message.includes("ObjectId") ||
        err.message.includes("BSON")) // could be thrown by the `new ObjectId()` function call in the try block
    ) {
      res.status(401).json({ error: { message: "Not authenticated" } });
      return;
    }

    next(err);
  }
}

// function that returns a function
// middleware factory --> returns a middleware function used to check if user's role is in the set of allowed roles
export function requireRole(...roles: UserRole[]) {
  // 1) This outer function runs once when you set up the route.
  // 2) It returns the actual middleware that Express will run per request.
  return function middleware(req: Request, res: Response, next: NextFunction) {
    const user = req.user;

    if (!user) {
      res.status(401).json({ error: { message: "Not authenticated" } });
      return;
    }

    if (!roles.includes(user.role)) {
      res.status(403).json({ error: { message: "Forbidden" } });
      return;
    }

    next();
  };
}
