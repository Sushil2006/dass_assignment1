import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import {
  getOrganizerCategoryLabel,
  normalizeOrganizerCategory,
  organizerCategories,
} from "../constants/organizerCategories";
import type {
  OrganizerPasswordResetRequestDoc,
  OrganizerPasswordResetRequestStatus,
  UserDoc,
} from "../db/models";
import { requireAuth, requireRole } from "../middleware/auth";

export const organizersRouter = Router();

const organizerVisibleStatuses = ["PUBLISHED", "CLOSED", "COMPLETED"] as const;

type PersistedEventStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "COMPLETED";
type DisplayEventStatus = PersistedEventStatus | "ONGOING";
type OrganizerEventType = "NORMAL" | "MERCH";

type OrganizerPublicEventDoc = {
  _id: ObjectId;
  name: string;
  description: string;
  type: OrganizerEventType;
  tags: string[];
  startDate: Date;
  endDate: Date;
  organizerId: ObjectId;
  status: PersistedEventStatus;
  createdAt: Date;
};

type OrganizerProfileDoc = UserDoc & {
  organizerCategory?: string;
  organizerDescription?: string;
  organizerContactEmail?: string;
  organizerContactNumber?: string;
  discordWebhookUrl?: string;
};

type OrganizerPasswordResetRequestResponse = {
  id: string;
  reason: string;
  status: OrganizerPasswordResetRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt: Date | null;
  adminComment: string | null;
};

const organizerProfilePatchSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  category: z.union([z.enum(organizerCategories), z.literal("")]).optional(),
  description: z.string().trim().max(2000).optional(),
  contactEmail: z.union([z.string().trim().email(), z.literal("")]).optional(),
  contactNumber: z.string().trim().max(30).optional(),
  discordWebhookUrl: z.union([z.string().trim().url(), z.literal("")]).optional(),
});

const organizerPasswordResetRequestCreateSchema = z.object({
  reason: z.string().trim().min(8).max(500),
});

function parseObjectId(rawId: unknown): ObjectId | null {
  if (typeof rawId !== "string") return null;
  if (!ObjectId.isValid(rawId)) return null;
  return new ObjectId(rawId);
}

function deriveDisplayStatus(event: OrganizerPublicEventDoc, now: Date): DisplayEventStatus {
  if (
    event.status === "PUBLISHED" &&
    now >= event.startDate &&
    now <= event.endDate
  ) {
    return "ONGOING";
  }

  return event.status;
}

function toPublicOrganizer(organizer: OrganizerProfileDoc) {
  const normalizedCategory = normalizeOrganizerCategory(organizer.organizerCategory);

  return {
    id: organizer._id.toString(),
    name: organizer.name,
    category: normalizedCategory,
    categoryLabel: normalizedCategory
      ? getOrganizerCategoryLabel(normalizedCategory)
      : null,
    description: organizer.organizerDescription ?? null,
    contactEmail: organizer.organizerContactEmail ?? organizer.email,
    contactNumber: organizer.organizerContactNumber ?? null,
    createdAt: organizer.createdAt,
  };
}

function toOrganizerSelfProfile(organizer: OrganizerProfileDoc) {
  const normalizedCategory = normalizeOrganizerCategory(organizer.organizerCategory);

  return {
    id: organizer._id.toString(),
    name: organizer.name,
    email: organizer.email,
    category: normalizedCategory ?? "",
    categoryLabel: normalizedCategory
      ? getOrganizerCategoryLabel(normalizedCategory)
      : "",
    description: organizer.organizerDescription ?? "",
    contactEmail: organizer.organizerContactEmail ?? organizer.email,
    contactNumber: organizer.organizerContactNumber ?? "",
    discordWebhookUrl: organizer.discordWebhookUrl ?? "",
    createdAt: organizer.createdAt,
  };
}

function toPublicOrganizerEvent(event: OrganizerPublicEventDoc) {
  return {
    id: event._id.toString(),
    name: event.name,
    description: event.description,
    type: event.type,
    tags: event.tags,
    startDate: event.startDate,
    endDate: event.endDate,
    status: event.status,
    displayStatus: deriveDisplayStatus(event, new Date()),
    createdAt: event.createdAt,
  };
}

