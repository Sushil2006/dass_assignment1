import { ObjectId } from "mongodb";
import { env } from "../config/env";
import { getDb } from "../db/client";
import { collections } from "../db/collections";
import type { UserDoc } from "../db/models";
import { hashPassword } from "../utils/password";

export async function seedFirstAdmin(): Promise<void> {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    console.log("Admin seed skipped: ADMIN_EMAIL/ADMIN_PASSWORD not set.");
    return;
  }

  const db = getDb();
  const users = db.collection<UserDoc>(collections.users);

  const existingAdmin = await users.findOne({ role: "admin" });
  if (existingAdmin) {
    return;
  }

  const createdAt = new Date();
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);

  const adminUser: UserDoc = {
    _id: new ObjectId(),
    name: env.ADMIN_NAME,
    email: env.ADMIN_EMAIL.toLowerCase(),
    passwordHash,
    role: "admin",
    isDisabled: false,
    createdAt,
  };

  try {
    await users.insertOne(adminUser);
    console.log(`Seeded first admin user: ${adminUser.email}`);
  } catch (err: unknown) {
    throw err;
  }
}
