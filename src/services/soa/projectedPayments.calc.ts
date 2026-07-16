export interface ProjectedPaymentsPackageData {
  installment_terms?: {
    currency?: string;
    down_payment?: { type?: "fixed" | "percentage"; value?: number };
    cycle_count?: number;
    end_before?: number;
  };
  reservation_terms?: { due_date?: string };
}

export interface ProjectedPaymentsProps {
  bookingData?: { confirmationNumber?: string };
  storeData?: { confirmationNumber?: string };
  isFullPayment?: boolean;
  bookingPayload?: { isFullpayment?: boolean };
  packageData?: ProjectedPaymentsPackageData;
}

export interface ProjectedPaymentTerm {
  payment_number: number;
  type: "fullpayment" | "downpayment" | "normal";
  description: string;
  amount_per_pax: number;
  total_amount: number;
  phpTotal: number;
  usdTotal: number;
  phpAmountPerPax: number;
  usdAmountPerPax: number;
  due_date: Date | null;
  status: "pending";
  isProjection: true;
  isFullPayment: boolean;
}

function parseDate(dateString: string): Date {
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) {
    const [month, day, year] = dateString.split("/");
    return new Date(Number(year), Number(month) - 1, Number(day));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
    return new Date(dateString);
  }
  return new Date(dateString);
}

export interface ProjectedPaymentsResult {
  isProjection: boolean;
  isFullPayment: boolean;
  installmentCurrency: string;
  downPaymentAmount: number;
  downPaymentDeadline: Date | null;
  remainingBalance: number;
  fullPaymentDeadline: Date | null;
  projectedPaymentTerms: ProjectedPaymentTerm[];
}

