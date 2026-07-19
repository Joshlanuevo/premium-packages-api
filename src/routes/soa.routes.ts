import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as SOAController from "../controllers/soa.controller";

const router = Router();

router.post("/soa/generate", requireAuth, asyncHandler(SOAController.generateSOA));
router.post("/soa/send-email", requireAuth, asyncHandler(SOAController.sendSOAEmail));

export default router;