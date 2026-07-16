import type { TravellerTypeWithDetails } from "./soaTravellers.calc";

export interface ChargeItem {
  price?: number;
  [key: string]: unknown;
}
export interface PaxPricedItem {
  price?: number;
  pax?: number;
}
export interface TotalPricedItem {
  total_price?: number;
}

export interface MarkupData {
  markup_value?: { type?: "fixed" | "percent"; value?: number };
}

export interface AppliedPromo {
  success?: boolean;
  data?: { discountedTotal?: number };
}

export interface SOAPaymentsPackageData {
  currency?: string;
  installment_terms?: {
    currency?: string;
    down_payment?: { type?: string; value?: number };
    end_before?: number;
  };
  reservation_terms?: { due_date?: string; amountPhp?: number; amountUsd?: number };
  payment_due_date?: string;
}

export interface SOAPaymentsPaymentData {
  currency?: string;
  guaranteeDeposit?: number;
  phpFullPayment?: number;
  usdFullPayment?: number;
}

export interface SOAPaymentsBookingPayload {
  installment_details?: { down_payment_amount?: number };
}

export interface SOAPaymentsProps {
  packageData?: SOAPaymentsPackageData;
  paymentData?: SOAPaymentsPaymentData;
  bookingPayload?: SOAPaymentsBookingPayload;
  markupData?: MarkupData | null;
  appliedPromo?: AppliedPromo | null;
  finalPhpAmount?: number | null;
  finalUsdAmount?: number | null;
  isClientSOA?: boolean;
  initial?: boolean;
}

export interface SOAPaymentsDependencies {
  nonInfantTravellerTypes: TravellerTypeWithDetails[];
  infantTravellers: TravellerTypeWithDetails[];
  totalPax: number;
  nonInfantPax: number;
  phpBaggageItems: TotalPricedItem[];
  usdBaggageItems: TotalPricedItem[];
  groupedPhpVisaItems: PaxPricedItem[];
  groupedUsdVisaItems: PaxPricedItem[];
  groupedPhpToursItems: TotalPricedItem[];
  groupedUsdToursItems: TotalPricedItem[];
  groupedPhpSeatItems: PaxPricedItem[];
  groupedUsdSeatItems: PaxPricedItem[];
  groupedPhpInsuranceItems: TotalPricedItem[];
  groupedUsdInsuranceItems: TotalPricedItem[];
  phpTaxItems: ChargeItem[];
  usdTaxItems: ChargeItem[];
  phpTipItems: ChargeItem[];
  usdTipItems: ChargeItem[];
  phpOtherFeeItems: ChargeItem[];
  usdOtherFeeItems: ChargeItem[];
  phpCommissionItems: ChargeItem[];
  usdCommissionItems: ChargeItem[];
  estimatedArrival: Date | null;
}

function round2Floor0(n: number): number {
  return Math.max(Math.round(n * 100) / 100, 0);
}

