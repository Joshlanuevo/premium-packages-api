import { getFirestore } from "../config/firebase";
import { randomUUID } from "node:crypto";

const PAYMENTS_COLLECTION = "installment_payments";
const TRANSACTIONS_COLLECTION = "installment_transactions";

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

/**
 * Mirrors pay_installment(): submit a payment for review, status starts "processing".
 */
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

  await db.collection(PAYMENTS_COLLECTION).doc(id).set(data);
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

/**
 * Mirrors update_payment() MINUS the wallet-deduction branch — this system has no
 * wallet, so the balance-check/commitTransaction path from the legacy controller
 * is intentionally dropped here. If a business need for an agent-credit check
 * surfaces later, it goes here as its own explicit step, not smuggled back in via
 * a deductToWallet-style flag.
 *
 * Still TODO (ported from legacy, not yet implemented): partial payment shortfall/
 * excess redistribution across sibling payments, addons sync, full-payment
 * supersession of siblings, and submission payment_status recomputation.
 */
export async function updatePayment(payload: UpdatePaymentPayload, userId: string) {
  const db = getFirestore();
  const ref = db.collection(PAYMENTS_COLLECTION).doc(payload.id);
  const snap = await ref.get();

  if (!snap.exists) {
    const error = new Error("Payment not found.");
    (error as { status?: number }).status = 404;
    throw error;
  }

  const current = snap.data() as { status: PaymentStatus };
  const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];

  if (!allowed.includes(payload.status)) {
    const error = new Error(`Invalid status transition: ${current.status} -> ${payload.status}`);
    (error as { status?: number }).status = 400;
    throw error;
  }

  const updates: Record<string, unknown> = {
    status: payload.status,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  };

  if (payload.amountPaidPartial && payload.status === "accepted") {
    updates.amountPaidPhp = payload.amountPaidPartial;
    updates.amountPaidPartial = payload.amountPaidPartial;
  }
  if (payload.status === "rejected") {
    updates.amountPaidPartial = 0;
  }

  await ref.set(updates, { merge: true });
  return { id: payload.id, ...current, ...updates };
}
