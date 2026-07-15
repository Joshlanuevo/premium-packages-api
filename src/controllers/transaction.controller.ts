import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { ok } from "../utils/response";
import * as TransactionService from "../services/transaction.service";

export async function updateTransaction(req: AuthedRequest, res: Response) {
  const result = await TransactionService.updateTransaction(req.body, req.user!.userId);
  return ok(res, result.data, result.message);
}