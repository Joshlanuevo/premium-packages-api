import { getFirestore } from "../config/firebase";
import { randomUUID } from "node:crypto";
import { Collections } from "../constants/collections";
import { computeAddonsSync } from "./addons.calc";
import { computeSubmissionPaymentStatus } from "./submissionStatus.calc";
import { getInstallmentTransaction, getPaymentsForInstallment } from "./paymentTerms.service";
import {
  getSubmission,
  setSubmissionPaymentStatus,
  setSubmissionVerifiedAfterAccept,
  markGuestAddonsPaidInSubmission,
} from "./submission.service";

type PaymentStatus = "pending" | "processing" | "accepted" | "rejected";

const ALLOWED_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  processing: ["accepted", "rejected"],
  pending: ["accepted", "rejected"],
  accepted: ["rejected"],
  rejected: ["pending"],
};

export interface PayInstallmentPayload {
  installmentId: string;
  amountPaidPhp?: number;
  amountPaidUsd?: number;
  payment_method: string;
  reference_number: string;
  attachment?: unknown[];
  date_of_payment: string;
  [key: string]: unknown;
}

export async function payInstallment(payload: PayInstallmentPayload, userId: string) {
  const db = getFirestore();
  const id = randomUUID();
  const now = new Date().toISOString();

  const data = {
    ...payload,
    id,
    status: "processing" as PaymentStatus,
    created_at: now,
    created_by: userId,
    updated_at: now,
    updated_by: userId,
  };

  await db.collection(Collections.installmentPayments).doc(id).set(data);
  return data;
}

export interface UpdatePaymentPayload {
  id: string;
  status: PaymentStatus;
  submissionId?: string;
  installmentId?: string;
  type?: string;
  amountPaidPhp?: number;
  amountPaidUsd?: number;
  amountPaidPartial?: number;
}

interface StoredPayment {
  status: PaymentStatus;
  type?: string;
  installmentId?: string;
  [key: string]: unknown;
}

function throwStatus(status: number, message: string): never {
  const error = new Error(message);
  (error as { status?: number }).status = status;
  throw error;
}

/**
 * Ported from update_payment(), MINUS the wallet-deduction branch (dropped
 * per the no-wallet architecture decision — see NOTES.local.md) and MINUS
 * two paths whose legacy source isn't available yet:
 *
 *   - amountPaidPartial (partial payment): needs distribute_remaining_balance()
 *     and deduct_excess_from_remaining_payments(), not yet seen. Rather than
 *     silently skipping the redistribution math, this REFUSES the request
 *     outright (501) so nobody assumes partial payments work correctly here.
 *   - accepting a 'full' payment: needs update_all_payments_to_accepted()
 *     (marks every sibling payment accepted too), not yet seen. Also
 *     explicitly refused (501). Rejecting a 'full' payment IS fully ported
 *     (it's just a delete, confirmed from source).
 *
 * Everything else IS fully ported from real source: status transition
 * validation, addons sync (computeAddonsSync), guest-addons-paid marking,
 * and submission payment_status recomputation (computeSubmissionPaymentStatus).
 */
export async function updatePayment(payload: UpdatePaymentPayload, userId: string) {
  const db = getFirestore();
  const ref = db.collection(Collections.installmentPayments).doc(payload.id);
  const snap = await ref.get();

  if (!snap.exists) {
    throwStatus(404, "Payment not found.");
  }

  const current = snap.data() as StoredPayment;
  const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];

  if (!allowed.includes(payload.status)) {
    throwStatus(400, `Invalid status transition: ${current.status} -> ${payload.status}`);
  }

  if (payload.amountPaidPartial) {
    throwStatus(
      501,
      "Partial payment redistribution is not yet implemented in this backend (needs distribute_remaining_balance/deduct_excess_from_remaining_payments source)."
    );
  }

  if (current.type === "full" && payload.status === "accepted") {
    throwStatus(
      501,
      "Accepting a full-payment settlement is not yet implemented in this backend (needs update_all_payments_to_accepted source)."
    );
  }

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = {
    status: payload.status,
    updated_at: now,
    updated_by: userId,
  };

  await ref.set(updates, { merge: true });

  if (current.type === "full" && payload.status === "rejected") {
    // Legacy deletes the payment record entirely on full-payment rejection,
    // reverting the booking to its prior installment schedule.
    await ref.delete();
  } else if (current.type === "addons") {
    const installmentId = payload.installmentId ?? current.installmentId;
    if (installmentId) {
      await syncInstallmentAddons(installmentId, userId);
    }
    if (payload.status === "accepted" && payload.submissionId) {
      await markGuestAddonsPaidInSubmission(payload.submissionId);
    }
  } else if (payload.status === "accepted") {
    if (payload.submissionId) {
      const installmentId = payload.installmentId ?? current.installmentId;
      const [payments, installment] = installmentId
        ? await Promise.all([getPaymentsForInstallment(installmentId), getInstallmentTransaction(installmentId)])
        : [[], null];
      const recomputed = computeSubmissionPaymentStatus(payments, installment?.status ?? null) ?? "verified";
      await setSubmissionVerifiedAfterAccept(payload.submissionId, recomputed);
    }
  } else if (payload.status === "rejected" || payload.status === "pending") {
    const installmentId = payload.installmentId ?? current.installmentId;
    if (payload.submissionId && installmentId) {
      const [payments, installment] = await Promise.all([
        getPaymentsForInstallment(installmentId),
        getInstallmentTransaction(installmentId),
      ]);
      const recomputed = computeSubmissionPaymentStatus(payments, installment?.status ?? null);
      if (recomputed) {
        await setSubmissionPaymentStatus(payload.submissionId, recomputed);
      }
    }
  }

  return { id: payload.id, ...current, ...updates };
}

/**
 * Ported from syncInstallmentTransactionAddons(). Recomputes an
 * installment's totals from ALL its payments and writes the result back —
 * see computeAddonsSync (addons.calc.ts) for the pure math.
 */
async function syncInstallmentAddons(installmentId: string, userId: string): Promise<void> {
  const db = getFirestore();
  const txSnap = await db
    .collection(Collections.installmentTransactions)
    .where("id", "==", installmentId)
    .limit(1)
    .get();

  if (txSnap.empty) {
    throwStatus(404, "Installment transaction not found.");
  }

  const txDoc = txSnap.docs[0];
  const txData = txDoc.data();
  const payments = await getPaymentsForInstallment(installmentId);
  const result = computeAddonsSync(payments, txData.status);

  await txDoc.ref.update({
    amountPhp: result.amountPhp,
    amountUsd: result.amountUsd,
    remainingBalancePhp: result.remainingBalancePhp,
    remainingBalanceUsd: result.remainingBalanceUsd,
    status: result.status,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
}