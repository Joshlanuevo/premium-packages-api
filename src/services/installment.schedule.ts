import type { InstallmentPaymentRecord, InstallmentTransactionRecord } from "../types/booking";

export interface BuildScheduleParams {
  transactionId: string;
  totalPhp: number;
  totalUsd: number;
  isFullpayment: boolean;
  installmentDetails?: {
    down_payment_amount?: number;
    cycle_count?: number;
    due_date: string;
    currency?: string;
  };
  reservationTermsDueDate?: string;
  userId: string;
  idGenerator: () => string;
  now: string;
}

export interface BuiltSchedule {
  transaction: InstallmentTransactionRecord;
  payments: InstallmentPaymentRecord[];
}

function toIsoDate(mmddyyyy: string | undefined): string | null {
  if (!mmddyyyy) return null;
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(mmddyyyy);
  if (!match) return null;
  const [, month, day, year] = match;
  return `${year}-${month}-${day}`;
}

export function buildInstallmentSchedule(params: BuildScheduleParams): BuiltSchedule {
  const {
    transactionId,
    totalPhp,
    totalUsd,
    isFullpayment,
    installmentDetails,
    reservationTermsDueDate,
    userId,
    idGenerator,
    now,
  } = params;

  const installmentId = "installment_" + idGenerator();
  const dueDate = installmentDetails?.due_date;
  const currency = (installmentDetails?.currency || "php").toLowerCase();
  const downPayment = installmentDetails?.down_payment_amount ?? 0;

  const transaction: InstallmentTransactionRecord = {
    id: installmentId,
    transactionId,
    amountPhp: totalPhp,
    amountUsd: totalUsd,
    dueDate: dueDate ?? "",
    status: "with balance",
    remainingBalancePhp: totalPhp,
    remainingBalanceUsd: totalUsd,
    created_at: now,
    created_by: userId,
    updated_at: now,
    updated_by: userId,
  };

  const payments: InstallmentPaymentRecord[] = [];
  const downPaymentDueDate = toIsoDate(reservationTermsDueDate) ?? now.slice(0, 10);

  if (isFullpayment) {
    payments.push({
      id: "payment_" + idGenerator(),
      installmentId,
      amountPaidPhp: currency === "php" ? totalPhp : 0,
      amountPaidUsd: currency === "usd" ? totalUsd : 0,
      paymentMethod: "bank",
      attachment: null,
      status: "pending",
      type: "fullpayment",
      due_date: downPaymentDueDate,
      created_at: now,
      created_by: userId,
      updated_at: now,
      updated_by: userId,
    });

    payments.push({
      id: "payment_" + idGenerator(),
      installmentId,
      amountPaidPhp: 0,
      amountPaidUsd: 0,
      paymentMethod: "bank",
      attachment: [],
      status: "pending",
      type: "addons",
      due_date: dueDate ?? downPaymentDueDate,
      created_at: now,
      created_by: userId,
      updated_at: now,
      updated_by: userId,
    });

    return { transaction, payments };
  }

  const terms = (installmentDetails?.cycle_count ?? 1) - 1;
  if (terms < 1) {
    throw new Error("Terms must be greater than 1 to create installments.");
  }
  if (!dueDate) {
    throw new Error("installment_details.due_date is required for installment bookings.");
  }

  payments.push({
    id: "payment_" + idGenerator(),
    installmentId,
    amountPaidPhp: currency === "php" ? downPayment : 0,
    amountPaidUsd: currency === "usd" ? downPayment : 0,
    paymentMethod: "bank",
    attachment: null,
    status: "pending",
    type: "downpayment",
    due_date: downPaymentDueDate,
    created_at: now,
    created_by: userId,
    updated_at: now,
    updated_by: userId,
  });

  const startDate = new Date(downPaymentDueDate);
  const endDate = new Date(dueDate);
  const totalDays = Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  const baseIntervalDays = Math.floor(totalDays / terms);
  const remainderDays = totalDays % terms;

  if (baseIntervalDays <= 0) {
    throw new Error("Invalid interval: Ensure due date is later than the down payment due date.");
  }

  let remainingPhp: number;
  let remainingUsd: number;
  let basePhp: number;
  let remainderPhp: number;
  let baseUsd: number;
  let remainderUsd: number;

  if (currency === "usd") {
    remainingUsd = Math.max(totalUsd - downPayment, 0);
    baseUsd = Math.floor(remainingUsd / terms);
    remainderUsd = remainingUsd % terms;

    basePhp = Math.floor(totalPhp / terms);
    remainderPhp = totalPhp % terms;
  } else {
    remainingPhp = Math.max(totalPhp - downPayment, 0);
    basePhp = Math.floor(remainingPhp / terms);
    remainderPhp = remainingPhp % terms;

    baseUsd = Math.floor(totalUsd / terms);
    remainderUsd = totalUsd % terms;
  }

  let currentDueDate = new Date(downPaymentDueDate);
  let lastDueDate = currentDueDate;

  for (let i = 1; i <= terms; i++) {
    const intervalDays = baseIntervalDays + (i <= remainderDays ? 1 : 0);
    currentDueDate = new Date(currentDueDate.getTime() + intervalDays * 24 * 60 * 60 * 1000);

    if (currentDueDate > endDate) {
      currentDueDate = new Date(endDate);
    }

    const amountPhp = basePhp + (i <= remainderPhp ? 1 : 0);
    const amountUsd = baseUsd + (i <= remainderUsd ? 1 : 0);

    payments.push({
      id: "payment_" + idGenerator(),
      installmentId,
      amountPaidPhp: amountPhp,
      amountPaidUsd: amountUsd,
      paymentMethod: "bank",
      attachment: [],
      status: "pending",
      type: "normal",
      due_date: currentDueDate.toISOString().slice(0, 10),
      created_at: now,
      created_by: userId,
      updated_at: now,
      updated_by: userId,
    });

    lastDueDate = currentDueDate;
  }

  payments.push({
    id: "payment_" + idGenerator(),
    installmentId,
    amountPaidPhp: 0,
    amountPaidUsd: 0,
    paymentMethod: "bank",
    attachment: [],
    status: "pending",
    type: "addons",
    due_date: lastDueDate.toISOString().slice(0, 10),
    created_at: now,
    created_by: userId,
    updated_at: now,
    updated_by: userId,
  });

  return { transaction, payments };
}