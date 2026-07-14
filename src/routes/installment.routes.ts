import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { Roles } from "../constants/roles";
import * as InstallmentController from "../controllers/installment.controller";

const router = Router();

router.post("/installments/pay", requireAuth, asyncHandler(InstallmentController.payInstallment));

router.post(
  "/installments/update-payment",
  requireAuth,
  requireRole(Roles.WHITELABEL, Roles.MASTERAGENT, Roles.ACCOUNTING),
  asyncHandler(InstallmentController.updatePayment)
);

export default router;