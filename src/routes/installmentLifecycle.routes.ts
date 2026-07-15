import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { Roles } from "../constants/roles";
import * as InstallmentLifecycleController from "../controllers/installmentLifecycle.controller";

const router = Router();

router.post(
  "/installments/extend",
  requireAuth,
  requireRole(Roles.WHITELABEL, Roles.MASTERAGENT, Roles.ACCOUNTING),
  asyncHandler(InstallmentLifecycleController.extendInstallation)
);

router.post(
  "/installments/cancel-status",
  requireAuth,
  requireRole(),
  asyncHandler(InstallmentLifecycleController.cancelInstallmentStatus)
);

export default router;