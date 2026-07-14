import { Response } from "express";

export function ok(res: Response, data: unknown, message = "OK") {
  return res.status(200).json({ status: true, message, data });
}

export function created(res: Response, data: unknown, message = "Created") {
  return res.status(201).json({ status: true, message, data });
}
