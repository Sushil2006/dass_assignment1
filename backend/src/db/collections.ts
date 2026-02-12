export const collections = {
  users: "users",
  events: "events",
  registrations: "registrations",
  payments: "payments",
  announcements: "announcements",
} as const;

export type CollectionName = (typeof collections)[keyof typeof collections];
