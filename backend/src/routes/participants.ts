import { Router } from "express";
import { type Collection, ObjectId } from "mongodb";
import { z } from "zod";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import {
  getOrganizerCategoryLabel,
  normalizeOrganizerCategory,
} from "../constants/organizerCategories";
import { requireAuth, requireRole } from "../middleware/auth";
import { isParticipantEligibleForEvent } from "../utils/eligibility";

export const participantsRouter = Router();

type EventType = "NORMAL" | "MERCH";
type PersistedEventStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "COMPLETED";
type DisplayEventStatus = PersistedEventStatus | "ONGOING";
type ParticipationStatus = "pending" | "confirmed" | "cancelled" | "rejected";
type ParticipantType = "iiit" | "non-iiit";

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

type ParticipantUserDoc = {
  _id: ObjectId;
  email: string;
  role: "participant";
  name: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  participantType?: ParticipantType;
  collegeOrOrganization?: string;
  contactNumber?: string;
  interests?: string[];
  followedOrganizerIds?: ObjectId[];
  onboardingCompleted?: boolean;
};

type OrganizerUserDoc = {
  _id: ObjectId;
  role: "organizer";
  name: string;
  organizerCategory?: string;
  organizerDescription?: string;
  isDisabled?: boolean;
};

type PublicFollowedOrganizerResponse = {
  id: string;
  name: string;
  category: string | null;
  categoryLabel: string | null;
  description: string | null;
};

const publicPersistedStatuses: PersistedEventStatus[] = [
  "PUBLISHED",
  "CLOSED",
  "COMPLETED",
];

const profilePatchSchema = z.object({
  firstName: z.string().trim().min(1).max(80).optional(),
  lastName: z.string().trim().min(1).max(80).optional(),
  contactNumber: z.union([z.string().trim().min(7).max(20), z.literal("")]).optional(),
  collegeOrOrganization: z
    .union([z.string().trim().min(2).max(120), z.literal("")])
    .optional(),
  interests: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
});

const onboardingSchema = z.object({
  interests: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  followedOrganizerIds: z.array(z.string().trim().min(1)).max(200).default([]),
});

function parseObjectId(rawId: unknown): ObjectId | null {
  if (typeof rawId !== "string") return null;
  if (!ObjectId.isValid(rawId)) return null;
  return new ObjectId(rawId);
}

function normalizeInterests(interests: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const value of interests) {
    const trimmed = value.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function splitFallbackName(name: string): { firstName: string; lastName: string } {
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized) {
    return { firstName: "", lastName: "" };
  }

  const parts = normalized.split(" ");
  if (parts.length === 1) {
    return { firstName: parts[0] ?? "", lastName: "" };
  }

  return {
    firstName: parts[0] ?? "",
    lastName: parts.slice(1).join(" "),
  };
}

function toParticipantProfileResponse(
  user: ParticipantUserDoc,
  followedOrganizers: PublicFollowedOrganizerResponse[],
) {
  const fallback = splitFallbackName(user.name);
  const firstName = user.firstName ?? fallback.firstName;
  const lastName = user.lastName ?? fallback.lastName;
  const fullName = `${firstName} ${lastName}`.trim() || user.name;

  return {
    id: user._id.toString(),
    name: fullName,
    firstName,
    lastName,
    email: user.email,
    participantType: user.participantType ?? null,
    collegeOrOrganization: user.collegeOrOrganization ?? "",
    contactNumber: user.contactNumber ?? "",
    interests: user.interests ?? [],
    followedOrganizerIds: (user.followedOrganizerIds ?? []).map((id) =>
      id.toString(),
    ),
    followedOrganizers,
    onboardingCompleted: user.onboardingCompleted ?? false,
    createdAt: user.createdAt,
  };
}

function toPublicFollowedOrganizerResponse(organizer: OrganizerUserDoc) {
  const normalizedCategory = normalizeOrganizerCategory(organizer.organizerCategory);

  return {
    id: organizer._id.toString(),
    name: organizer.name,
    category: normalizedCategory,
    categoryLabel: normalizedCategory
      ? getOrganizerCategoryLabel(normalizedCategory)
      : null,
    description: organizer.organizerDescription ?? null,
  };
}

