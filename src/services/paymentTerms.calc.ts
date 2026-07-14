import type { InstallmentPaymentRecord } from "../types/booking";

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export class PaymentTermError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function buildFullPaymentRecord(params: {
  installmentId: string;
  totalPhp: number;
  totalUsd: number;
  currency?: string;
  attachment?: unknown[];
  userId: string;
  id: string;
  now: string;
  dueDateToday: string;
}): InstallmentPaymentRecord {
  const currency = (params.currency || "php").toLowerCase();
  return {
    id: params.id,
    installmentId: params.installmentId,
    amountPaidPhp: params.totalPhp || (currency === "php" ? params.totalPhp : 0),
    amountPaidUsd: params.totalUsd || (currency === "usd" ? params.totalUsd : 0),
    paymentMethod: "bank",
    attachment: params.attachment ?? [],
    status: "pending",
    type: "full",
    due_date: params.dueDateToday,
    created_at: params.now,
    created_by: params.userId,
    updated_at: params.now,
    updated_by: params.userId,
  };
}

export interface AdditionalPaymentTermResult {
  newPayment: InstallmentPaymentRecord;
  recalculatedPayments: { id: string; amountPaidPhp: number; amountPaidUsd: number }[];
  remainingBalancePhp: number;
  remainingBalanceUsd: number;
}

export function computeAdditionalPaymentTerm(params: {
  existingPayments: InstallmentPaymentRecord[];
  totalPhp: number;
  totalUsd: number;
  storedRemainingPhp: number;
  storedRemainingUsd: number;
  installmentDueDate: string | null;
  amountPaidPhp: number;
  amountPaidUsd: number;
  dueDate: string;
  userId: string;
  newPaymentId: string;
  now: string;
}): AdditionalPaymentTermResult {
  const {
    existingPayments,
    totalPhp,
    totalUsd,
    storedRemainingPhp,
    storedRemainingUsd,
    installmentDueDate,
    amountPaidPhp,
    amountPaidUsd,
    dueDate,
    userId,
    newPaymentId,
    now,
  } = params;

  if (installmentDueDate) {
    const installmentDue = new Date(installmentDueDate);
    const newDue = new Date(dueDate);
    if (newDue > installmentDue) {
      throw new PaymentTermError(
        400,
        `Payment due date cannot be greater than the installment due date. Installment due date: ${installmentDueDate}`
      );
    }
  }

  const hasPendingDownpayment = existingPayments.some(
    (p) => p.type === "downpayment" && p.status === "pending"
  );
  if (hasPendingDownpayment) {
    throw new PaymentTermError(
      400,
      "Additional payment term is only available after downpayment has been accepted."
    );
  }

  const pendingNormalPayments: InstallmentPaymentRecord[] = [];
  let totalAllocatedPhp = 0;
  let totalAllocatedUsd = 0;

  for (const payment of existingPayments) {
    if (payment.type === "addons") continue;

    if (payment.type === "normal" && (payment.status === "pending" || payment.status === "rejected")) {
      pendingNormalPayments.push(payment);
      continue;
    }

    totalAllocatedPhp += payment.amountPaidPhp ?? 0;
    totalAllocatedUsd += payment.amountPaidUsd ?? 0;
  }

  const availableRemainingPhp = storedRemainingPhp > 0 ? storedRemainingPhp : totalPhp - totalAllocatedPhp;
  const availableRemainingUsd = storedRemainingUsd > 0 ? storedRemainingUsd : totalUsd - totalAllocatedUsd;

  if (amountPaidPhp > 0 && amountPaidPhp >= availableRemainingPhp) {
    throw new PaymentTermError(
      400,
      `Amount must be less than remaining balance. Available remaining: PHP ${availableRemainingPhp}, USD ${availableRemainingUsd}`
    );
  }
  if (amountPaidUsd > 0 && amountPaidUsd >= availableRemainingUsd) {
    throw new PaymentTermError(
      400,
      `Amount must be less than remaining balance. Available remaining: PHP ${availableRemainingPhp}, USD ${availableRemainingUsd}`
    );
  }

  const remainingBalancePhp = round2(availableRemainingPhp - amountPaidPhp);
  const remainingBalanceUsd = round2(availableRemainingUsd - amountPaidUsd);

  const dueDateFormatted = new Date(dueDate).toISOString().slice(0, 10);

  const newPayment: InstallmentPaymentRecord = {
    id: newPaymentId,
    installmentId: existingPayments[0]?.installmentId ?? "",
    amountPaidPhp: round2(amountPaidPhp),
    amountPaidUsd: round2(amountPaidUsd),
    paymentMethod: "bank",
    attachment: [],
    status: "pending",
    type: "normal",
    due_date: dueDateFormatted,
    created_at: now,
    created_by: userId,
    updated_at: now,
    updated_by: userId,
  };

  const recalculatedPayments: { id: string; amountPaidPhp: number; amountPaidUsd: number }[] = [];

  if (pendingNormalPayments.length > 0 && (remainingBalancePhp > 0 || remainingBalanceUsd > 0)) {
    const n = pendingNormalPayments.length;
    const basePhp = remainingBalancePhp > 0 ? round2(remainingBalancePhp / n) : 0;
    const baseUsd = remainingBalanceUsd > 0 ? round2(remainingBalanceUsd / n) : 0;

    pendingNormalPayments.forEach((payment, i) => {
      const isLast = i === n - 1;
      const newAmountPhp = isLast ? round2(remainingBalancePhp - basePhp * (n - 1)) : basePhp;
      const newAmountUsd = isLast ? round2(remainingBalanceUsd - baseUsd * (n - 1)) : baseUsd;

      recalculatedPayments.push({ id: payment.id, amountPaidPhp: newAmountPhp, amountPaidUsd: newAmountUsd });
    });
  }

  return { newPayment, recalculatedPayments, remainingBalancePhp, remainingBalanceUsd };
}

