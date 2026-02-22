import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { Router, type Response } from "express";
import multer from "multer";
import { type Collection, ObjectId } from "mongodb";
import { z } from "zod";
import { env } from "../config/env";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import { requireAuth, requireRole } from "../middleware/auth";
import { sendTicketEmailSafe } from "../utils/email";
import { buildTicketDoc, type StoredTicketDoc } from "../utils/tickets";

export const participationsRouter = Router();

type EventType = "NORMAL" | "MERCH";
type PersistedEventStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "COMPLETED";
type ParticipationStatus = "pending" | "confirmed" | "cancelled" | "rejected";

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
  type: EventType;
  organizerId: ObjectId;
  status: PersistedEventStatus;
  regFee: number;
  regDeadline: Date;
  regLimit: number;
  endDate: Date;
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

type UploadedFieldFile = {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
};

type NormalResponseValue = string | number | string[];

type StoredNormalResponse = {
  key: string;
  label: string;
  type: NormalFormFieldType;
  value?: NormalResponseValue;
  file?: UploadedFieldFile;
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

type ParticipantUserDoc = {
  _id: ObjectId;
  email: string;
  role: "participant";
  name: string;
};

const inactiveParticipationStatuses: ParticipationStatus[] = [
  "cancelled",
  "rejected",
];

const registerBodySchema = z.object({
  eventId: z.string().trim().min(1),
  answers: z.record(z.string(), z.unknown()).default({}),
});

const purchaseBodySchema = z.object({
  eventId: z.string().trim().min(1),
  sku: z.string().trim().min(1).max(80),
  quantity: z.coerce.number().int().min(1).max(100).default(1),
});

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.resolve(process.cwd(), env.UPLOAD_DIR));
    },
    filename: (_req, file, cb) => {
      const safeExt = path.extname(file.originalname).slice(0, 20);
      const randomPart = crypto.randomBytes(6).toString("hex");
      cb(null, `${Date.now()}-${randomPart}${safeExt}`);
    },
  }),
  limits: {
    fileSize: 10 * 1024 * 1024,
    files: 20,
  },
});

function parseObjectId(rawId: unknown): ObjectId | null {
  if (typeof rawId !== "string") return null;
  if (!ObjectId.isValid(rawId)) return null;
  return new ObjectId(rawId);
}

function readAnswersPayload(raw: unknown): Record<string, unknown> {
  if (raw === undefined) return {};

  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed.length === 0) return {};

    const parsed = JSON.parse(trimmed) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("answers must be a JSON object");
    }

    return parsed as Record<string, unknown>;
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }

  throw new Error("answers must be a JSON object");
}

async function cleanupUploadedFiles(files: Express.Multer.File[]): Promise<void> {
  await Promise.all(
    files.map(async (file) => {
      try {
        await fs.unlink(file.path);
      } catch {
        // ignore cleanup failure
      }
    }),
  );
}

async function rejectWithCleanup(
  res: Response,
  status: number,
  message: string,
  files: Express.Multer.File[],
) {
  await cleanupUploadedFiles(files);
  return res.status(status).json({ error: { message } });
}

function getFileByField(
  files: Express.Multer.File[],
): Map<string, Express.Multer.File> | null {
  const fileMap = new Map<string, Express.Multer.File>();

  for (const file of files) {
    if (fileMap.has(file.fieldname)) {
      return null;
    }

    fileMap.set(file.fieldname, file);
  }

  return fileMap;
}

function validateParticipationWindow(event: StoredEventDoc, now: Date): string | null {
  if (event.status !== "PUBLISHED") {
    return "Event is not open for participation";
  }

  if (now > event.regDeadline) {
    return "Registration deadline has passed";
  }

  if (now > event.endDate) {
    return "Event has already ended";
  }

  return null;
}