export function computeCurrencyTotal(
  currency: "PHP" | "USD",
  props: SOAPaymentsProps,
  deps: SOAPaymentsDependencies,
  basePriceTotalPhp: number,
  basePriceTotalUsd: number
): number {
  const isPhp = currency === "PHP";

  const baseTotal =
    props.packageData?.currency === currency
      ? deps.nonInfantTravellerTypes.reduce((sum, t) => {
          if (isPhp) return sum + (t.total || 0);
          return sum + (t.usd_total || Number(t.price ?? 0) * t.quantity || 0);
        }, 0)
      : 0;

  const infantBaseTotal = deps.infantTravellers
    .filter((t) => t.currency === currency)
    .reduce((sum, t) => sum + (isPhp ? t.total || 0 : t.usd_total || 0), 0);

  const items = isPhp
    ? {
        baggage: deps.phpBaggageItems,
        visa: deps.groupedPhpVisaItems,
        tours: deps.groupedPhpToursItems,
        seats: deps.groupedPhpSeatItems,
        insurance: deps.groupedPhpInsuranceItems,
        tax: deps.phpTaxItems,
        tip: deps.phpTipItems,
        otherFee: deps.phpOtherFeeItems,
        commission: deps.phpCommissionItems,
      }
    : {
        baggage: deps.usdBaggageItems,
        visa: deps.groupedUsdVisaItems,
        tours: deps.groupedUsdToursItems,
        seats: deps.groupedUsdSeatItems,
        insurance: deps.groupedUsdInsuranceItems,
        tax: deps.usdTaxItems,
        tip: deps.usdTipItems,
        otherFee: deps.usdOtherFeeItems,
        commission: deps.usdCommissionItems,
      };

  const baggageTotal = props.initial ? 0 : items.baggage.reduce((sum, item) => sum + (item.total_price ?? 0), 0);
  const visaTotal = props.initial ? 0 : items.visa.reduce((sum, item) => sum + (item.price ?? 0) * (item.pax ?? 0), 0);
  const toursTotal = props.initial ? 0 : items.tours.reduce((sum, item) => sum + (item.total_price ?? 0), 0);
  const insuranceTotal = props.initial ? 0 : items.insurance.reduce((sum, item) => sum + (item.total_price ?? 0), 0);
  const seatsTotal = props.initial
    ? 0
    : items.seats.reduce((sum, item) => sum + (item.price ?? 0) * (item.pax ?? 0), 0);
  const taxTotal = items.tax.reduce((sum, item) => sum + (item.price ?? 0) * deps.totalPax, 0);
  const tipTotal = items.tip.reduce((sum, item) => sum + (item.price ?? 0) * deps.totalPax, 0);
  const otherFeeTotal = items.otherFee.reduce((sum, item) => sum + (item.price ?? 0) * deps.totalPax, 0);

  const markupForCurrency = (() => {
    if (currency !== (props.packageData?.currency || "PHP")) return 0;
    const markup = props.markupData;
    if (!markup?.markup_value) return 0;

    const base = isPhp ? basePriceTotalPhp : basePriceTotalUsd;
    const type = markup.markup_value.type;
    const value = markup.markup_value.value || 0;

    if (type === "fixed") return value * (deps.nonInfantPax || 1);
    if (type === "percent") return (base * value) / 100;
    return 0;
  })();

  const commissionTotal = items.commission.reduce((sum, c) => sum + (c.price ?? 0) * deps.nonInfantPax, 0);
  const commissionAdjustment = props.isClientSOA ? 0 : -commissionTotal;

  const calculatedTotal =
    baseTotal +
    infantBaseTotal +
    baggageTotal +
    visaTotal +
    toursTotal +
    insuranceTotal +
    seatsTotal +
    taxTotal +
    tipTotal +
    otherFeeTotal +
    commissionAdjustment +
    markupForCurrency;

  const hasValidPromo =
    props.appliedPromo?.success === true &&
    props.appliedPromo?.data?.discountedTotal != null &&
    props.appliedPromo.data.discountedTotal > 0;

  if (hasValidPromo) {
    const packageCurrency = props.packageData?.currency || "PHP";
    if (packageCurrency === currency) {
      const discountedAmount = props.appliedPromo!.data!.discountedTotal!;
      const adjustedAmount = props.isClientSOA ? discountedAmount + commissionTotal : discountedAmount;
      return round2Floor0(adjustedAmount);
    }
  }

  if (isPhp && props.finalPhpAmount != null && props.finalPhpAmount > 0) {
    const adjustedAmount = props.isClientSOA ? props.finalPhpAmount + commissionTotal : props.finalPhpAmount;
    return round2Floor0(adjustedAmount);
  }
  if (!isPhp && props.finalUsdAmount != null && props.finalUsdAmount > 0) {
    const adjustedAmount = props.isClientSOA ? props.finalUsdAmount + commissionTotal : props.finalUsdAmount;
    return round2Floor0(adjustedAmount);
  }

  return round2Floor0(calculatedTotal);
}

