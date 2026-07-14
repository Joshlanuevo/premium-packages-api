import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { ok } from "../utils/response";
import * as PaymentTermsService from "../services/paymentTerms.service";

export async function createFullPayment(req: AuthedRequest, res: Response) {
  const { installmentId, totalPhp, totalUsd, currency } = req.body ?? {};
  const result = await PaymentTermsService.createFullPayment(
    installmentId,
    totalPhp ?? 0,
    totalUsd ?? 0,
    currency,
    req.user!.userId
  );
  return ok(res, result, "Full payment created successfully.");
}

export async function addAdditionalPaymentTerm(req: AuthedRequest, res: Response) {
  const { installmentId, amountPaidPhp, amountPaidUsd, due_date } = req.body ?? {};
  const result = await PaymentTermsService.addAdditionalPaymentTerm(
    installmentId,
    amountPaidPhp ?? 0,
    amountPaidUsd ?? 0,
    due_date,
    req.user!.userId
  );
  return ok(res, result, "Additional payment term added successfully.");
}

export async function deletePaymentTerm(req: AuthedRequest, res: Response) {
  const { paymentId } = req.body ?? {};
  const result = await PaymentTermsService.deletePaymentTerm(paymentId, req.user!.userId);
  return ok(res, result, "Payment term deleted successfully.");
}

export async function updatePaymentDueDate(req: AuthedRequest, res: Response) {
  const { paymentId, due_date } = req.body ?? {};
  const result = await PaymentTermsService.updatePaymentDueDate(paymentId, due_date, req.user!.userId);
  return ok(res, result, "Payment due date updated successfully.");
}