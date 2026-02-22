import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import { requireAuth, requireRole } from "../middleware/auth";
import type { RegistrationDoc } from "../db/models";
import { toCsvString } from "../utils/csv";

export const eventsRouter = Router();

const eventTypes = ["NORMAL", "MERCH"] as const;
const persistedEventStatuses = [
  "DRAFT",
  "PUBLISHED",
  "CLOSED",
  "COMPLETED",
] as const;

const publicQueryStatuses = [
  "PUBLISHED",
  "CLOSED",
  "COMPLETED",
  "ONGOING",
] as const;
const publicPersistedStatuses = ["PUBLISHED", "CLOSED", "COMPLETED"] as const;

type EventType = (typeof eventTypes)[number];
type PersistedEventStatus = (typeof persistedEventStatuses)[number];
type DisplayEventStatus = PersistedEventStatus | "ONGOING";
type PublicQueryStatus = (typeof publicQueryStatuses)[number];

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

type NormalFormFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "file";

type NormalFormField = {
  key: string;
  label: string;
  type: NormalFormFieldType;
  required: boolean;
  options?: string[] | undefined;
  order: number;
}; // for typescript type-checks

type MerchVariant = {
  sku: string;
  label: string;
  stock: number;
  priceDelta?: number | undefined;
};

type ParticipationStatus = "pending" | "confirmed" | "cancelled" | "rejected";

type StoredNormalResponse = {
  key: string;
  label: string;
  type: NormalFormFieldType;
  value?: string | number | string[] | undefined;
  file?:
    | {
        filename: string;
        originalName: string;
        mimeType: string;
        size: number;
      }
    | undefined;
};

type MerchPurchaseSnapshot = {
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
  updatedAt?: Date;
  eventType?: EventType;
  ticketId?: string;
  normalResponses?: StoredNormalResponse[] | undefined;
  merchPurchase?: MerchPurchaseSnapshot | undefined;
};

type ParticipantUserDoc = {
  _id: ObjectId;
  role: "participant";
  name: string;
  email: string;
  participantType?: string;
  collegeOrOrganization?: string;
  contactNumber?: string;
};

type EventAnalyticsSummary = {
  totalParticipations: number;
  activeParticipations: number;
  confirmedCount: number;
  pendingCount: number;
  cancelledCount: number;
  rejectedCount: number;
  normalCount: number;
  merchCount: number;
  registrations24h: number;
  estimatedRevenue: number;
};

const normalFormFieldTypes = [
  "text",
  "textarea",
  "number",
  "select",
  "checkbox",
  "file",
] as const; // for zod runtime checks

const normalFormFieldSchema = z
  .object({
    key: z.string().trim().min(1).max(80),
    label: z.string().trim().min(1).max(120),
    type: z.enum(normalFormFieldTypes),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(80)).max(40).optional(),
    order: z.number().int().min(0),
  })
  .superRefine((field, ctx) => {
    const needsOptions = field.type === "select" || field.type === "checkbox";
    if (needsOptions && (!field.options || field.options.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "options are required for select/checkbox fields",
      });
    }

    if (!needsOptions && field.options && field.options.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["options"],
        message: "options are only allowed for select/checkbox fields",
      });
    }
  });

const normalFormSchema = z.object({
  fields: z.array(normalFormFieldSchema).max(60).default([]),
  isFormLocked: z.boolean().default(false),
});

const merchVariantSchema = z.object({
  sku: z.string().trim().min(1).max(60),
  label: z.string().trim().min(1).max(120),
  stock: z.number().int().min(0),
  priceDelta: z.number().optional(),
});

const merchConfigSchema = z.object({
  variants: z.array(merchVariantSchema).min(1).max(200),
  perParticipantLimit: z.number().int().min(1).max(1000).default(1),
});

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
    normalForm: normalFormSchema.optional(),
    merchConfig: merchConfigSchema.optional(),
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

    if (data.type === "NORMAL" && data.merchConfig) {
      ctx.addIssue({
        code: "custom",
        path: ["merchConfig"],
        message: "merchConfig is not allowed for NORMAL events",
      });
    }

    if (data.type === "MERCH" && data.normalForm) {
      ctx.addIssue({
        code: "custom",
        path: ["normalForm"],
        message: "normalForm is not allowed for MERCH events",
      });
    }

    if (data.type === "MERCH" && !data.merchConfig) {
      ctx.addIssue({
        code: "custom",
        path: ["merchConfig"],
        message: "merchConfig is required for MERCH events",
      });
    }

    if (data.type === "NORMAL" && !data.normalForm) {
      ctx.addIssue({
        code: "custom",
        path: ["normalForm"],
        message: "normalForm is required for NORMAL events",
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
  normalForm: normalFormSchema.optional(),
  merchConfig: merchConfigSchema.optional(),
});

const updateEventStatusSchema = z.object({
  status: z.enum(persistedEventStatuses),
});

const publicEventsQuerySchema = z
  .object({
    q: z.string().trim().min(1).max(120).optional(),
    type: z.enum(eventTypes).optional(),
    eligibility: z.string().trim().min(1).max(160).optional(),
    status: z.enum(publicQueryStatuses).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.from && data.to && data.to < data.from) {
      ctx.addIssue({
        code: "custom",
        path: ["to"],
        message: "to must be greater than or equal to from",
      });
    }
  });

