# Part 1 Plan — Project Setup (React + TS + React-Bootstrap + Zod, Express + TS, MongoDB Driver)

This part gets you to a working dev setup: backend server running with a health check + Mongo connection, and frontend running with React-Bootstrap + routing + an API client that sends `httpOnly` cookies (`credentials: "include"`).

## 1) Prereqs (10 minutes)

1. Install tools.
- Node.js LTS (18+ recommended)
- npm

2. Decide where you’ll develop vs what you’ll submit.
- Develop in this repo’s existing `backend/` and `frontend/` folders (simplest).
- At submission time, zip with the required structure: `<roll_no>/backend`, `<roll_no>/frontend`, `<roll_no>/README.md`, `<roll_no>/deployment.txt`.

## 2) Backend Setup (Express + TypeScript) (45–90 minutes)

1. Create the backend project.
- `cd backend`
- `npm init -y`

2. Install runtime dependencies.
- `npm i express cors cookie-parser morgan dotenv jsonwebtoken bcrypt multer mongodb zod`

3. Install dev dependencies.
- `npm i -D typescript tsx @types/node @types/express @types/cors @types/cookie-parser @types/morgan @types/jsonwebtoken @types/bcrypt @types/multer`

4. Create TypeScript config.
- `npx tsc --init`
- In `tsconfig.json`, set:
  - `"target": "ES2022"`
  - `"module": "CommonJS"`
  - `"moduleResolution": "Node"`
  - `"esModuleInterop": true`
  - `"types": ["node"]`
  - `"verbatimModuleSyntax": false`
  - `"outDir": "dist"`
  - `"rootDir": "src"`
  - `"strict": true`

5. Add npm scripts in `package.json`.
- `dev`: run the server with hot reload (use `tsx watch`)
- `start`: run compiled JS from `dist` (later, for deployment)
- `typecheck`: `tsc --noEmit`

6. Create folder structure.
- `mkdir -p src/config src/db src/routes src/middleware src/utils`

7. Add environment variables (dev).
- Create `src/config/env.ts`:
  - Use `zod` to parse `process.env` and fail fast on missing/invalid variables.
  - Export `env` with `PORT`, `MONGODB_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`, `UPLOAD_DIR`.
- Create `.env` (do not commit real secrets):
  - `PORT=4000`
  - `MONGODB_URI=...`
  - `JWT_SECRET=...`
  - `CLIENT_ORIGIN=http://localhost:5173`
  - `UPLOAD_DIR=./uploads`
- Create `.env.example` with the same keys (empty values).

8. Create a MongoDB connection helper (no Mongoose).
- Create `src/db/client.ts`:
  - Initialize `MongoClient` using `MONGODB_URI`.
  - Export `connectDb()` that connects once and returns `db`.
  - Export a `getDb()` that throws if not connected (helps catch boot-order mistakes).

9. Create the Express app.
- Create `src/app.ts`:
  - `express.json()`
  - `cookie-parser`
  - `morgan("dev")`
  - `cors({ origin: CLIENT_ORIGIN, credentials: true })`
  - One router mounted at `/api`
  - Central error handler that returns `{ error: { message } }`

10. Add a health route that confirms DB connectivity.
- Create `src/routes/health.ts`:
  - `GET /api/health` returns `{ ok: true, db: "up" }`
  - It should call `db.command({ ping: 1 })` using `getDb()`

11. Create the server entrypoint.
- Create `src/server.ts`:
  - Ensure `UPLOAD_DIR` exists on startup (create directory if missing).
  - Call `connectDb()` before listening.
  - Start listening on `PORT`.

12. Run the backend.
- `npm run dev`
- Verify in browser/curl:
  - `GET http://localhost:4000/api/health`

Checkpoint: backend runs, connects to MongoDB, and health check returns `{ ok: true }`.

## 3) Frontend Setup (Vite + React + TS + React-Bootstrap + Zod) (45–90 minutes)

1. Create the frontend project.
- From `<roll_no>/`:
  - `npm create vite@latest frontend -- --template react-ts`
  - `cd frontend`
  - `npm i`

2. Install UI + routing + validation libs.
- `npm i react-router-dom react-bootstrap bootstrap zod`
- (Optional but recommended for forms) `npm i react-hook-form @hookform/resolvers`
- (Optional) `npm i axios`

3. Add Bootstrap CSS.
- In `src/main.tsx`, add:
  - `import "bootstrap/dist/css/bootstrap.min.css";`

4. Add routing skeleton.
- Create pages:
  - `src/pages/Login.tsx`
  - `src/pages/Signup.tsx`
  - `src/pages/ParticipantDashboard.tsx`
  - `src/pages/OrganizerDashboard.tsx`
  - `src/pages/AdminDashboard.tsx`
- Add a router in `src/App.tsx` with routes for those pages.

5. Add a React-Bootstrap layout.
- Create `src/components/AppNav.tsx`:
  - A basic `Navbar` + `Container` + placeholder links.
- Render it in `App.tsx` (even before auth is done, it helps you iterate fast).

6. Configure API base URL + cookie sending.
- Create `.env` in `frontend/`:
  - `VITE_API_BASE_URL=http://localhost:4000`
- Create `src/lib/api.ts`:
  - If using `fetch`, always pass `credentials: "include"`.
  - If using `axios`, set `withCredentials: true` and `baseURL: import.meta.env.VITE_API_BASE_URL`.

7. Run the frontend.
- `npm run dev`
- Open `http://localhost:5173`

Checkpoint: frontend runs, uses React-Bootstrap components, and can call `/api/health` with credentials enabled.

## 4) Dev Integration Checks (15–30 minutes)

1. Confirm CORS + cookies shape (even before real auth).
- Backend `cors(...credentials: true...)` is required for cookie auth.
- Frontend API calls must include credentials.

2. Confirm you can hit health from the frontend.
- Add a temporary button on `Login` page: “Ping backend”.
- On click: call `/api/health` and render the JSON.

3. Confirm local upload directory behavior.
- Make sure `UPLOAD_DIR` exists after backend boot (you’ll need it for merch payment proofs later).

## 5) Notes For Later Parts (Important)

1. No Mongoose.
- You will define schemas/validation with Zod at the API boundary (request/response), and enforce DB constraints with Mongo indexes + careful queries.

2. Where Zod fits best.
- Backend: validate request bodies (`req.body`) and `process.env`.
- Frontend: validate forms before sending requests (especially signup/login and event creation).

3. Don’t overbuild in Part 1.
- Your only goal here is a stable dev loop and a clean skeleton you can extend in Part 2+.
