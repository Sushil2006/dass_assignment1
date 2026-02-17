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
    const payload = verifyJwt(token);

    // block disabled organizers on every authenticated request
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
        res.status(403).json({ error: { message: "Organizer account is disabled" } });
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
        err.message.includes("BSON"))
    ) {
      res.status(401).json({ error: { message: "Not authenticated" } });
      return;
    }

    next(err);
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
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
