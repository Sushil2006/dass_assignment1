import { Router } from "express";
import { ObjectId } from "mongodb";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import type { UserDoc } from "../db/models";
import { requireAuth } from "../middleware/auth";
import type { StoredTicketDoc } from "../utils/tickets";

export const ticketsRouter = Router();

type PersistedEventStatus = "DRAFT" | "PUBLISHED" | "CLOSED" | "COMPLETED";
type EventType = "NORMAL" | "MERCH";

type StoredEventDoc = {
  _id: ObjectId;
  name: string;
  type: EventType;
  organizerId: ObjectId;
  status: PersistedEventStatus;
  startDate: Date;
  endDate: Date;
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

// fetch ticket detail for owner participant, event organizer, or admin
ticketsRouter.get("/:ticketId", requireAuth, async (req, res, next) => {
  try {
    const rawTicketId = readParamString(req.params.ticketId);
    if (!rawTicketId) {
      return res.status(400).json({ error: { message: "Invalid ticket id" } });
    }

    const authUser = req.user;
    if (!authUser) {
      return res.status(401).json({ error: { message: "Not authenticated" } });
    }

    const db = getDb();
    const tickets = db.collection<StoredTicketDoc>(collections.tickets);
    const events = db.collection<StoredEventDoc>(collections.events);
    const users = db.collection<UserDoc>(collections.users);

    const ticket = await tickets.findOne({ ticketId: rawTicketId });
    if (!ticket) {
      return res.status(404).json({ error: { message: "Ticket not found" } });
    }

    const event = await events.findOne({ _id: ticket.eventId });
    if (!event) {
      return res.status(404).json({ error: { message: "Event not found" } });
    }

    const isOwner = ticket.userId.toString() === authUser.id;
    let organizerAccess = false;
    if (authUser.role === "organizer") {
      const organizerId = parseObjectId(authUser.id);
      organizerAccess =
        organizerId !== null && event.organizerId.equals(organizerId);
    }

    if (!isOwner && !organizerAccess && authUser.role !== "admin") {
      return res.status(403).json({ error: { message: "Forbidden" } });
    }

    const participant = await users.findOne({ _id: ticket.userId });
    if (!participant) {
      return res.status(404).json({ error: { message: "Participant not found" } });
    }

    return res.json({
      ticket: {
        id: ticket.ticketId,
        qrPayload: ticket.qrPayload,
        eventType: ticket.eventType,
        createdAt: ticket.createdAt,
        participationId: ticket.participationId.toString(),
        event: {
          id: event._id.toString(),
          name: event.name,
          type: event.type,
          status: event.status,
          startDate: event.startDate,
          endDate: event.endDate,
          organizerId: event.organizerId.toString(),
        },
        participant: {
          id: participant._id.toString(),
          name: participant.name,
          email: participant.email,
        },
      },
    });
  } catch (err) {
    return next(err);
  }
});