async function listActiveFollowedOrganizerIds(
  users: Collection<ParticipantUserDoc | OrganizerUserDoc>,
  followedOrganizerIds: ObjectId[],
): Promise<ObjectId[]> {
  if (followedOrganizerIds.length === 0) {
    return [];
  }

  const activeOrganizerDocs = await users
    .find({
      _id: { $in: followedOrganizerIds },
      role: "organizer",
      isDisabled: { $ne: true },
    })
    .toArray();

  const activeOrganizerIdSet = new Set(
    activeOrganizerDocs.map((organizer) => organizer._id.toString()),
  );

  return followedOrganizerIds.filter((id) =>
    activeOrganizerIdSet.has(id.toString()),
  );
}

async function normalizeParticipantFollows(params: {
  users: Collection<ParticipantUserDoc | OrganizerUserDoc>;
  participants: Collection<ParticipantUserDoc>;
  participant: ParticipantUserDoc;
}): Promise<ParticipantUserDoc> {
  const followedOrganizerIds = params.participant.followedOrganizerIds ?? [];
  if (followedOrganizerIds.length === 0) {
    return params.participant;
  }

  const activeFollowedOrganizerIds = await listActiveFollowedOrganizerIds(
    params.users,
    followedOrganizerIds,
  );

  if (activeFollowedOrganizerIds.length === followedOrganizerIds.length) {
    return params.participant;
  }

  await params.participants.updateOne(
    { _id: params.participant._id, role: "participant" },
    { $set: { followedOrganizerIds: activeFollowedOrganizerIds } },
  );

  return {
    ...params.participant,
    followedOrganizerIds: activeFollowedOrganizerIds,
  };
}

async function listFollowedOrganizers(params: {
  users: Collection<ParticipantUserDoc | OrganizerUserDoc>;
  followedOrganizerIds: ObjectId[];
}): Promise<PublicFollowedOrganizerResponse[]> {
  if (params.followedOrganizerIds.length === 0) {
    return [];
  }

  const organizerDocs = await params.users
    .find({
      _id: { $in: params.followedOrganizerIds },
      role: "organizer",
      isDisabled: { $ne: true },
    })
    .toArray();

  const organizerById = new Map(
    organizerDocs
      .filter(
        (organizer): organizer is OrganizerUserDoc =>
          organizer.role === "organizer",
      )
      .map((organizer) => [organizer._id.toString(), organizer]),
  );

  return params.followedOrganizerIds.flatMap((organizerId) => {
    const organizer = organizerById.get(organizerId.toString());
    if (!organizer) return [];
    return [toPublicFollowedOrganizerResponse(organizer)];
  });
}

async function buildParticipantProfileResponse(params: {
  users: Collection<ParticipantUserDoc | OrganizerUserDoc>;
  participant: ParticipantUserDoc;
}) {
  const followedOrganizers = await listFollowedOrganizers({
    users: params.users,
    followedOrganizerIds: params.participant.followedOrganizerIds ?? [],
  });

  return toParticipantProfileResponse(params.participant, followedOrganizers);
}

// participant gets own profile and stored onboarding preferences
participantsRouter.get(
  "/me/profile",
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

      const participants = getDb().collection<ParticipantUserDoc>(collections.users);
      const users = getDb().collection<ParticipantUserDoc | OrganizerUserDoc>(
        collections.users,
      );
      const participant = await participants.findOne({
        _id: participantId,
        role: "participant",
      });
      if (!participant) {
        return res.status(404).json({ error: { message: "Participant not found" } });
      }

      const normalizedParticipant = await normalizeParticipantFollows({
        users,
        participants,
        participant,
      });
      const profile = await buildParticipantProfileResponse({
        users,
        participant: normalizedParticipant,
      });

      return res.json({
        profile,
      });
    } catch (err) {
      return next(err);
    }
  },
);

