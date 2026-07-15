function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface BalanceResult {
  remainingBalancePhp: number;
  remainingBalanceUsd: number;
  status: "with balance" | "completed";
}

export function computeBalanceAfterPayment(
  currentRemainingPhp: number,
  currentRemainingUsd: number,
  paymentAmountPhp: number,
  paymentAmountUsd: number
): BalanceResult {
  const remainingBalancePhp = currentRemainingPhp - paymentAmountPhp;
  const remainingBalanceUsd = currentRemainingUsd - paymentAmountUsd;

  const status: BalanceResult["status"] =
    remainingBalanceUsd <= 0 && remainingBalancePhp <= 0 ? "completed" : "with balance";

  return { remainingBalancePhp, remainingBalanceUsd, status };
}

export interface EligiblePaymentInput {
  id: string;
  type?: string;
  status?: string;
  amountPaidPhp?: number;
  amountPaidUsd?: number;
}

export interface RedistributionUpdate {
  id: string;
  newAmountPaidPhp: number;
  newAmountPaidUsd: number;
}

function findEligiblePayments(payments: EligiblePaymentInput[], currentPaymentId: string): EligiblePaymentInput[] {
  const excludedTypes = ["full", "downpayment", "addons"];
  return payments.filter(
    (p) =>
      p.id !== currentPaymentId &&
      !excludedTypes.includes(p.type ?? "") &&
      ["pending", "processing"].includes(p.status ?? "")
  );
}

export function computeDistributeRemainingBalance(
  allPayments: EligiblePaymentInput[],
  currentPaymentId: string,
  remainingBalancePhp: number,
  remainingBalanceUsd: number
): RedistributionUpdate[] {
  const eligible = findEligiblePayments(allPayments, currentPaymentId);
  if (eligible.length === 0) return [];

  const n = eligible.length;
  const perPaymentPhp = round2(remainingBalancePhp / n);
  const perPaymentUsd = round2(remainingBalanceUsd / n);

  let totalDistributedPhp = 0;
  let totalDistributedUsd = 0;

  return eligible.map((payment, index) => {
    const isLast = index === n - 1;
    const distributedPhp = isLast ? round2(remainingBalancePhp - totalDistributedPhp) : perPaymentPhp;
    const distributedUsd = isLast ? round2(remainingBalanceUsd - totalDistributedUsd) : perPaymentUsd;

    totalDistributedPhp += distributedPhp;
    totalDistributedUsd += distributedUsd;

    const currentPhp = payment.amountPaidPhp ?? 0;
    const currentUsd = payment.amountPaidUsd ?? 0;

    return {
      id: payment.id,
      newAmountPaidPhp: round2(currentPhp + distributedPhp),
      newAmountPaidUsd: round2(currentUsd + distributedUsd),
    };
  });
}

export function computeDeductExcess(
  allPayments: EligiblePaymentInput[],
  currentPaymentId: string,
  excessPhp: number,
  excessUsd: number
): RedistributionUpdate[] {
  const eligible = findEligiblePayments(allPayments, currentPaymentId);
  if (eligible.length === 0 || (excessPhp <= 0 && excessUsd <= 0)) return [];

  const n = eligible.length;
  const perPaymentPhp = round2(excessPhp / n);
  const perPaymentUsd = round2(excessUsd / n);

  let totalDeductedPhp = 0;
  let totalDeductedUsd = 0;

  return eligible.map((payment, index) => {
    const isLast = index === n - 1;
    const deductPhp = isLast ? round2(excessPhp - totalDeductedPhp) : perPaymentPhp;
    const deductUsd = isLast ? round2(excessUsd - totalDeductedUsd) : perPaymentUsd;

    const currentPhp = payment.amountPaidPhp ?? 0;
    const currentUsd = payment.amountPaidUsd ?? 0;

    const newAmountPaidPhp = Math.max(0, round2(currentPhp - deductPhp));
    const newAmountPaidUsd = Math.max(0, round2(currentUsd - deductUsd));

    totalDeductedPhp += currentPhp - newAmountPaidPhp;
    totalDeductedUsd += currentUsd - newAmountPaidUsd;

    return { id: payment.id, newAmountPaidPhp, newAmountPaidUsd };
  });
}