import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import bcrypt from "bcrypt";
import { MongoClient, ObjectId } from "mongodb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envFileArg = process.argv[2];
const envPath = envFileArg
  ? path.resolve(process.cwd(), envFileArg)
  : path.resolve(__dirname, "../.env.overnight");

function loadEnvFile(filePath: string): void {
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;

    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

loadEnvFile(envPath);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function dbNameFromUri(uri: string): string {
  const parsed = new URL(uri);
  const dbName = parsed.pathname.replace(/^\//, "");
  if (!dbName) {
    throw new Error("MONGODB_URI must include a database name in path");
  }
  return dbName;
}

async function run(): Promise<void> {
  const mongoUri = requireEnv("MONGODB_URI");
  const dbName = dbNameFromUri(mongoUri);

  const adminEmail = requireEnv("ADMIN_EMAIL").toLowerCase();
  const adminPassword = requireEnv("ADMIN_PASSWORD");
  const adminName = process.env.ADMIN_NAME?.trim() || "ADMIN";

  const participantEmail = requireEnv("TEST_PARTICIPANT_EMAIL").toLowerCase();
  const participantPassword = requireEnv("TEST_PARTICIPANT_PASSWORD");
  const participantFirstName = process.env.TEST_PARTICIPANT_FIRST_NAME?.trim() || "Overnight";
  const participantLastName = process.env.TEST_PARTICIPANT_LAST_NAME?.trim() || "Participant";

  const organizerEmail = requireEnv("TEST_ORGANIZER_EMAIL").toLowerCase();
  const organizerPassword = requireEnv("TEST_ORGANIZER_PASSWORD");
  const organizerName = process.env.TEST_ORGANIZER_NAME?.trim() || "Overnight Organizer";

  const now = new Date();
  const regDeadline = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const startDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const endDate = new Date(now.getTime() + 8 * 24 * 60 * 60 * 1000);

  const client = new MongoClient(mongoUri);
  await client.connect();
  const db = client.db(dbName);

  await db.dropDatabase();

  const users = db.collection("users");
  const events = db.collection("events");

  const [adminHash, participantHash, organizerHash] = await Promise.all([
    bcrypt.hash(adminPassword, 10),
    bcrypt.hash(participantPassword, 10),
    bcrypt.hash(organizerPassword, 10),
  ]);

  const adminId = new ObjectId();
  const participantId = new ObjectId();
  const organizerId = new ObjectId();

  await users.insertMany([
    {
      _id: adminId,
      name: adminName,
      email: adminEmail,
      passwordHash: adminHash,
      role: "admin",
      isDisabled: false,
      createdAt: now,
    },
    {
      _id: organizerId,
      name: organizerName,
      email: organizerEmail,
      passwordHash: organizerHash,
      role: "organizer",
      isDisabled: false,
      createdAt: now,
      organizerCategory: "club",
      organizerDescription: "Seeded organizer for overnight automation",
      organizerContactEmail: organizerEmail,
    },
    {
      _id: participantId,
      name: `${participantFirstName} ${participantLastName}`.trim(),
      firstName: participantFirstName,
      lastName: participantLastName,
      email: participantEmail,
      passwordHash: participantHash,
      role: "participant",
      participantType: "non-iiit",
      isDisabled: false,
      createdAt: now,
      interests: ["ai", "web"],
      onboardingCompleted: false,
      followedOrganizerIds: [organizerId],
    },
  ]);

  await users.createIndex({ email: 1 }, { unique: true });

  await events.insertMany([
    {
      _id: new ObjectId(),
      name: "Seeded Overnight Published Event",
      description: "Published event for participant browse tests",
      type: "NORMAL",
      tags: ["seed", "automation"],
      eligibility: "all",
      regFee: 0,
      regDeadline,
      regLimit: 500,
      startDate,
      endDate,
      organizerId,
      status: "PUBLISHED",
      createdAt: now,
      updatedAt: now,
      normalForm: {
        fields: [
          {
            key: "fullName",
            label: "Full Name",
            type: "text",
            required: true,
            order: 0,
          },
        ],
        isFormLocked: false,
      },
    },
    {
      _id: new ObjectId(),
      name: "Seeded Overnight Draft Event",
      description: "Draft event for organizer lifecycle tests",
      type: "MERCH",
      tags: ["seed", "draft"],
      eligibility: "all",
      regFee: 199,
      regDeadline,
      regLimit: 100,
      startDate,
      endDate,
      organizerId,
      status: "DRAFT",
      createdAt: now,
      updatedAt: now,
      merchConfig: {
        variants: [
          { sku: "TSHIRT-BLACK-M", label: "Black Tee M", stock: 20, priceDelta: 0 },
        ],
        perParticipantLimit: 2,
        totalStock: 20,
      },
    },
  ]);

  await client.close();

  console.log("Database reset + seed complete");
  console.log(`Admin: ${adminEmail}`);
  console.log(`Organizer: ${organizerEmail}`);
  console.log(`Participant: ${participantEmail}`);
}

run().catch((error) => {
  console.error("reset_db.ts failed", error);
  process.exit(1);
});
