export const collections = {
  users: "users",
  events: "events",
  registrations: "registrations",
  tickets: "tickets",
  payments: "payments",
  organizerPasswordResetRequests: "organizer_password_reset_requests",
  attendances: "attendances",
  announcements: "announcements",
} as const;

export type CollectionName = (typeof collections)[keyof typeof collections];
