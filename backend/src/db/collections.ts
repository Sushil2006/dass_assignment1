export const collections = {
  users: "users",
  events: "events",
  registrations: "registrations",
  tickets: "tickets",
  payments: "payments",
  attendances: "attendances",
  announcements: "announcements",
} as const;

export type CollectionName = (typeof collections)[keyof typeof collections];
