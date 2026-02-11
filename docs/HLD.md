# High-Level Design (HLD) — Felicity Event Management System (MERN)

## 1) Goal
Build a centralized platform for event discovery, registration/purchases, ticketing (QR), and organizer/admin workflows with role-based access control.

## 2) Actors (Roles)
- Participant: IIIT or Non-IIIT, can browse/register/purchase, manage profile, follow organizers, leave feedback (Tier C).
- Organizer: creates/manages events, views participants, approves merch payments (Tier A), scans tickets/marks attendance (Tier A), moderates discussions (Tier B).
- Admin: provisions/removes organizers, handles organizer password reset requests (Tier B).

## 3) System Components
- Frontend: React SPA with routes split by role (`/participant/*`, `/organizer/*`, `/admin/*`).
- Backend: Node.js + Express REST API (+ Socket.IO for real-time forum).
- Database: MongoDB (Mongoose schemas, indexes).
- File storage: local disk on the backend server (`UPLOAD_DIR`), served via a static route.
- Email: dev SMTP (Mailtrap/Ethereal) for sending tickets/notifications.

## 4) Authentication & Authorization

### 4.1 Session Strategy (Course Choice)
- Auth token: JWT stored in an `httpOnly` cookie.
- Frontend does not read the token; it just calls APIs with `credentials: "include"` / `withCredentials: true`.

### 4.2 Auth Flow
- `POST /api/auth/login`: verifies credentials, sets cookie, returns `{ user: { id, role, ... } }`.
- `POST /api/auth/logout`: clears cookie.
- `GET /api/me`: returns current user info if cookie is valid.

### 4.3 RBAC
- Middleware: `requireAuth` (JWT verify) + `requireRole("participant" | "organizer" | "admin")`.
- Backend enforces authorization; frontend only improves UX (route guards).

## 5) Core Domain Model (Conceptual)
- User:
  - Shared auth fields: `email`, `passwordHash`, `role`, `isDisabled`.
  - Participant profile fields or organizer profile fields depending on `role`.
- Organizer:
  - Profile metadata used in listings and contact info.
- Event:
  - Shared event metadata + `type` (`NORMAL`/`MERCH`) + lifecycle `status` (`DRAFT`→`PUBLISHED`→...).
  - Normal events include a `formSchema` (form builder) that locks after first registration.
  - Merchandise events include variants/stock/per-participant limits.
- Registration/Order:
  - “Normal registration” records form submissions and results in a Ticket.
  - “Merch order” records purchase intent; in Tier A payment-approval flow, Ticket issuance happens only after approval.
- Ticket:
  - Unique `ticketId` + QR payload; used for organizer scanning and attendance marking.
- Attendance:
  - Record of scans per ticket with timestamp; rejects duplicates; supports manual override + audit log (Tier A).
- Discussion:
  - Real-time messages associated with an event; organizer moderation actions (Tier B).
- Feedback:
  - Rating + comment for attended events (Tier C). Stored with `participantId` internally but never exposed in organizer-facing responses.

## 6) File Uploads (Local Disk)

### 6.1 What Uses Uploads
- Merchandise payment proof images (Tier A).
- Optional: form builder “file upload” fields (core form builder mentions file upload; you can support this minimally).

### 6.2 Storage Approach
- Use `multer` to store uploads in `UPLOAD_DIR` with safe filenames.
- Serve uploads via a static route (example: `/uploads/...`) with access control as needed:
  - Payment proofs should be visible only to the organizer/admin who needs them.

### 6.3 Deployment Note
Local disk is simplest but can be ephemeral on many hosts. For a course demo:
- Prefer a host option that supports persistent disk, or
- Accept that uploads may reset on redeploy and document it in `README.md`.

## 7) Email (Dev SMTP)
- Use dev SMTP (Mailtrap/Ethereal) to validate ticket emails locally.
- Email sends:
  - Ticket issuance confirmation (normal + merch).
  - (Optional) organizer/admin workflow notifications.

## 8) Real-time (Socket.IO) — Tier B
- Socket.IO namespace/rooms per event: participants join only if registered; organizers join for moderation.
- Persist messages in MongoDB so page reload shows history.

## 9) Key Workflows (End-to-End)

### 9.1 Participant Signup + Onboarding
- Participant registers (IIIT domain validation for IIIT type).
- Onboarding collects interests + followed organizers and stores them on the participant profile.

### 9.2 Browse + Register/Purchase + Ticket
- Browse endpoint supports search/filters/trending.
- Register normal event:
  - Validate constraints → save submission → create Ticket → email ticket.
- Purchase merch event:
  - Core: immediate success decrements stock and issues Ticket.
  - Tier A: order starts `PENDING`, payment proof uploaded, organizer approves → then stock decrement + Ticket issuance.

### 9.3 Organizer Create Event + Form Builder
- Draft → edit → publish.
- Normal-event form schema locks after first registration.
- Publish triggers Discord webhook post (core organizer feature).

### 9.4 Attendance Tracking (Tier A)
- Organizer scans QR (camera/file).
- Backend validates ticket, prevents duplicates, stores attendance timestamp.
- Export attendance CSV and allow manual override with audit log.

### 9.5 Organizer Password Reset via Admin (Tier B)
- Organizer creates request → admin reviews → approve generates a new password → organizer logs in and changes it.

### 9.6 Anonymous Feedback (Tier C)
- Participant can submit one feedback per attended event.
- Organizer sees only aggregated stats + anonymous comments.

