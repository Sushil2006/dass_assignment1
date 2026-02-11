# Implementation Plan (MERN) — Felicity Event Management System

This repo currently contains the assignment PDF (`assignment1.pdf`) and your notes/summary, but no `backend/` or `frontend/` code yet. This plan assumes you will create the full MERN project from scratch in the required submission structure.

## 0) Decide Scope Up Front (30–60 minutes)

1. Confirm deliverables and folders.
You must end with `<roll_no>/backend/`, `<roll_no>/frontend/`, `<roll_no>/README.md`, `<roll_no>/deployment.txt`.

2. Pick your Part-2 (Advanced) features now because they affect your data model and UI.
Recommended set (good learning value, integrates well with core requirements):
Tier A: Merchandise Payment Approval Workflow; QR Scanner & Attendance Tracking.
Tier B: Organizer Password Reset Workflow via Admin; Real-time Discussion Forum.
Tier C: Add-to-Calendar integration.

3. Make 3 key architecture decisions (write them in your README as “Design Choices”).
Token storage: `httpOnly` cookie JWT (safer) or `localStorage` JWT (simpler).
File uploads: local disk (easy, weak for cloud deploy) or Cloudinary/S3 (best for deploy).
Emails: real SMTP provider (best) or a dev SMTP (good for local).

## 1) Project Setup (1–2 hours)

1. Create the required submission folder structure.
`<roll_no>/backend` and `<roll_no>/frontend`.

2. Initialize two Node projects.
Backend: `npm init -y`.
Frontend: `npm create vite@latest frontend -- --template react` (or your preferred React scaffold).

3. Create `.env` files and document required environment variables.
Backend must have: `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
If using email: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`.
If using Cloudinary: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
If using Discord: `DISCORD_WEBHOOK_URL` (per organizer or global).

4. Add basic tooling.
Backend: `nodemon`, `eslint` (optional), `morgan`, `cors`, `cookie-parser`, `dotenv`.
Frontend: `react-router-dom`, `axios` (or `fetch`), a small UI library (optional).

Checkpoint: You can run `backend` server and `frontend` dev server at the same time without errors.

## 2) Backend Foundation (Express + Mongo) (2–4 hours)

1. Create an Express app with clear structure.
Suggested folders: `src/app.js`, `src/server.js`, `src/config/`, `src/routes/`, `src/controllers/`, `src/models/`, `src/middleware/`, `src/utils/`.

2. Add global middleware and error handling.
JSON parsing, CORS, cookies, request logging, “not found” handler, centralized error handler.

3. Connect MongoDB with Mongoose.
Use a single connection helper and fail fast if `MONGODB_URI` is missing.

Checkpoint: `GET /api/health` returns `{ ok: true }` and your server logs show DB connected.

## 3) Data Model Design (Do This Before Writing Many Routes) (3–6 hours)

Your goal is: minimal models that satisfy the assignment, and are extensible for advanced features.

1. Pick a user-model strategy.
Recommended for beginners: a single `User` collection with `role` and role-specific subdocuments.
Alternative: separate collections (`participants`, `organizers`, `admins`) with a shared auth layer.

2. Implement minimum schemas (core).
User:
`role` (`participant` | `organizer` | `admin`), `email` (unique), `passwordHash`, `isDisabled`, `createdAt`.
Participant fields:
`firstName`, `lastName`, `participantType` (`IIIT` | `NON_IIIT`), `orgName`, `contactNumber`, `interests[]`, `followedOrganizerIds[]`.
Organizer fields:
`name`, `description`, `category`, `contactEmail`, `contactNumber`, `discordWebhookUrl` (optional).
Event:
`name`, `description`, `type` (`NORMAL` | `MERCH`), `tags[]`, `eligibility`, `regFee`, `regDeadline`, `regLimit`, `startDate`, `endDate`, `organizerId`, `status` (`DRAFT` | `PUBLISHED` | `ONGOING` | `CLOSED` | `COMPLETED`).
Normal event form schema:
`formSchema` with field definitions (type, label, required, options, order); `isFormLocked`.
Merchandise details:
`variants[]` (size/color/etc), `stock`, `perParticipantLimit`.
Registration/Purchase:
Store one record per participant per event with `status`, `createdAt`, and type-specific fields.
Ticket:
`ticketId` (unique), `eventId`, `participantId`, `qrPayload`, `issuedAt`.

3. Add indexes early.
Unique index: user email; ticketId.
Search index: event name, organizer name (or store organizerName on event as a denormalized field).

Checkpoint: You can create a sample event + user in Mongo and fetch it back with a script or route.

## 4) Authentication + RBAC (Core Requirement) (4–8 hours)

