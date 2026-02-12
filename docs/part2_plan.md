# Part 2 Plan — Auth + Roles + Core Models (No Mongoose)

Goal: working auth (signup/login/logout), role-based access, and core Mongo collections with indexes. Keep it minimal and extendable.

## 1) Data Model + Indexes (30–60 minutes)

1. Define collections (no Mongoose).
- `users`
- `events`
- `registrations`
- `payments`
- `announcements` (optional for now)

2. Decide minimal fields for each.
- `users`: email, passwordHash, role, name, createdAt
- `events`: title, organizerId, category, date, price, capacity, createdAt
- `registrations`: eventId, userId, status, createdAt
- `payments`: registrationId, method, amount, proofUrl, status, createdAt

3. Create a DB index setup helper.
- `src/db/indexes.ts`
- Ensure unique index on `users.email`
- Helpful indexes: `events.organizerId`, `registrations.eventId`, `registrations.userId`

## 2) Auth Utilities (30–60 minutes)

1. Password hashing helpers.
- `src/utils/password.ts`
- `hashPassword(plain)` and `verifyPassword(plain, hash)`

2. JWT helpers.
- `src/utils/jwt.ts`
- `signJwt(payload)` and `verifyJwt(token)`

3. Cookie config.
- `src/config/cookies.ts`
- `httpOnly`, `sameSite`, `secure`, `maxAge`

## 3) Auth Routes + Controllers (60–120 minutes)

1. Add auth router.
- `src/routes/auth.ts`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`

2. Implement controllers.
- Validate with Zod.
- On signup: create user, hash password, set cookie.
- On login: verify, set cookie.
- On logout: clear cookie.
- On me: return current user (no passwordHash).

3. Wire router.
- Add to `src/routes/index.ts`
- Ensure mounted under `/api` in `app.ts`

## 4) Auth Middleware (30–60 minutes)

1. `requireAuth`.
- Reads JWT from cookie.
- Attaches user to `req.user`.
- 401 if missing/invalid.

2. `requireRole(...roles)`.
- Checks `req.user.role`.
- 403 if not allowed.

## 5) Frontend Auth Screens (60–120 minutes)

1. Login form.
- `src/pages/Login.tsx`
- Inputs: email, password
- Call `/api/auth/login`
- On success: redirect based on role

2. Signup form.
- `src/pages/Signup.tsx`
- Inputs: name, email, password, role (select)
- Call `/api/auth/signup`

3. Auth state helper.
- `src/lib/auth.ts`
- `getMe()` calls `/api/auth/me`
- Store user in local state (simple for now)

## 6) Role-Based Routing (30–60 minutes)

1. Create simple protected route wrapper.
- `src/components/ProtectedRoute.tsx`
- If no user: redirect `/login`
- If role mismatch: redirect `/login` or `/`

2. Wrap dashboard routes.
- Participant, Organizer, Admin dashboards should require respective roles.

## 7) Dev Checks (15–30 minutes)

1. Signup + login + logout works with cookies.
2. `/api/auth/me` returns current user.
3. Role-based redirects behave correctly.

Checkpoint: You can sign up, log in, stay logged in via cookie, and access only the correct dashboard for your role.