function validateNormalResponses(params: {
  fields: NormalFormField[];
  answers: Record<string, unknown>;
  uploadedFiles: Express.Multer.File[];
}): { responses?: StoredNormalResponse[]; error?: string } {
  const fieldsByKey = new Map(params.fields.map((field) => [field.key, field]));
  const fileMap = getFileByField(params.uploadedFiles);

  if (!fileMap) {
    return { error: "Only one file is allowed per file field" };
  }

  for (const answerKey of Object.keys(params.answers)) {
    const field = fieldsByKey.get(answerKey);
    if (!field) {
      return { error: `Unknown form field: ${answerKey}` };
    }
    if (field.type === "file") {
      return { error: `Field ${answerKey} must be uploaded as file` };
    }
  }

  for (const [fileFieldKey] of fileMap.entries()) {
    const field = fieldsByKey.get(fileFieldKey);
    if (!field) {
      return { error: `Unknown file field: ${fileFieldKey}` };
    }
    if (field.type !== "file") {
      return { error: `Field ${fileFieldKey} does not accept file uploads` };
    }
  }

  const responses: StoredNormalResponse[] = [];
  const orderedFields = [...params.fields].sort((a, b) => a.order - b.order);

  for (const field of orderedFields) {
    if (field.type === "file") {
      const file = fileMap.get(field.key);
      if (!file) {
        if (field.required) {
          return { error: `Missing required file for field ${field.key}` };
        }
        continue;
      }

      responses.push({
        key: field.key,
        label: field.label,
        type: field.type,
        file: {
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      });
      continue;
    }

    const raw = params.answers[field.key];
    const missing =
      raw === undefined ||
      raw === null ||
      (typeof raw === "string" && raw.trim().length === 0);

    if (missing) {
      if (field.required) {
        return { error: `Missing required value for field ${field.key}` };
      }
      continue;
    }

    if (field.type === "text" || field.type === "textarea" || field.type === "select") {
      if (typeof raw !== "string") {
        return { error: `Field ${field.key} must be a string` };
      }

      const value = raw.trim();
      if (!value && field.required) {
        return { error: `Missing required value for field ${field.key}` };
      }

      if (field.type === "select" && field.options && !field.options.includes(value)) {
        return { error: `Invalid option for field ${field.key}` };
      }

      responses.push({
        key: field.key,
        label: field.label,
        type: field.type,
        value,
      });
      continue;
    }

    if (field.type === "number") {
      const value =
        typeof raw === "number"
          ? raw
          : typeof raw === "string"
            ? Number(raw)
            : Number.NaN;

      if (!Number.isFinite(value)) {
        return { error: `Field ${field.key} must be a valid number` };
      }

      responses.push({
        key: field.key,
        label: field.label,
        type: field.type,
        value,
      });
      continue;
    }

    if (field.type === "checkbox") {
      const options = field.options ?? [];
      let selected: string[];
      if (Array.isArray(raw)) {
        selected = raw
          .map((item) => String(item).trim())
          .filter((item) => item.length > 0);
      } else if (typeof raw === "string") {
        selected = raw
          .split(",")
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      } else {
        return { error: `Field ${field.key} must be a string or string[]` };
      }

      if (selected.length === 0 && field.required) {
        return { error: `Missing required value for field ${field.key}` };
      }

      if (selected.some((item) => !options.includes(item))) {
        return { error: `Invalid option for field ${field.key}` };
      }

      responses.push({
        key: field.key,
        label: field.label,
        type: field.type,
        value: selected,
      });
      continue;
    }
  }

  return { responses };
}

function toParticipationResponse(participation: StoredParticipationDoc) {
  return {
    id: participation._id.toString(),
    eventId: participation.eventId.toString(),
    userId: participation.userId.toString(),
    eventType: participation.eventType,
    status: participation.status,
    ticketId: participation.ticketId,
    createdAt: participation.createdAt,
    updatedAt: participation.updatedAt,
    normalResponses: participation.normalResponses,
    merchPurchase: participation.merchPurchase,
  };
}

function toTicketResponse(ticket: StoredTicketDoc) {
  return {
    id: ticket.ticketId,
    eventId: ticket.eventId.toString(),
    userId: ticket.userId.toString(),
    participationId: ticket.participationId.toString(),
    eventType: ticket.eventType,
    qrPayload: ticket.qrPayload,
    createdAt: ticket.createdAt,
  };
}

async function restockMerchIfNeeded(params: {
  events: Collection<StoredEventDoc>;
  event: StoredEventDoc;
  participation: StoredParticipationDoc;
  now: Date;
}) {
  if (!params.participation.merchPurchase || !params.event.merchConfig) return;

  const targetSku = params.participation.merchPurchase.sku;
  const restoreQuantity = params.participation.merchPurchase.quantity;

  const nextVariants = params.event.merchConfig.variants.map((variant) =>
    variant.sku === targetSku
      ? { ...variant, stock: variant.stock + restoreQuantity }
      : variant,
  );

  const nextTotalStock = nextVariants.reduce(
    (sum, variant) => sum + variant.stock,
    0,
  );

  await params.events.updateOne(
    { _id: params.event._id },
    {
      $set: {
        merchConfig: {
          variants: nextVariants,
          perParticipantLimit: params.event.merchConfig.perParticipantLimit,
          totalStock: nextTotalStock,
        },
        updatedAt: params.now,
      },
    },
  );
}

// participant registers for a normal event with form answers + optional files
participationsRouter.post(
  "/register",
  requireAuth,
  requireRole("participant"),
  upload.any(),
  async (req, res, next) => {
    const uploadedFiles = Array.isArray(req.files) ? req.files : [];

    try {
      const authUser = req.user;
      if (!authUser) {
        return rejectWithCleanup(
          res,
          401,
          "Not authenticated",
          uploadedFiles,
        );
      }

      const participantId = parseObjectId(authUser.id);
      if (!participantId) {
        return rejectWithCleanup(
          res,
          401,
          "Not authenticated",
          uploadedFiles,
        );
      }

      let answers: Record<string, unknown>;
      try {
        answers = readAnswersPayload(req.body.answers);
      } catch {
        return rejectWithCleanup(
          res,
          400,
          "answers must be a valid JSON object",
          uploadedFiles,
        );
      }

      const parsed = registerBodySchema.safeParse({
        eventId: req.body.eventId,
        answers,
      });
      if (!parsed.success) {
        return rejectWithCleanup(
          res,
          400,
          "Invalid request",
          uploadedFiles,
        );
      }

      const eventId = parseObjectId(parsed.data.eventId);
      if (!eventId) {
        return rejectWithCleanup(
          res,
          400,
          "Invalid event id",
          uploadedFiles,
        );
      }

      const db = getDb();
      const events = db.collection<StoredEventDoc>(collections.events);
      const participations = db.collection<StoredParticipationDoc>(
        collections.registrations,
      );
      const tickets = db.collection<StoredTicketDoc>(collections.tickets);
      const users = db.collection<ParticipantUserDoc>(collections.users);

      const participant = await users.findOne({
        _id: participantId,
        role: "participant",
      });
      if (!participant) {
        return rejectWithCleanup(
          res,
          404,
          "Participant not found",
          uploadedFiles,
        );
      }

      const event = await events.findOne({ _id: eventId });
      if (!event) {
        return rejectWithCleanup(
          res,
          404,
          "Event not found",
          uploadedFiles,
        );
      }

      if (event.type !== "NORMAL") {
        return rejectWithCleanup(
          res,
          400,
          "This endpoint only supports NORMAL events",
          uploadedFiles,
        );
      }

      const availabilityError = validateParticipationWindow(event, new Date());
      if (availabilityError) {
        return rejectWithCleanup(res, 400, availabilityError, uploadedFiles);
      }

      const existingParticipation = await participations.findOne({
        eventId,
        userId: participantId,
        status: { $nin: inactiveParticipationStatuses },
      });
      if (existingParticipation) {
        return rejectWithCleanup(
          res,
          409,
          "You already have an active participation for this event",
          uploadedFiles,
        );
      }

      const activeCount = await participations.countDocuments({
        eventId,
        status: { $nin: inactiveParticipationStatuses },
      });
      if (activeCount >= event.regLimit) {
        return rejectWithCleanup(
          res,
          409,
          "Registration limit reached",
          uploadedFiles,
        );
      }

      const validation = validateNormalResponses({
        fields: event.normalForm?.fields ?? [],
        answers: parsed.data.answers,
        uploadedFiles,
      });
      if (validation.error || !validation.responses) {
        return rejectWithCleanup(
          res,
          400,
          validation.error ?? "Invalid form submission",
          uploadedFiles,
        );
      }

      const now = new Date();
      const participationId = new ObjectId();
      const ticket = buildTicketDoc({
        eventId,
        userId: participantId,
        participationId,
        eventType: "NORMAL",
        now,
      });

      const participation: StoredParticipationDoc = {
        _id: participationId,
        eventId,
        userId: participantId,
        status: "confirmed",
        createdAt: now,
        updatedAt: now,
        eventType: "NORMAL",
        ticketId: ticket.ticketId,
        normalResponses: validation.responses,
      };

      await participations.insertOne(participation);
      await tickets.insertOne(ticket);

      await sendTicketEmailSafe({
        toEmail: participant.email,
        toName: participant.name,
        eventName: event.name,
        eventType: event.type,
        ticketId: ticket.ticketId,
        qrPayload: ticket.qrPayload,
      });

      return res.status(201).json({
        participation: toParticipationResponse(participation),
        ticket: toTicketResponse(ticket),
      });
    } catch (err) {
      await cleanupUploadedFiles(uploadedFiles);
      return next(err);
    }
  },
);

// participant cancels own active participation and releases merch stock if needed
participationsRouter.patch(
  "/:participationId/cancel",
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

      const participationId = parseObjectId(req.params.participationId);
      if (!participationId) {
        return res
          .status(400)
          .json({ error: { message: "Invalid participation id" } });
      }

      const db = getDb();
      const participations = db.collection<StoredParticipationDoc>(
        collections.registrations,
      );
      const events = db.collection<StoredEventDoc>(collections.events);

      const participation = await participations.findOne({
        _id: participationId,
        userId: participantId,
      });
      if (!participation) {
        return res
          .status(404)
          .json({ error: { message: "Participation not found" } });
      }

      if (
        participation.status === "cancelled" ||
        participation.status === "rejected"
      ) {
        return res.json({ participation: toParticipationResponse(participation) });
      }

      const event = await events.findOne({ _id: participation.eventId });
      if (!event) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      const now = new Date();
      await participations.updateOne(
        { _id: participation._id, userId: participantId },
        { $set: { status: "cancelled", updatedAt: now } },
      );

      await restockMerchIfNeeded({ events, event, participation, now });

      const updated: StoredParticipationDoc = {
        ...participation,
        status: "cancelled",
        updatedAt: now,
      };

      return res.json({ participation: toParticipationResponse(updated) });
    } catch (err) {
      return next(err);
    }
  },
);