function parseObjectId(rawId: unknown): ObjectId | null {
  if (typeof rawId !== "string") return null;
  if (!ObjectId.isValid(rawId)) return null;
  return new ObjectId(rawId);
}

function getOrganizerObjectId(userId: string): ObjectId | null {
  return parseObjectId(userId);
}

function readQueryStringValue(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildPublicEventsFilter(
  query: z.infer<typeof publicEventsQuerySchema>,
) {
  const filter: Record<string, unknown> = {};

  // ongoing is derived later from published + time window
  if (query.status === "ONGOING") {
    filter.status = "PUBLISHED";
  } else if (query.status) {
    filter.status = query.status;
  } else {
    filter.status = { $in: publicPersistedStatuses };
  }

  if (query.type) {
    filter.type = query.type;
  }

  if (query.eligibility) {
    filter.eligibility = new RegExp(`^${escapeRegex(query.eligibility)}$`, "i");
  }

  if (query.q) {
    const qRegex = new RegExp(escapeRegex(query.q), "i");
    filter.$or = [{ name: qRegex }, { description: qRegex }, { tags: qRegex }];
  }

  if (query.from || query.to) {
    const startDateFilter: Record<string, Date> = {};
    if (query.from) startDateFilter.$gte = query.from;
    if (query.to) startDateFilter.$lte = query.to;
    filter.startDate = startDateFilter;
  }

  return filter;
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

function sanitizeNormalFormByType(
  eventType: EventType,
  normalForm: StoredEventDoc["normalForm"],
): StoredEventDoc["normalForm"] {
  if (eventType !== "NORMAL") return undefined;
  return normalForm;
}

function sanitizeMerchConfigByType(
  eventType: EventType,
  merchConfig: StoredEventDoc["merchConfig"],
): StoredEventDoc["merchConfig"] {
  if (eventType !== "MERCH") return undefined;
  return merchConfig;
}

function countTotalStock(variants: MerchVariant[]): number {
  return variants.reduce((sum, variant) => sum + variant.stock, 0);
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
    normalForm: sanitizeNormalFormByType(event.type, event.normalForm),
    merchConfig: sanitizeMerchConfigByType(event.type, event.merchConfig),
  };
}

function canRegisterNow(event: StoredEventDoc, now: Date): boolean {
  if (event.status !== "PUBLISHED") return false;
  if (now > event.regDeadline) return false;
  if (now > event.endDate) return false;
  return true;
}

function toPublicEventResponse(event: StoredEventDoc) {
  return {
    ...toEventResponse(event),
    canRegister: canRegisterNow(event, new Date()),
  };
}

function isActiveParticipationStatus(status: ParticipationStatus): boolean {
  return status !== "cancelled" && status !== "rejected";
}

function resolveParticipationEventType(
  participation: StoredParticipationDoc,
  fallbackType: EventType,
): EventType {
  return participation.eventType ?? fallbackType;
}

function formatNormalResponseValue(response: StoredNormalResponse): string {
  if (response.file) {
    return `[file] ${response.file.originalName}`;
  }

  if (Array.isArray(response.value)) {
    return response.value.join(" | ");
  }

  if (response.value === undefined || response.value === null) {
    return "";
  }

  return String(response.value);
}

function buildEventAnalyticsSummary(
  event: StoredEventDoc,
  participations: StoredParticipationDoc[],
  now: Date,
): EventAnalyticsSummary {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const summary: EventAnalyticsSummary = {
    totalParticipations: participations.length,
    activeParticipations: 0,
    confirmedCount: 0,
    pendingCount: 0,
    cancelledCount: 0,
    rejectedCount: 0,
    normalCount: 0,
    merchCount: 0,
    registrations24h: 0,
    estimatedRevenue: 0,
  };

  for (const participation of participations) {
    const eventType = resolveParticipationEventType(participation, event.type);
    if (eventType === "MERCH") {
      summary.merchCount += 1;
    } else {
      summary.normalCount += 1;
    }

    if (participation.status === "confirmed") {
      summary.confirmedCount += 1;
      if (eventType === "MERCH") {
        summary.estimatedRevenue += participation.merchPurchase?.totalAmount ?? 0;
      } else {
        summary.estimatedRevenue += event.regFee;
      }
    } else if (participation.status === "pending") {
      summary.pendingCount += 1;
    } else if (participation.status === "cancelled") {
      summary.cancelledCount += 1;
    } else if (participation.status === "rejected") {
      summary.rejectedCount += 1;
    }

    if (isActiveParticipationStatus(participation.status)) {
      summary.activeParticipations += 1;
      if (participation.createdAt >= since) {
        summary.registrations24h += 1;
      }
    }
  }

  return summary;
}

async function loadOrganizerEventParticipants(params: {
  eventId: ObjectId;
  organizerId: ObjectId;
}) {
  const db = getDb();
  const events = db.collection<StoredEventDoc>(collections.events);
  const participations = db.collection<StoredParticipationDoc>(
    collections.registrations,
  );
  const users = db.collection<ParticipantUserDoc>(collections.users);

  const event = await events.findOne({
    _id: params.eventId,
    organizerId: params.organizerId,
  });
  if (!event) return null;

  const foundParticipations = await participations
    .find({ eventId: params.eventId })
    .sort({ createdAt: -1 })
    .toArray();

  const participantIds = [
    ...new Set(foundParticipations.map((entry) => entry.userId.toString())),
  ].map((id) => new ObjectId(id));

  const participants =
    participantIds.length > 0
      ? await users
          .find({
            _id: { $in: participantIds },
            role: "participant",
          })
          .toArray()
      : [];

  const participantsById = new Map(
    participants.map((participant) => [participant._id.toString(), participant]),
  );

  return {
    event,
    participations: foundParticipations,
    participantsById,
  };
}

// organizer creates a new event draft with validated form/merch config
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
        normalForm:
          parsed.data.type === "NORMAL"
            ? {
                fields: parsed.data.normalForm?.fields ?? [],
                isFormLocked: parsed.data.normalForm?.isFormLocked ?? false,
              }
            : undefined,
        merchConfig:
          parsed.data.type === "MERCH" && parsed.data.merchConfig
            ? {
                variants: parsed.data.merchConfig.variants,
                perParticipantLimit:
                  parsed.data.merchConfig.perParticipantLimit,
                totalStock: countTotalStock(parsed.data.merchConfig.variants),
              }
            : undefined,
      };

      await events.insertOne(event);

      return res.status(201).json({ event: toEventResponse(event) });
    } catch (err) {
      return next(err);
    }
  },
);