// participant updates editable profile fields
participantsRouter.patch(
  "/me/profile",
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

      const parsed = profilePatchSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: { message: "Invalid request", details: parsed.error.flatten() },
        });
      }

      const participants = getDb().collection<ParticipantUserDoc>(collections.users);
      const users = getDb().collection<ParticipantUserDoc | OrganizerUserDoc>(
        collections.users,
      );
      const existing = await participants.findOne({
        _id: participantId,
        role: "participant",
      });
      if (!existing) {
        return res.status(404).json({ error: { message: "Participant not found" } });
      }

      const setPayload: Partial<ParticipantUserDoc> = {};
      const unsetPayload: Record<string, ""> = {};

      const existingNameFallback = splitFallbackName(existing.name);
      const currentFirstName = existing.firstName ?? existingNameFallback.firstName;
      const currentLastName = existing.lastName ?? existingNameFallback.lastName;
      const nextFirstName = parsed.data.firstName ?? currentFirstName;
      const nextLastName = parsed.data.lastName ?? currentLastName;

      if (parsed.data.firstName !== undefined || parsed.data.lastName !== undefined) {
        if (!nextFirstName || !nextLastName) {
          return res.status(400).json({
            error: { message: "firstName and lastName are required" },
          });
        }

        setPayload.firstName = nextFirstName;
        setPayload.lastName = nextLastName;
        setPayload.name = `${nextFirstName} ${nextLastName}`.trim();
      }

      if (parsed.data.contactNumber !== undefined) {
        if (parsed.data.contactNumber === "") {
          unsetPayload.contactNumber = "";
        } else {
          setPayload.contactNumber = parsed.data.contactNumber;
        }
      }

      if (parsed.data.collegeOrOrganization !== undefined) {
        if (parsed.data.collegeOrOrganization === "") {
          unsetPayload.collegeOrOrganization = "";
        } else {
          setPayload.collegeOrOrganization = parsed.data.collegeOrOrganization;
        }
      }

      if (parsed.data.interests !== undefined) {
        setPayload.interests = normalizeInterests(parsed.data.interests);
      }

      if (
        Object.keys(setPayload).length === 0 &&
        Object.keys(unsetPayload).length === 0
      ) {
        return res.status(400).json({ error: { message: "No fields to update" } });
      }

      const updateDoc: {
        $set?: Partial<ParticipantUserDoc>;
        $unset?: Record<string, "">;
      } = {};

      if (Object.keys(setPayload).length > 0) {
        updateDoc.$set = setPayload;
      }

      if (Object.keys(unsetPayload).length > 0) {
        updateDoc.$unset = unsetPayload;
      }

      await participants.updateOne(
        { _id: participantId, role: "participant" },
        updateDoc,
      );

      const updated = await participants.findOne({
        _id: participantId,
        role: "participant",
      });
      if (!updated) {
        return res.status(404).json({ error: { message: "Participant not found" } });
      }

      const normalizedParticipant = await normalizeParticipantFollows({
        users,
        participants,
        participant: updated,
      });
      const profile = await buildParticipantProfileResponse({
        users,
        participant: normalizedParticipant,
      });

      return res.json({
        profile,
      });
    } catch (err) {
      return next(err);
    }
  },
);

