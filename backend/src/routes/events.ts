import { type Request, Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import { requireAuth, requireRole } from "../middleware/auth";
import type { RegistrationDoc } from "../db/models";
import { toCsvString } from "../utils/csv";
import { AUTH_COOKIE_NAME } from "../config/cookies";
import { verifyJwt } from "../utils/jwt";
import { postEventAnnouncementToDiscordSafe } from "../utils/discord";

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
  attendanceMarked: number;
  attendanceRate: number;
};

type OrganizerUserDoc = {
  _id: ObjectId;
  role: "organizer";
  name: string;
  isDisabled?: boolean;
  discordWebhookUrl?: string;
};

type ParticipantPreferenceDoc = {
  _id: ObjectId;
  role: "participant";
  interests?: string[];
  followedOrganizerIds?: ObjectId[];
};

type StoredPaymentDoc = {
  _id: ObjectId;
  registrationId: ObjectId;
  method: "upi" | "bank_transfer" | "cash" | "card" | "other";
  amount: number;
  proofUrl?: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Date;
};

type StoredAttendanceDoc = {
  _id: ObjectId;
  eventId: ObjectId;
  participationId: ObjectId;
  userId: ObjectId;
  markedAt: Date;
};

type ParticipantViewerContext = {
  id: ObjectId;
  interests: string[];
  followedOrganizerIds: string[];
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
    organizer: z.string().trim().min(1).max(120).optional(),
    type: z.enum(eventTypes).optional(),
    eligibility: z.string().trim().min(1).max(160).optional(),
    status: z.enum(publicQueryStatuses).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    followedOnly: z.boolean().optional(),
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

function readQueryBooleanValue(value: unknown): boolean | undefined {
  const raw = readQueryStringValue(value);
  if (!raw) return undefined;

  const normalized = raw.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") return true;
  if (normalized === "false" || normalized === "0") return false;
  return undefined;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp = Array.from({ length: rows }, () => new Array<number>(cols).fill(0));

  for (let i = 0; i < rows; i += 1) dp[i]![0] = i;
  for (let j = 0; j < cols; j += 1) dp[0]![j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1,
        dp[i]![j - 1]! + 1,
        dp[i - 1]![j - 1]! + cost,
      );
    }
  }

  return dp[rows - 1]![cols - 1]!;
}

function tokenMatchesTextFuzzy(token: string, text: string): boolean {
  if (!token) return true;
  if (!text) return false;
  if (text.includes(token)) return true;

  const words = text.split(" ");
  for (const word of words) {
    if (!word) continue;
    if (word.includes(token)) return true;

    const distance = levenshteinDistance(token, word);
    if (distance <= 1) return true;
  }

  return false;
}

function matchesSearchQueryFuzzy(query: string, haystacks: string[]): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return true;

  const tokens = normalizedQuery.split(" ").filter((token) => token.length > 0);
  if (tokens.length === 0) return true;

  const normalizedHaystacks = haystacks.map(normalizeSearchText);
  return tokens.every((token) =>
    normalizedHaystacks.some((text) => tokenMatchesTextFuzzy(token, text)),
  );
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

