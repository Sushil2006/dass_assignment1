import type { NextFunction, Request, Response } from "express";
import { AUTH_COOKIE_NAME } from "../config/cookies";
import type { UserRole } from "../db/models";
import { verifyJwt } from "../utils/jwt";

// reads jwt from auth cookie, verifies it and sets req.user = {id, role}
export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = req.cookies?.[AUTH_COOKIE_NAME];

  if (!token || typeof token !== "string") {
    res.status(401).json({ error: { message: "Not authenticated" } });
    return;
  }

  try {
    const payload = verifyJwt(token);
    req.user = { id: payload.userId, role: payload.role };
    next();
  } catch {
    res.status(401).json({ error: { message: "Not authenticated" } });
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
