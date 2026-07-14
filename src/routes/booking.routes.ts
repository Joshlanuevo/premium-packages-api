import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as BookingController from "../controllers/booking.controller";

const router = Router();

router.post("/bookings", requireAuth, asyncHandler(BookingController.createBooking));

export default router;