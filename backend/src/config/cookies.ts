// setup cookie config
import type { CookieOptions } from "express";

export const AUTH_COOKIE_NAME = "felicity_auth";

export const authCookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: "lax",
  secure: false,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
  path: "/",
};
