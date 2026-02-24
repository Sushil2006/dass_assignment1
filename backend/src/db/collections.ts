export const collections = {
  users: "users",
  events: "events",
  registrations: "registrations",
  tickets: "tickets",
  payments: "payments",
  organizerPasswordResetRequests: "organizer_password_reset_requests",
  attendances: "attendances",
  attendanceAuditLogs: "attendance_audit_logs",
  announcements: "announcements",
} as const;

export type CollectionName = (typeof collections)[keyof typeof collections];
