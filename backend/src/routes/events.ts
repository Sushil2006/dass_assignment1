import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import { requireAuth, requireRole } from "../middleware/auth";

export const eventsRouter = Router();

const eventTypes = ["NORMAL", "MERCH"] as const;
const persistedEventStatuses = [
  "DRAFT",
  "PUBLISHED",
  "CLOSED",
  "COMPLETED",
] as const;

type EventType = (typeof eventTypes)[number];
type PersistedEventStatus = (typeof persistedEventStatuses)[number];
type DisplayEventStatus = PersistedEventStatus | "ONGOING";

type StoredEventDoc = {
  _id: ObjectId;
  name: string;
  description: string;
  type: EventType;
  tags: string[];
  eligibility: string;
  regFee: number;
  regDeadline: Date;
  regLimit: number;
  startDate: Date;
  endDate: Date;
  organizerId: ObjectId;
  status: PersistedEventStatus;
  createdAt: Date;
  updatedAt?: Date;
};

const createEventSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    description: z.string().trim().min(1).max(5000),
    type: z.enum(eventTypes),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    eligibility: z.string().trim().min(1).max(160).default("all"),
    regFee: z.number().min(0).default(0),
    regDeadline: z.coerce.date(),
    regLimit: z.number().int().min(1).default(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .superRefine((data, ctx) => {
    if (data.endDate <= data.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "endDate must be after startDate",
      });
    }
    if (data.regDeadline > data.startDate) {
      ctx.addIssue({
        code: "custom",
        path: ["regDeadline"],
        message: "regDeadline must be before or equal to startDate",
      });
    }
  });

const updateEventSchema = z.object({
  name: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(5000).optional(),
  type: z.enum(eventTypes).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  eligibility: z.string().trim().min(1).max(160).optional(),
  regFee: z.number().min(0).optional(),
  regDeadline: z.coerce.date().optional(),
  regLimit: z.number().int().min(1).optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
});

const updateEventStatusSchema = z.object({
  status: z.enum(persistedEventStatuses),
});

function parseObjectId(rawId: unknown): ObjectId | null {
  if (typeof rawId !== "string") return null;
  if (!ObjectId.isValid(rawId)) return null;
  return new ObjectId(rawId);
}

function getOrganizerObjectId(userId: string): ObjectId | null {
  return parseObjectId(userId);
}

function deriveDisplayStatus(
  event: StoredEventDoc,
  now: Date,
): DisplayEventStatus {
  if (
    event.status === "PUBLISHED" &&
    now >= event.startDate &&
    now <= event.endDate
  ) {
    return "ONGOING";
  }

  return event.status;
}

function toEventResponse(event: StoredEventDoc) {
  return {
    id: event._id.toString(),
    name: event.name,
    description: event.description,
    type: event.type,
    tags: event.tags,
    eligibility: event.eligibility,
    regFee: event.regFee,
    regDeadline: event.regDeadline,
    regLimit: event.regLimit,
    startDate: event.startDate,
    endDate: event.endDate,
    organizerId: event.organizerId.toString(),
    status: event.status,
    displayStatus: deriveDisplayStatus(event, new Date()),
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  };
}

eventsRouter.post(
  "/organizer",
  requireAuth,
  requireRole("organizer"),
  async (req, res, next) => {
    try {
      const parsed = createEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            message: "Invalid request",
            details: parsed.error.flatten(),
          },
        });
      }

      const authUser = req.user;
      if (!authUser) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const organizerId = getOrganizerObjectId(authUser.id);
      if (!organizerId) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const db = getDb();
      const events = db.collection<StoredEventDoc>(collections.events);
      const now = new Date();

      const event: StoredEventDoc = {
        _id: new ObjectId(),
        name: parsed.data.name,
        description: parsed.data.description,
        type: parsed.data.type,
        tags: parsed.data.tags,
        eligibility: parsed.data.eligibility,
        regFee: parsed.data.regFee,
        regDeadline: parsed.data.regDeadline,
        regLimit: parsed.data.regLimit,
        startDate: parsed.data.startDate,
        endDate: parsed.data.endDate,
        organizerId,
        status: "DRAFT",
        createdAt: now,
        updatedAt: now,
      };

      await events.insertOne(event);

      return res.status(201).json({ event: toEventResponse(event) });
    } catch (err) {
      return next(err);
    }
  },
);

eventsRouter.get(
  "/organizer",
  requireAuth,
  requireRole("organizer"),
  async (req, res, next) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const organizerId = getOrganizerObjectId(authUser.id);
      if (!organizerId) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const db = getDb();
      const events = db.collection<StoredEventDoc>(collections.events);
      const organizerEvents = await events
        .find({ organizerId })
        .sort({ createdAt: -1 })
        .toArray();

      return res.json({ events: organizerEvents.map(toEventResponse) });
    } catch (err) {
      return next(err);
    }
  },
);

eventsRouter.get(
  "/organizer/:eventId",
  requireAuth,
  requireRole("organizer"),
  async (req, res, next) => {
    try {
      const eventId = parseObjectId(req.params.eventId);
      if (!eventId) {
        return res.status(400).json({ error: { message: "Invalid event id" } });
      }

      const authUser = req.user;
      if (!authUser) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const organizerId = getOrganizerObjectId(authUser.id);
      if (!organizerId) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const db = getDb();
      const events = db.collection<StoredEventDoc>(collections.events); // give me the `events` collection, and assume its documents conform to the `StoredEventDoc` shape.
      const event = await events.findOne({ _id: eventId, organizerId });

      if (!event) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      return res.json({ event: toEventResponse(event) });
    } catch (err) {
      return next(err);
    }
  },
);

