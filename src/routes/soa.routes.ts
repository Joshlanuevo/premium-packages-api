import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as SOAController from "../controllers/soa.controller";

const router = Router();

router.post("/soa/generate", requireAuth, asyncHandler(SOAController.generateSOA));

export default router;