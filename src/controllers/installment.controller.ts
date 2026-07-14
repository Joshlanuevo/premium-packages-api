import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { ok } from "../utils/response";
import * as InstallmentService from "../services/installment.service";

export async function payInstallment(req: AuthedRequest, res: Response) {
  const result = await InstallmentService.payInstallment(req.body, req.user!.userId);
  return ok(res, result, "Payment submitted for review.");
}

export async function updatePayment(req: AuthedRequest, res: Response) {
  const result = await InstallmentService.updatePayment(req.body, req.user!.userId);
  return ok(res, result, "Payment updated successfully.");
}
