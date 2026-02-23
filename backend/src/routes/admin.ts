import { randomBytes } from "node:crypto";
import { Router } from "express";
import { type Collection, ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import type {
  OrganizerPasswordResetRequestDoc,
  OrganizerPasswordResetRequestStatus,
  UserDoc,
} from "../db/models";
import { hashPassword } from "../utils/password";

export const adminRouter = Router();

// keep input minimal for organizer provisioning
const createOrganizerSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const resolvePasswordResetRequestSchema = z.object({
  decision: z.enum(["approve", "reject"]),
  comment: z.string().trim().max(500).optional(),
});

type AdminPasswordResetRequestResponse = {
  id: string;
  organizerId: string;
  organizerName: string;
  organizerEmail: string;
  reason: string;
  status: OrganizerPasswordResetRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  adminComment: string | null;
};

function toOrganizerResponse(user: UserDoc) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    isDisabled: user.isDisabled === true,
    isArchived: Boolean(user.archivedAt),
    createdAt: user.createdAt,
  };
}

function generateOrganizerPassword(): string {
  return `Org#${randomBytes(9).toString("base64url")}`;
}

function slugifyName(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
}

async function generateOrganizerEmail(params: {
  users: Collection<UserDoc>;
  organizerName: string;
}): Promise<string> {
  const base = slugifyName(params.organizerName) || "organizer";

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const suffix = randomBytes(2).toString("hex");
    const email = `${base}-${suffix}@felicity.local`;
    const existing = await params.users.findOne({ email });
    if (!existing) return email;
  }

  throw new Error("Failed to generate organizer email");
}

function parseOrganizerId(rawId: string): ObjectId | null {
  if (!ObjectId.isValid(rawId)) return null;
  return new ObjectId(rawId);
}

function parsePasswordResetRequestId(rawId: string): ObjectId | null {
  if (!ObjectId.isValid(rawId)) return null;
  return new ObjectId(rawId);
}

