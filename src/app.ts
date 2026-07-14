import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import routes from "./routes";
import { errorHandler } from "./middleware/errorHandler";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: process.env.CORS_ORIGIN?.split(",") ?? "*",
      credentials: true,
    })
  );
  app.use(express.json({ limit: "5mb" }));
  app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

  app.use("/api", routes);

  app.use(errorHandler);

  return app;
}
