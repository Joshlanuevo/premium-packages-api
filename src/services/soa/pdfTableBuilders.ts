import { formatCurrency } from "./formatters";

export interface PdfMakeCell {
  text?: string | number;
  style?: string;
  alignment?: string;
  colSpan?: number;
  bold?: boolean;
  color?: string;
  margin?: number[];
  valign?: string;
}

export type PdfMakeRow = (PdfMakeCell | Record<string, never>)[];

export interface BasePackageItem {
  title: string;
  unitPrice: number;
  pax: number;
  amount: number;
}
export interface InfantTravellerItem {
  title: string;
  description?: string;
  price: number;
  quantity: number;
  total: number;
  usd_price?: number;
  usd_total?: number;
}
export interface BaggageTableItem {
  type: string;
  weight: string | number;
  unit_price: number;
  pax: number;
  total_price: number;
}
export interface VisaTableItem {
  type: string;
  price: number;
  pax: number;
}
export interface InsuranceTableItem {
  provider: string;
  total_price: number;
  price?: number;
  pax: number;
  currency?: string;
}
export interface TourTableItem {
  type: string;
  price: number;
  pax: number;
}
export interface SeatTableItem {
  type: string;
  price: number;
  pax: number;
}
export interface ChargeTableItem {
  price: number;
  totalPax: number;
  tax?: string;
  tip?: string;
  fee?: string;
}
export interface AddonTableItem {
  name?: string;
  unit_price?: number;
  pax?: number;
  quantity?: number;
  total_price?: number;
}
export interface CommissionTableItem {
  commision: string;
  price: number;
  currency?: string;
  nonInfantPax: number;
}

export interface PaymentTableParams {
  basePackage?: BasePackageItem[];
  infantTravellers?: InfantTravellerItem[];
  baggageItems?: BaggageTableItem[];
  visaItems?: VisaTableItem[];
  insuranceItems?: InsuranceTableItem[];
  toursItems?: TourTableItem[];
  seatsItems?: SeatTableItem[];
  taxItems?: ChargeTableItem[];
  tipItems?: ChargeTableItem[];
  otherFeeItems?: ChargeTableItem[];
  addonItems?: AddonTableItem[];
  commissionItems?: CommissionTableItem[];
  discountAmount?: number;
  promoCode?: string;
  totalAmount?: number;
  showNoChargesMessage?: boolean;
  isClientSOA?: boolean;
  initial?: boolean;
  markupAmountPerPax?: number;
  totalMarkupAmount?: number;
}

