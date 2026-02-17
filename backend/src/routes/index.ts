import { Router } from "express";
import { healthRouter } from "./health";
import { authRouter } from "./auth";
import { securityRouter } from "./security";

export const apiRouter = Router();

apiRouter.use(healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/security", securityRouter);