// organizer lists own events, newest first
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

// organizer dashboard analytics summary across own events
eventsRouter.get(
  "/organizer/analytics/summary",
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
      const participations = db.collection<StoredParticipationDoc>(
        collections.registrations,
      );

      const organizerEvents = await events
        .find({ organizerId })
        .sort({ createdAt: -1 })
        .toArray();
      if (organizerEvents.length === 0) {
        return res.json({
          summary: {
            totalEvents: 0,
            draftEvents: 0,
            publishedEvents: 0,
            closedEvents: 0,
            completedEvents: 0,
            totalParticipations: 0,
            activeParticipations: 0,
            confirmedCount: 0,
            pendingCount: 0,
            cancelledCount: 0,
            rejectedCount: 0,
            registrations24h: 0,
            estimatedRevenue: 0,
          },
          topEvents: [],
        });
      }

      const eventIds = organizerEvents.map((event) => event._id);
      const allParticipations = await participations
        .find({ eventId: { $in: eventIds } })
        .toArray();

      const participationsByEventId = new Map<string, StoredParticipationDoc[]>();
      for (const participation of allParticipations) {
        const eventId = participation.eventId.toString();
        const list = participationsByEventId.get(eventId);
        if (list) {
          list.push(participation);
        } else {
          participationsByEventId.set(eventId, [participation]);
        }
      }

      const now = new Date();
      const eventSummaries = organizerEvents.map((event) => {
        const eventParticipations =
          participationsByEventId.get(event._id.toString()) ?? [];
        const analytics = buildEventAnalyticsSummary(event, eventParticipations, now);
        return {
          event,
          analytics,
        };
      });

      const summary = {
        totalEvents: organizerEvents.length,
        draftEvents: organizerEvents.filter((event) => event.status === "DRAFT")
          .length,
        publishedEvents: organizerEvents.filter(
          (event) => event.status === "PUBLISHED",
        ).length,
        closedEvents: organizerEvents.filter((event) => event.status === "CLOSED")
          .length,
        completedEvents: organizerEvents.filter(
          (event) => event.status === "COMPLETED",
        ).length,
        totalParticipations: eventSummaries.reduce(
          (sum, item) => sum + item.analytics.totalParticipations,
          0,
        ),
        activeParticipations: eventSummaries.reduce(
          (sum, item) => sum + item.analytics.activeParticipations,
          0,
        ),
        confirmedCount: eventSummaries.reduce(
          (sum, item) => sum + item.analytics.confirmedCount,
          0,
        ),
        pendingCount: eventSummaries.reduce(
          (sum, item) => sum + item.analytics.pendingCount,
          0,
        ),
        cancelledCount: eventSummaries.reduce(
          (sum, item) => sum + item.analytics.cancelledCount,
          0,
        ),
        rejectedCount: eventSummaries.reduce(
          (sum, item) => sum + item.analytics.rejectedCount,
          0,
        ),
        registrations24h: eventSummaries.reduce(
          (sum, item) => sum + item.analytics.registrations24h,
          0,
        ),
        estimatedRevenue: eventSummaries.reduce(
          (sum, item) => sum + item.analytics.estimatedRevenue,
          0,
        ),
      };

      const topEvents = eventSummaries
        .sort((a, b) => {
          const byActive =
            b.analytics.activeParticipations - a.analytics.activeParticipations;
          if (byActive !== 0) return byActive;

          const byRecent24h =
            b.analytics.registrations24h - a.analytics.registrations24h;
          if (byRecent24h !== 0) return byRecent24h;

          return b.event.createdAt.getTime() - a.event.createdAt.getTime();
        })
        .slice(0, 5)
        .map((item) => ({
          id: item.event._id.toString(),
          name: item.event.name,
          type: item.event.type,
          status: item.event.status,
          startDate: item.event.startDate,
          endDate: item.event.endDate,
          totalParticipations: item.analytics.totalParticipations,
          activeParticipations: item.analytics.activeParticipations,
          registrations24h: item.analytics.registrations24h,
          estimatedRevenue: item.analytics.estimatedRevenue,
        }));

      return res.json({ summary, topEvents });
    } catch (err) {
      return next(err);
    }
  },
);