function calculateBaseTotal(
  currency: "PHP" | "USD",
  props: SOAPaymentsProps,
  nonInfantTravellerTypes: TravellerTypeWithDetails[]
): number {
  if (props.packageData?.currency !== currency) return 0;

  const isPhp = currency === "PHP";
  return nonInfantTravellerTypes.reduce((sum, t) => {
    if (isPhp) return sum + (t.total || 0);
    return sum + (t.usd_total || Number(t.price ?? 0) * t.quantity || 0);
  }, 0);
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

export interface SOAPaymentsResult {
  installmentCurrency: string;
  fullpaymentCurrency: string | undefined;
  totalPesoAmount: number;
  totalUsdAmount: number;
  basePriceTotalPhp: number;
  basePriceTotalUsd: number;
  guaranteeDepositAmount: number;
  guaranteeDepositDeadline: Date | null;
  fullPaymentDeadline: Date | null;
  remainingBalance: number;
  perPaxAmount: number;
}

export function computeSOAPayments(props: SOAPaymentsProps, deps: SOAPaymentsDependencies): SOAPaymentsResult {
  const installmentCurrency = props.packageData?.installment_terms?.currency || "PHP";
  const fullpaymentCurrency = props.paymentData?.currency;

  const basePriceTotalPhp = calculateBaseTotal("PHP", props, deps.nonInfantTravellerTypes);
  const basePriceTotalUsd = calculateBaseTotal("USD", props, deps.nonInfantTravellerTypes);

  const totalPesoAmount = computeCurrencyTotal("PHP", props, deps, basePriceTotalPhp, basePriceTotalUsd);
  const totalUsdAmount = computeCurrencyTotal("USD", props, deps, basePriceTotalPhp, basePriceTotalUsd);

  const guaranteeDepositAmount = (() => {
    if (props.paymentData?.guaranteeDeposit !== undefined && props.paymentData.guaranteeDeposit > 0) {
      return props.paymentData.guaranteeDeposit;
    }

    const downPayment = props.bookingPayload?.installment_details?.down_payment_amount;
    if (downPayment && downPayment > 0) {
      const pax = deps.totalPax || 1;
      const installmentDownPaymentPerPax = props.packageData?.installment_terms?.down_payment?.value || 0;

      if (installmentDownPaymentPerPax > 0 && downPayment === installmentDownPaymentPerPax) {
        return downPayment * pax;
      }
      return downPayment;
    }

    const terms = props.packageData?.reservation_terms;
    if (terms) {
      const depositCurrency = props.packageData?.installment_terms?.currency || "PHP";
      const perPax = depositCurrency === "PHP" ? terms.amountPhp || 0 : terms.amountUsd || 0;
      return perPax * (deps.totalPax || 1);
    }

    return 0;
  })();

  const guaranteeDepositDeadline = props.packageData?.reservation_terms?.due_date
    ? parseDate(props.packageData.reservation_terms.due_date)
    : null;

  const fullPaymentDeadline = (() => {
    const endBefore = props.packageData?.installment_terms?.end_before;
    if (props.packageData?.payment_due_date) {
      return new Date(props.packageData.payment_due_date);
    }
    const eta = deps.estimatedArrival;
    if (!endBefore || !eta) return null;
    return new Date(new Date(eta).getTime() - endBefore * 24 * 60 * 60 * 1000);
  })();

  const remainingBalance = (() => {
    const packageCurrency = props.packageData?.currency || "PHP";
    const totalAmount = packageCurrency === "USD" ? totalUsdAmount : totalPesoAmount;

    const depositCurrency = props.packageData?.installment_terms?.currency || "PHP";
    const deposit = depositCurrency === packageCurrency ? guaranteeDepositAmount : 0;

    return Math.max(totalAmount - deposit, 0);
  })();

  const perPaxAmount = (() => {
    const currency = props.paymentData?.currency || "USD";
    const totalAmount = currency === "PHP" ? totalPesoAmount : totalUsdAmount;

    if (totalAmount > 0 && deps.totalPax > 0) {
      return totalAmount / deps.totalPax;
    }

    const fullPayment = currency === "PHP" ? props.paymentData?.phpFullPayment : props.paymentData?.usdFullPayment;
    return fullPayment && fullPayment > 0 ? fullPayment : 0;
  })();

  return {
    installmentCurrency,
    fullpaymentCurrency,
    totalPesoAmount,
    totalUsdAmount,
    basePriceTotalPhp,
    basePriceTotalUsd,
    guaranteeDepositAmount,
    guaranteeDepositDeadline,
    fullPaymentDeadline,
    remainingBalance,
    perPaxAmount,
  };
}