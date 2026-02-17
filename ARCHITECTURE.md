# Repository Architecture

Below is a high-level architecture map of the repo, showing how the major modules interact.

```mermaid
flowchart LR
  %% ============ Frontend ============
  subgraph Frontend [Frontend (Vite + React)]
    FE_main[main.tsx]
    FE_app[App.tsx (Router + Routes)]
    FE_nav[components/AppNav.tsx]
    FE_protected[components/ProtectedRoute.tsx]
    FE_pages[pages/* (Login, Signup, Dashboards, Admin)]
    FE_lib_api[lib/api.ts]
    FE_lib_auth[lib/auth.ts]
    FE_auth_state[lib/authState.ts]
    FE_assets[public/, assets/]
  end

  %% ============ Backend ============
  subgraph Backend [Backend (Express + MongoDB)]
    BE_server[server.ts]
    BE_app[app.ts]
    BE_routes_index[routes/index.ts]
    BE_routes_auth[routes/auth.ts]
    BE_routes_security[routes/security.ts]
    BE_routes_events[routes/events.ts]
    BE_routes_admin[routes/admin.ts]
    BE_routes_health[routes/health.ts]

    BE_middleware_auth[middleware/auth.ts]
    BE_db_client[db/client.ts]
    BE_db_collections[db/collections.ts]
    BE_db_indexes[db/indexes.ts]
    BE_db_models[db/models.ts]

    BE_utils_jwt[utils/jwt.ts]
    BE_utils_password[utils/password.ts]
    BE_config_env[config/env.ts]
    BE_config_cookies[config/cookies.ts]
    BE_startup_seed[startup/seedAdmin.ts]
    BE_types[types/express.d.ts]
  end

  %% ============ Data & Storage ============
  subgraph DataStores [Data & Storage]
    DB[(MongoDB)]
    Uploads[(uploads/)]
  end

  %% ============ Docs ============
  subgraph Docs [Docs & Plans]
    Docs_main[docs/*.md]
    Docs_plans[docs/plans/*.md]
    Docs_pdf[docs/assignment1.pdf]
  end

  %% -------- Frontend wiring --------
  FE_main --> FE_app
  FE_app --> FE_nav
  FE_app --> FE_protected
  FE_app --> FE_pages
  FE_pages --> FE_lib_auth
  FE_pages --> FE_lib_api
  FE_nav --> FE_lib_auth
  FE_protected --> FE_auth_state
  FE_auth_state --> FE_lib_auth
  FE_lib_auth --> FE_lib_api

  %% -------- Backend wiring --------
  BE_server --> BE_app
  BE_server --> BE_config_env
  BE_server --> BE_db_client
  BE_server --> BE_db_indexes
  BE_server --> BE_startup_seed

  BE_app --> BE_routes_index
  BE_app --> BE_config_env

  BE_routes_index --> BE_routes_auth
  BE_routes_index --> BE_routes_security
  BE_routes_index --> BE_routes_events
  BE_routes_index --> BE_routes_admin
  BE_routes_index --> BE_routes_health

  BE_routes_auth --> BE_db_client
  BE_routes_auth --> BE_db_models
  BE_routes_auth --> BE_utils_password
  BE_routes_auth --> BE_utils_jwt
  BE_routes_auth --> BE_config_env
  BE_routes_auth --> BE_config_cookies

  BE_routes_security --> BE_db_client
  BE_routes_security --> BE_utils_password

  BE_routes_events --> BE_db_client
  BE_routes_events --> BE_db_collections

  BE_routes_admin --> BE_db_client
  BE_routes_admin --> BE_db_collections
  BE_routes_admin --> BE_utils_password

  BE_middleware_auth --> BE_utils_jwt
  BE_middleware_auth --> BE_db_client
  BE_middleware_auth --> BE_config_cookies
  BE_utils_jwt --> BE_config_env

  BE_db_indexes --> BE_db_client
  BE_db_client --> BE_config_env

  BE_startup_seed --> BE_db_client
  BE_startup_seed --> BE_utils_password
  BE_startup_seed --> BE_config_env

  %% Type augmentation used across backend
  BE_routes_auth -.-> BE_types
  BE_routes_events -.-> BE_types
  BE_routes_admin -.-> BE_types
  BE_routes_security -.-> BE_types
  BE_middleware_auth -.-> BE_types

  %% Route protection (auth/role guards)
  BE_routes_events -.-> BE_middleware_auth
  BE_routes_security -.-> BE_middleware_auth
  BE_routes_admin -.-> BE_middleware_auth

  %% External connections
  FE_lib_api -->|HTTP /api/*| BE_app
  BE_db_client --> DB
  BE_server --> Uploads
```