export function buildPesoPaymentTableBody(params: PaymentTableParams): PdfMakeRow[] {
  const {
    basePackage = [],
    infantTravellers = [],
    baggageItems = [],
    visaItems = [],
    insuranceItems = [],
    toursItems = [],
    seatsItems = [],
    taxItems = [],
    tipItems = [],
    otherFeeItems = [],
    addonItems = [],
    commissionItems = [],
    discountAmount = 0,
    promoCode = "",
    totalAmount = 0,
    showNoChargesMessage = false,
    isClientSOA = false,
    initial = false,
    markupAmountPerPax = 0,
    totalMarkupAmount = 0,
  } = params;

  const body: PdfMakeRow[] = [
    [
      { text: "PARTICULARS", style: "tableHeader", alignment: "left" },
      { text: "UNIT PRICE (PHP)", style: "tableHeader", alignment: "right" },
      { text: "NO. OF PAX", style: "tableHeader", alignment: "center" },
      { text: "AMOUNT (PHP)", style: "tableHeader", alignment: "right" },
    ],
  ];

  basePackage.forEach((item) => {
    body.push([
      { text: item.title, style: "tableCell" },
      { text: formatCurrency(item.unitPrice), style: "tableCell", alignment: "right" },
      { text: item.pax, style: "tableCell", alignment: "center" },
      { text: formatCurrency(item.amount), style: "tableCell", alignment: "right" },
    ]);
  });

  infantTravellers.forEach((infant) => {
    body.push([
      {
        text: infant.description ? `${infant.title} (${infant.description})` : infant.title,
        style: "tableCell",
      },
      { text: formatCurrency(infant.price), style: "tableCell", alignment: "right" },
      { text: infant.quantity, style: "tableCell", alignment: "center" },
      { text: formatCurrency(infant.total), style: "tableCell", alignment: "right" },
    ]);
  });

  if (!initial) {
    baggageItems.forEach((baggage) => {
      body.push([
        { text: `${baggage.type} - ${baggage.weight}`, style: "tableCell" },
        { text: formatCurrency(baggage.unit_price), style: "tableCell", alignment: "right" },
        { text: baggage.pax, style: "tableCell", alignment: "center" },
        { text: formatCurrency(baggage.total_price), style: "tableCell", alignment: "right" },
      ]);
    });
  }

  if (!initial) {
    visaItems.forEach((visa) => {
      body.push([
        { text: `${visa.type} (VISA)`, style: "tableCell" },
        { text: formatCurrency(visa.price), style: "tableCell", alignment: "right" },
        { text: visa.pax, style: "tableCell", alignment: "center" },
        { text: formatCurrency(visa.price * visa.pax), style: "tableCell", alignment: "right" },
      ]);
    });
  }

  if (!initial) {
    insuranceItems.forEach((insurance) => {
      body.push([
        { text: `${insurance.provider} (INSURANCE)`, style: "tableCell" },
        {
          text: formatCurrency(insurance.total_price / insurance.pax, insurance.currency),
          style: "tableCell",
          alignment: "right",
        },
        { text: insurance.pax, style: "tableCell", alignment: "center" },
        { text: formatCurrency(insurance.total_price, insurance.currency), style: "tableCell", alignment: "right" },
      ]);
    });
  }

  if (!initial) {
    toursItems.forEach((tour) => {
      body.push([
        { text: `${tour.type} (TOUR)`, style: "tableCell" },
        { text: formatCurrency(tour.price), style: "tableCell", alignment: "right" },
        { text: tour.pax, style: "tableCell", alignment: "center" },
        { text: formatCurrency(tour.price * tour.pax), style: "tableCell", alignment: "right" },
      ]);
    });
  }

  if (!initial) {
    seatsItems.forEach((seat) => {
      body.push([
        { text: `${seat.type} (SEAT)`, style: "tableCell" },
        { text: formatCurrency(seat.price), style: "tableCell", alignment: "right" },
        { text: seat.pax, style: "tableCell", alignment: "center" },
        { text: formatCurrency(seat.price * seat.pax), style: "tableCell", alignment: "right" },
      ]);
    });
  }

  taxItems.forEach((tax) => {
    body.push([
      { text: `${tax.tax} (TAX)`, style: "tableCell" },
      { text: formatCurrency(tax.price), style: "tableCell", alignment: "right" },
      { text: tax.totalPax, style: "tableCell", alignment: "center" },
      { text: formatCurrency(tax.price * tax.totalPax), style: "tableCell", alignment: "right" },
    ]);
  });

  tipItems.forEach((tip) => {
    body.push([
      { text: `${tip.tip} (TIP)`, style: "tableCell" },
      { text: formatCurrency(tip.price), style: "tableCell", alignment: "right" },
      { text: tip.totalPax, style: "tableCell", alignment: "center" },
      { text: formatCurrency(tip.price * tip.totalPax), style: "tableCell", alignment: "right" },
    ]);
  });

  otherFeeItems.forEach((fee) => {
    body.push([
      { text: fee.fee ?? "", style: "tableCell" },
      { text: formatCurrency(fee.price), style: "tableCell", alignment: "right" },
      { text: fee.totalPax, style: "tableCell", alignment: "center" },
      { text: formatCurrency(fee.price * fee.totalPax), style: "tableCell", alignment: "right" },
    ]);
  });

  addonItems.forEach((addon) => {
    body.push([
      { text: `${addon.name || "Add-on"} (ADD-ON)`, style: "tableCell", color: "#ff6b6b" },
      { text: formatCurrency(addon.unit_price || 0, "PHP"), style: "tableCell", alignment: "right", color: "#ff6b6b" },
      { text: addon.pax || addon.quantity || 1, style: "tableCell", alignment: "center", color: "#ff6b6b" },
      { text: formatCurrency(addon.total_price || 0, "PHP"), style: "tableCell", alignment: "right", color: "#ff6b6b" },
    ]);
  });

  if (!isClientSOA) {
    commissionItems.forEach((commission) => {
      body.push([
        { text: commission.commision, style: "tableCell" },
        { text: formatCurrency(-commission.price, commission.currency), style: "tableCell", alignment: "right" },
        { text: commission.nonInfantPax, style: "tableCell", alignment: "center" },
        {
          text: formatCurrency(-commission.price * commission.nonInfantPax, commission.currency),
          style: "tableCell",
          alignment: "right",
        },
      ]);
    });
  }

  if (totalMarkupAmount > 0) {
    const pax = markupAmountPerPax > 0 ? Math.round(totalMarkupAmount / markupAmountPerPax) : "\u2014";
    body.push([
      { text: "Service Fee", style: "tableCell" },
      { text: formatCurrency(markupAmountPerPax, "PHP"), style: "tableCell", alignment: "right" },
      { text: pax, style: "tableCell", alignment: "center" },
      { text: formatCurrency(totalMarkupAmount, "PHP"), style: "tableCell", alignment: "right", bold: true },
    ]);
  }

  if (showNoChargesMessage) {
    body.push([{ text: "No PHP charges available.", colSpan: 4, alignment: "center", style: "tableCell" }, {}, {}, {}]);
  }

  if (discountAmount > 0) {
    body.push([
      {
        text: `LESS: ${promoCode ? `PROMO (${promoCode})` : "DISCOUNT"}`,
        colSpan: 3,
        alignment: "right",
        style: "tableCell",
        color: "green",
      },
      {},
      {},
      { text: `-${formatCurrency(discountAmount, "PHP")}`, style: "tableCell", alignment: "right", color: "green", bold: true },
    ]);
  }

  body.push([
    { text: "TOTAL AMOUNT", colSpan: 3, alignment: "right", style: "tableHeader", margin: [0, 5, 0, 5] },
    {},
    {},
    {
      text: formatCurrency(totalAmount, "PHP"),
      style: "tableCell",
      alignment: "right",
      bold: true,
      valign: "middle",
      margin: [0, 5, 0, 5],
    },
  ]);

  return body;
}