function toOrganizerPasswordResetRequestResponse(
  request: OrganizerPasswordResetRequestDoc,
): OrganizerPasswordResetRequestResponse {
  return {
    id: request._id.toString(),
    reason: request.reason,
    status: request.status,
    createdAt: request.createdAt,
    updatedAt: request.updatedAt,
    resolvedAt: request.resolvedAt ?? null,
    adminComment: request.adminComment ?? null,
  };
}

organizersRouter.get("/categories", (_req, res) => {
  return res.json({
    categories: organizerCategories.map((value) => ({
      value,
      label: getOrganizerCategoryLabel(value),
    })),
  });
});

// public list of active organizers for browse/discovery
organizersRouter.get("/", async (_req, res, next) => {
  try {
    const db = getDb();
    const users = db.collection<OrganizerProfileDoc>(collections.users);

    // list only active organizer accounts for public browse
    const organizers = await users
      .find({ role: "organizer", isDisabled: { $ne: true } })
      .sort({ createdAt: -1 })
      .toArray();

    return res.json({ organizers: organizers.map(toPublicOrganizer) });
  } catch (err) {
    return next(err);
  }
});

// public organizer detail with visible events split into upcoming/past
organizersRouter.get("/:organizerId", async (req, res, next) => {
  try {
    const rawOrganizerId = req.params.organizerId;

    if (rawOrganizerId === "me") {
      return next();
    }

    const organizerId = parseObjectId(rawOrganizerId);
    if (!organizerId) {
      return res.status(400).json({ error: { message: "Invalid organizer id" } });
    }

    const db = getDb();
    const users = db.collection<OrganizerProfileDoc>(collections.users);

    // organizer must exist and not be disabled
    const organizer = await users.findOne({
      _id: organizerId,
      role: "organizer",
      isDisabled: { $ne: true },
    });

    if (!organizer) {
      return res.status(404).json({ error: { message: "Organizer not found" } });
    }

    const events = db.collection<OrganizerPublicEventDoc>(collections.events);
    const visibleEvents = await events
      .find({
        organizerId,
        status: { $in: organizerVisibleStatuses },
      })
      .sort({ startDate: 1 })
      .toArray();

    const now = new Date();

    // keep ongoing/future in upcoming bucket for organizer public detail
    const upcomingEvents = visibleEvents
      .filter((event) => event.status !== "COMPLETED" && event.endDate >= now)
      .map(toPublicOrganizerEvent);

    // keep ended/completed events in past bucket
    const pastEvents = visibleEvents
      .filter((event) => event.status === "COMPLETED" || event.endDate < now)
      .sort((a, b) => b.startDate.getTime() - a.startDate.getTime())
      .map(toPublicOrganizerEvent);

    return res.json({
      organizer: toPublicOrganizer(organizer),
      upcomingEvents,
      pastEvents,
    });
  } catch (err) {
    return next(err);
  }
});

// organizer reads own editable profile
organizersRouter.get(
  "/me",
  requireAuth,
  requireRole("organizer"),
  async (req, res, next) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const organizerId = parseObjectId(authUser.id);
      if (!organizerId) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const db = getDb();
      const users = db.collection<OrganizerProfileDoc>(collections.users);

      // fetch organizer's own editable profile
      const organizer = await users.findOne({ _id: organizerId, role: "organizer" });
      if (!organizer) {
        return res.status(404).json({ error: { message: "Organizer not found" } });
      }

      return res.json({ profile: toOrganizerSelfProfile(organizer) });
    } catch (err) {
      return next(err);
    }
  },
);