1. Participant signup.
Validate IIIT domain (e.g., `@iiit.ac.in`) for `participantType=IIIT`.
Hash passwords with `bcrypt`.
After signup, create onboarding state (a boolean like `hasOnboarded`).

2. Organizer login.
No self-registration; only Admin can create organizer accounts.

3. Admin provisioning.
On backend boot, create the first admin if none exists using `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

4. Login and session persistence.
Implement `POST /api/auth/login` returning a JWT.
Persist session across restarts by storing JWT in an `httpOnly` cookie with a long expiry (simple) or add refresh-token flow (more secure).

5. Authorization middleware.
`requireAuth` verifies JWT.
`requireRole(...roles)` enforces RBAC.

6. Frontend protection contract (decide now).
Backend returns `401` when unauthenticated and `403` when role is wrong.
Frontend uses this to redirect to login or show “not allowed”.

Checkpoint: With Postman, you can login and access a protected `GET /api/me`.

## 5) Participant APIs (Core) (6–12 hours)

1. Onboarding and profile.
`GET /api/participants/me`, `PATCH /api/participants/me`.
Store interests and followed organizers in DB.

2. Organizers listing and follow/unfollow.
`GET /api/organizers` for listing.
`POST /api/participants/me/follow/:organizerId` and `DELETE ...` for follow/unfollow.

3. Browse events (search + filters + trending).
`GET /api/events` with query params: `q`, `type`, `eligibility`, `from`, `to`, `followedOnly`.
Trending endpoint: `GET /api/events/trending` returning Top 5 by registrations in last 24h.

4. Event details.
`GET /api/events/:id` returns full details including type-specific info and “canRegister” flags.

5. Register normal event.
Validate: deadline, limit, eligibility, and form schema.
Save submission answers.
Generate ticket: create a unique `ticketId`, generate QR, persist ticket.
Send email and also show ticket in “My Events”.

6. Purchase merchandise event (core flow).
Validate: stock, per-participant limit, deadline.
Decrement stock safely (use atomic update).
Generate ticket and send email.

Checkpoint: A participant can register/purchase and see the ticket ID in a “history” response.

## 6) Organizer APIs (Core) (8–16 hours)

1. Organizer profile.
`GET /api/organizers/me`, `PATCH /api/organizers/me`.

2. Create/edit events with status rules.
Draft creation: `POST /api/organizer/events`.
Update draft freely; publish via `POST /api/organizer/events/:id/publish`.
Published edit rules: only allow description update, deadline extension, increase limit, close registrations.
Ongoing/completed: prevent edits.

3. Normal-event form builder.
Store form schema; allow reorder and required/optional.
Lock form after first registration (set `isFormLocked=true` when the first submission is created).

4. Organizer dashboard data.
`GET /api/organizer/events` returning list with computed status.
Analytics for completed events: registrations, revenue, attendance counts.

5. Participants list + CSV export.
`GET /api/organizer/events/:id/participants` with search/filter.
`GET /api/organizer/events/:id/participants.csv` returns CSV.

6. Discord webhook integration.
On publish, post a message to the organizer’s configured webhook.

Checkpoint: Organizer can publish an event and see registrations + export CSV.

## 7) Admin APIs (Core) (4–8 hours)

1. Manage organizers.
`POST /api/admin/organizers` creates organizer with auto-generated password.
`GET /api/admin/organizers` lists all.
`PATCH /api/admin/organizers/:id/disable` disables login.
Decide archive vs delete; implement at least disable (safer).

2. Admin dashboard.
Show counts: organizers, participants, events, recent registrations.

Checkpoint: Admin can create an organizer and that organizer can log in.

## 8) Frontend Foundation (React) (4–8 hours)

1. App skeleton.
React Router routes for `/login`, `/signup`, and role-based areas: `/participant/*`, `/organizer/*`, `/admin/*`.

2. Auth state.
Create an `AuthProvider` that loads the current user from `GET /api/me` on app start.
Implement `ProtectedRoute` that checks auth + role.

3. API client.
Create one `api` helper (Axios or fetch wrapper) that includes credentials, handles `401/403`, and normalizes errors.

Checkpoint: You can login and get routed to the correct dashboard by role.

## 9) Participant UI (Core Screens) (8–16 hours)

1. Signup + onboarding.
After signup, route to onboarding screen to choose interests and followed clubs; allow skip.

2. Dashboard (“My Events”).
Upcoming events list and Participation History tabs: Normal, Merchandise, Completed, Cancelled/Rejected.
Ticket ID should be clickable and open a ticket detail view.

3. Browse Events.
Search bar and filters; implement fuzzy matching either server-side or client-side.
Trending widget that calls `GET /api/events/trending`.

4. Event Details + register/purchase flow.
Render form for normal events from formSchema.
Render merch variant selector and quantity limits.
Show validation and “blocked” states clearly (deadline passed, stock, limits).

5. Clubs/Organizers pages.
List + follow/unfollow; organizer detail with upcoming/past events.

6. Profile page.
Edit allowed fields; lock email and participant type.
Add a password-change screen.

Checkpoint: A participant can complete the entire journey from signup to ticket.

## 10) Organizer UI (Core Screens) (8–16 hours)

1. Organizer dashboard.
Cards/carousel of events with status and actions.

2. Create Event flow.
Wizard-style UI helps beginners: step 1 basic info; step 2 type-specific; step 3 publish.

3. Event detail page (organizer view).
Overview, analytics, participants list, CSV export.

4. Organizer profile page.
Allow editing contact details and Discord webhook url.

Checkpoint: Organizer can create a draft, build a form, publish, and inspect registrations.

## 11) Admin UI (Core Screens) (4–8 hours)

1. Manage clubs/organizers.
Form to create organizer; show generated credentials once; list with disable/archive.

2. Password reset requests page (if implementing Tier B reset workflow).

Checkpoint: Admin can provision organizers entirely via UI.

## 12) Cross-Cutting Concerns (Do These As You Go) (Ongoing)

1. Validation.
Backend: validate request bodies and return consistent error responses.
Frontend: validate forms and display helpful messages.

2. Security baseline.
Use `bcrypt`, JWT, RBAC checks in middleware, and never trust client-sent role/user IDs.
Use rate limiting on auth routes if you have time.

3. Consistent status computations.
Create one shared function that decides if an event is editable, registerable, ongoing, etc.

4. Observability.
Log important events: organizer created, event published, ticket issued, stock change, attendance scan.

## 13) Advanced Features (Part 2) (Timebox: 2–4 days total)

Implement in this order to minimize rework:

1. Tier B: Organizer Password Reset Workflow (Admin mediated).
Add `PasswordResetRequest` model; organizer submits request; admin approves/rejects; on approve generate new password and store hash; keep request history.

2. Tier A: Merchandise Payment Approval Workflow.
Change merch “purchase” into an “order” with status: `PENDING`, `APPROVED`, `REJECTED`.
Add payment proof upload and organizer approval UI.
Only on approval: decrement stock, issue QR ticket, send confirmation email.

3. Tier A: QR Scanner & Attendance Tracking.
On organizer event page add “scanner” screen.
Implement scan by camera (library) or file upload; verify ticketId; mark attendance with timestamp; reject duplicates; export attendance CSV; add manual override with audit log.

4. Tier B: Real-time Discussion Forum.
Use `socket.io` for real-time updates.
Create message model with threading fields; allow organizer moderation actions; add notifications (basic badge count is fine).

5. Tier C: Add-to-Calendar.
Generate `.ics` file for an event; add Google/Outlook links; allow export from “My Events”.

Checkpoint: Each advanced feature has a short README section describing the workflow and endpoints.

## 14) Deployment (1 day including debugging)

1. Backend deployment.
Deploy Express server to Render/Railway/Fly.
Set environment variables and ensure file uploads work in production (prefer Cloudinary/S3).

2. MongoDB Atlas.
Create Atlas cluster, whitelist IPs (or 0.0.0.0/0 for assignment), set `MONGODB_URI`.

3. Frontend deployment.
Deploy to Vercel/Netlify; set API base URL.

4. Final checks.
Login works in production; session persists; protected pages enforce RBAC; sample event registration works; emails deliver; QR ticket renders.

5. Fill `deployment.txt`.
Include frontend URL (required) and optionally backend URL for convenience.

## 15) Final Submission Checklist (2–4 hours)

1. Validate requirements quickly with a “demo script”.
Create one admin, create one organizer, publish one normal + one merch event, register as a participant, issue ticket, export CSV, scan attendance.

2. Write `README.md`.
Include setup steps, env vars, chosen advanced features, known limitations, and design choices.

3. ZIP with correct structure.
`<roll_no>/backend`, `<roll_no>/frontend`, `<roll_no>/README.md`, `<roll_no>/deployment.txt`.

## Suggested Learning Path (What To Learn While Implementing)

1. Node/Express basics: routing, middleware, controllers, error handling.
2. Mongo/Mongoose: schemas, validation, indexes, queries, aggregations.
3. Auth: bcrypt hashing, JWT signing/verification, RBAC middleware, cookies/CORS.
4. React: routing, protected routes, forms, state management, API calls.
5. “Real systems” skills: uploads, email, QR generation/scanning, deployments, debugging production issues.

