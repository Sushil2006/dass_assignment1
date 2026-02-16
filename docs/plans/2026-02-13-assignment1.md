# Felicity Event Management System (Assignment 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish Assignment 1 fast, with full rubric coverage, by building only what is required on top of the current codebase.

**Architecture:** React (Vite + TS + React-Bootstrap) frontend, Express (TS) REST backend, MongoDB. Auth uses JWT in `httpOnly` cookie. Keep flows simple and deterministic.

**Tech Stack:** React, Express, MongoDB Node driver, Zod, bcrypt, JWT, multer, nodemailer, socket.io.

---

## 1) KISS Rules for This Project

- Build for marks, not production hardening.
- Implement assignment-required behavior first; defer polish.
- Keep one clear path per flow; avoid optional branching unless rubric requires it.
- Prefer simple REST + Mongo queries over abstractions.
- Reuse existing files/patterns in current codebase.

---

## 2) Verified Current State (from repo)

### Backend present
- Auth routes exist: `backend/src/routes/auth.ts`
- Auth middleware exists: `backend/src/middleware/auth.ts`
- Models/indexes scaffolding exists: `backend/src/db/models.ts`, `backend/src/db/indexes.ts`
- App/server bootstrapping exists: `backend/src/app.ts`, `backend/src/server.ts`

### Frontend present
- Router + role-protected routes exist: `frontend/src/App.tsx`, `frontend/src/components/ProtectedRoute.tsx`
- Login/signup pages exist: `frontend/src/pages/Login.tsx`, `frontend/src/pages/Signup.tsx`
- Nav exists: `frontend/src/components/AppNav.tsx`

### Immediate gaps
- `as any` in auth login token signing: `backend/src/routes/auth.ts`
- Signup still generic and role-select based (not assignment-compliant): `frontend/src/pages/Signup.tsx`
- Domain models and feature routes for events/participation/admin flows not implemented yet.

---

## 3) Fixed Feature Selection (Advanced Part)

Implement exactly these:
- Tier A: Merchandise Payment Approval, QR Scanner + Attendance
- Tier B: Organizer Password Reset Workflow, Real-time Discussion Forum
- Tier C: Anonymous Feedback

No extra advanced feature work outside this list.

---

## 4) Fast Execution Plan (Milestone Order)

Each milestone ends with `npm run typecheck` (backend) and `npm run build` (frontend when UI changed).

## Milestone 0 - Stabilize Existing Skeleton

**Target:** make current base compile and match assignment auth entry points.

**Tasks**
1. Fix `Button as={Link}` typing issue in auth pages.
   - Files: `frontend/src/pages/Login.tsx`, `frontend/src/pages/Signup.tsx`
2. Remove forbidden `as any` in auth route.
   - File: `backend/src/routes/auth.ts`
3. Convert signup UI to participant-only required fields.
   - Files: `frontend/src/pages/Signup.tsx`, `frontend/src/lib/auth.ts`
4. Update navbar to assignment role menus.
   - File: `frontend/src/components/AppNav.tsx`

**Done when**
- Backend typecheck passes
- Frontend build passes
- Signup/login pages work

## Milestone 1 - Core Data Model + Indexes

**Target:** lock schema before feature coding.

**Tasks**
1. Replace placeholder model types with assignment-aligned docs.
   - File: `backend/src/db/models.ts`
   - Include: user(participant/organizer/admin), event(normal/merch), participation, ticket, attendance, reset request, discussion message, feedback
2. Register all needed collection constants.
   - File: `backend/src/db/collections.ts`
3. Add uniqueness + query indexes only for required flows.
   - File: `backend/src/db/indexes.ts`

**Done when**
- DB boots with indexes
- Typecheck passes

## Milestone 2 - Auth/RBAC to Match PDF

**Target:** exact role/account rules from assignment.

**Tasks**
1. Participant signup validation: IIIT vs Non-IIIT.
   - File: `backend/src/routes/auth.ts`
2. Seed first admin from env on startup.
   - Files: `backend/src/config/env.ts`, `backend/src/server.ts`, `backend/src/startup/seedAdmin.ts`
3. Disable-check for organizer auth and authenticated requests.
   - Files: `backend/src/routes/auth.ts`, `backend/src/middleware/auth.ts`