export interface DeletePaymentTermResult {
  redistributedPayments: {
    id: string;
    previousAmountPhp: number;
    previousAmountUsd: number;
    newAmountPhp: number;
    newAmountUsd: number;
  }[];
  deletedAmountPhp: number;
  deletedAmountUsd: number;
}

export function computeDeletePaymentTerm(params: {
  paymentToDelete: InstallmentPaymentRecord;
  allPayments: InstallmentPaymentRecord[];
}): DeletePaymentTermResult {
  const { paymentToDelete, allPayments } = params;

  if (paymentToDelete.type !== "normal") {
    throw new PaymentTermError(400, "Only payments with type 'normal' can be deleted.");
  }

  if (paymentToDelete.status === "accepted" || (paymentToDelete.status as string) === "completed") {
    throw new PaymentTermError(400, "Payments with status 'accepted' or 'completed' cannot be deleted.");
  }

  let furthestDueDate: Date | null = null;
  for (const p of allPayments) {
    if (!p.due_date) continue;
    const d = new Date(p.due_date);
    if (isNaN(d.getTime())) continue;
    if (!furthestDueDate || d > furthestDueDate) furthestDueDate = d;
  }

  if (paymentToDelete.due_date && furthestDueDate) {
    const thisDue = new Date(paymentToDelete.due_date);
    if (!isNaN(thisDue.getTime()) && thisDue >= furthestDueDate) {
      throw new PaymentTermError(
        400,
        `Cannot delete the payment with the furthest due date. Furthest due date: ${furthestDueDate.toISOString().slice(0, 10)}`
      );
    }
  }

  const activePayments = allPayments.filter(
    (p) => p.id !== paymentToDelete.id && p.type === "normal" && (p.status === "pending" || p.status === "processing")
  );

  const amountToDistributePhp = round2(paymentToDelete.amountPaidPhp ?? 0);
  const amountToDistributeUsd = round2(paymentToDelete.amountPaidUsd ?? 0);

  const redistributedPayments: DeletePaymentTermResult["redistributedPayments"] = [];

  if (activePayments.length > 0 && (amountToDistributePhp > 0 || amountToDistributeUsd > 0)) {
    const n = activePayments.length;
    const basePhp = amountToDistributePhp > 0 ? round2(amountToDistributePhp / n) : 0;
    const baseUsd = amountToDistributeUsd > 0 ? round2(amountToDistributeUsd / n) : 0;

    activePayments.forEach((payment, i) => {
      const isLast = i === n - 1;
      const addPhp = isLast ? round2(amountToDistributePhp - basePhp * (n - 1)) : basePhp;
      const addUsd = isLast ? round2(amountToDistributeUsd - baseUsd * (n - 1)) : baseUsd;

      const previousAmountPhp = payment.amountPaidPhp ?? 0;
      const previousAmountUsd = payment.amountPaidUsd ?? 0;

      redistributedPayments.push({
        id: payment.id,
        previousAmountPhp,
        previousAmountUsd,
        newAmountPhp: round2(previousAmountPhp + addPhp),
        newAmountUsd: round2(previousAmountUsd + addUsd),
      });
    });
  }

  return { redistributedPayments, deletedAmountPhp: amountToDistributePhp, deletedAmountUsd: amountToDistributeUsd };
}

export function validateDueDateUpdate(params: {
  currentDueDate: string | null;
  newDueDate: string;
  installmentDueDate: string | null;
}): string {
  const { currentDueDate, newDueDate, installmentDueDate } = params;

  if (!currentDueDate) {
    throw new PaymentTermError(400, "Current payment does not have a due date.");
  }

  const currentDue = new Date(currentDueDate);
  const newDue = new Date(newDueDate);

  if (isNaN(currentDue.getTime()) || isNaN(newDue.getTime())) {
    throw new PaymentTermError(400, "Invalid due date format. Please use a valid date format (Y-m-d).");
  }

  if (newDue < currentDue) {
    throw new PaymentTermError(
      400,
      `New due date cannot be lower than the current due date. Current due date: ${currentDue.toISOString().slice(0, 10)}`
    );
  }

  if (installmentDueDate) {
    const installmentDue = new Date(installmentDueDate);
    if (!isNaN(installmentDue.getTime()) && newDue > installmentDue) {
      throw new PaymentTermError(
        400,
        `Payment due date cannot be greater than the installment due date. Installment due date: ${installmentDue.toISOString().slice(0, 10)}`
      );
    }
  }

  return newDue.toISOString().slice(0, 10);
}