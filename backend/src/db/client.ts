import { Db, MongoClient } from "mongodb";
import { env } from "../config/env";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectDb(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(env.MONGODB_URI);
  await client.connect();

  db = client.db();
  return db;
}

export function getDb(): Db {
  if (!db)
    throw new Error("DB not connected. Call connectDb() before getDb().");
  return db;
}

export async function closeDb(): Promise<void> {
  await client?.close();
  client = null;
  db = null;
}