4. Add change-password endpoint.
   - Files: `backend/src/routes/security.ts`, `backend/src/routes/index.ts`
5. Add `.env.example` files.
   - Files: `backend/.env.example`, `frontend/.env.example`

**Note**
- CSRF hardening is optional for coursework unless explicitly required by evaluator; keep as short README note, not a blocker milestone.

**Done when**
- Admin seed works
- IIIT validation works
- Disabled organizer cannot access app
- Password change works

## Milestone 3 - Admin and Organizer Management

**Target:** finish all admin rubric requirements early.

**Tasks**
1. Implement admin organizer management APIs.
   - File: `backend/src/routes/admin.ts`
   - Include create/list/disable/archive/delete-with-guard
2. Mount admin routes with role guards.
   - File: `backend/src/routes/index.ts`
3. Build admin pages.
   - Files: `frontend/src/pages/admin/AdminHome.tsx`, `frontend/src/pages/admin/ManageOrganizers.tsx`, `frontend/src/App.tsx`

**Done when**
- Admin can provision organizer and generated credentials can log in

## Milestone 4 - Event Lifecycle (Organizer + Public Browse)

**Target:** unlock event creation, publishing, and browsing.

**Tasks**
1. Add events router and organizer event CRUD.
   - Files: `backend/src/routes/events.ts`, `backend/src/routes/index.ts`
   - Support statuses: DRAFT/PUBLISHED/CLOSED/COMPLETED and derived ONGOING display
2. Add normal form schema + merch config support.
   - File: `backend/src/routes/events.ts`
3. Add public event listing, filtering, trending, detail.
   - File: `backend/src/routes/events.ts`
4. Add organizer public endpoints + detail upcoming/past events.
   - File: `backend/src/routes/organizers.ts`
5. Build organizer event screens and participant browse screens.
   - Files: `frontend/src/pages/organizer/MyEvents.tsx`, `frontend/src/pages/organizer/CreateEventWizard.tsx`, `frontend/src/pages/organizer/EventEditorForm.tsx`, `frontend/src/pages/participant/BrowseEvents.tsx`, `frontend/src/components/EventCard.tsx`
6. Implement organizer self profile (including Discord webhook URL).
   - Files: `backend/src/routes/organizers.ts`, `frontend/src/pages/organizer/OrganizerProfile.tsx`, `frontend/src/pages/OrganizerDashboard.tsx`

**Done when**
- Organizer can create/publish events
- Participant can browse/search/filter and open event detail

## Milestone 5 - Participation, Tickets, Participant Dashboard

**Target:** complete participant core experience.

**Tasks**
1. Implement register/purchase endpoints with validation.
   - File: `backend/src/routes/participations.ts`
   - Include file-upload support for normal-event form fields when field type is `file`
2. Implement ticket generation + fetch endpoint.
   - Files: `backend/src/utils/tickets.ts`, `backend/src/routes/tickets.ts`
3. Add dev SMTP ticket email send.
   - File: `backend/src/utils/email.ts`
4. Add participant APIs and pages: my events, ticket detail, event detail flow.
   - Files: `backend/src/routes/participants.ts`, `frontend/src/pages/participant/MyEvents.tsx`, `frontend/src/pages/participant/TicketDetail.tsx`, `frontend/src/pages/participant/EventDetail.tsx`
5. Implement cancellation/rejection statuses to support history tabs.
   - Files: `backend/src/routes/participations.ts`, `backend/src/db/models.ts`
6. Add protected file-download routes (owner/organizer/admin only).
   - Files: `backend/src/routes/uploads.ts`, `backend/src/routes/index.ts`

**Done when**
- Register/purchase works
- Ticket + QR visible
- Dashboard tabs (normal/merch/completed/cancelled-rejected) are accurate

## Milestone 6 - Preferences, Follow, Profile

**Target:** complete onboarding + recommendation requirement.

**Tasks**
1. Participant profile + onboarding + follow/unfollow APIs.
   - File: `backend/src/routes/participants.ts`
2. Organizer listing/detail UI with follow actions.
   - Files: `frontend/src/pages/participant/Organizers.tsx`, `frontend/src/pages/participant/OrganizerDetail.tsx`
3. Participant profile page + change password form.
   - Files: `frontend/src/pages/participant/Profile.tsx`, `frontend/src/pages/common/ChangePassword.tsx`

