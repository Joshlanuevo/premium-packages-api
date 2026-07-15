import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";
import * as TransactionController from "../controllers/transaction.controller";

const router = Router();

router.post("/transactions/update", requireAuth, asyncHandler(TransactionController.updateTransaction));

export default router;