// organizer lists one event's participants and analytics
eventsRouter.get(
  "/organizer/:eventId/participants",
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

      const loaded = await loadOrganizerEventParticipants({ eventId, organizerId });
      if (!loaded) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      const now = new Date();
      const analytics = buildEventAnalyticsSummary(
        loaded.event,
        loaded.participations,
        now,
      );

      const participants = loaded.participations.map((participation) => {
        const participant = loaded.participantsById.get(
          participation.userId.toString(),
        );

        return {
          id: participation._id.toString(),
          userId: participation.userId.toString(),
          status: participation.status,
          eventType: resolveParticipationEventType(participation, loaded.event.type),
          ticketId: participation.ticketId ?? null,
          createdAt: participation.createdAt,
          updatedAt: participation.updatedAt ?? participation.createdAt,
          participant: participant
            ? {
                id: participant._id.toString(),
                name: participant.name,
                email: participant.email,
                participantType: participant.participantType ?? null,
                collegeOrOrganization:
                  participant.collegeOrOrganization ?? null,
                contactNumber: participant.contactNumber ?? null,
              }
            : {
                id: participation.userId.toString(),
                name: "Unknown participant",
                email: null,
                participantType: null,
                collegeOrOrganization: null,
                contactNumber: null,
              },
          normalResponses: (participation.normalResponses ?? []).map((response) => ({
            key: response.key,
            label: response.label,
            type: response.type,
            value: response.value,
            file: response.file
              ? {
                  ...response.file,
                  downloadUrl: `/api/uploads/${response.file.filename}`,
                }
              : undefined,
          })),
          merchPurchase: participation.merchPurchase ?? null,
        };
      });

      return res.json({
        event: toEventResponse(loaded.event),
        analytics,
        participants,
      });
    } catch (err) {
      return next(err);
    }
  },
);