// participant completes onboarding by saving interests + followed organizers
participantsRouter.post(
  "/me/onboarding",
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

      const parsed = onboardingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: { message: "Invalid request", details: parsed.error.flatten() },
        });
      }

      const followedOrganizerObjectIds: ObjectId[] = [];
      for (const rawId of parsed.data.followedOrganizerIds) {
        const organizerId = parseObjectId(rawId);
        if (!organizerId) {
          return res.status(400).json({
            error: { message: `Invalid organizer id: ${rawId}` },
          });
        }
        followedOrganizerObjectIds.push(organizerId);
      }

      const users = getDb().collection<ParticipantUserDoc | OrganizerUserDoc>(
        collections.users,
      );
      const participants = getDb().collection<ParticipantUserDoc>(collections.users);

      if (followedOrganizerObjectIds.length > 0) {
        const activeFollowableCount = await users.countDocuments({
          _id: { $in: followedOrganizerObjectIds },
          role: "organizer",
          isDisabled: { $ne: true },
        });

        if (activeFollowableCount !== followedOrganizerObjectIds.length) {
          return res.status(400).json({
            error: { message: "One or more followedOrganizerIds are invalid" },
          });
        }
      }

      await users.updateOne(
        { _id: participantId, role: "participant" },
        {
          $set: {
            interests: normalizeInterests(parsed.data.interests),
            followedOrganizerIds: followedOrganizerObjectIds,
            onboardingCompleted: true,
          },
        },
      );

      const updated = await users.findOne({
        _id: participantId,
        role: "participant",
      });
      if (!updated || updated.role !== "participant") {
        return res.status(404).json({ error: { message: "Participant not found" } });
      }

      const normalizedParticipant = await normalizeParticipantFollows({
        users,
        participants,
        participant: updated,
      });
      const profile = await buildParticipantProfileResponse({
        users,
        participant: normalizedParticipant,
      });

      return res.json({
        profile,
      });
    } catch (err) {
      return next(err);
    }
  },
);

// participant follows one active organizer
participantsRouter.post(
  "/me/follows/:organizerId",
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

      const organizerId = parseObjectId(req.params.organizerId);
      if (!organizerId) {
        return res.status(400).json({ error: { message: "Invalid organizer id" } });
      }

      const users = getDb().collection<ParticipantUserDoc | OrganizerUserDoc>(
        collections.users,
      );
      const participants = getDb().collection<ParticipantUserDoc>(collections.users);
      const organizer = await users.findOne({
        _id: organizerId,
        role: "organizer",
        isDisabled: { $ne: true },
      });
      if (!organizer) {
        return res.status(404).json({ error: { message: "Organizer not found" } });
      }

      await users.updateOne(
        { _id: participantId, role: "participant" },
        { $addToSet: { followedOrganizerIds: organizerId } },
      );

      const updated = await participants.findOne({
        _id: participantId,
        role: "participant",
      });
      if (!updated) {
        return res.status(404).json({ error: { message: "Participant not found" } });
      }

      const normalizedParticipant = await normalizeParticipantFollows({
        users,
        participants,
        participant: updated,
      });
      const profile = await buildParticipantProfileResponse({
        users,
        participant: normalizedParticipant,
      });

      return res.json({
        profile,
      });
    } catch (err) {
      return next(err);
    }
  },
);

// participant unfollows one organizer
participantsRouter.delete(
  "/me/follows/:organizerId",
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

      const organizerId = parseObjectId(req.params.organizerId);
      if (!organizerId) {
        return res.status(400).json({ error: { message: "Invalid organizer id" } });
      }

      const participants = getDb().collection<ParticipantUserDoc>(collections.users);
      const users = getDb().collection<ParticipantUserDoc | OrganizerUserDoc>(
        collections.users,
      );

      await participants.updateOne(
        { _id: participantId, role: "participant" },
        { $pull: { followedOrganizerIds: organizerId } },
      );

      const updated = await participants.findOne({
        _id: participantId,
        role: "participant",
      });
      if (!updated) {
        return res.status(404).json({ error: { message: "Participant not found" } });
      }

      const normalizedParticipant = await normalizeParticipantFollows({
        users,
        participants,
        participant: updated,
      });
      const profile = await buildParticipantProfileResponse({
        users,
        participant: normalizedParticipant,
      });

      return res.json({
        profile,
      });
    } catch (err) {
      return next(err);
    }
  },
);

// participant lists currently followed active organizers
participantsRouter.get(
  "/me/follows",
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

      const participants = getDb().collection<ParticipantUserDoc>(collections.users);
      const users = getDb().collection<ParticipantUserDoc | OrganizerUserDoc>(
        collections.users,
      );

      const participant = await participants.findOne({
        _id: participantId,
        role: "participant",
      });
      if (!participant) {
        return res.status(404).json({ error: { message: "Participant not found" } });
      }

      const normalizedParticipant = await normalizeParticipantFollows({
        users,
        participants,
        participant,
      });
      const organizers = await listFollowedOrganizers({
        users,
        followedOrganizerIds: normalizedParticipant.followedOrganizerIds ?? [],
      });

      return res.json({
        organizers,
      });
    } catch (err) {
      return next(err);
    }
  },
);

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