**Codebase Overview**
This repo is a full-stack event management system with three roles: participant, organizer, and admin. The backend is an Express + MongoDB API with auth, organizer provisioning, event CRUD, and password management. The frontend is a React app with role-based routing and an admin organizer management UI. The docs folder contains the assignment brief and planning notes.

**Top Level**
- `.gitignore` — Git ignore rules for the repo.
- `ARCHITECTURE.md` — Architecture diagram and codebase overview.
- `backend/` — Backend service (Express + MongoDB).
- `frontend/` — Frontend client (React + Vite).
- `docs/` — Assignment brief, plans, and notes.
- `.opencode/.gitignore` — Ignore rules for local tool config.
- `.opencode/bun.lock` — Tool dependency lockfile.
- `.opencode/oh-my-opencode.jsonc` — Tool configuration.
- `.opencode/package.json` — Tool dependencies metadata.

**Backend Files**
- `backend/.env` — Local runtime config (Mongo URI, JWT secret, client origin, etc.).
- `backend/package.json` — Backend dependencies and scripts.
- `backend/package-lock.json` — Dependency lockfile.
- `backend/tsconfig.json` — TypeScript compiler config.
- `backend/src/server.ts` — Server bootstrap: create uploads dir, connect DB, ensure indexes, seed admin, start Express.
- `backend/src/app.ts` — Express app wiring, middleware, CORS, route mount, and error handler.
- `backend/src/routes/index.ts` — API router; mounts auth, security, events, health, and admin routes.
- `backend/src/routes/auth.ts` — Signup, login, logout, and `me` endpoints; issues JWT cookies.
- `backend/src/routes/security.ts` — Authenticated password change flow.
- `backend/src/routes/events.ts` — Organizer-scoped event CRUD plus status updates; validates normal form and merch config.
- `backend/src/routes/admin.ts` — Admin organizer provisioning, disable/archive, and delete.
- `backend/src/routes/health.ts` — Simple health check endpoint.
- `backend/src/routes/organizers.ts` — Public organizer browsing + organizer public events (not currently mounted in `routes/index.ts`).
- `backend/src/middleware/auth.ts` — JWT auth middleware and role guard; blocks disabled organizers.
- `backend/src/db/client.ts` — MongoDB client connection and `getDb()`.
- `backend/src/db/collections.ts` — Centralized collection name constants.
- `backend/src/db/indexes.ts` — Index creation on users/events/registrations.
- `backend/src/db/models.ts` — DB document types and enums.
- `backend/src/config/env.ts` — Loads and validates environment variables.
- `backend/src/config/cookies.ts` — Auth cookie name/options.
- `backend/src/utils/jwt.ts` — JWT signing and verification helpers.
- `backend/src/utils/password.ts` — Bcrypt hashing and verification.
- `backend/src/startup/seedAdmin.ts` — Optional first admin seeding on boot.
- `backend/src/types/express.d.ts` — Extends `Express.Request` with `req.user`.
- `backend/uploads/` — Upload directory created at startup (no public route yet).

**Frontend Files**
- `frontend/.env` — Vite client env vars (API base URL).
- `frontend/package.json` — Frontend dependencies and scripts.
- `frontend/package-lock.json` — Dependency lockfile.
- `frontend/vite.config.ts` — Vite build config.
- `frontend/tsconfig.json` — Base TypeScript config.
- `frontend/tsconfig.app.json` — App build TS config.
- `frontend/tsconfig.node.json` — Node tooling TS config.
- `frontend/eslint.config.js` — Linting config.
- `frontend/index.html` — Vite HTML entry.
- `frontend/README.md` — Frontend dev instructions.
- `frontend/.gitignore` — Frontend ignore rules.
- `frontend/public/vite.svg` — Public static asset.
- `frontend/src/main.tsx` — React entry point; mounts `App`.
- `frontend/src/App.tsx` — Router + role-based route layout.
- `frontend/src/App.css` — App-level styles (currently empty).
- `frontend/src/index.css` — Global styles (currently empty).
- `frontend/src/components/AppNav.tsx` — Top navigation; uses `getMe`, role menus, logout.
- `frontend/src/components/ProtectedRoute.tsx` — Route guard by auth and role.
- `frontend/src/lib/api.ts` — `fetch` wrapper for API calls (with cookies).
- `frontend/src/lib/auth.ts` — Auth API helpers: login/signup/logout/me.
- `frontend/src/lib/authState.ts` — Auth state hook that fetches `me`.
- `frontend/src/pages/Login.tsx` — Login UI and redirect by role.
- `frontend/src/pages/Signup.tsx` — Participant signup UI.
- `frontend/src/pages/ParticipantDashboard.tsx` — Minimal dashboard; calls `/api/health`.
- `frontend/src/pages/OrganizerDashboard.tsx` — Placeholder organizer dashboard.
- `frontend/src/pages/AdminDashboard.tsx` — Placeholder admin dashboard (not routed).
- `frontend/src/pages/admin/AdminHome.tsx` — Admin landing page with organizer counts.
- `frontend/src/pages/admin/ManageOrganizers.tsx` — Admin CRUD for organizers.
- `frontend/src/assets/react.svg` — Asset.

