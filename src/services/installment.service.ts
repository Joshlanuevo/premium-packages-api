import { getFirestore } from "../config/firebase";
import { randomUUID } from "node:crypto";
import { Collections } from "../constants/collections";
import { computeAddonsSync } from "./addons.calc";
import { computeSubmissionPaymentStatus } from "./submissionStatus.calc";
import {
  computeBalanceAfterPayment,
  computeDistributeRemainingBalance,
  computeDeductExcess,
} from "./balance.calc";
import { getInstallmentTransaction, getPaymentsForInstallment } from "./paymentTerms.service";
import {
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
  amountPaidPhp?: number;
  amountPaidUsd?: number;
  [key: string]: unknown;
}

function throwStatus(status: number, message: string): never {
  const error = new Error(message);
  (error as { status?: number }).status = status;
  throw error;
}

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

  const now = new Date().toISOString();
  const originalAmountPhp = payload.amountPaidPhp ?? current.amountPaidPhp ?? 0;
  const originalAmountUsd = payload.amountPaidUsd ?? current.amountPaidUsd ?? 0;

  const amountToDeductPhp =
    payload.amountPaidPartial && payload.amountPaidPartial > 0 ? payload.amountPaidPartial : originalAmountPhp;
  const amountToDeductUsd =
    payload.amountPaidPartial && payload.amountPaidPartial > 0 && originalAmountPhp > 0
      ? originalAmountUsd * (payload.amountPaidPartial / originalAmountPhp)
      : originalAmountUsd;

  const updates: Record<string, unknown> = {
    status: payload.status,
    updated_at: now,
    updated_by: userId,
  };

  if (payload.amountPaidPartial && payload.amountPaidPartial > 0 && payload.status === "accepted") {
    updates.amountPaidPhp = payload.amountPaidPartial;
    updates.amountPaidUsd = amountToDeductUsd;
    updates.amountPaidPartial = payload.amountPaidPartial;
  }
  if (payload.status === "rejected") {
    updates.amountPaidPartial = 0;
  }

  await ref.set(updates, { merge: true });

  const installmentId = payload.installmentId ?? current.installmentId;

  if (payload.status === "accepted" && payload.amountPaidPartial && payload.amountPaidPartial > 0 && installmentId) {
    const remainingBalancePhp = originalAmountPhp - payload.amountPaidPartial;
    const remainingBalanceUsd = originalAmountUsd - amountToDeductUsd;

    const allPayments = await getPaymentsForInstallment(installmentId);

    if (remainingBalancePhp > 0 || remainingBalanceUsd > 0) {
      const redistributions = computeDistributeRemainingBalance(
        allPayments,
        payload.id,
        remainingBalancePhp,
        remainingBalanceUsd
      );
      await applyRedistributions(redistributions, userId);
    } else if (remainingBalancePhp < 0 || remainingBalanceUsd < 0) {
      const excessPhp = payload.amountPaidPartial - originalAmountPhp;
      const excessUsd = amountToDeductUsd - originalAmountUsd;
      const redistributions = computeDeductExcess(allPayments, payload.id, excessPhp, excessUsd);
      await applyRedistributions(redistributions, userId);
    }
  }

  if (current.type === "full") {
    if (payload.status === "rejected") {
      await ref.delete();
    } else if (payload.status === "accepted") {
      if (installmentId) {
        await updateAllPaymentsToAccepted(installmentId, userId);
      }
    }
  } else if (current.type === "addons") {
    if (installmentId) {
      await syncInstallmentAddons(installmentId, userId);
    }
    if (payload.status === "accepted" && payload.submissionId) {
      await markGuestAddonsPaidInSubmission(payload.submissionId);
    }
  } else if (payload.status === "accepted") {
    if (installmentId) {
      await applyCalculateBalance(installmentId, amountToDeductPhp, amountToDeductUsd, userId);
    }
    if (payload.submissionId) {
      const [payments, installment] = installmentId
        ? await Promise.all([getPaymentsForInstallment(installmentId), getInstallmentTransaction(installmentId)])
        : [[], null];
      const recomputed = computeSubmissionPaymentStatus(payments, installment?.status ?? null) ?? "verified";
      await setSubmissionVerifiedAfterAccept(payload.submissionId, recomputed);
    }
  } else if (payload.status === "rejected" || payload.status === "pending") {
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

async function applyRedistributions(
  redistributions: { id: string; newAmountPaidPhp: number; newAmountPaidUsd: number }[],
  userId: string
): Promise<void> {
  if (redistributions.length === 0) return;
  const db = getFirestore();
  const batch = db.batch();
  const now = new Date().toISOString();

  for (const r of redistributions) {
    batch.update(db.collection(Collections.installmentPayments).doc(r.id), {
      amountPaidPhp: r.newAmountPaidPhp,
      amountPaidUsd: r.newAmountPaidUsd,
      updated_at: now,
      updated_by: userId,
    });
  }

  await batch.commit();
}

async function applyCalculateBalance(
  installmentId: string,
  paymentAmountPhp: number,
  paymentAmountUsd: number,
  userId: string
): Promise<void> {
  const db = getFirestore();
  const txSnap = await db
    .collection(Collections.installmentTransactions)
    .where("id", "==", installmentId)
    .limit(1)
    .get();

  if (txSnap.empty) {
    throwStatus(404, "Installment not found.");
  }

  const txDoc = txSnap.docs[0];
  const txData = txDoc.data();
  const result = computeBalanceAfterPayment(
    txData.remainingBalancePhp ?? 0,
    txData.remainingBalanceUsd ?? 0,
    paymentAmountPhp,
    paymentAmountUsd
  );

  await txDoc.ref.update({
    remainingBalancePhp: result.remainingBalancePhp,
    remainingBalanceUsd: result.remainingBalanceUsd,
    status: result.status,
    updated_at: new Date().toISOString(),
    updated_by: userId,
  });
}

async function updateAllPaymentsToAccepted(installmentId: string, userId: string): Promise<void> {
  const db = getFirestore();
  const payments = await getPaymentsForInstallment(installmentId);
  const now = new Date().toISOString();

  const batch = db.batch();
  for (const payment of payments as { id: string }[]) {
    batch.update(db.collection(Collections.installmentPayments).doc(payment.id), {
      status: "accepted",
      updated_at: now,
      updated_by: userId,
    });
  }
  await batch.commit();

  await syncInstallmentAddons(installmentId, userId);
}

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