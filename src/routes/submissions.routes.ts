import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as SubmissionsController from "../controllers/submissions.controller";

const router = Router();

router.get("/submissions", requireAuth, asyncHandler(SubmissionsController.getSubmissionsByVariation));

export default router;