async function canRegisterForEventDetail(params: {
  event: StoredEventDoc;
  participations: Collection<StoredParticipationDoc>;
  participantType?: ParticipantType | null;
  now: Date;
}): Promise<boolean> {
  if (!canRegisterNow(params.event, params.now)) {
    return false;
  }

  if (
    !isParticipantEligibleForEvent({
      eventEligibility: params.event.eligibility,
      participantType: params.participantType ?? null,
    })
  ) {
    return false;
  }

  const activeCount = await params.participations.countDocuments({
    eventId: params.event._id,
    status: { $nin: ["cancelled", "rejected"] },
  });

  if (activeCount >= params.event.regLimit) {
    return false;
  }

  if (params.event.type === "MERCH") {
    const merchConfig = params.event.merchConfig;
    if (!merchConfig) return false;
    if (merchConfig.totalStock <= 0) return false;
    if (!merchConfig.variants.some((variant) => variant.stock > 0)) {
      return false;
    }
  }

  return true;
}

function toParticipantEventResponse(
  event: StoredEventDoc,
  organizerName?: string,
  canRegisterOverride?: boolean,
) {
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
    organizerName: organizerName ?? null,
    status: event.status,
    displayStatus: deriveDisplayStatus(event, new Date()),
    canRegister:
      canRegisterOverride !== undefined
        ? canRegisterOverride
        : canRegisterNow(event, new Date()),
    normalForm: event.type === "NORMAL" ? event.normalForm : undefined,
    merchConfig: event.type === "MERCH" ? event.merchConfig : undefined,
  };
}

function toParticipationItemResponse(
  participation: StoredParticipationDoc,
  event: StoredEventDoc,
  organizerName?: string,
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
    event: toParticipantEventResponse(event, organizerName),
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
      const users = db.collection<OrganizerUserDoc>(collections.users);

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
      const organizerIds = [
        ...new Set(foundEvents.map((entry) => entry.organizerId.toString())),
      ].map((id) => new ObjectId(id));
      const organizers =
        organizerIds.length > 0
          ? await users
              .find({
                _id: { $in: organizerIds },
                role: "organizer",
              })
              .toArray()
          : [];
      const organizerNameById = new Map(
        organizers.map((organizer) => [organizer._id.toString(), organizer.name]),
      );

      const items = foundParticipations
        .map((entry) => {
          const event = eventsById.get(entry.eventId.toString());
          if (!event) return null;
          return toParticipationItemResponse(
            entry,
            event,
            organizerNameById.get(event.organizerId.toString()),
          );
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
      const users = db.collection<ParticipantUserDoc | OrganizerUserDoc>(
        collections.users,
      );

      const participant = await users.findOne({
        _id: participantId,
        role: "participant",
      });
      if (!participant || participant.role !== "participant") {
        return res.status(404).json({ error: { message: "Participant not found" } });
      }

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

      const organizer = await users.findOne({
        _id: event.organizerId,
        role: "organizer",
      });
      const organizerIsActive =
        organizer?.role === "organizer" && organizer.isDisabled !== true;
      if (!organizerIsActive) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      const organizerName = organizer?.role === "organizer" ? organizer.name : undefined;
      const canRegister = organizerIsActive
        ? await canRegisterForEventDetail({
            event,
            participations,
            participantType: participant.participantType ?? null,
            now: new Date(),
          })
        : false;

      return res.json({
        event: toParticipantEventResponse(event, organizerName, canRegister),
        myParticipation: latestParticipation
          ? toParticipationItemResponse(latestParticipation, event, organizerName)
          : null,
      });
    } catch (err) {
      return next(err);
    }
  },
);
