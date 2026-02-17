import { Router } from "express";
import { ObjectId } from "mongodb";
import { z } from "zod";
import { env } from "../config/env";
import { getDb } from "../db/client";
import { hashPassword, verifyPassword } from "../utils/password";
import { signJwt, verifyJwt } from "../utils/jwt";
import { AUTH_COOKIE_NAME, authCookieOptions } from "../config/cookies";
import {
  participantTypes,
  userRoles,
  type ParticipantType,
  type UserDoc,
} from "../db/models";

export const authRouter = Router();

const signupSchema = z.object({
  name: z.string().trim().min(1),
  email: z.email(),
  password: z.string().min(8),
  role: z.enum(userRoles).default("participant"),
  participantType: z.enum(participantTypes).optional(),
  collegeOrOrganization: z.string().trim().min(2).max(120).optional(),
  contactNumber: z.string().trim().min(7).max(20).optional(),
});

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
});

// DO NOT send passwordHash to the client --> this function removes passwordHash from the user object
function toPublicUser(user: {
  _id: ObjectId;
  email: string;
  role: string;
  name: string;
  createdAt: Date;
}) {
  return {
    id: user._id.toString(),
    email: user.email,
    role: user.role,
    name: user.name,
    createdAt: user.createdAt,
  };
}

function isIiitEmail(email: string): boolean {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";

  return env.IIIT_EMAIL_DOMAINS.some(
    (allowedDomain) => domain === allowedDomain,
  );
}

authRouter.post("/signup", async (req, res, next) => {
  try {
    const parsed = signupSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: "Invalid request", details: parsed.error.flatten() },
      });
    }

    const db = getDb();
    const users = db.collection<UserDoc>("users");
    const { name, password, collegeOrOrganization, contactNumber } =
      parsed.data;

    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const isIiitDomainEmail = isIiitEmail(normalizedEmail);

    if (parsed.data.role !== "participant") {
      return res
        .status(403)
        .json({ error: { message: "Only participant signup is allowed" } });
    }

    const requestedType = parsed.data.participantType;
    const participantType: ParticipantType =
      requestedType ?? (isIiitDomainEmail ? "iiit" : "non-iiit");

    if (participantType === "iiit" && !isIiitDomainEmail) {
      return res.status(400).json({
        error: {
          message:
            "IIIT participant signup requires an IIIT-issued email address",
        },
      });
    }

    if (requestedType === "non-iiit" && isIiitDomainEmail) {
      return res.status(400).json({
        error: {
          message:
            "IIIT-issued email should register as participantType='iiit'",
        },
      });
    }

    const passwordHash = await hashPassword(password);
    const createdAt = new Date();

    const userToInsert: UserDoc = {
      _id: new ObjectId(),
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
      role: "participant",
      participantType,
      accountStatus: "active",
      isDisabled: false,
      createdAt,
    };

    if (collegeOrOrganization?.trim()) {
      userToInsert.collegeOrOrganization = collegeOrOrganization.trim();
    }

    if (contactNumber?.trim()) {
      userToInsert.contactNumber = contactNumber.trim();
    }

    const insertResult = await users.insertOne(userToInsert);

    const token = signJwt({
      userId: insertResult.insertedId.toString(),
      role: "participant",
    });
    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions);

    const user = {
      _id: insertResult.insertedId,
      name: name.trim(),
      email: normalizedEmail,
      role: "participant",
      createdAt,
    };

    return res.status(201).json({ user: toPublicUser(user) });
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      (err as { code?: number }).code === 11000 // error code when unique constraint violated in mongodb
    ) {
      return res
        .status(409)
        .json({ error: { message: "Email already in use" } });
    }
    return next(err);
  }
});

authRouter.post("/login", async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: { message: "Invalid request", details: parsed.error.flatten() },
      });
    }

    const db = getDb();
    const users = db.collection<UserDoc>("users");
    const email = parsed.data.email.toLowerCase();

    const user = await users.findOne({ email });
    if (!user) {
      return res
        .status(401)
        .json({ error: { message: "Invalid credentials" } });
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return res
        .status(401)
        .json({ error: { message: "Invalid credentials" } });
    }

    const token = signJwt({
      userId: user._id.toString(),
      role: user.role,
    });

    res.cookie(AUTH_COOKIE_NAME, token, authCookieOptions);

    return res.json({
      user: toPublicUser(user),
    });
  } catch (err) {
    return next(err);
  }
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: authCookieOptions.httpOnly,
    sameSite: authCookieOptions.sameSite,
    secure: authCookieOptions.secure,
    path: authCookieOptions.path,
  });

  return res.json({ ok: true });
});

authRouter.get("/me", async (req, res, next) => {
  try {
    const token = req.cookies?.[AUTH_COOKIE_NAME];
    if (!token || typeof token !== "string") {
      return res.status(401).json({ error: { message: "Not authenticated" } });
    }

    const payload = verifyJwt(token);

    const db = getDb();
    const user = await db
      .collection("users")
      .findOne({ _id: new ObjectId(payload.userId) });

    if (!user) {
      return res.status(401).json({ error: { message: "Not authenticated" } });
    }

    return res.json({
      user: toPublicUser({
        _id: user._id as ObjectId,
        email: String(user.email),
        role: String(user.role),
        name: String(user.name),
        createdAt: user.createdAt as Date,
      }),
    });
  } catch (err) {
    return next(err);
  }
});
