// parse the .env file into a structured object that can be used in other parts of the program
import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET should be at least 32 characters"),
  CLIENT_ORIGIN: z.string().url(),
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  SMTP_HOST: z.string().trim().min(1).default("127.0.0.1"),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  SMTP_USER: z.string().trim().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z
    .string()
    .trim()
    .min(1)
    .default("Felicity <no-reply@felicity.local>"),

  IIIT_EMAIL_DOMAINS: z
    .string()
    .default("iiit.ac.in")
    .transform((raw) =>
      raw
        .split(",")
        .map((domain) => domain.trim().toLowerCase())
        .filter((domain) => domain.length > 0),
    )
    .refine(
      (domains) => domains.length > 0,
      "IIIT_EMAIL_DOMAINS must contain at least one domain",
    ),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_NAME: z.string().min(1).default("System Admin"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}

export const env = parsed.data;
