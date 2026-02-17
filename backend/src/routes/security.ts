import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../db/client";
import type { UserDoc } from "../db/models";
import { requireAuth } from "../middleware/auth";
import { hashPassword, verifyPassword } from "../utils/password";

export const securityRouter = Router();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

securityRouter.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    // validate payload before touching db
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: "Invalid request", details: parsed.error.flatten() },
      });
    }

    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: { message: "Not authenticated" } });
    }

    // reject trivial no-op password updates
    if (parsed.data.currentPassword === parsed.data.newPassword) {
      return res.status(400).json({
        error: { message: "New password must be different from current password" },
      });
    }

    const db = getDb();
    const users = db.collection<UserDoc>("users");
    const user = await users.findOne({ _id: new ObjectId(authUser.id) });

    if (!user) {
      return res.status(401).json({ error: { message: "Not authenticated" } });
    }

    // verify current password before replacing hash
    const isCurrentPasswordValid = await verifyPassword(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      return res.status(401).json({ error: { message: "Current password is incorrect" } });
    }

    const newPasswordHash = await hashPassword(parsed.data.newPassword);

    // store only the new hash in db
    await users.updateOne(
      { _id: user._id },
      { $set: { passwordHash: newPasswordHash } },
    );

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});
