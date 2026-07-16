import { formatCurrency } from "./formatters";
import type { PdfMakeRow } from "./pdfTableBuilders";

export interface ActualPaymentTerm {
  type: "downpayment" | "normal" | "installment" | "payment" | "full" | "addons" | string;
  status?: string;
  amountPaidPhp?: number;
  amountPaidUsd?: number;
  due_date?: string | Date;
  payment_number?: number;
}

export interface ActualPaymentTermsData {
  terms: ActualPaymentTerm[];
  currency: "PHP" | "USD";
  totalPax: number;
}

function getStatusColor(status: string | undefined): string {
  if (status === "accepted" || status === "paid") return "green";
  if (status === "pending") return "orange";
  if (status === "processing") return "blue";
  if (status === "rejected" || status === "overdue") return "red";
  return "gray";
}

function getTermDescription(term: ActualPaymentTerm, index: number): string {
  if (term.type === "downpayment") return "Downpayment";
  if (term.type === "fullpayment") return "Full Payment";
  if (term.type === "full") return "Full Payment Settlement";
  if (term.type === "addons") return "Add-ons / Additional Fees";
  return `Payment ${term.payment_number || index + 1}`;
}

function getTermAmount(
  term: ActualPaymentTerm,
  terms: ActualPaymentTerm[],
  regularPayments: ActualPaymentTerm[],
  currency: "PHP" | "USD",
  isClientSOA: boolean,
  pesoDisplayTotal: number,
  usdDisplayTotal: number
): number {
  let amount = currency === "PHP" ? term.amountPaidPhp ?? 0 : term.amountPaidUsd ?? 0;

  if (isClientSOA && regularPayments.length > 0) {
    if (term.type === "downpayment" || term.type === "addons" || term.type === "full") {
      return amount;
    }

    const regularNonDPPayments = terms.filter((t) => t.type !== "addons" && t.type !== "full" && t.type !== "downpayment");

    const amountCounts: Record<string, number> = {};
    regularNonDPPayments.forEach((t) => {
      const amt = currency === "PHP" ? t.amountPaidPhp ?? 0 : t.amountPaidUsd ?? 0;
      amountCounts[amt] = (amountCounts[amt] || 0) + 1;
    });

    let originalAmount: number | null = null;
    let maxCount = 0;
    for (const [amt, count] of Object.entries(amountCounts)) {
      if (count > maxCount) {
        maxCount = count;
        originalAmount = parseFloat(amt);
      }
    }

    const isOriginalPayment = originalAmount !== null && Math.abs(amount - originalAmount) < 0.01;

    if (!isOriginalPayment) {
      return amount;
    }

    const backendTotal = regularNonDPPayments
      .filter((t) => {
        const amt = currency === "PHP" ? t.amountPaidPhp ?? 0 : t.amountPaidUsd ?? 0;
        return Math.abs(amt - (originalAmount ?? 0)) < 0.01;
      })
      .reduce((sum, t) => sum + (currency === "PHP" ? t.amountPaidPhp ?? 0 : t.amountPaidUsd ?? 0), 0);

    const downpaymentAmount = terms
      .filter((t) => t.type === "downpayment")
      .reduce((sum, t) => sum + (currency === "PHP" ? t.amountPaidPhp ?? 0 : t.amountPaidUsd ?? 0), 0);

    const manuallyAddedAmount = regularNonDPPayments
      .filter((t) => {
        const amt = currency === "PHP" ? t.amountPaidPhp ?? 0 : t.amountPaidUsd ?? 0;
        return Math.abs(amt - (originalAmount ?? 0)) > 0.01;
      })
      .reduce((sum, t) => sum + (currency === "PHP" ? t.amountPaidPhp ?? 0 : t.amountPaidUsd ?? 0), 0);

    const displayTotal = currency === "PHP" ? pesoDisplayTotal : usdDisplayTotal;
    const displayTotalWithoutDPandManual = displayTotal - downpaymentAmount - manuallyAddedAmount;

    if (backendTotal > 0 && Math.abs(backendTotal - displayTotalWithoutDPandManual) > 0.01) {
      const adjustmentRatio = displayTotalWithoutDPandManual / backendTotal;
      amount = amount * adjustmentRatio;
    }
  }

  return amount;
}

