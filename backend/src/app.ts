import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import { env } from "./config/env";
import { apiRouter } from "./routes";

export const app = express();

// adding middleware: functions that run on every single request
app.use(morgan("dev")); // http request logging to terminal
app.use(express.json()); // parse json request bodies; if client sends json, express reads the body and sets req.body to the parsed object
app.use(cookieParser()); // parse the cookie header into req.cookies object

// cors handler middleware
app.use(
  cors({
    origin: env.CLIENT_ORIGIN,
    credentials: true,
  }),
);

app.use("/api", apiRouter);

// error handler middleware
app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: { message: "Internal Server Error" } });
  },
);