// organizer exports one event's participants as csv
eventsRouter.get(
  "/organizer/:eventId/participants.csv",
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

      const loaded = await loadOrganizerEventParticipants({ eventId, organizerId });
      if (!loaded) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      const rows = loaded.participations.map((participation) => {
        const participant = loaded.participantsById.get(
          participation.userId.toString(),
        );

        return {
          participationId: participation._id.toString(),
          participantName: participant?.name ?? "Unknown participant",
          participantEmail: participant?.email ?? "",
          participantType: participant?.participantType ?? "",
          collegeOrOrganization: participant?.collegeOrOrganization ?? "",
          contactNumber: participant?.contactNumber ?? "",
          status: participation.status,
          eventType: resolveParticipationEventType(participation, loaded.event.type),
          ticketId: participation.ticketId ?? "",
          joinedAt: participation.createdAt,
          updatedAt: participation.updatedAt ?? participation.createdAt,
          merchSku: participation.merchPurchase?.sku ?? "",
          merchLabel: participation.merchPurchase?.label ?? "",
          merchQuantity: participation.merchPurchase?.quantity ?? "",
          merchUnitPrice: participation.merchPurchase?.unitPrice ?? "",
          merchTotalAmount: participation.merchPurchase?.totalAmount ?? "",
          normalResponses: (participation.normalResponses ?? [])
            .map((response) => `${response.label}: ${formatNormalResponseValue(response)}`)
            .join(" || "),
        };
      });

      const csv = toCsvString(rows, [
        { header: "participationId", value: (row) => row.participationId },
        { header: "participantName", value: (row) => row.participantName },
        { header: "participantEmail", value: (row) => row.participantEmail },
        { header: "participantType", value: (row) => row.participantType },
        {
          header: "collegeOrOrganization",
          value: (row) => row.collegeOrOrganization,
        },
        { header: "contactNumber", value: (row) => row.contactNumber },
        { header: "status", value: (row) => row.status },
        { header: "eventType", value: (row) => row.eventType },
        { header: "ticketId", value: (row) => row.ticketId },
        { header: "joinedAt", value: (row) => row.joinedAt },
        { header: "updatedAt", value: (row) => row.updatedAt },
        { header: "merchSku", value: (row) => row.merchSku },
        { header: "merchLabel", value: (row) => row.merchLabel },
        { header: "merchQuantity", value: (row) => row.merchQuantity },
        { header: "merchUnitPrice", value: (row) => row.merchUnitPrice },
        { header: "merchTotalAmount", value: (row) => row.merchTotalAmount },
        { header: "normalResponses", value: (row) => row.normalResponses },
      ]);

      const safeEventName = loaded.event.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 60);
      const filename = `${safeEventName || "event"}-participants.csv`;

      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename=\"${filename}\"`);
      return res.send(csv);
    } catch (err) {
      return next(err);
    }
  },
);

// organizer gets one own event by id for edit/view
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
      const events = db.collection<StoredEventDoc>(collections.events);
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