export function computeProjectedPayments(
  props: ProjectedPaymentsProps,
  totalPax: number,
  estimatedArrival: Date | string | null,
  totalPesoAmount: number,
  totalUsdAmount: number
): ProjectedPaymentsResult {
  const isProjection = !props.bookingData?.confirmationNumber && !props.storeData?.confirmationNumber;
  const isFullPayment = props.isFullPayment || props.bookingPayload?.isFullpayment || false;
  const installmentCurrency = props.packageData?.installment_terms?.currency || "PHP";
  const hasMixedCurrency = totalPesoAmount > 0 && totalUsdAmount > 0;

  const downPaymentAmount = (() => {
    const config = props.packageData?.installment_terms?.down_payment;
    if (!config) return 0;

    if (config.type === "fixed") {
      return config.value || 0;
    }
    if (config.type === "percentage") {
      const totalAmount = installmentCurrency === "PHP" ? totalPesoAmount : totalUsdAmount;
      return (totalAmount * (config.value || 0)) / 100;
    }
    return 0;
  })();

  const downPaymentAmountPhp = (() => {
    const config = props.packageData?.installment_terms?.down_payment;
    if (!config) return 0;
    return installmentCurrency === "PHP" ? downPaymentAmount : 0;
  })();

  const downPaymentAmountUsd = (() => {
    const config = props.packageData?.installment_terms?.down_payment;
    if (!config) return 0;
    return installmentCurrency === "USD" ? downPaymentAmount : 0;
  })();

  const downPaymentDeadline = props.packageData?.reservation_terms?.due_date
    ? parseDate(props.packageData.reservation_terms.due_date)
    : null;

  const remainingBalance = (() => {
    const totalAmount = installmentCurrency === "PHP" ? totalPesoAmount : totalUsdAmount;
    const totalDownPayment = downPaymentAmount * totalPax;
    return Math.max(totalAmount - totalDownPayment, 0);
  })();

  const remainingBalancePhp = (() => {
    if (!hasMixedCurrency) return 0;
    const dpPhp = downPaymentAmountPhp * totalPax;
    return Math.max(totalPesoAmount - dpPhp, 0);
  })();

  const remainingBalanceUsd = (() => {
    if (installmentCurrency !== "USD") return 0;
    const dpUsd = downPaymentAmountUsd * totalPax;
    return Math.max(totalUsdAmount - dpUsd, 0);
  })();

  const fullPaymentDeadline = (() => {
    const endBefore = props.packageData?.installment_terms?.end_before;
    if (!endBefore || !estimatedArrival) return null;
    const etaDate = new Date(estimatedArrival);
    return new Date(etaDate.getTime() - endBefore * 24 * 60 * 60 * 1000);
  })();

  const projectedPaymentTerms: ProjectedPaymentTerm[] = [];

  if (isProjection) {
    if (isFullPayment) {
      const totalAmount = installmentCurrency === "PHP" ? totalPesoAmount : totalUsdAmount;

      projectedPaymentTerms.push({
        payment_number: 1,
        type: "fullpayment",
        description: "Full Payment",
        amount_per_pax: totalAmount / totalPax,
        total_amount: totalAmount,
        phpTotal: totalPesoAmount,
        usdTotal: totalUsdAmount,
        phpAmountPerPax: totalPax > 0 ? totalPesoAmount / totalPax : 0,
        usdAmountPerPax: totalPax > 0 ? totalUsdAmount / totalPax : 0,
        due_date: downPaymentDeadline || fullPaymentDeadline,
        status: "pending",
        isProjection: true,
        isFullPayment: true,
      });
    } else {
      const cycleCount = props.packageData?.installment_terms?.cycle_count || 2;

      const dpPhpTotal = downPaymentAmountPhp * totalPax;
      const dpUsdTotal = downPaymentAmountUsd * totalPax;

      projectedPaymentTerms.push({
        payment_number: 1,
        type: "downpayment",
        description: "Down Payment",
        amount_per_pax: downPaymentAmount,
        total_amount: downPaymentAmount * totalPax,
        phpTotal: dpPhpTotal,
        usdTotal: dpUsdTotal,
        phpAmountPerPax: totalPax > 0 ? dpPhpTotal / totalPax : 0,
        usdAmountPerPax: totalPax > 0 ? dpUsdTotal / totalPax : 0,
        due_date: downPaymentDeadline,
        status: "pending",
        isProjection: true,
        isFullPayment: false,
      });

      if (cycleCount > 1) {
        const remainingInstallments = cycleCount - 1;

        const balancePerInstallmentPhp = hasMixedCurrency ? remainingBalancePhp / remainingInstallments : 0;
        const balancePerInstallmentUsd = remainingBalanceUsd > 0 ? remainingBalanceUsd / remainingInstallments : 0;
        const balancePerInstallment = remainingBalance / remainingInstallments;

        const startDate = downPaymentDeadline;
        const endDate = fullPaymentDeadline;

        if (startDate && endDate) {
          const today = new Date();
          const effectiveStart = today;
          const effectiveEnd =
            endDate > today ? endDate : new Date(today.getTime() + cycleCount * 30 * 24 * 60 * 60 * 1000);

          const timeDiff = effectiveEnd.getTime() - effectiveStart.getTime();
          const intervalDays = Math.abs(timeDiff) / remainingInstallments;

          for (let i = 2; i <= cycleCount; i++) {
            const dueDate = new Date(effectiveStart.getTime() + intervalDays * (i - 1));

            projectedPaymentTerms.push({
              payment_number: i,
              type: "normal",
              description: `Payment ${i}`,
              amount_per_pax: balancePerInstallment / totalPax,
              total_amount: balancePerInstallment,
              phpTotal: balancePerInstallmentPhp,
              usdTotal: balancePerInstallmentUsd,
              phpAmountPerPax: totalPax > 0 ? balancePerInstallmentPhp / totalPax : 0,
              usdAmountPerPax: totalPax > 0 ? balancePerInstallmentUsd / totalPax : 0,
              due_date: dueDate,
              status: "pending",
              isProjection: true,
              isFullPayment: false,
            });
          }
        }
      }
    }
  }

  return {
    isProjection,
    isFullPayment,
    installmentCurrency,
    downPaymentAmount,
    downPaymentDeadline,
    remainingBalance,
    fullPaymentDeadline,
    projectedPaymentTerms,
  };
}

export function formatProjectedCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount);
}