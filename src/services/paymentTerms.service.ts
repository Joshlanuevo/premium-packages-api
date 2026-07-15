import { randomUUID } from "node:crypto";
import { getFirestore } from "../config/firebase";
import { Collections } from "../constants/collections";
import {
  buildFullPaymentRecord,
  computeAdditionalPaymentTerm,
  computeDeletePaymentTerm,
  validateDueDateUpdate,
  PaymentTermError,
} from "./paymentTerms.calc";
import type { InstallmentPaymentRecord, InstallmentTransactionRecord } from "../types/booking";

async function getPayment(id: string): Promise<InstallmentPaymentRecord> {
  const db = getFirestore();
  const snap = await db.collection(Collections.installmentPayments).doc(id).get();
  if (!snap.exists) {
    throw new PaymentTermError(404, "Payment not found.");
  }
  return snap.data() as InstallmentPaymentRecord;
}

export  async function getInstallmentTransaction(installmentId: string): Promise<InstallmentTransactionRecord | null> {
  const db = getFirestore();
  const snap = await db
    .collection(Collections.installmentTransactions)
    .where("id", "==", installmentId)
    .limit(1)
    .get();
  if (snap.empty) return null;
  return snap.docs[0].data() as InstallmentTransactionRecord;
}

export async function getPaymentsForInstallment(installmentId: string): Promise<InstallmentPaymentRecord[]> {
  const db = getFirestore();
  const snap = await db
    .collection(Collections.installmentPayments)
    .where("installmentId", "==", installmentId)
    .get();
  return snap.docs.map((d) => d.data() as InstallmentPaymentRecord);
}

export async function createFullPayment(
  installmentId: string,
  totalPhp: number,
  totalUsd: number,
  currency: string | undefined,
  userId: string
): Promise<InstallmentPaymentRecord> {
  if (!installmentId) throw new PaymentTermError(400, "installmentId is required.");

  const db = getFirestore();
  const existing = await db
    .collection(Collections.installmentPayments)
    .where("installmentId", "==", installmentId)
    .where("type", "==", "full")
    .limit(1)
    .get();

  if (!existing.empty) {
    throw new PaymentTermError(409, "A full payment already exists for this installment.");
  }

  const now = new Date().toISOString();
  const record = buildFullPaymentRecord({
    installmentId,
    totalPhp,
    totalUsd,
    currency,
    userId,
    id: "full_payment_" + randomUUID(),
    now,
    dueDateToday: now.slice(0, 10),
  });

  await db.collection(Collections.installmentPayments).doc(record.id).set(record);
  return record;
}

export async function addAdditionalPaymentTerm(
  installmentId: string,
  amountPaidPhp: number,
  amountPaidUsd: number,
  dueDate: string,
  userId: string
) {
  if (!installmentId) throw new PaymentTermError(400, "installmentId is required.");
  if (!dueDate) throw new PaymentTermError(400, "due_date is required.");

  const transaction = await getInstallmentTransaction(installmentId);
  if (!transaction) throw new PaymentTermError(404, "Installment transaction not found.");

  const existingPayments = await getPaymentsForInstallment(installmentId);
  const now = new Date().toISOString();

  const result = computeAdditionalPaymentTerm({
    existingPayments,
    totalPhp: transaction.amountPhp,
    totalUsd: transaction.amountUsd,
    storedRemainingPhp: transaction.remainingBalancePhp,
    storedRemainingUsd: transaction.remainingBalanceUsd,
    installmentDueDate: transaction.dueDate || null,
    amountPaidPhp,
    amountPaidUsd,
    dueDate,
    userId,
    newPaymentId: "payment_" + randomUUID(),
    now,
  });

  const db = getFirestore();
  const batch = db.batch();

  batch.set(db.collection(Collections.installmentPayments).doc(result.newPayment.id), result.newPayment);
  for (const recalculated of result.recalculatedPayments) {
    batch.update(db.collection(Collections.installmentPayments).doc(recalculated.id), {
      amountPaidPhp: recalculated.amountPaidPhp,
      amountPaidUsd: recalculated.amountPaidUsd,
      updated_at: now,
      updated_by: userId,
    });
  }

  await batch.commit();

  return {
    newPayment: result.newPayment,
    recalculatedPaymentsCount: result.recalculatedPayments.length,
    recalculatedPayments: result.recalculatedPayments,
    remainingBalancePhp: result.remainingBalancePhp,
    remainingBalanceUsd: result.remainingBalanceUsd,
  };
}

export async function deletePaymentTerm(paymentId: string, userId: string) {
  if (!paymentId) throw new PaymentTermError(400, "paymentId is required.");

  const paymentToDelete = await getPayment(paymentId);
  const allPayments = await getPaymentsForInstallment(paymentToDelete.installmentId);

  const result = computeDeletePaymentTerm({ paymentToDelete, allPayments });

  const db = getFirestore();
  const batch = db.batch();
  const now = new Date().toISOString();

  batch.delete(db.collection(Collections.installmentPayments).doc(paymentId));
  for (const redistributed of result.redistributedPayments) {
    batch.update(db.collection(Collections.installmentPayments).doc(redistributed.id), {
      amountPaidPhp: redistributed.newAmountPhp,
      amountPaidUsd: redistributed.newAmountUsd,
      updated_at: now,
      updated_by: userId,
    });
  }

  await batch.commit();

  return {
    deletedPaymentId: paymentId,
    deletedAmountPhp: result.deletedAmountPhp,
    deletedAmountUsd: result.deletedAmountUsd,
    redistributedPaymentsCount: result.redistributedPayments.length,
    redistributedPayments: result.redistributedPayments,
  };
}

export async function updatePaymentDueDate(paymentId: string, newDueDate: string, userId: string) {
  if (!paymentId) throw new PaymentTermError(400, "paymentId is required.");
  if (!newDueDate) throw new PaymentTermError(400, "due_date is required.");

  const payment = await getPayment(paymentId);
  const transaction = await getInstallmentTransaction(payment.installmentId);

  const normalizedDate = validateDueDateUpdate({
    currentDueDate: payment.due_date || null,
    newDueDate,
    installmentDueDate: transaction?.dueDate || null,
  });

  const db = getFirestore();
  const now = new Date().toISOString();

  await db.collection(Collections.installmentPayments).doc(paymentId).update({
    due_date: normalizedDate,
    updated_at: now,
    updated_by: userId,
  });

  return {
    paymentId,
    previousDueDate: payment.due_date,
    newDueDate: normalizedDate,
  };
}