export interface DollarPaymentTableParams extends PaymentTableParams {
  hasUsdItems?: boolean;
}

export function buildDollarPaymentTableBody(params: DollarPaymentTableParams): PdfMakeRow[] {
  const {
    basePackage = [],
    infantTravellers = [],
    baggageItems = [],
    visaItems = [],
    toursItems = [],
    insuranceItems = [],
    seatsItems = [],
    taxItems = [],
    tipItems = [],
    otherFeeItems = [],
    addonItems = [],
    commissionItems = [],
    discountAmount = 0,
    promoCode = "",
    totalAmount = 0,
    hasUsdItems = false,
    isClientSOA = false,
    initial = false,
    markupAmountPerPax = 0,
    totalMarkupAmount = 0,
  } = params;

  const body: PdfMakeRow[] = [
    [
      { text: "PARTICULARS", style: "tableHeader", alignment: "left" },
      { text: "UNIT PRICE (USD)", style: "tableHeader", alignment: "right" },
      { text: "NO. OF PAX", style: "tableHeader", alignment: "center" },
      { text: "AMOUNT (USD)", style: "tableHeader", alignment: "right" },
    ],
  ];

  basePackage.forEach((item) => {
    body.push([
      { text: item.title, style: "tableCell" },
      { text: formatCurrency(item.unitPrice, "USD"), style: "tableCell", alignment: "right" },
      { text: item.pax, style: "tableCell", alignment: "center" },
      { text: formatCurrency(item.amount, "USD"), style: "tableCell", alignment: "right" },
    ]);
  });

  infantTravellers.forEach((infant) => {
    body.push([
      {
        text: infant.description ? `${infant.title} (${infant.description})` : infant.title,
        style: "tableCell",
      },
      { text: formatCurrency(infant.usd_price, "USD"), style: "tableCell", alignment: "right" },
      { text: infant.quantity, style: "tableCell", alignment: "center" },
      { text: formatCurrency(infant.usd_total, "USD"), style: "tableCell", alignment: "right" },
    ]);
  });

  if (!initial) {
    baggageItems.forEach((baggage) => {
      body.push([
        { text: `${baggage.type} - ${baggage.weight}`, style: "tableCell" },
        { text: formatCurrency(baggage.unit_price, "USD"), style: "tableCell", alignment: "right" },
        { text: baggage.pax, style: "tableCell", alignment: "center" },
        { text: formatCurrency(baggage.total_price, "USD"), style: "tableCell", alignment: "right" },
      ]);
    });
  }

  if (!initial) {
    visaItems.forEach((visa) => {
      body.push([
        { text: `${visa.type} (VISA)`, style: "tableCell" },
        { text: formatCurrency(visa.price, "USD"), style: "tableCell", alignment: "right" },
        { text: visa.pax, style: "tableCell", alignment: "center" },
        { text: formatCurrency(visa.price * visa.pax, "USD"), style: "tableCell", alignment: "right" },
      ]);
    });
  }

  if (!initial) {
    toursItems.forEach((tour) => {
      body.push([
        { text: `${tour.type} (TOUR)`, style: "tableCell" },
        { text: formatCurrency(tour.price, "USD"), style: "tableCell", alignment: "right" },
        { text: tour.pax, style: "tableCell", alignment: "center" },
        { text: formatCurrency(tour.price * tour.pax, "USD"), style: "tableCell", alignment: "right" },
      ]);
    });
  }

  if (!initial) {
    seatsItems.forEach((seat) => {
      body.push([
        { text: `${seat.type} (SEAT)`, style: "tableCell" },
        { text: formatCurrency(seat.price, "USD"), style: "tableCell", alignment: "right" },
        { text: seat.pax, style: "tableCell", alignment: "center" },
        { text: formatCurrency(seat.price * seat.pax, "USD"), style: "tableCell", alignment: "right" },
      ]);
    });
  }

  if (!initial) {
    insuranceItems.forEach((insurance) => {
      body.push([
        { text: `${insurance.provider} (INSURANCE)`, style: "tableCell" },
        { text: formatCurrency(insurance.price, "USD"), style: "tableCell", alignment: "right" },
        { text: insurance.pax, style: "tableCell", alignment: "center" },
        { text: formatCurrency((insurance.price ?? 0) * insurance.pax, "USD"), style: "tableCell", alignment: "right" },
      ]);
    });
  }

  taxItems.forEach((tax) => {
    body.push([
      { text: `${tax.tax} (TAX)`, style: "tableCell" },
      { text: formatCurrency(tax.price, "USD"), style: "tableCell", alignment: "right" },
      { text: tax.totalPax, style: "tableCell", alignment: "center" },
      { text: formatCurrency(tax.price * tax.totalPax, "USD"), style: "tableCell", alignment: "right" },
    ]);
  });

  tipItems.forEach((tip) => {
    body.push([
      { text: tip.tip ?? "", style: "tableCell" },
      { text: formatCurrency(tip.price, "USD"), style: "tableCell", alignment: "right" },
      { text: tip.totalPax, style: "tableCell", alignment: "center" },
      { text: formatCurrency(tip.price * tip.totalPax, "USD"), style: "tableCell", alignment: "right" },
    ]);
  });

  otherFeeItems.forEach((fee) => {
    body.push([
      { text: fee.fee ?? "", style: "tableCell" },
      { text: formatCurrency(fee.price, "USD"), style: "tableCell", alignment: "right" },
      { text: fee.totalPax, style: "tableCell", alignment: "center" },
      { text: formatCurrency(fee.price * fee.totalPax, "USD"), style: "tableCell", alignment: "right" },
    ]);
  });

  addonItems.forEach((addon) => {
    body.push([
      { text: `${addon.name || "Add-on"} (ADD-ON)`, style: "tableCell", color: "#ff6b6b" },
      { text: formatCurrency(addon.unit_price || 0, "USD"), style: "tableCell", alignment: "right", color: "#ff6b6b" },
      { text: addon.pax || addon.quantity || 1, style: "tableCell", alignment: "center", color: "#ff6b6b" },
      { text: formatCurrency(addon.total_price || 0, "USD"), style: "tableCell", alignment: "right", color: "#ff6b6b" },
    ]);
  });

  if (!isClientSOA) {
    commissionItems.forEach((commission) => {
      body.push([
        { text: commission.commision, style: "tableCell" },
        { text: formatCurrency(-commission.price, "USD"), style: "tableCell", alignment: "right" },
        { text: commission.nonInfantPax, style: "tableCell", alignment: "center" },
        {
          text: formatCurrency(-commission.price * commission.nonInfantPax, "USD"),
          style: "tableCell",
          alignment: "right",
        },
      ]);
    });
  }

  if (totalMarkupAmount > 0) {
    const pax = markupAmountPerPax > 0 ? Math.round(totalMarkupAmount / markupAmountPerPax) : "\u2014";
    body.push([
      { text: "Service Fee", style: "tableCell" },
      { text: formatCurrency(markupAmountPerPax, "USD"), style: "tableCell", alignment: "right" },
      { text: pax, style: "tableCell", alignment: "center" },
      { text: formatCurrency(totalMarkupAmount, "USD"), style: "tableCell", alignment: "right", bold: true },
    ]);
  }

  if (hasUsdItems && discountAmount > 0) {
    body.push([
      {
        text: `LESS: ${promoCode ? `PROMO (${promoCode})` : "DISCOUNT"}`,
        colSpan: 3,
        alignment: "right",
        style: "tableCell",
        color: "green",
      },
      {},
      {},
      { text: `-${formatCurrency(discountAmount, "USD")}`, style: "tableCell", alignment: "center", color: "green", bold: true },
    ]);
  }

  if (hasUsdItems) {
    body.push([
      { text: "TOTAL AMOUNT", colSpan: 3, alignment: "right", style: "tableHeader", margin: [0, 5, 0, 5] },
      {},
      {},
      { text: formatCurrency(totalAmount, "USD"), style: "tableCell", alignment: "right", bold: true, margin: [0, 5, 0, 5] },
    ]);
  }

  if (!hasUsdItems) {
    body.push([
      { text: "No USD charges available.", colSpan: 4, alignment: "center", style: "tableCell", margin: [0, 8, 0, 8] },
      {},
      {},
      {},
    ]);
  }

  return body;
}