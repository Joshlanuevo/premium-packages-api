import { Router } from "express";
import { asyncHandler } from "../middleware/asyncHandler";
import * as AuthController from "../controllers/auth.controller";

const router = Router();

router.post("/auth/login", asyncHandler(AuthController.login));

export default router;