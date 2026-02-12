import type { UserRole } from "../db/models";

declare global {
  // adding types to the global typescript world, NOT a new module export
  namespace Express {
    // merge with existing Express namespace
    interface Request {
      // merge with existing Request definition
      user?: { id: string; role: UserRole }; // req.user is an optional field containing user information (optional because before auth middleware runs, req.user doesn't exist)
    }
  }
}

export {};