// organizer/admin rejects participation and releases merch stock when applicable
participationsRouter.patch(
  "/:participationId/reject",
  requireAuth,
  requireRole("organizer", "admin"),
  async (req, res, next) => {
    try {
      const authUser = req.user;
      if (!authUser) {
        return res.status(401).json({ error: { message: "Not authenticated" } });
      }

      const participationId = parseObjectId(req.params.participationId);
      if (!participationId) {
        return res
          .status(400)
          .json({ error: { message: "Invalid participation id" } });
      }

      const db = getDb();
      const participations = db.collection<StoredParticipationDoc>(
        collections.registrations,
      );
      const events = db.collection<StoredEventDoc>(collections.events);

      const participation = await participations.findOne({ _id: participationId });
      if (!participation) {
        return res
          .status(404)
          .json({ error: { message: "Participation not found" } });
      }

      if (
        participation.status === "cancelled" ||
        participation.status === "rejected"
      ) {
        return res.json({ participation: toParticipationResponse(participation) });
      }

      const event = await events.findOne({ _id: participation.eventId });
      if (!event) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      if (authUser.role === "organizer") {
        const organizerId = parseObjectId(authUser.id);
        if (!organizerId || event.organizerId.toString() !== organizerId.toString()) {
          return res.status(403).json({ error: { message: "Forbidden" } });
        }
      }

      const now = new Date();
      await participations.updateOne(
        { _id: participation._id },
        { $set: { status: "rejected", updatedAt: now } },
      );

      await restockMerchIfNeeded({ events, event, participation, now });

      const updated: StoredParticipationDoc = {
        ...participation,
        status: "rejected",
        updatedAt: now,
      };

      return res.json({ participation: toParticipationResponse(updated) });
    } catch (err) {
      return next(err);
    }
  },
);

