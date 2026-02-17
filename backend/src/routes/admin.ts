import { randomBytes } from "node:crypto";
import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import type { UserDoc } from "../db/models";
import { hashPassword } from "../utils/password";

export const adminRouter = Router();

// keep input minimal for organizer provisioning
const createOrganizerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.email(),
});

function toOrganizerResponse(user: UserDoc) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isDisabled: user.isDisabled === true,
    createdAt: user.createdAt,
  };
}

function generateOrganizerPassword(): string {
  return `Org#${randomBytes(9).toString("base64url")}`;
}

function parseOrganizerId(rawId: string): ObjectId | null {
  if (!ObjectId.isValid(rawId)) return null;
  return new ObjectId(rawId);
}

adminRouter.post("/organizers", async (req, res, next) => {
  try {
    const parsed = createOrganizerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: "Invalid request", details: parsed.error.flatten() },
      });
    }

    const db = getDb();
    const users = db.collection<UserDoc>(collections.users);

    // generate one-time organizer credentials
    const name = parsed.data.name;
    const email = parsed.data.email.toLowerCase().trim();
    const plainPassword = generateOrganizerPassword();
    const passwordHash = await hashPassword(plainPassword);
    const createdAt = new Date();

    const organizer: UserDoc = {
      _id: new ObjectId(),
      name,
      email,
      passwordHash,
      role: "organizer",
      isDisabled: false,
      createdAt,
    };

    await users.insertOne(organizer);

    return res.status(201).json({
      organizer: toOrganizerResponse(organizer),
      credentials: {
        email,
        password: plainPassword,
      },
    });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000
    ) {
      return res.status(409).json({ error: { message: "Email already in use" } });
    }

    return next(err);
  }
});

adminRouter.get("/organizers", async (_req, res, next) => {
  try {
    const db = getDb();
    const users = db.collection<UserDoc>(collections.users);

    // list only organizer accounts for admin table
    const organizers = await users.find({ role: "organizer" }).sort({ createdAt: -1 }).toArray();

    return res.json({ organizers: organizers.map(toOrganizerResponse) });
  } catch (err) {
    return next(err);
  }
});

adminRouter.patch("/organizers/:organizerId/disable", async (req, res, next) => {
  try {
    const organizerId = parseOrganizerId(req.params.organizerId);
    if (!organizerId) {
      return res.status(400).json({ error: { message: "Invalid organizer id" } });
    }

    const db = getDb();
    const users = db.collection<UserDoc>(collections.users);

    // disable organizer login without deleting data
    const result = await users.updateOne(
      { _id: organizerId, role: "organizer" },
      { $set: { isDisabled: true } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: { message: "Organizer not found" } });
    }

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

adminRouter.patch("/organizers/:organizerId/archive", async (req, res, next) => {
  try {
    const organizerId = parseOrganizerId(req.params.organizerId);
    if (!organizerId) {
      return res.status(400).json({ error: { message: "Invalid organizer id" } });
    }

    const db = getDb();
    const users = db.collection<UserDoc>(collections.users);

    // archive behaves as disabled account in current model
    const result = await users.updateOne(
      { _id: organizerId, role: "organizer" },
      { $set: { isDisabled: true } },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: { message: "Organizer not found" } });
    }

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});

adminRouter.delete("/organizers/:organizerId", async (req, res, next) => {
  try {
    const organizerId = parseOrganizerId(req.params.organizerId);
    if (!organizerId) {
      return res.status(400).json({ error: { message: "Invalid organizer id" } });
    }

    const db = getDb();
    const users = db.collection<UserDoc>(collections.users);

    const organizer = await users.findOne({ _id: organizerId, role: "organizer" });
    if (!organizer) {
      return res.status(404).json({ error: { message: "Organizer not found" } });
    }

    // do not allow hard delete if organizer already has events
    const events = db.collection(collections.events);
    const linkedEventCount = await events.countDocuments({ organizerId });
    if (linkedEventCount > 0) {
      return res.status(409).json({
        error: {
          message: "Organizer has events. Archive/disable instead of delete.",
        },
      });
    }

    await users.deleteOne({ _id: organizerId, role: "organizer" });

    return res.json({ ok: true });
  } catch (err) {
    return next(err);
  }
});
