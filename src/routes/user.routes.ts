import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as UserController from "../controllers/user.controller";

const router = Router();

router.get("/me", requireAuth, asyncHandler(UserController.getMe));

export default router;