# Felicity Event Management System — Assignment 1 Summary

**Goal:** Build a centralized event/registration platform to replace ad-hoc forms/spreadsheets, using the **MERN stack** (MongoDB, Express REST APIs, React, Node.js).

## Dates & Submission
- **Deadline:** 12 Feb 2026
- **Submit:** a **single ZIP** with:
  - `<roll_no>/backend/`
  - `<roll_no>/frontend/`
  - `<roll_no>/README.md`
  - `<roll_no>/deployment.txt` (must include **Frontend URL**)

## Roles (One Role Per User)
- **Participant**
  - IIIT student
  - Non-IIIT participant
- **Organizer** (clubs/councils/fest teams)
- **Admin** (system administrator)
- **No role switching** is allowed.

## Authentication & Security
- **Participant registration**
  - IIIT participants must register with **IIIT-issued email only** (email domain validation required).
  - Non-IIIT participants register with **email + password**.
- **Organizer authentication**
  - No self-registration; **Admin provisions** organizer accounts.
  - Password reset is **requested/handled via Admin** (ties into an advanced feature option).
- **Admin provisioning**
  - Admin is the **first user** in the system.
  - Admin credentials are **backend-provisioned only** (no UI registration).
- **Security requirements**
  - Hash passwords with **bcrypt** (no plaintext storage).
  - Use **JWT auth** for all protected routes.
  - Protect all frontend pages except login/signup with **role-based access control**.
- **Session management**
  - Login redirects to role dashboard.
  - Session persists across browser restarts until logout.
  - Logout clears auth tokens.

## Onboarding & Preferences (Participants Only)
- After signup, participants can select/skip:
  - **Areas of Interest** (multi-select)
  - **Clubs/Organizers to Follow**
- Preferences must be:
  - Stored in DB
  - Editable later from Profile
  - Used to influence event ordering/recommendations

## Data Models (Minimum Required Fields)
You may add fields as needed, but must **justify** them appropriately.

### Participant
- First Name, Last Name
- Email (unique)
- Participant Type (IIIT / Non-IIIT)
- College / Organization Name
- Contact Number
- Password (hashed)

### Organizer
- Organizer Name
- Description
- Category
- Contact Email

## Events
### Event Types (each event is exactly one type)
- **Normal Event (Individual):** single participant registration (e.g., workshops, talks, competitions)
- **Merchandise Event (Individual):** used for selling merchandise; individual purchase only

### Event Attributes (minimum)
- Event Name, Description, Type, Tags
- Eligibility
- Registration Fee
- Registration Deadline
- Registration Limit
- Event Start Date, Event End Date
- Organizer ID

### Type-specific requirements
- **Normal:** dynamic **custom registration form** (form builder)
- **Merchandise:** item details (size/color/variants), stock quantity, configurable per-participant purchase limit

## Participant App Requirements
### Navigation
- Dashboard, Browse Events, Clubs/Organizers, Profile, Logout

### My Events Dashboard
- Upcoming registered events with key details
- Participation History tabs: Normal, Merchandise, Completed, Cancelled/Rejected
- Each record shows: event name/type/organizer/status, team name (if applicable), clickable ticket ID

### Browse Events
- Search with partial + fuzzy matching on event/organizer names
- Trending: Top 5 events in last 24 hours
- Filters (work with search): event type, eligibility, date range, followed clubs vs all events

### Event Details
- Show full event info, indicate type, provide register/purchase button with validation
- Block registration if deadline passed or limits/stock exhausted

### Registration / Purchase Workflows
- **Normal event:** submit registration → generate ticket → email to participant + visible in history
- **Merchandise:** purchase implies registration; decrement stock on purchase; generate QR ticket; send confirmation email; block out-of-stock purchases
- Tickets must include event + participant details, **unique Ticket ID**, and **QR code**

### Profile
- Editable: name, contact number, college/org, interests, followed clubs
- Non-editable: email, participant type
- Security settings: password reset/change mechanism (implementation design is flexible)

### Clubs/Organizers
- Listing page of approved organizers (name/category/description) with follow/unfollow
- Organizer detail page (participant view): info + upcoming/past events

## Organizer App Requirements
### Navigation
- Dashboard, Create Event, Profile, Logout, Ongoing Events

### Organizer Dashboard
- Events carousel/cards with name, type, status (Draft/Published/Ongoing/Closed) linking to event detail
- Analytics across completed events: registrations/sales/revenue/attendance stats

### Event Detail (Organizer View)
- Overview: name/type/status/dates/eligibility/pricing
- Analytics: registrations/sales, attendance, team completion, revenue
- Participants list with search/filter + CSV export (name/email/reg date/payment/team/attendance)

### Event Creation & Editing
- Flow: Create as **Draft** → define required fields → **Publish**
- Rules:
  - Draft: free edits; can publish
  - Published: can update description, extend deadline, increase limit, close registrations
  - Ongoing/Completed: no edits except status change; can be marked completed/closed
- Form builder for Normal events:
  - Field types like text/dropdown/checkbox/file upload, required/optional, reorder
  - Form locks after the first registration is received

### Organizer Profile
- Editable: name/category/description/contact email/number (login email not editable)
- **Discord webhook**: auto-post new events to Discord

## Admin App Requirements
### Navigation
- Dashboard, Manage Clubs/Organizers, Password Reset Requests, Logout

### Club/Organizer Management
- Add organizer/club:
  - System auto-generates login email + password
  - Admin receives credentials and shares with organizer
  - New accounts can log in immediately
- Remove organizer/club:
  - Remove/disable accounts (removed cannot log in)
  - Option to archive or permanently delete

## Deployment Requirements
- Frontend: static hosting (e.g., Vercel/Netlify) and provide production URL
- Backend: managed Node hosting (e.g., Render/Railway/Fly/Heroku) and provide base API URL
- Database: MongoDB Atlas; connect via environment variable

## Part 2: Advanced Features (Pick Exactly 30 Marks)
You must implement:
- **Tier A:** choose **2** features (8 marks each)
- **Tier B:** choose **2** features (6 marks each)
- **Tier C:** choose **1** feature (2 marks)
- Also: clearly list and justify the chosen features in `README.md`

### Tier A (choose 2)
- Hackathon team registration (team leader, invites, completion when team formed, team dashboard, auto-ticket for all)
- Merchandise payment approval workflow (upload proof → pending → organizer approve/reject → on approval decrement stock + QR ticket + email)
- QR scanner + attendance tracking (camera/file scan, timestamp, no duplicates, live dashboard, CSV export, manual override + audit log)

### Tier B (choose 2)
- Real-time discussion forum on event page (moderation, notifications, threading, reactions)
- Organizer password reset workflow via Admin (request/approve/reject, comments, auto-generate new password, history)
- Team chat for hackathon teams (requires Tier A hackathon teams)

### Tier C (choose 1)
- Anonymous feedback system (ratings + comments; organizer analytics/export)
- Add-to-calendar integration (.ics + Google/Outlook links; timezone/reminders; batch export)
- Bot protection (CAPTCHA + rate limiting/IP blocking + admin security monitoring dashboard)
