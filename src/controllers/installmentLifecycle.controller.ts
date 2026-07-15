import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { ok } from "../utils/response";
import * as InstallmentLifecycleService from "../services/installmentLifecycle.service";

export async function cancelInstallmentStatus(req: AuthedRequest, res: Response) {
  const { id } = req.body ?? {};
  const result = await InstallmentLifecycleService.cancelInstallmentStatus(id, req.user!.userId);
  return ok(res, result, "Installment payment successfully cancelled.");
}

export async function extendInstallation(req: AuthedRequest, res: Response) {
  const { id, confirmation_no, due_date } = req.body ?? {};
  const result = await InstallmentLifecycleService.extendInstallation(
    id,
    confirmation_no,
    due_date,
    req.user!.userId
  );
  return ok(res, result, result.message);
}