// participant purchases merch variant and reserves stock before ticket issue
participationsRouter.post(
  "/purchase",
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

      const parsed = purchaseBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: { message: "Invalid request", details: parsed.error.flatten() },
        });
      }

      const eventId = parseObjectId(parsed.data.eventId);
      if (!eventId) {
        return res.status(400).json({ error: { message: "Invalid event id" } });
      }

      const db = getDb();
      const events = db.collection<StoredEventDoc>(collections.events);
      const participations = db.collection<StoredParticipationDoc>(
        collections.registrations,
      );
      const tickets = db.collection<StoredTicketDoc>(collections.tickets);
      const users = db.collection<ParticipantUserDoc>(collections.users);

      const participant = await users.findOne({
        _id: participantId,
        role: "participant",
      });
      if (!participant) {
        return res.status(404).json({ error: { message: "Participant not found" } });
      }

      const event = await events.findOne({ _id: eventId });
      if (!event) {
        return res.status(404).json({ error: { message: "Event not found" } });
      }

      if (event.type !== "MERCH") {
        return res.status(400).json({
          error: { message: "This endpoint only supports MERCH events" },
        });
      }

      const availabilityError = validateParticipationWindow(event, new Date());
      if (availabilityError) {
        return res.status(400).json({ error: { message: availabilityError } });
      }

      const existingParticipation = await participations.findOne({
        eventId,
        userId: participantId,
        status: { $nin: inactiveParticipationStatuses },
      });
      if (existingParticipation) {
        return res.status(409).json({
          error: {
            message: "You already have an active participation for this event",
          },
        });
      }

      const activeCount = await participations.countDocuments({
        eventId,
        status: { $nin: inactiveParticipationStatuses },
      });
      if (activeCount >= event.regLimit) {
        return res.status(409).json({ error: { message: "Registration limit reached" } });
      }

      if (!event.merchConfig) {
        return res
          .status(400)
          .json({ error: { message: "Merch config is missing for this event" } });
      }

      if (parsed.data.quantity > event.merchConfig.perParticipantLimit) {
        return res.status(400).json({
          error: {
            message: "Requested quantity exceeds per participant purchase limit",
          },
        });
      }

      const variant = event.merchConfig.variants.find(
        (entry) => entry.sku === parsed.data.sku,
      );
      if (!variant) {
        return res.status(400).json({ error: { message: "Invalid merch variant sku" } });
      }

      if (variant.stock < parsed.data.quantity) {
        return res.status(409).json({ error: { message: "Requested stock unavailable" } });
      }

      const nextVariants = event.merchConfig.variants.map((entry) =>
        entry.sku === variant.sku
          ? { ...entry, stock: entry.stock - parsed.data.quantity }
          : entry,
      );
      const nextTotalStock = nextVariants.reduce(
        (sum, entry) => sum + entry.stock,
        0,
      );

      const now = new Date();
      await events.updateOne(
        { _id: eventId },
        {
          $set: {
            merchConfig: {
              variants: nextVariants,
              perParticipantLimit: event.merchConfig.perParticipantLimit,
              totalStock: nextTotalStock,
            },
            updatedAt: now,
          },
        },
      );

      const participationId = new ObjectId();
      const ticket = buildTicketDoc({
        eventId,
        userId: participantId,
        participationId,
        eventType: "MERCH",
        now,
      });

      const unitPrice = Math.max(0, event.regFee + (variant.priceDelta ?? 0));
      const totalAmount = unitPrice * parsed.data.quantity;

      const participation: StoredParticipationDoc = {
        _id: participationId,
        eventId,
        userId: participantId,
        status: "confirmed",
        createdAt: now,
        updatedAt: now,
        eventType: "MERCH",
        ticketId: ticket.ticketId,
        merchPurchase: {
          sku: variant.sku,
          label: variant.label,
          quantity: parsed.data.quantity,
          unitPrice,
          totalAmount,
        },
      };

      await participations.insertOne(participation);
      await tickets.insertOne(ticket);

      await sendTicketEmailSafe({
        toEmail: participant.email,
        toName: participant.name,
        eventName: event.name,
        eventType: event.type,
        ticketId: ticket.ticketId,
        qrPayload: ticket.qrPayload,
      });

      return res.status(201).json({
        participation: toParticipationResponse(participation),
        ticket: toTicketResponse(ticket),
      });
    } catch (err) {
      return next(err);
    }
  },
);