// organizer updates selected fields on own event, while preserving date/type rules
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

      const nextType = parsed.data.type ?? existing.type;
      const nextNormalForm =
        parsed.data.normalForm !== undefined
          ? parsed.data.normalForm
          : existing.normalForm;
      const nextMerchConfig =
        parsed.data.merchConfig !== undefined
          ? parsed.data.merchConfig
          : existing.merchConfig
            ? {
                variants: existing.merchConfig.variants,
                perParticipantLimit: existing.merchConfig.perParticipantLimit,
              }
            : undefined;

      if (nextType === "NORMAL") {
        if (!nextNormalForm) {
          return res.status(400).json({
            error: { message: "normalForm is required for NORMAL events" },
          });
        }

        if (nextMerchConfig) {
          return res.status(400).json({
            error: { message: "merchConfig is not allowed for NORMAL events" },
          });
        }
      }

      if (nextType === "MERCH") {
        if (!nextMerchConfig) {
          return res.status(400).json({
            error: { message: "merchConfig is required for MERCH events" },
          });
        }

        if (nextNormalForm) {
          return res.status(400).json({
            error: { message: "normalForm is not allowed for MERCH events" },
          });
        }
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

      if (parsed.data.normalForm !== undefined) {
        updatePayload.normalForm =
          nextType === "NORMAL"
            ? {
                fields: parsed.data.normalForm.fields,
                isFormLocked: parsed.data.normalForm.isFormLocked,
              }
            : undefined;
      }

      if (parsed.data.merchConfig !== undefined) {
        updatePayload.merchConfig =
          nextType === "MERCH"
            ? {
                variants: parsed.data.merchConfig.variants,
                perParticipantLimit:
                  parsed.data.merchConfig.perParticipantLimit,
                totalStock: countTotalStock(parsed.data.merchConfig.variants),
              }
            : undefined;
      }

      if (parsed.data.type !== undefined) {
        if (parsed.data.type === "NORMAL") {
          updatePayload.merchConfig = undefined;
          updatePayload.normalForm = {
            fields: nextNormalForm?.fields ?? [],
            isFormLocked: nextNormalForm?.isFormLocked ?? false,
          };
        }

        if (parsed.data.type === "MERCH") {
          updatePayload.normalForm = undefined;
          const merchSource = nextMerchConfig;
          updatePayload.merchConfig = merchSource
            ? {
                variants: merchSource.variants,
                perParticipantLimit: merchSource.perParticipantLimit,
                totalStock: countTotalStock(merchSource.variants),
              }
            : undefined;
        }
      }

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

// organizer changes lifecycle status for one own event
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

// organizer deletes one own event by id
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

// public event listing with filters (search, type, eligibility, status, date range)
eventsRouter.get("/", async (req, res, next) => {
  try {
    const parsed = publicEventsQuerySchema.safeParse({
      q: readQueryStringValue(req.query.q),
      type: readQueryStringValue(req.query.type),
      eligibility: readQueryStringValue(req.query.eligibility),
      status: readQueryStringValue(req.query.status),
      from: readQueryStringValue(req.query.from),
      to: readQueryStringValue(req.query.to),
    });

    if (!parsed.success) {
      return res.status(400).json({
        error: { message: "Invalid query", details: parsed.error.flatten() },
      });
    }

    const db = getDb();
    const events = db.collection<StoredEventDoc>(collections.events);
    const filter = buildPublicEventsFilter(parsed.data);
    const foundEvents = await events
      .find(filter)
      .sort({ startDate: 1, createdAt: -1 })
      .toArray();

    const filteredEvents =
      parsed.data.status === "ONGOING"
        ? foundEvents.filter(
            (event) => deriveDisplayStatus(event, new Date()) === "ONGOING",
          )
        : foundEvents;

    return res.json({ events: filteredEvents.map(toPublicEventResponse) });
  } catch (err) {
    return next(err);
  }
});

// top 5 public trending events by non-cancelled registrations in last 24h
eventsRouter.get("/trending", async (_req, res, next) => {
  try {
    const db = getDb();
    const registrations = db.collection<RegistrationDoc>(
      collections.registrations,
    );
    const events = db.collection<StoredEventDoc>(collections.events);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const topRegistrations = await registrations
      .aggregate<{ _id: ObjectId; registrations24h: number }>([
        {
          $match: {
            createdAt: { $gte: since },
            status: { $nin: ["cancelled", "rejected"] },
          },
        },
        {
          $group: {
            _id: "$eventId",
            registrations24h: { $sum: 1 },
          },
        },
        { $sort: { registrations24h: -1 } },
      ])
      .toArray();

    if (topRegistrations.length === 0) {
      return res.json({ events: [] });
    }

    const eventIds = topRegistrations.map((row) => row._id);
    const topEvents = await events
      .find({
        _id: { $in: eventIds },
        status: { $in: publicPersistedStatuses },
      })
      .toArray();

    const eventsById = new Map(
      topEvents.map((event) => [event._id.toString(), event]),
    );

    const ordered = topRegistrations
      .map((row) => {
        const event = eventsById.get(row._id.toString());
        if (!event) return null;

        return {
          ...toPublicEventResponse(event),
          registrations24h: row.registrations24h,
        };
      })
      .filter((event): event is NonNullable<typeof event> => event !== null)
      .slice(0, 5);

    return res.json({ events: ordered });
  } catch (err) {
    return next(err);
  }
});

// public event details by id (only public statuses)
eventsRouter.get("/:eventId", async (req, res, next) => {
  try {
    const eventId = parseObjectId(req.params.eventId);
    if (!eventId) {
      return res.status(400).json({ error: { message: "Invalid event id" } });
    }

    const db = getDb();
    const events = db.collection<StoredEventDoc>(collections.events);
    const event = await events.findOne({
      _id: eventId,
      status: { $in: publicPersistedStatuses },
    });

    if (!event) {
      return res.status(404).json({ error: { message: "Event not found" } });
    }

    return res.json({ event: toPublicEventResponse(event) });
  } catch (err) {
    return next(err);
  }
});
