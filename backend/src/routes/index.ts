import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { adminRouter } from "./admin";
import { eventsRouter } from "./events";
import { healthRouter } from "./health";
import { authRouter } from "./auth";
import { securityRouter } from "./security";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/security", securityRouter);
apiRouter.use("/events", eventsRouter);
apiRouter.use("/admin", requireAuth, requireRole("admin"), adminRouter);
