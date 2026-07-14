import { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface ErrorWithStatus {
  status?: number;
  message?: string;
}

function hasStatus(err: unknown): err is ErrorWithStatus {
  return (
    typeof err === "object" &&
    err !== null &&
    "status" in err &&
    typeof (err as ErrorWithStatus).status === "number"
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  if (hasStatus(err)) {
    return res.status(err.status!).json({ error: err.message || "Request failed." });
  }

  console.error(err);
  return res.status(500).json({ error: "Internal server error." });
}