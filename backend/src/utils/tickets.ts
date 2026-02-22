import crypto from "node:crypto";
import { ObjectId } from "mongodb";

export type TicketEventType = "NORMAL" | "MERCH";

export type StoredTicketDoc = {
  _id: ObjectId;
  ticketId: string;
  eventId: ObjectId;
  userId: ObjectId;
  participationId: ObjectId;
  eventType: TicketEventType;
  qrPayload: string;
  createdAt: Date;
};

type BuildTicketDocInput = {
  eventId: ObjectId;
  userId: ObjectId;
  participationId: ObjectId;
  eventType: TicketEventType;
  now?: Date;
};

function generateTicketId(now: Date): string {
  const timePart = now.getTime().toString(36).toUpperCase();
  const randomPart = crypto.randomBytes(4).toString("hex").toUpperCase();
  return `TKT-${timePart}-${randomPart}`;
}

function buildTicketQrPayload(params: {
  ticketId: string;
  eventId: ObjectId;
  userId: ObjectId;
  participationId: ObjectId;
  issuedAt: Date;
}): string {
  return JSON.stringify({
    ticketId: params.ticketId,
    eventId: params.eventId.toString(),
    userId: params.userId.toString(),
    participationId: params.participationId.toString(),
    issuedAt: params.issuedAt.toISOString(),
  });
}

export function buildTicketDoc(input: BuildTicketDocInput): StoredTicketDoc {
  const createdAt = input.now ?? new Date();
  const ticketId = generateTicketId(createdAt);

  return {
    _id: new ObjectId(),
    ticketId,
    eventId: input.eventId,
    userId: input.userId,
    participationId: input.participationId,
    eventType: input.eventType,
    qrPayload: buildTicketQrPayload({
      ticketId,
      eventId: input.eventId,
      userId: input.userId,
      participationId: input.participationId,
      issuedAt: createdAt,
    }),
    createdAt,
  };
}