function formatDueDate(dueDate: string | Date | undefined): string {
  if (!dueDate) return "TBA";
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export interface PdfTable {
  table: { headerRows: number; widths: (string | number)[]; body: PdfMakeRow[] };
  layout: Record<string, unknown>;
  margin?: number[];
}

export function buildActualPaymentTermsTable(
  actualPaymentTermsData: ActualPaymentTermsData | null | undefined,
  isClientSOA: boolean = false,
  pesoDisplayTotal: number = 0,
  usdDisplayTotal: number = 0
): PdfTable | null {
  if (!actualPaymentTermsData || !actualPaymentTermsData.terms || actualPaymentTermsData.terms.length === 0) {
    return null;
  }

  const { terms, currency, totalPax } = actualPaymentTermsData;

  const hasAcceptedFullPayment = terms.some((t) => t.type === "full" && (t.status === "accepted" || t.status === "paid"));
  const hasActiveFullPayment = terms.some((t) => t.type === "full" && (t.status === "processing" || t.status === "pending"));

  let displayTerms: ActualPaymentTerm[] = [];

  if (hasAcceptedFullPayment) {
    displayTerms = terms.filter((t) => {
      let shouldInclude = false;
      if (t.status === "accepted" || t.status === "paid") {
        if (t.type === "downpayment") shouldInclude = true;
        if (t.type === "normal" || t.type === "installment" || t.type === "payment") shouldInclude = true;
        if (t.type === "full") shouldInclude = true;
      }
      return shouldInclude;
    });
  } else if (hasActiveFullPayment) {
    displayTerms = terms.filter((t) => {
      if (t.type === "downpayment" && (t.status === "accepted" || t.status === "paid")) return true;
      if (t.type === "full" && (t.status === "processing" || t.status === "pending")) return true;
      return false;
    });
  } else {
    displayTerms = terms.filter((t) => t.type !== "addons" && t.type !== "full");
  }

  const regularPayments = displayTerms.filter((t) => t.type !== "addons");

  const addonPayments = terms.filter((t) => {
    if (t.type !== "addons") return false;
    const amount = currency === "PHP" ? t.amountPaidPhp ?? 0 : t.amountPaidUsd ?? 0;
    return amount > 0;
  });

  const body: PdfMakeRow[] = [
    [
      { text: "PAYMENT TERM", style: "tableHeader", alignment: "left" },
      { text: "AMOUNT PER PAX", style: "tableHeader", alignment: "center" },
      { text: "NO. OF PAX", style: "tableHeader", alignment: "center" },
      { text: "TOTAL AMOUNT", style: "tableHeader", alignment: "center" },
      { text: "DUE DATE", style: "tableHeader", alignment: "center" },
      { text: "STATUS", style: "tableHeader", alignment: "center" },
    ],
  ];

  regularPayments.forEach((term, index) => {
    const phpAmount = term.amountPaidPhp || 0;
    const usdAmount = term.amountPaidUsd || 0;
    const hasBoth = phpAmount > 0 && usdAmount > 0;
    const hasPhpOnly = phpAmount > 0 && usdAmount === 0;

    const buildAmountPerPaxCell = () => {
      if (hasBoth) {
        return {
          stack: [
            { text: formatCurrency(phpAmount / totalPax, "PHP"), style: "tableCell", alignment: "center" },
            { text: formatCurrency(usdAmount / totalPax, "USD"), style: "tableCell", alignment: "center", color: "#1565c0" },
          ],
        };
      }
      if (hasPhpOnly) {
        return { text: formatCurrency(phpAmount / totalPax, "PHP"), style: "tableCell", alignment: "center" };
      }
      return { text: formatCurrency(usdAmount / totalPax, "USD"), style: "tableCell", alignment: "center" };
    };

    const buildTotalAmountCell = (isBold = false, textColor?: string) => {
      if (hasBoth) {
        return {
          stack: [
            { text: formatCurrency(phpAmount, "PHP"), style: "tableCell", alignment: "center", bold: isBold },
            { text: formatCurrency(usdAmount, "USD"), style: "tableCell", alignment: "center", bold: isBold, color: "#1565c0" },
          ],
        };
      }
      if (hasPhpOnly) {
        return { text: formatCurrency(phpAmount, "PHP"), style: "tableCell", alignment: "center", bold: isBold, color: textColor };
      }
      return { text: formatCurrency(usdAmount, "USD"), style: "tableCell", alignment: "center", bold: isBold, color: textColor };
    };

    const isFullPaymentTerm = term.type === "full";
    const textColor = isFullPaymentTerm ? "#1976d2" : undefined;
    const isBold = isFullPaymentTerm;

    body.push([
      {
        stack: [
          { text: getTermDescription(term, index), style: "tableCell", bold: isBold, color: textColor },
          {
            text: isFullPaymentTerm ? "Settlement of Remaining Balance" : `Payment #${term.payment_number || index + 1} of ${regularPayments.length}`,
            style: "tableCell",
            fontSize: 8,
            color: textColor || "#666666",
            margin: [0, 2, 0, 0],
          },
        ],
      },
      buildAmountPerPaxCell() as any,
      { text: totalPax.toString(), style: "tableCell", alignment: "center", color: textColor },
      buildTotalAmountCell(isBold, textColor) as any,
      { text: formatDueDate(term.due_date), style: "tableCell", alignment: "center", color: textColor },
      {
        text: term.status ? term.status.toUpperCase() : "PENDING",
        style: "tableCell",
        alignment: "center",
        bold: true,
        color: getStatusColor(term.status),
        fontSize: 8,
      },
    ] as PdfMakeRow);
  });

  if (!hasAcceptedFullPayment && !hasActiveFullPayment) {
    addonPayments.forEach((addon, addonIndex) => {
      const amount = getTermAmount(addon, terms, regularPayments, currency, isClientSOA, pesoDisplayTotal, usdDisplayTotal);
      const amountPerPax = totalPax > 0 ? amount / totalPax : 0;

      body.push([
        {
          stack: [
            { text: getTermDescription(addon, regularPayments.length + addonIndex), style: "tableCell", bold: true, color: "#ff6b6b" },
            { text: "Add-on Payment", style: "tableCell", fontSize: 8, color: "#ff6b6b", margin: [0, 2, 0, 0] },
          ],
        },
        { text: formatCurrency(amountPerPax, currency), style: "tableCell", alignment: "center" },
        { text: totalPax.toString(), style: "tableCell", alignment: "center" },
        { text: formatCurrency(amount, currency), style: "tableCell", alignment: "center", bold: true },
        { text: formatDueDate(addon.due_date), style: "tableCell", alignment: "center" },
        {
          text: addon.status ? addon.status.toUpperCase() : "PENDING",
          style: "tableCell",
          alignment: "center",
          bold: true,
          color: getStatusColor(addon.status),
          fontSize: 8,
        },
      ] as PdfMakeRow);
    });
  }

  const allValidTerms = hasAcceptedFullPayment || hasActiveFullPayment ? regularPayments : [...regularPayments, ...addonPayments];

  const paidCount = allValidTerms.filter((t) => t.status === "accepted" || t.status === "paid").length;

  const paidPhpAmount = allValidTerms
    .filter((t) => t.status === "accepted" || t.status === "paid")
    .reduce((sum, t) => sum + (t.amountPaidPhp || 0), 0);

  const paidUsdAmount = allValidTerms
    .filter((t) => t.status === "accepted" || t.status === "paid")
    .reduce((sum, t) => sum + (t.amountPaidUsd || 0), 0);

  const totalPhpAmountAll = allValidTerms.reduce((sum, t) => sum + (t.amountPaidPhp || 0), 0);
  const totalUsdAmountAll = allValidTerms.reduce((sum, t) => sum + (t.amountPaidUsd || 0), 0);

  const remainingPhp = totalPhpAmountAll - paidPhpAmount;
  const remainingUsd = totalUsdAmountAll - paidUsdAmount;

  const hasMixedCurrency = totalPhpAmountAll > 0 && totalUsdAmountAll > 0;

  body.push([
    { text: "REMAINING BALANCE", colSpan: 3, alignment: "right", style: "tableHeader", bold: true },
    {},
    {},
    {
      stack: hasMixedCurrency
        ? [
            { text: formatCurrency(remainingPhp, "PHP"), style: "tableCell", alignment: "center", bold: true, fontSize: 10, color: remainingPhp > 0 ? "red" : "green" },
            { text: formatCurrency(remainingUsd, "USD"), style: "tableCell", alignment: "center", bold: true, fontSize: 10, color: remainingUsd > 0 ? "red" : "green" },
          ]
        : [
            {
              text: formatCurrency(remainingPhp > 0 ? remainingPhp : remainingUsd, remainingPhp > 0 ? "PHP" : "USD"),
              style: "tableCell",
              alignment: "center",
              bold: true,
              fontSize: 11,
              color: remainingPhp > 0 || remainingUsd > 0 ? "red" : "green",
            },
          ],
    } as any,
    {
      text: `${paidCount} of ${allValidTerms.length} paid`,
      colSpan: 2,
      alignment: "center",
      style: "tableCell",
      fontSize: 9,
      color: paidCount === allValidTerms.length ? "green" : "orange",
    },
    {},
  ] as PdfMakeRow);

  return {
    table: {
      headerRows: 1,
      widths: ["*", "18%", "12%", "18%", "18%", "12%"],
      body,
    },
    layout: {
      hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 2 : 1),
      vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 2 : 1),
      hLineColor: () => "#222A35",
      vLineColor: () => "#222A35",
      fillColor: (rowIndex: number, node: any) => {
        if (rowIndex === 0) return "#e8f5e9";
        if (rowIndex === node.table.body.length - 1) return "#c8e6c9";
        const firstCell = node.table.body[rowIndex][0];
        const isAddon = firstCell?.stack?.[0]?.color === "#ff6b6b";
        if (isAddon) return "#fff3e0";
        const isFullPaymentRow = firstCell?.stack?.[0]?.color === "#1976d2";
        if (isFullPaymentRow) return "#e3f2fd";
        return rowIndex % 2 === 0 ? "#f5f5f5" : null;
      },
    },
    margin: [0, 10, 0, 0],
  };
}