function validateOrganizerStatusTransition(
  event: StoredEventDoc,
  nextStatus: PersistedEventStatus,
  now: Date,
): string | null {
  if (event.status === nextStatus) return null;

  if (event.status === "COMPLETED") {
    return "Completed events cannot change status";
  }

  if (event.status === "DRAFT") {
    if (nextStatus !== "PUBLISHED") {
      return "Draft events can only be moved to PUBLISHED";
    }
    return null;
  }

  if (event.status === "PUBLISHED") {
    if (nextStatus === "CLOSED") return null;

    if (nextStatus === "COMPLETED") {
      if (deriveDisplayStatus(event, now) === "ONGOING") return null;
      return "Only ongoing events can be marked completed";
    }

    return "Published events can only be moved to CLOSED";
  }

  if (event.status === "CLOSED") {
    if (nextStatus !== "COMPLETED") {
      return "Closed events can only be moved to COMPLETED";
    }
    return null;
  }

  return "Invalid event status transition";
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

async function getOptionalParticipantViewer(
  req: Request,
): Promise<ParticipantViewerContext | null> {
  const token = req.cookies?.[AUTH_COOKIE_NAME];
  if (!token || typeof token !== "string") return null;

  try {
    const payload = verifyJwt(token);
    if (payload.role !== "participant") return null;

    const participantId = parseObjectId(payload.userId);
    if (!participantId) return null;

    const users = getDb().collection<ParticipantPreferenceDoc>(collections.users);
    const participant = await users.findOne({
      _id: participantId,
      role: "participant",
    });
    if (!participant) return null;

    return {
      id: participantId,
      interests: (participant.interests ?? [])
        .map((value) => value.trim().toLowerCase())
        .filter((value) => value.length > 0),
      followedOrganizerIds: (participant.followedOrganizerIds ?? []).map((id) =>
        id.toString(),
      ),
    };
  } catch {
    return null;
  }
}

function countInterestMatches(
  event: StoredEventDoc,
  normalizedInterests: string[],
): number {
  if (normalizedInterests.length === 0) return 0;

  const eventTags = new Set(event.tags.map((tag) => tag.trim().toLowerCase()));
  let matches = 0;

  for (const interest of normalizedInterests) {
    if (eventTags.has(interest)) {
      matches += 1;
    }
  }

  return matches;
}

function scoreEventForParticipant(
  event: StoredEventDoc,
  viewer: ParticipantViewerContext,
): number {
  let score = 0;

  if (viewer.followedOrganizerIds.includes(event.organizerId.toString())) {
    score += 100;
  }

  const interestMatches = countInterestMatches(event, viewer.interests);
  score += interestMatches * 25;

  return score;
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
  attendanceMarked = 0,
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
    attendanceMarked,
    attendanceRate: 0,
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

  const denominator = summary.activeParticipations;
  summary.attendanceRate =
    denominator > 0
      ? Number(((summary.attendanceMarked / denominator) * 100).toFixed(2))
      : 0;

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
                isFormLocked: true,
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
      const attendances = db.collection<StoredAttendanceDoc>(
        collections.attendances,
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
            attendanceMarked: 0,
            attendanceRate: 0,
          },
          topEvents: [],
        });
      }

      const completedEvents = organizerEvents.filter(
        (event) => event.status === "COMPLETED",
      );
      if (completedEvents.length === 0) {
        return res.json({
          summary: {
            totalEvents: organizerEvents.length,
            draftEvents: organizerEvents.filter((event) => event.status === "DRAFT")
              .length,
            publishedEvents: organizerEvents.filter(
              (event) => event.status === "PUBLISHED",
            ).length,
            closedEvents: organizerEvents.filter((event) => event.status === "CLOSED")
              .length,
            completedEvents: 0,
            totalParticipations: 0,
            activeParticipations: 0,
            confirmedCount: 0,
            pendingCount: 0,
            cancelledCount: 0,
            rejectedCount: 0,
            registrations24h: 0,
            estimatedRevenue: 0,
            attendanceMarked: 0,
            attendanceRate: 0,
          },
          topEvents: [],
        });
      }

      const eventIds = completedEvents.map((event) => event._id);
      const allParticipations = await participations
        .find({ eventId: { $in: eventIds } })
        .toArray();
      const allAttendances = await attendances
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

      const attendanceByEventId = new Map<string, number>();
      for (const attendance of allAttendances) {
        const key = attendance.eventId.toString();
        attendanceByEventId.set(key, (attendanceByEventId.get(key) ?? 0) + 1);
      }

      const now = new Date();
      const eventSummaries = completedEvents.map((event) => {
        const eventParticipations =
          participationsByEventId.get(event._id.toString()) ?? [];
        const attendanceMarked = attendanceByEventId.get(event._id.toString()) ?? 0;
        const analytics = buildEventAnalyticsSummary(
          event,
          eventParticipations,
          now,
          attendanceMarked,
        );
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
        attendanceMarked: eventSummaries.reduce(
          (sum, item) => sum + item.analytics.attendanceMarked,
          0,
        ),
        attendanceRate: 0,
      };

      summary.attendanceRate =
        summary.activeParticipations > 0
          ? Number(
              (
                (summary.attendanceMarked / summary.activeParticipations) *
                100
              ).toFixed(2),
            )
          : 0;

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
          attendanceMarked: item.analytics.attendanceMarked,
          attendanceRate: item.analytics.attendanceRate,
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

      const db = getDb();
      const payments = db.collection<StoredPaymentDoc>(collections.payments);
      const attendances = db.collection<StoredAttendanceDoc>(
        collections.attendances,
      );
      const participationIds = loaded.participations.map((entry) => entry._id);

      const foundPayments =
        participationIds.length > 0
          ? await payments
              .find({
                registrationId: { $in: participationIds },
              })
              .toArray()
          : [];
      const paymentByParticipationId = new Map(
        foundPayments.map((entry) => [entry.registrationId.toString(), entry]),
      );

      const foundAttendances =
        participationIds.length > 0
          ? await attendances
              .find({
                participationId: { $in: participationIds },
              })
              .toArray()
          : [];
      const attendanceByParticipationId = new Map(
        foundAttendances.map((entry) => [entry.participationId.toString(), entry]),
      );

      const now = new Date();
      const analytics = buildEventAnalyticsSummary(
        loaded.event,
        loaded.participations,
        now,
        foundAttendances.length,
      );

      const participants = loaded.participations.map((participation) => {
        const participant = loaded.participantsById.get(
          participation.userId.toString(),
        );
        const payment = paymentByParticipationId.get(participation._id.toString());
        const attendance = attendanceByParticipationId.get(
          participation._id.toString(),
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
          teamName: null,
          payment: payment
            ? {
                status: payment.status,
                amount: payment.amount,
                method: payment.method,
                proofUrl: payment.proofUrl ?? null,
                createdAt: payment.createdAt,
              }
            : null,
          attendance: {
            isPresent: Boolean(attendance),
            markedAt: attendance?.markedAt ?? null,
          },
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

      const db = getDb();
      const payments = db.collection<StoredPaymentDoc>(collections.payments);
      const attendances = db.collection<StoredAttendanceDoc>(
        collections.attendances,
      );
      const participationIds = loaded.participations.map((entry) => entry._id);

      const foundPayments =
        participationIds.length > 0
          ? await payments
              .find({ registrationId: { $in: participationIds } })
              .toArray()
          : [];
      const paymentByParticipationId = new Map(
        foundPayments.map((entry) => [entry.registrationId.toString(), entry]),
      );

      const foundAttendances =
        participationIds.length > 0
          ? await attendances
              .find({ participationId: { $in: participationIds } })
              .toArray()
          : [];
      const attendanceByParticipationId = new Map(
        foundAttendances.map((entry) => [entry.participationId.toString(), entry]),
      );

      const rows = loaded.participations.map((participation) => {
        const participant = loaded.participantsById.get(
          participation.userId.toString(),
        );
        const payment = paymentByParticipationId.get(participation._id.toString());
        const attendance = attendanceByParticipationId.get(
          participation._id.toString(),
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
          teamName: "",
          paymentStatus: payment?.status ?? "",
          paymentAmount: payment?.amount ?? "",
          paymentMethod: payment?.method ?? "",
          attendanceMarked: attendance ? "yes" : "no",
          attendanceMarkedAt: attendance?.markedAt ?? "",
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
        { header: "teamName", value: (row) => row.teamName },
        { header: "paymentStatus", value: (row) => row.paymentStatus },
        { header: "paymentAmount", value: (row) => row.paymentAmount },
        { header: "paymentMethod", value: (row) => row.paymentMethod },
        { header: "attendanceMarked", value: (row) => row.attendanceMarked },
        { header: "attendanceMarkedAt", value: (row) => row.attendanceMarkedAt },
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

      const requestedFields = Object.keys(parsed.data) as Array<
        keyof z.infer<typeof updateEventSchema>
      >;

      if (existing.status === "CLOSED" || existing.status === "COMPLETED") {
        return res.status(400).json({
          error: {
            message:
              "Closed or completed events cannot be edited. Use status update only.",
          },
        });
      }

      if (
        existing.status === "PUBLISHED" &&
        deriveDisplayStatus(existing, new Date()) === "ONGOING"
      ) {
        return res.status(400).json({
          error: {
            message:
              "Ongoing events cannot be edited. Use status update only.",
          },
        });
      }

      if (existing.status === "PUBLISHED") {
        const allowedPublishedFields = new Set<keyof z.infer<typeof updateEventSchema>>([
          "description",
          "regDeadline",
          "regLimit",
        ]);
        const invalidFields = requestedFields.filter(
          (field) => !allowedPublishedFields.has(field),
        );
        if (invalidFields.length > 0) {
          return res.status(400).json({
            error: {
              message:
                "Published events allow only description update, deadline extension, and limit increase",
            },
          });
        }

        if (
          parsed.data.regDeadline !== undefined &&
          parsed.data.regDeadline < existing.regDeadline
        ) {
          return res.status(400).json({
            error: { message: "Published event deadline can only be extended" },
          });
        }

        if (
          parsed.data.regLimit !== undefined &&
          parsed.data.regLimit < existing.regLimit
        ) {
          return res.status(400).json({
            error: { message: "Published event registration limit can only increase" },
          });
        }
      }

      if (parsed.data.normalForm !== undefined && existing.type === "NORMAL") {
        const registrations = db.collection<StoredParticipationDoc>(
          collections.registrations,
        );
        const registrationCount = await registrations.countDocuments({
          eventId,
        });

        if (registrationCount > 0) {
          return res.status(400).json({
            error: {
              message:
                "Form is locked after first registration and cannot be edited",
            },
          });
        }
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
                isFormLocked: true,
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
            isFormLocked: true,
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

      const updatedAt = new Date();
      const transitionError = validateOrganizerStatusTransition(
        existing,
        parsed.data.status,
        updatedAt,
      );
      if (transitionError) {
        return res.status(400).json({
          error: { message: transitionError },
        });
      }

      await events.updateOne(
        { _id: eventId, organizerId },
        { $set: { status: parsed.data.status, updatedAt } },
      );

      const updatedEvent: StoredEventDoc = {
        ...existing,
        status: parsed.data.status,
        updatedAt,
      };

      if (
        parsed.data.status === "PUBLISHED" &&
        existing.status !== "PUBLISHED"
      ) {
        const users = db.collection<OrganizerUserDoc>(collections.users);
        const organizer = await users.findOne({
          _id: organizerId,
          role: "organizer",
        });

        if (organizer?.discordWebhookUrl) {
          await postEventAnnouncementToDiscordSafe({
            webhookUrl: organizer.discordWebhookUrl,
            organizerName: organizer.name,
            eventName: existing.name,
            eventType: existing.type,
            regDeadline: existing.regDeadline,
            startDate: existing.startDate,
            endDate: existing.endDate,
          });
        }
      }

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

      const existing = await events.findOne({ _id: eventId, organizerId });
      if (!existing) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      if (existing.status !== "DRAFT") {
        return res.status(400).json({
          error: { message: "Only draft events can be deleted" },
        });
      }

      await events.deleteOne({ _id: eventId, organizerId });

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
      organizer: readQueryStringValue(req.query.organizer),
      type: readQueryStringValue(req.query.type),
      eligibility: readQueryStringValue(req.query.eligibility),
      status: readQueryStringValue(req.query.status),
      from: readQueryStringValue(req.query.from),
      to: readQueryStringValue(req.query.to),
      followedOnly: readQueryBooleanValue(req.query.followedOnly),
    });

    if (!parsed.success) {
      return res.status(400).json({
        error: { message: "Invalid query", details: parsed.error.flatten() },
      });
    }

    const db = getDb();
    const events = db.collection<StoredEventDoc>(collections.events);
    const organizers = db.collection<OrganizerUserDoc>(collections.users);
    const viewer = await getOptionalParticipantViewer(req);
    const filter = buildPublicEventsFilter(parsed.data);
    let scopedOrganizerIds: ObjectId[] | null = null;

    if (parsed.data.organizer) {
      const organizerRegex = new RegExp(escapeRegex(parsed.data.organizer), "i");
      const matchedOrganizers = await organizers
        .find({
          role: "organizer",
          isDisabled: { $ne: true },
          name: organizerRegex,
        })
        .toArray();

      scopedOrganizerIds = matchedOrganizers.map((entry) => entry._id);
    }

    if (parsed.data.followedOnly) {
      if (!viewer) {
        return res
          .status(401)
          .json({ error: { message: "Not authenticated" } });
      }

      const followedIds = viewer.followedOrganizerIds.map((id) => new ObjectId(id));
      scopedOrganizerIds =
        scopedOrganizerIds === null
          ? followedIds
          : scopedOrganizerIds.filter((id) =>
              viewer.followedOrganizerIds.includes(id.toString()),
            );
    }

    if (scopedOrganizerIds && scopedOrganizerIds.length === 0) {
      return res.json({ events: [], recommendedEvents: [] });
    }

    if (scopedOrganizerIds) {
      filter.organizerId = { $in: scopedOrganizerIds };
    }

    const foundEvents = await events
      .find(filter)
      .sort({ startDate: 1, createdAt: -1 })
      .toArray();

    const eventOrganizerIds = [
      ...new Set(foundEvents.map((event) => event.organizerId.toString())),
    ].map((id) => new ObjectId(id));
    const organizerDocs =
      eventOrganizerIds.length > 0
        ? await organizers
            .find({
              _id: { $in: eventOrganizerIds },
              role: "organizer",
              isDisabled: { $ne: true },
            })
            .toArray()
        : [];
    const organizerNameById = new Map(
      organizerDocs.map((entry) => [entry._id.toString(), entry.name]),
    );
    const visibleEvents = foundEvents.filter((event) =>
      organizerNameById.has(event.organizerId.toString()),
    );

    const statusFiltered =
      parsed.data.status === "ONGOING"
        ? visibleEvents.filter(
            (event) => deriveDisplayStatus(event, new Date()) === "ONGOING",
          )
        : visibleEvents;

    const queryText = parsed.data.q;
    const qFiltered = queryText
      ? statusFiltered.filter((event) =>
          matchesSearchQueryFuzzy(queryText, [
            event.name,
            event.description,
            ...(event.tags ?? []),
            organizerNameById.get(event.organizerId.toString()) ?? "",
          ]),
        )
      : statusFiltered;

    const now = new Date();
    const ranked = qFiltered.map((event) => ({
      event,
      preferenceScore: viewer ? scoreEventForParticipant(event, viewer) : 0,
    }));

    ranked.sort((a, b) => {
      if (viewer && b.preferenceScore !== a.preferenceScore) {
        return b.preferenceScore - a.preferenceScore;
      }

      const byStartDate =
        a.event.startDate.getTime() - b.event.startDate.getTime();
      if (byStartDate !== 0) return byStartDate;

      return b.event.createdAt.getTime() - a.event.createdAt.getTime();
    });

    const orderedEvents = ranked.map(({ event, preferenceScore }) => ({
      ...toPublicEventResponse(event),
      organizerName: organizerNameById.get(event.organizerId.toString()) ?? null,
      preferenceScore,
    }));

    const recommendedEvents = viewer
      ? ranked
          .filter(
            ({ event, preferenceScore }) =>
              preferenceScore > 0 && canRegisterNow(event, now),
          )
          .slice(0, 5)
          .map(({ event, preferenceScore }) => ({
            ...toPublicEventResponse(event),
            organizerName:
              organizerNameById.get(event.organizerId.toString()) ?? null,
            preferenceScore,
          }))
      : [];

    return res.json({ events: orderedEvents, recommendedEvents });
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
    const organizers = db.collection<OrganizerUserDoc>(collections.users);
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

    const organizerIds = [
      ...new Set(topEvents.map((event) => event.organizerId.toString())),
    ].map((id) => new ObjectId(id));
    const activeOrganizers =
      organizerIds.length > 0
        ? await organizers
            .find({
              _id: { $in: organizerIds },
              role: "organizer",
              isDisabled: { $ne: true },
            })
            .toArray()
        : [];
    const activeOrganizerIds = new Set(
      activeOrganizers.map((organizer) => organizer._id.toString()),
    );
    const eventsById = new Map(
      topEvents
        .filter((event) => activeOrganizerIds.has(event.organizerId.toString()))
        .map((event) => [event._id.toString(), event]),
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
    const organizers = db.collection<OrganizerUserDoc>(collections.users);
    const event = await events.findOne({
      _id: eventId,
      status: { $in: publicPersistedStatuses },
    });

    if (!event) {
      return res.status(404).json({ error: { message: "Event not found" } });
    }

    const organizer = await organizers.findOne({
      _id: event.organizerId,
      role: "organizer",
      isDisabled: { $ne: true },
    });
    if (!organizer) {
      return res.status(404).json({ error: { message: "Event not found" } });
    }

    return res.json({ event: toPublicEventResponse(event) });
  } catch (err) {
    return next(err);
  }
});
