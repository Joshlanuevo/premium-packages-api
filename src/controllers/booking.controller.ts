import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { ok } from "../utils/response";
import * as BookingService from "../services/booking.service";

export async function createBooking(req: AuthedRequest, res: Response) {
  const userId = req.user!.userId;
  const result = await BookingService.createBooking(req.body, userId);
  return ok(res, result, "Booking created successfully.");
}