**Docs**
- `docs/assignment1.pdf` — Assignment spec.
- `docs/implementation_plan.md` — Overall implementation plan.
- `docs/notes.md` — Notes.
- `docs/part1_plan.md` — Plan for part 1.
- `docs/part2_plan.md` — Plan for part 2.
- `docs/summary.md` — Summary of work.
- `docs/plans/2026-02-13-assignment1.md` — Plan log and milestones.

**User Flows**
- Participant signup: `frontend/src/pages/Signup.tsx` -> `frontend/src/lib/auth.ts` -> `frontend/src/lib/api.ts` -> `backend/src/routes/auth.ts` -> `backend/src/utils/password.ts` -> MongoDB `users` -> JWT cookie -> redirect to `/participant`.
- Login + session restore: `frontend/src/pages/Login.tsx` -> `backend/src/routes/auth.ts` (login) -> JWT cookie; `frontend/src/lib/authState.ts` calls `/api/auth/me` on load to restore session.
- Admin organizer provisioning: `frontend/src/pages/admin/ManageOrganizers.tsx` -> `/api/admin/organizers` in `backend/src/routes/admin.ts` -> generates password -> stores organizer -> returns credentials.
- Organizer access control: `backend/src/middleware/auth.ts` blocks disabled organizers for any authenticated route.
- Organizer event management (API only): `/api/events/organizer/*` in `backend/src/routes/events.ts` handles create/list/get/update/status/delete.
- Password change: authenticated user calls `/api/security/change-password` in `backend/src/routes/security.ts`.
- Health check: `frontend/src/pages/ParticipantDashboard.tsx` calls `/api/health` in `backend/src/routes/health.ts`.

**Implemented Routes (High-Level Steps)**
- `GET /api/health` (routes/health.ts): return `{ ok: true }`.

- `POST /api/auth/signup` (routes/auth.ts): validate payload; enforce participant-only signup rules; normalize email + infer participant type; hash password; insert user; issue JWT cookie; return public user.
- `POST /api/auth/login` (routes/auth.ts): validate payload; look up user; verify password; block disabled organizers; issue JWT cookie; return public user.
- `POST /api/auth/logout` (routes/auth.ts): clear auth cookie; return `{ ok: true }`.
- `GET /api/auth/me` (routes/auth.ts): require auth; load user by id; return public user.

- `POST /api/security/change-password` (routes/security.ts): require auth; validate payload; reject same password; verify current password; update password hash; return `{ ok: true }`.

- `POST /api/events/organizer` (routes/events.ts): require organizer; validate payload (dates + type/form/merch rules); create event with status `DRAFT`; insert; return event.
- `GET /api/events/organizer` (routes/events.ts): require organizer; fetch organizer’s events sorted by create time; return list.
- `GET /api/events/organizer/:eventId` (routes/events.ts): require organizer; validate id; fetch by id + organizerId; return event or 404.
- `PATCH /api/events/organizer/:eventId` (routes/events.ts): require organizer; validate id + payload; enforce date rules; enforce type/form/merch consistency; update fields; return updated event.
- `PATCH /api/events/organizer/:eventId/status` (routes/events.ts): require organizer; validate id + status; block changes from `COMPLETED`; update status; return updated event.
- `DELETE /api/events/organizer/:eventId` (routes/events.ts): require organizer; validate id; delete by id + organizerId; return `{ ok: true }` or 404.

- `POST /api/admin/organizers` (routes/admin.ts): require admin (applied at router mount); validate payload; generate password; hash and insert organizer; return organizer + credentials.
- `GET /api/admin/organizers` (routes/admin.ts): require admin; list organizer accounts; return list.
- `PATCH /api/admin/organizers/:organizerId/disable` (routes/admin.ts): require admin; validate id; set `isDisabled=true`; return `{ ok: true }`.
- `PATCH /api/admin/organizers/:organizerId/archive` (routes/admin.ts): require admin; validate id; set `isDisabled=true`; return `{ ok: true }`.
- `DELETE /api/admin/organizers/:organizerId` (routes/admin.ts): require admin; validate id; block delete if organizer has events; delete organizer; return `{ ok: true }`.

- `GET /api/organizers` (routes/organizers.ts): list active organizers; return public organizer list. Note: router is implemented but not mounted in `backend/src/routes/index.ts`.
- `GET /api/organizers/:organizerId` (routes/organizers.ts): validate id; fetch organizer + visible events; split into upcoming/past; return organizer + events. Note: router is implemented but not mounted in `backend/src/routes/index.ts`.
