import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/requireRole";
import { asyncHandler } from "../middleware/asyncHandler";
import { Roles } from "../constants/roles";
import * as PaymentTermsController from "../controllers/paymentTerms.controller";

const router = Router();

router.post(
  "/installments/create-full-payment",
  requireAuth,
  requireRole(Roles.WHITELABEL, Roles.MASTERAGENT, Roles.ACCOUNTING, Roles.AGENT, Roles.SUBAGENT),
  asyncHandler(PaymentTermsController.createFullPayment)
);

router.post(
  "/installments/add-payment-term",
  requireAuth,
  requireRole(Roles.WHITELABEL, Roles.MASTERAGENT, Roles.ACCOUNTING, Roles.AGENT, Roles.SUBAGENT),
  asyncHandler(PaymentTermsController.addAdditionalPaymentTerm)
);

router.post(
  "/installments/delete-payment-term",
  requireAuth,
  requireRole(Roles.WHITELABEL, Roles.MASTERAGENT, Roles.ACCOUNTING),
  asyncHandler(PaymentTermsController.deletePaymentTerm)
);

router.post(
  "/installments/update-payment-due-date",
  requireAuth,
  requireRole(Roles.WHITELABEL, Roles.MASTERAGENT, Roles.ACCOUNTING),
  asyncHandler(PaymentTermsController.updatePaymentDueDate)
);

export default router;