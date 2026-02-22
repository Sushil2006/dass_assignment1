import { getDb } from "./client";

export async function ensureDbIndexes(): Promise<void> {
  const db = getDb();

  // create index --> allows for faster query answering
  // { email: 1 } --> email sorted in asc order
  await db.collection("users").createIndex({ email: 1 }, { unique: true });

  await db.collection("events").createIndex({ organizerId: 1 });

  await db.collection("registrations").createIndex({ eventId: 1 });
  await db.collection("registrations").createIndex({ userId: 1 });

  await db.collection("tickets").createIndex({ ticketId: 1 }, { unique: true });
  await db.collection("tickets").createIndex({ userId: 1, createdAt: -1 });
}
