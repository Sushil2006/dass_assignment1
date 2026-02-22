import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import { requireAuth, requireRole } from "../middleware/auth";

export const participantsRouter = Router();

type EventType = "NORMAL" | "MERCH";
type PersistedEventStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "COMPLETED";
type DisplayEventStatus = PersistedEventStatus | "ONGOING";
type ParticipationStatus = "pending" | "confirmed" | "cancelled" | "rejected";

type NormalFormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "file";

type StoredNormalResponse = {
  key: string;
  label: string;
  type: NormalFormFieldType;
  value?: string | number | string[];
  file?: {
    filename: string;
    originalName: string;
    mimeType: string;
    size: number;
  };
};

type MerchPurchase = {
  sku: string;
  label: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};

type StoredParticipationDoc = {
  _id: ObjectId;
  eventId: ObjectId;
  userId: ObjectId;
  status: ParticipationStatus;
  createdAt: Date;
  updatedAt: Date;
  eventType: EventType;
  ticketId: string;
  normalResponses?: StoredNormalResponse[] | undefined;
  merchPurchase?: MerchPurchase | undefined;
};

type NormalFormField = {
  key: string;
  label: string;
  type: NormalFormFieldType;
  required: boolean;
  options?: string[] | undefined;
  order: number;
};

type MerchVariant = {
  sku: string;
  label: string;
  stock: number;
  priceDelta?: number | undefined;
};

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
  normalForm?:
    | {
        fields: NormalFormField[];
        isFormLocked: boolean;
      }
    | undefined;
  merchConfig?:
    | {
        variants: MerchVariant[];
        perParticipantLimit: number;
        totalStock: number;
      }
    | undefined;
};

const publicPersistedStatuses: PersistedEventStatus[] = [
  "PUBLISHED",
  "CLOSED",
  "COMPLETED",
];

function parseObjectId(rawId: unknown): ObjectId | null {
  if (typeof rawId !== "string") return null;
  if (!ObjectId.isValid(rawId)) return null;
  return new ObjectId(rawId);
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

function canRegisterNow(event: StoredEventDoc, now: Date): boolean {
  if (event.status !== "PUBLISHED") return false;
  if (now > event.regDeadline) return false;
  if (now > event.endDate) return false;
  return true;
}

function toParticipantEventResponse(event: StoredEventDoc) {
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
    canRegister: canRegisterNow(event, new Date()),
    normalForm: event.type === "NORMAL" ? event.normalForm : undefined,
    merchConfig: event.type === "MERCH" ? event.merchConfig : undefined,
  };
}

function toParticipationItemResponse(
  participation: StoredParticipationDoc,
  event: StoredEventDoc,
) {
  return {
    id: participation._id.toString(),
    eventId: participation.eventId.toString(),
    userId: participation.userId.toString(),
    status: participation.status,
    eventType: participation.eventType,
    ticketId: participation.ticketId,
    createdAt: participation.createdAt,
    updatedAt: participation.updatedAt,
    event: toParticipantEventResponse(event),
    normalResponses: participation.normalResponses,
    merchPurchase: participation.merchPurchase,
  };
}

// participant gets dashboard buckets for own participations and history tabs
participantsRouter.get(
  "/me/events",
  requireAuth,
  requireRole("participant"),
  async (req, res, next) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const participantId = parseObjectId(authUser.id);
      if (!participantId) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const db = getDb();
      const participations = db.collection<StoredParticipationDoc>(
        collections.registrations,
      );
      const events = db.collection<StoredEventDoc>(collections.events);

      const foundParticipations = await participations
        .find({ userId: participantId })
        .sort({ createdAt: -1 })
        .toArray();

      if (foundParticipations.length === 0) {
        return res.json({
          upcoming: [],
          normal: [],
          merchandise: [],
          completed: [],
          cancelledRejected: [],
        });
      }

      const eventIds = foundParticipations.map((entry) => entry.eventId);
      const foundEvents = await events.find({ _id: { $in: eventIds } }).toArray();
      const eventsById = new Map(
        foundEvents.map((event) => [event._id.toString(), event]),
      );

      const items = foundParticipations
        .map((entry) => {
          const event = eventsById.get(entry.eventId.toString());
          if (!event) return null;
          return toParticipationItemResponse(entry, event);
        })
        .filter(
          (
            item,
          ): item is NonNullable<typeof item> => item !== null,
        );

      const now = new Date();
      const upcoming: typeof items = [];
      const normal: typeof items = [];
      const merchandise: typeof items = [];
      const completed: typeof items = [];
      const cancelledRejected: typeof items = [];

      for (const item of items) {
        const isCancelledOrRejected =
          item.status === "cancelled" || item.status === "rejected";
        const isCompleted =
          !isCancelledOrRejected &&
          (item.event.status === "COMPLETED" || new Date(item.event.endDate) < now);
        const isUpcoming =
          !isCancelledOrRejected &&
          !isCompleted &&
          new Date(item.event.endDate) >= now;

        if (isCancelledOrRejected) {
          cancelledRejected.push(item);
          continue;
        }

        if (isCompleted) {
          completed.push(item);
          continue;
        }

        if (isUpcoming) {
          upcoming.push(item);
        }

        if (item.eventType === "NORMAL") {
          normal.push(item);
        } else {
          merchandise.push(item);
        }
      }

      return res.json({
        upcoming,
        normal,
        merchandise,
        completed,
        cancelledRejected,
      });
    } catch (err) {
      return next(err);
    }
  },
);

// participant gets event detail view with own latest participation state
participantsRouter.get(
  "/me/events/:eventId",
  requireAuth,
  requireRole("participant"),
  async (req, res, next) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const participantId = parseObjectId(authUser.id);
      if (!participantId) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const eventId = parseObjectId(req.params.eventId);
      if (!eventId) {
        return res.status(400).json({ error: { message: "Invalid event id" } });
      }

      const db = getDb();
      const events = db.collection<StoredEventDoc>(collections.events);
      const participations = db.collection<StoredParticipationDoc>(
        collections.registrations,
      );

      const event = await events.findOne({ _id: eventId });
      if (!event) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      const latestParticipation = await participations.findOne(
        { userId: participantId, eventId },
        { sort: { createdAt: -1 } },
      );

      if (!latestParticipation && !publicPersistedStatuses.includes(event.status)) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      return res.json({
        event: toParticipantEventResponse(event),
        myParticipation: latestParticipation
          ? toParticipationItemResponse(latestParticipation, event)
          : null,
      });
    } catch (err) {
      return next(err);
    }
  },
);
