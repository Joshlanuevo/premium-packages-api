import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import * as PackageController from "../controllers/package.controller";

const router = Router();

router.get("/packages/:id", asyncHandler(PackageController.getPackage));

router.post(
  "/packages",
  requireAuth,
  requireRole(),
  asyncHandler(PackageController.writePackage)
);

export default router;