**Done when**
- Onboarding stores interests/follows
- Event ordering reflects follows/interests

## Milestone 7 - Organizer Event Ops (Participants + CSV + Analytics)

**Target:** organizer-side management and export requirements.

**Tasks**
1. Add event participants list + CSV endpoints.
   - Files: `backend/src/routes/events.ts`, `backend/src/utils/csv.ts`
2. Build organizer event detail page tabs.
   - File: `frontend/src/pages/organizer/EventDetail.tsx`
3. Add organizer dashboard analytics summary.
   - Files: `backend/src/routes/events.ts`, `frontend/src/pages/OrganizerDashboard.tsx`

**Done when**
- Organizer sees participants, analytics, and can export CSV

## Milestone 8 - Advanced Features (Selected Set Only)

### 8A. Organizer Password Reset via Admin
- Backend: `backend/src/routes/passwordReset.ts`, `backend/src/routes/index.ts`
- UI: `frontend/src/pages/organizer/PasswordResetRequest.tsx`, `frontend/src/pages/admin/PasswordResetRequests.tsx`
- Minimum flow: request -> admin approve/reject -> status history visible

### 8B. Merchandise Payment Approval
- Backend: `backend/src/routes/participations.ts`, `backend/src/routes/merchApproval.ts`
- UI: `frontend/src/pages/organizer/MerchApprovals.tsx`
- Minimum flow: place order (awaiting proof) -> upload proof -> organizer approve/reject -> ticket only on approve

### 8C. QR Attendance
- Backend: `backend/src/routes/attendance.ts`
- UI: `frontend/src/pages/organizer/AttendanceScanner.tsx`
- Minimum flow: scan QR/ticketId, reject duplicate, manual override, CSV export

### 8D. Real-time Discussion
- Backend: `backend/src/realtime/socket.ts`, `backend/src/routes/discussion.ts`
- UI: `frontend/src/pages/participant/EventDiscussion.tsx`
- Minimum flow: post, thread reply, react, organizer pin/delete, basic new-message notification

### 8E. Anonymous Feedback
- Backend: `backend/src/routes/feedback.ts`
- UI: `frontend/src/pages/participant/LeaveFeedback.tsx`, organizer feedback tab in `frontend/src/pages/organizer/EventDetail.tsx`
- Minimum flow: attended participants only, one feedback per user/event, aggregated organizer view + CSV

**Done when**
- All 5 selected advanced features are demonstrable end-to-end

## Milestone 9 - Deployment + Submission Package

**Target:** submit-ready deliverable.

**Tasks**
1. Deploy backend + frontend + MongoDB Atlas.
2. Set production env vars and CORS origin.
3. Create root `README.md` and `deployment.txt` as required.
4. Verify zip structure exactly:
   - `<roll_no>/backend`
   - `<roll_no>/frontend`
   - `<roll_no>/README.md`
   - `<roll_no>/deployment.txt`

---

## 5) Minimal Verification Loop (after every milestone)

Run:
- `cd backend && npm run typecheck`
- `cd frontend && npm run build` (if frontend changed)

Manual smoke checks:
- Auth flow (signup/login/logout/me)
- One organizer event publish flow
- One participant registration/purchase flow

If a milestone fails checks, do not continue to next milestone.

---

## 6) Requirement Mapping (Quick Rubric Check)

### Core
- Auth/security/session: Milestones 0-2
- Onboarding/preferences/recommendations: Milestone 6 (+ ordering in Milestone 4)
- Participant dashboard + tickets + QR/email: Milestone 5
- Browse/search/filter/trending/details: Milestone 4
- Organizer dashboard/create/edit/participants/CSV/profile: Milestones 4, 7
- Admin organizer management: Milestone 3
- Deployment deliverables: Milestone 9

### Advanced (chosen)
- Tier A: merch approval + QR attendance: Milestone 8B, 8C
- Tier B: organizer password reset + real-time discussion: Milestone 8A, 8D
- Tier C: anonymous feedback: Milestone 8E

---

## 7) Out-of-Scope Unless Time Remains

- Production-grade security extras beyond assignment text
- Fancy architecture/refactors not needed for rubric
- Non-required UI polish

If unsure between simple vs fancy, choose simple.
