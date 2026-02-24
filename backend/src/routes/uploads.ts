import fs from "node:fs/promises";
import path from "node:path";
import { Router } from "express";
import { ObjectId } from "mongodb";
import { env } from "../config/env";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import { requireAuth } from "../middleware/auth";

export const uploadsRouter = Router();

type StoredParticipationDoc = {
  _id: ObjectId;
  eventId: ObjectId;
  userId: ObjectId;
  normalResponses?: Array<{
    key: string;
    file?: {
      filename: string;
      originalName: string;
      mimeType: string;
      size: number;
    };
  }>;
};

type StoredEventDoc = {
  _id: ObjectId;
  organizerId: ObjectId;
};

type StoredPaymentDoc = {
  _id: ObjectId;
  registrationId: ObjectId;
  proofUrl?: string;
};

function parseObjectId(rawId: unknown): ObjectId | null {
  if (typeof rawId !== "string") return null;
  if (!ObjectId.isValid(rawId)) return null;
  return new ObjectId(rawId);
}

function readParamString(raw: unknown): string | null {
  if (typeof raw === "string") return raw.trim();
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0].trim();
  return null;
}

function sanitizeFilename(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const base = path.basename(trimmed);
  if (base !== trimmed) return null;
  if (base === "." || base === "..") return null;
  if (base.includes("/") || base.includes("\\")) return null;
  return base;
}

// protected upload download for owner participant, event organizer, or admin
uploadsRouter.get("/:filename", requireAuth, async (req, res, next) => {
  try {
    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: { message: "Not authenticated" } });
    }

    const rawFilename = readParamString(req.params.filename);
    if (!rawFilename) {
      return res.status(400).json({ error: { message: "Invalid filename" } });
    }

    const filename = sanitizeFilename(rawFilename);
    if (!filename) {
      return res.status(400).json({ error: { message: "Invalid filename" } });
    }

    const db = getDb();
    const participations = db.collection<StoredParticipationDoc>(
      collections.registrations,
    );
    const events = db.collection<StoredEventDoc>(collections.events);
    const payments = db.collection<StoredPaymentDoc>(collections.payments);

    let participation = await participations.findOne({
      "normalResponses.file.filename": filename,
    });
    let downloadName = filename;

    if (!participation) {
      const payment = await payments.findOne({
        proofUrl: `/api/uploads/${filename}`,
      });
      if (!payment) {
        return res.status(404).json({ error: { message: "File not found" } });
      }

      participation = await participations.findOne({
        _id: payment.registrationId,
      });
      if (!participation) {
        return res.status(404).json({ error: { message: "File not found" } });
      }

      const extension = path.extname(filename).toLowerCase();
      downloadName = `payment-proof${extension || ""}`;
    }

    const isOwner = participation.userId.toString() === authUser.id;
    let isOrganizer = false;
    if (authUser.role === "organizer") {
      const organizerId = parseObjectId(authUser.id);
      if (organizerId) {
        const event = await events.findOne({ _id: participation.eventId });
        isOrganizer =
          event !== null && event.organizerId.toString() === organizerId.toString();
      }
    }

    if (!isOwner && !isOrganizer && authUser.role !== "admin") {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    const matchedResponse = participation.normalResponses?.find(
      (response) => response.file?.filename === filename,
    );
    if (matchedResponse?.file?.originalName) {
      downloadName = matchedResponse.file.originalName;
    }

    const absolutePath = path.resolve(process.cwd(), env.UPLOAD_DIR, filename);

    try {
      await fs.access(absolutePath);
    } catch {
      return res.status(404).json({ error: { message: "File not found" } });
    }

    return res.download(absolutePath, downloadName);
  } catch (err) {
    return next(err);
  }
});