eventsRouter.patch(
  "/organizer/:eventId",
  requireAuth,
  requireRole("organizer"),
  async (req, res, next) => {
    try {
      const eventId = parseObjectId(req.params.eventId);
      if (!eventId) {
        return res.status(400).json({ error: { message: "Invalid event id" } });
      }

      const parsed = updateEventSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            message: "Invalid request",
            details: parsed.error.flatten(),
          },
        });
      }

      if (Object.keys(parsed.data).length === 0) {
        return res
          .status(400)
          .json({ error: { message: "No fields to update" } });
      }

      const authUser = req.user;
      if (!authUser) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const organizerId = getOrganizerObjectId(authUser.id);
      if (!organizerId) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const db = getDb();
      const events = db.collection<StoredEventDoc>(collections.events);
      const existing = await events.findOne({ _id: eventId, organizerId });

      if (!existing) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      const nextStartDate = parsed.data.startDate ?? existing.startDate;
      const nextEndDate = parsed.data.endDate ?? existing.endDate;
      if (nextEndDate <= nextStartDate) {
        return res
          .status(400)
          .json({ error: { message: "endDate must be after startDate" } });
      }

      const nextRegDeadline = parsed.data.regDeadline ?? existing.regDeadline;
      if (nextRegDeadline > nextStartDate) {
        return res.status(400).json({
          error: {
            message: "regDeadline must be before or equal to startDate",
          },
        });
      }

      const updatedAt = new Date();
      const updatePayload: Partial<StoredEventDoc> = { updatedAt };

      if (parsed.data.name !== undefined) updatePayload.name = parsed.data.name;
      if (parsed.data.description !== undefined) {
        updatePayload.description = parsed.data.description;
      }
      if (parsed.data.type !== undefined) updatePayload.type = parsed.data.type;
      if (parsed.data.tags !== undefined) updatePayload.tags = parsed.data.tags;
      if (parsed.data.eligibility !== undefined) {
        updatePayload.eligibility = parsed.data.eligibility;
      }
      if (parsed.data.regFee !== undefined)
        updatePayload.regFee = parsed.data.regFee;
      if (parsed.data.regDeadline !== undefined) {
        updatePayload.regDeadline = parsed.data.regDeadline;
      }
      if (parsed.data.regLimit !== undefined) {
        updatePayload.regLimit = parsed.data.regLimit;
      }
      if (parsed.data.startDate !== undefined) {
        updatePayload.startDate = parsed.data.startDate;
      }
      if (parsed.data.endDate !== undefined)
        updatePayload.endDate = parsed.data.endDate;

      await events.updateOne(
        { _id: eventId, organizerId },
        { $set: updatePayload },
      );

      const updatedEvent = {
        ...existing,
        ...updatePayload,
      } as StoredEventDoc;

      return res.json({ event: toEventResponse(updatedEvent) });
    } catch (err) {
      return next(err);
    }
  },
);

eventsRouter.patch(
  "/organizer/:eventId/status",
  requireAuth,
  requireRole("organizer"),
  async (req, res, next) => {
    try {
      const eventId = parseObjectId(req.params.eventId);
      if (!eventId) {
        return res.status(400).json({ error: { message: "Invalid event id" } });
      }

      const parsed = updateEventStatusSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: {
            message: "Invalid request",
            details: parsed.error.flatten(),
          },
        });
      }

      const authUser = req.user;
      if (!authUser) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const organizerId = getOrganizerObjectId(authUser.id);
      if (!organizerId) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const db = getDb();
      const events = db.collection<StoredEventDoc>(collections.events);
      const existing = await events.findOne({ _id: eventId, organizerId });

      if (!existing) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      if (
        existing.status === "COMPLETED" &&
        parsed.data.status !== "COMPLETED"
      ) {
        return res.status(400).json({
          error: { message: "Completed events cannot change status" },
        });
      }

      const updatedAt = new Date();
      await events.updateOne(
        { _id: eventId, organizerId },
        { $set: { status: parsed.data.status, updatedAt } },
      );

      const updatedEvent: StoredEventDoc = {
        ...existing,
        status: parsed.data.status,
        updatedAt,
      };

      return res.json({ event: toEventResponse(updatedEvent) });
    } catch (err) {
      return next(err);
    }
  },
);

eventsRouter.delete(
  "/organizer/:eventId",
  requireAuth,
  requireRole("organizer"),
  async (req, res, next) => {
    try {
      const eventId = parseObjectId(req.params.eventId);
      if (!eventId) {
        return res.status(400).json({ error: { message: "Invalid event id" } });
      }

      const authUser = req.user;
      if (!authUser) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const organizerId = getOrganizerObjectId(authUser.id);
      if (!organizerId) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const db = getDb();
      const events = db.collection<StoredEventDoc>(collections.events);
      const result = await events.deleteOne({ _id: eventId, organizerId });

      if (result.deletedCount === 0) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      return res.json({ ok: true });
    } catch (err) {
      return next(err);
    }
  },
);
