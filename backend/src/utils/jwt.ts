import jwt, { JwtPayload } from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "../db/models";
import { userRoles } from "../db/models";

export type AuthJwtPayload = {
  userId: string;
  role: UserRole;
};

export function signJwt(payload: AuthJwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: "7d" });
}

export function verifyJwt(token: string): AuthJwtPayload {
  const decoded: string | JwtPayload = jwt.verify(token, env.JWT_SECRET);

  if (typeof decoded === "string") throw new Error("Invalid token");

  const userId: unknown = decoded.userId;
  const role: unknown = decoded.role;

  if (typeof userId !== "string") throw new Error("Invalid token");
  if (typeof role !== "string") throw new Error("Invalid token");
  if (!userRoles.includes(role as UserRole)) throw new Error("Invalid token");

  return { userId, role: role as UserRole };
}
