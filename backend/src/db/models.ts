import { ObjectId } from "mongodb";

export const userRoles = ["participant", "organizer", "admin"] as const; // as const --> treat each element as a literal type
export type UserRole = (typeof userRoles)[number]; // (typeof userRoles)[number] becomes "admin" | "user" | "guest"
// can use later like:
// const user: UserRole = "participant";

export const participantTypes = ["iiit", "non-iiit"] as const;
export type ParticipantType = (typeof participantTypes)[number];

export type UserDoc = {
  _id: ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  name: string;
  firstName?: string;
  lastName?: string;
  createdAt: Date;
  participantType?: ParticipantType;
  collegeOrOrganization?: string;
  contactNumber?: string;
  isDisabled?: boolean;
  archivedAt?: Date;
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

export const registrationEventTypes = ["NORMAL", "MERCH"] as const;
export type RegistrationEventType = (typeof registrationEventTypes)[number];

export type RegistrationFieldType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "file";

export type RegistrationFieldFile = {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
};

export type RegistrationResponseValue = string | number | string[];

export type RegistrationFormResponse = {
  key: string;
  label: string;
  type: RegistrationFieldType;
  value?: RegistrationResponseValue;
  file?: RegistrationFieldFile;
};

export type MerchPurchaseSnapshot = {
  sku: string;
  label: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
};

export type RegistrationDoc = {
  _id: ObjectId;
  eventId: ObjectId;
  userId: ObjectId;
  status: RegistrationStatus;
  createdAt: Date;
  updatedAt?: Date;
  eventType?: RegistrationEventType;
  ticketId?: string;
  normalResponses?: RegistrationFormResponse[];
  merchPurchase?: MerchPurchaseSnapshot;
};

export type RegistrationInsert = Omit<RegistrationDoc, "_id">;

export type TicketDoc = {
  _id: ObjectId;
  ticketId: string;
  eventId: ObjectId;
  userId: ObjectId;
  participationId: ObjectId;
  eventType: RegistrationEventType;
  qrPayload: string;
  createdAt: Date;
};

export type TicketInsert = Omit<TicketDoc, "_id">;

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

export const organizerPasswordResetRequestStatuses = [
  "pending",
  "approved",
  "rejected",
] as const;
export type OrganizerPasswordResetRequestStatus =
  (typeof organizerPasswordResetRequestStatuses)[number];

export type OrganizerPasswordResetRequestDoc = {
  _id: ObjectId;
  organizerId: ObjectId;
  reason: string;
  status: OrganizerPasswordResetRequestStatus;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date;
  adminComment?: string;
  reviewedByAdminId?: ObjectId;
};

export type OrganizerPasswordResetRequestInsert = Omit<
  OrganizerPasswordResetRequestDoc,
  "_id"
>;