// organizer updates own profile fields (supports clearing optional fields)
organizersRouter.patch(
  "/me",
  requireAuth,
  requireRole("organizer"),
  async (req, res, next) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const organizerId = parseObjectId(authUser.id);
      if (!organizerId) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const parsed = organizerProfilePatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: { message: "Invalid request", details: parsed.error.flatten() },
        });
      }

      // prepare set/unset so empty strings can clear optional fields
      const setPayload: Partial<OrganizerProfileDoc> = {};
      const unsetPayload: Record<string, ""> = {};

      if (parsed.data.name !== undefined) {
        setPayload.name = parsed.data.name;
      }

      if (parsed.data.category !== undefined) {
        if (parsed.data.category === "") {
          unsetPayload.organizerCategory = "";
        } else {
          setPayload.organizerCategory = parsed.data.category;
        }
      }

      if (parsed.data.description !== undefined) {
        if (parsed.data.description === "") {
          unsetPayload.organizerDescription = "";
        } else {
          setPayload.organizerDescription = parsed.data.description;
        }
      }

      if (parsed.data.contactEmail !== undefined) {
        if (parsed.data.contactEmail === "") {
          unsetPayload.organizerContactEmail = "";
        } else {
          setPayload.organizerContactEmail = parsed.data.contactEmail;
        }
      }

      if (parsed.data.contactNumber !== undefined) {
        if (parsed.data.contactNumber === "") {
          unsetPayload.organizerContactNumber = "";
        } else {
          setPayload.organizerContactNumber = parsed.data.contactNumber;
        }
      }

      if (parsed.data.discordWebhookUrl !== undefined) {
        if (parsed.data.discordWebhookUrl === "") {
          unsetPayload.discordWebhookUrl = "";
        } else {
          setPayload.discordWebhookUrl = parsed.data.discordWebhookUrl;
        }
      }

      if (
        Object.keys(setPayload).length === 0 &&
        Object.keys(unsetPayload).length === 0
      ) {
        return res.status(400).json({ error: { message: "No fields to update" } });
      }

      const db = getDb();
      const users = db.collection<OrganizerProfileDoc>(collections.users);

      const updateDoc: {
        $set?: Partial<OrganizerProfileDoc>;
        $unset?: Record<string, "">;
      } = {};

      if (Object.keys(setPayload).length > 0) {
        updateDoc.$set = setPayload;
      }

      if (Object.keys(unsetPayload).length > 0) {
        updateDoc.$unset = unsetPayload;
      }

      await users.updateOne({ _id: organizerId, role: "organizer" }, updateDoc);

      const updated = await users.findOne({ _id: organizerId, role: "organizer" });
      if (!updated) {
        return res.status(404).json({ error: { message: "Organizer not found" } });
      }

      return res.json({ profile: toOrganizerSelfProfile(updated) });
    } catch (err) {
      return next(err);
    }
  },
);

// organizer creates a password reset request for admin review
organizersRouter.post(
  "/me/password-reset-requests",
  requireAuth,
  requireRole("organizer"),
  async (req, res, next) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const organizerId = parseObjectId(authUser.id);
      if (!organizerId) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const parsed = organizerPasswordResetRequestCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: { message: "Invalid request", details: parsed.error.flatten() },
        });
      }

      const db = getDb();
      const requests = db.collection<OrganizerPasswordResetRequestDoc>(
        collections.organizerPasswordResetRequests,
      );

      const pending = await requests.findOne({
        organizerId,
        status: "pending",
      });

      if (pending) {
        return res.status(409).json({
          error: { message: "A pending password reset request already exists" },
        });
      }

      const now = new Date();
      const request: OrganizerPasswordResetRequestDoc = {
        _id: new ObjectId(),
        organizerId,
        reason: parsed.data.reason,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };

      await requests.insertOne(request);

      return res.status(201).json({
        request: toOrganizerPasswordResetRequestResponse(request),
      });
    } catch (err) {
      return next(err);
    }
  },
);

// organizer reads own reset request history
organizersRouter.get(
  "/me/password-reset-requests",
  requireAuth,
  requireRole("organizer"),
  async (req, res, next) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const organizerId = parseObjectId(authUser.id);
      if (!organizerId) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const db = getDb();
      const requests = db.collection<OrganizerPasswordResetRequestDoc>(
        collections.organizerPasswordResetRequests,
      );

      const history = await requests
        .find({ organizerId })
        .sort({ createdAt: -1 })
        .limit(20)
        .toArray();

      return res.json({
        requests: history.map(toOrganizerPasswordResetRequestResponse),
      });
    } catch (err) {
      return next(err);
    }
  },
);
