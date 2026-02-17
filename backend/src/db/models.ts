import { ObjectId } from "mongodb";

export const userRoles = ["participant", "organizer", "admin"] as const; // as const --> treat each element as a literal type
export type UserRole = (typeof userRoles)[number]; // (typeof userRoles)[number] becomes "admin" | "user" | "guest"
// can use later like:
// const user: UserRole = "participant";

export const participantTypes = ["iiit", "non-iiit"] as const;
export type ParticipantType = (typeof participantTypes)[number];

export const accountStatuses = ["active", "disabled"] as const;
export type AccountStatus = (typeof accountStatuses)[number];

export type UserDoc = {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  createdAt: Date;
  participantType?: ParticipantType;
  collegeOrOrganization?: string;
  contactNumber?: string;
  accountStatus?: AccountStatus;
  isDisabled?: boolean;
};

export type UserInsert = Omit<UserDoc, "_id">; // removes the _id attribute

export type EventDoc = {
  _id: ObjectId;
  title: string;
  organizerId: ObjectId;
  category: string;
  date: Date;
  price: number;
  capacity: number;
  createdAt: Date;
};

export type EventInsert = Omit<EventDoc, "_id">;

export const registrationStatuses = [
  "pending",
  "confirmed",
  "cancelled",
  "rejected",
] as const;
export type RegistrationStatus = (typeof registrationStatuses)[number];

export type RegistrationDoc = {
  _id: ObjectId;
  eventId: ObjectId;
  userId: ObjectId;
  status: RegistrationStatus;
  createdAt: Date;
};

export type RegistrationInsert = Omit<RegistrationDoc, "_id">;

export const paymentMethods = [
  "upi",
  "bank_transfer",
  "cash",
  "card",
  "other",
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentStatuses = ["pending", "approved", "rejected"] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export type PaymentDoc = {
  _id: ObjectId;
  registrationId: ObjectId;
  method: PaymentMethod;
  amount: number;
  proofUrl?: string;
  status: PaymentStatus;
  createdAt: Date;
};

export type PaymentInsert = Omit<PaymentDoc, "_id">;