function toAdminPasswordResetRequestResponse(params: {
  request: OrganizerPasswordResetRequestDoc;
  organizer: UserDoc;
}): AdminPasswordResetRequestResponse {
  return {
    id: params.request._id.toString(),
    organizerId: params.organizer._id.toString(),
    organizerName: params.organizer.name,
    organizerEmail: params.organizer.email,
    reason: params.request.reason,
    status: params.request.status,
    createdAt: params.request.createdAt,
    updatedAt: params.request.updatedAt,
    resolvedAt: params.request.resolvedAt ?? null,
    adminComment: params.request.adminComment ?? null,
  };
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
    const email = await generateOrganizerEmail({
      users,
      organizerName: name,
    });
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

adminRouter.get("/password-reset-requests", async (_req, res, next) => {
  try {
    const db = getDb();
    const users = db.collection<UserDoc>(collections.users);
    const requests = db.collection<OrganizerPasswordResetRequestDoc>(
      collections.organizerPasswordResetRequests,
    );

    const resetRequests = await requests.find({}).sort({ createdAt: -1 }).limit(200).toArray();

    if (resetRequests.length === 0) {
      return res.json({ requests: [] });
    }

    const organizerIds = Array.from(
      new Set(resetRequests.map((request) => request.organizerId.toString())),
    ).map((id) => new ObjectId(id));

    const organizers = await users
      .find({
        _id: { $in: organizerIds },
        role: "organizer",
      })
      .toArray();

    const organizersById = new Map(organizers.map((organizer) => [organizer._id.toString(), organizer]));

    const response = resetRequests.flatMap((request) => {
      const organizer = organizersById.get(request.organizerId.toString());
      if (!organizer) return [];
      return [toAdminPasswordResetRequestResponse({ request, organizer })];
    });

    return res.json({ requests: response });
  } catch (err) {
    return next(err);
  }
});

adminRouter.patch("/password-reset-requests/:requestId", async (req, res, next) => {
  try {
    const requestId = parsePasswordResetRequestId(req.params.requestId);
    if (!requestId) {
      return res.status(400).json({ error: { message: "Invalid request id" } });
    }

    const parsed = resolvePasswordResetRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: "Invalid request", details: parsed.error.flatten() },
      });
    }

    const db = getDb();
    const users = db.collection<UserDoc>(collections.users);
    const requests = db.collection<OrganizerPasswordResetRequestDoc>(
      collections.organizerPasswordResetRequests,
    );

    const existing = await requests.findOne({ _id: requestId });
    if (!existing) {
      return res.status(404).json({ error: { message: "Request not found" } });
    }

    if (existing.status !== "pending") {
      return res.status(409).json({
        error: { message: "Request has already been resolved" },
      });
    }

    const organizer = await users.findOne({
      _id: existing.organizerId,
      role: "organizer",
    });
    if (!organizer) {
      return res.status(404).json({ error: { message: "Organizer not found" } });
    }

    const now = new Date();
    const adminId = req.user ? new ObjectId(req.user.id) : undefined;
    const cleanedComment = parsed.data.comment?.trim() ?? "";
    const baseSetPayload: Partial<OrganizerPasswordResetRequestDoc> = {
      status: parsed.data.decision === "approve" ? "approved" : "rejected",
      updatedAt: now,
      resolvedAt: now,
    };

    if (adminId) {
      baseSetPayload.reviewedByAdminId = adminId;
    }

    if (cleanedComment) {
      baseSetPayload.adminComment = cleanedComment;
    }

    if (parsed.data.decision === "approve") {
      if (organizer.archivedAt) {
        return res.status(409).json({
          error: { message: "Archived organizer cannot be reset" },
        });
      }

      const nextPassword = generateOrganizerPassword();
      const nextPasswordHash = await hashPassword(nextPassword);

      await users.updateOne(
        { _id: organizer._id, role: "organizer" },
        { $set: { passwordHash: nextPasswordHash, isDisabled: false } },
      );

      await requests.updateOne(
        { _id: requestId },
        cleanedComment
          ? { $set: baseSetPayload }
          : { $set: baseSetPayload, $unset: { adminComment: "" } },
      );

      const updated = await requests.findOne({ _id: requestId });
      if (!updated) {
        return res.status(404).json({ error: { message: "Request not found" } });
      }

      return res.json({
        request: toAdminPasswordResetRequestResponse({
          request: updated,
          organizer,
        }),
        credentials: {
          email: organizer.email,
          password: nextPassword,
        },
      });
    }

    await requests.updateOne(
      { _id: requestId },
      cleanedComment ? { $set: baseSetPayload } : { $set: baseSetPayload, $unset: { adminComment: "" } },
    );

    const updated = await requests.findOne({ _id: requestId });
    if (!updated) {
      return res.status(404).json({ error: { message: "Request not found" } });
    }

    return res.json({
      request: toAdminPasswordResetRequestResponse({
        request: updated,
        organizer,
      }),
    });
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

adminRouter.patch("/organizers/:organizerId/enable", async (req, res, next) => {
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

    if (organizer.archivedAt) {
      return res.status(409).json({
        error: { message: "Archived organizer cannot be enabled" },
      });
    }

    await users.updateOne(
      { _id: organizerId, role: "organizer" },
      { $set: { isDisabled: false } },
    );

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

    const organizer = await users.findOne({ _id: organizerId, role: "organizer" });
    if (!organizer) {
      return res.status(404).json({ error: { message: "Organizer not found" } });
    }

    // keep lifecycle explicit: disable first, then archive
    if (!organizer.isDisabled) {
      return res.status(409).json({
        error: { message: "Disable organizer before archiving" },
      });
    }

    // persist archive marker while keeping account disabled
    const archivedAt = organizer.archivedAt ?? new Date();
    await users.updateOne(
      { _id: organizerId, role: "organizer" },
      { $set: { isDisabled: true, archivedAt } },
    );

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
