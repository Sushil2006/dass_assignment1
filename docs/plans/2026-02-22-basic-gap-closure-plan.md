# Basic Feature Gap-Closure Plan (Post Milestone 7)

Date: 2026-02-22  
Scope: core/basic features only (exclude all advanced features + deployment tasks)

## 1) What the assignment expects for preferences ordering/recommendations

From `docs/assignment1.pdf` (Section 5):
- participant preferences (interests + followed organizers) must be stored and editable
- preferences must influence event ordering and recommendations

Ground truth from spec:
- the PDF does **not** prescribe any fixed ranking formula/algorithm
- it only requires observable influence on ordering + a recommendation behavior

KISS-compliant interpretation:
- rank visible events with a deterministic preference score
- show recommended events as a separate top block/list
- fallback to neutral ordering when participant has no preferences

Proposed scoring (simple + explainable):
- `+100` if event organizer is followed
- `+25 * (number of matching tags/interests)`
- `+10` if event is currently ongoing
- tie-breakers: earlier `startDate`, then newer `createdAt`

This satisfies “influence ordering and recommendations” without overengineering.

---

## 2) Strict Next-Fix Order (highest impact first)

## Step 1 - Fix Browse/Search/Filter + Preference-based ordering/recommendations
Why first:
- Covers major participant marks: Browse Events + recommendations expectations
- Unlocks Section 5 and Section 9.3 compliance quickly

Changes:
- Backend: `backend/src/routes/events.ts`
  - extend public listing query support for organizer-name and followed-only mode
  - add participant-aware ranking path when auth user is participant
  - compute preference score from participant interests + followed organizers
  - return `recommendedEvents` (top N ranked) alongside ordered `events`
- Backend: `backend/src/routes/participants.ts` (if cleaner)
  - optional dedicated endpoint: `GET /api/participants/me/recommendations`
- Frontend: `frontend/src/pages/participant/BrowseEvents.tsx`
  - add filters for `eligibility`, `followedOnly`, `organizer`
  - render a “Recommended for you” section from API response

Acceptance criteria:
- changing interests/follows changes event order for same filter set
- followed organizers get visibly higher placement
- recommendation block is not identical to naive date sorting when preferences exist

## Step 2 - Fix Ticket QR requirement (render actual QR code)
Why second:
- Ticket/QR is explicitly called out in participant workflow rubric

Changes:
- Frontend: `frontend/src/pages/participant/TicketDetail.tsx`
  - render a real QR image/component from `qrPayload` (not plain text only)
  - keep payload text visible for debugging (small expandable area)
- Frontend dependency: lightweight QR library (or canvas util)

Acceptance criteria:
- ticket detail shows scannable QR code and ticket id
- existing ticket flow remains unchanged

## Step 3 - Enforce organizer event editing lifecycle rules
Why third:
- Direct organizer rubric requirement under Event Creation & Editing

Changes:
- Backend: `backend/src/routes/events.ts`
  - in `PATCH /api/events/organizer/:eventId`, enforce status-based editable fields:
    - `DRAFT`: free edits
    - `PUBLISHED`: only description, regDeadline extension, regLimit increase
    - `CLOSED`/`COMPLETED`: no content edits (status route still allowed)
  - reject invalid transitions with precise 400 messages

Acceptance criteria:
- disallowed edits fail with clear errors
- allowed published edits succeed only under constraints

## Step 4 - Enforce form lock after first registration
Why fourth:
- Explicit form-builder rule in organizer rubric

Changes:
- Backend: `backend/src/routes/events.ts`
  - when normal event has `normalForm.isFormLocked === true` and at least one registration exists, block normal form field edits/reordering
- Backend: `backend/src/routes/participations.ts`
  - no change in participant submit path except keep compatibility

Acceptance criteria:
- first registration + locked form prevents later form-structure updates
- non-form fields can still follow lifecycle rules

## Step 5 - Add participants tab search/filter in organizer event detail
Why fifth:
- Organizer detail page explicitly requires participants list search/filter + CSV
- CSV exists; search/filter still missing

Changes:
- Frontend: `frontend/src/pages/organizer/EventDetail.tsx`
  - add local search box + filters (`status`, `eventType`)
  - filter participant list client-side from fetched dataset
- Optional backend paging/filter endpoint (only if dataset grows)

Acceptance criteria:
- organizer can quickly filter confirmed/cancelled etc.
- search by participant name/email works

## Step 6 - Implement Discord webhook auto-post for new events
Why sixth:
- Organizer profile section expects webhook-based announcement integration

Changes:
- Backend: `backend/src/utils/discord.ts` (new)
  - minimal webhook sender with safe failure handling
- Backend: `backend/src/routes/events.ts`
  - after create/publish event, post concise message if organizer has webhook URL
- Keep best-effort behavior (no event-creation failure on webhook failure)

Acceptance criteria:
- when webhook configured, publish/create triggers Discord post
- webhook failures are logged but do not break API response

## Step 7 - Align participant name model with first/last name requirement
Why seventh:
- Required by data model/profile spec, but can be safely done after high-flow fixes

Changes:
- Backend: `backend/src/db/models.ts`, `backend/src/routes/auth.ts`, `backend/src/routes/participants.ts`
  - introduce `firstName`, `lastName`; keep compatibility shim for existing `name` during transition
- Frontend: `frontend/src/pages/Signup.tsx`, `frontend/src/pages/participant/Profile.tsx`
  - split/edit first and last name fields
- migration script for existing users (one-time split heuristic)

Acceptance criteria:
- new signups store first/last separately
- profile edits expose both fields
- existing users still load without breakage

## Step 8 - Show organizer contact info in participant organizer detail
Why eighth:
- Small but explicit rubric requirement

Changes:
- Frontend: `frontend/src/pages/participant/OrganizerDetail.tsx`
  - render contact email (+ contact number if present)

Acceptance criteria:
- organizer detail visibly shows contact email

---

## 3) Execution Notes

- implement sequentially in above order, one step per commit
- after each step:
  - backend: `npm run typecheck`
  - frontend: `npm run build`
- keep API responses backward-compatible where possible
- keep comments minimal and in existing short lower-case style

## 4) Definition of Done (basic features only)

Basic-feature closure is complete when Steps 1-8 are done and verified manually via:
- participant: browse/recommendation impact, event detail register/purchase, ticket with QR, profile edits
- organizer: lifecycle-correct editing, locked form behavior, event participants search/filter + csv, dashboard analytics, discord webhook post
- admin: organizer management still functional
