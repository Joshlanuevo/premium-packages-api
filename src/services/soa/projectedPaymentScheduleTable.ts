import { formatCurrency } from "./formatters";
import type { PdfMakeRow } from "./pdfTableBuilders";
import type { ProjectedPaymentTerm } from "./projectedPayments.calc";

export interface ProjectedScheduleData {
  paymentTerms: ProjectedPaymentTerm[];
  currency: string;
  totalPax: number;
  isFullPayment: boolean;
}

function formatDueDate(dueDate: Date | string | null | undefined): string {
  if (!dueDate) return "TBA";
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return "TBA";
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function buildProjectedPaymentScheduleTable(
  projectedData: ProjectedScheduleData | null | undefined,
  isClientSOA: boolean = false,
  pesoDisplayTotal: number = 0,
  usdDisplayTotal: number = 0
): unknown[] | null {
  if (!projectedData || !projectedData.paymentTerms || projectedData.paymentTerms.length === 0) {
    return null;
  }

  const { paymentTerms, currency, totalPax, isFullPayment } = projectedData;

  const headerColor = isFullPayment ? "#c8e6c9" : "#bbdefb";
  const rowColor1 = isFullPayment ? "#e8f5e9" : "#e3f2fd";
  const rowColor2 = isFullPayment ? "#f1f8e9" : "#e1f5fe";
  const totalRowColor = isFullPayment ? "#a5d6a7" : "#90caf9";
  const noteColor = isFullPayment ? "#c8e6c9" : "#fff9c4";

  const originalTotal = paymentTerms.reduce((sum, term) => sum + term.total_amount, 0);
  const adjustedTotal = isClientSOA
    ? currency === "PHP"
      ? pesoDisplayTotal
      : usdDisplayTotal
    : originalTotal;

  const body: PdfMakeRow[] = [
    [
      { text: "PAYMENT TERM", style: "tableHeader", alignment: "left", fillColor: headerColor } as any,
      { text: `UNIT PRICE (${currency})`, style: "tableHeader", alignment: "center", fillColor: headerColor } as any,
      { text: "NO. OF PAX", style: "tableHeader", alignment: "center", fillColor: headerColor } as any,
      { text: `TOTAL AMOUNT (${currency})`, style: "tableHeader", alignment: "center", fillColor: headerColor } as any,
      { text: "DUE DATE", style: "tableHeader", alignment: "center", fillColor: headerColor } as any,
    ],
  ];

  paymentTerms.forEach((term, index) => {
    const rowColor = index % 2 === 0 ? rowColor1 : rowColor2;

    const phpTotal = term.phpTotal || 0;
    const usdTotal = term.usdTotal || 0;
    const hasBoth = phpTotal > 0 && usdTotal > 0;

    const amountPerPaxCell: any = hasBoth
      ? {
          stack: [
            { text: formatCurrency(term.phpAmountPerPax, "PHP"), style: "tableCell", alignment: "center" },
            { text: formatCurrency(term.usdAmountPerPax, "USD"), style: "tableCell", alignment: "center", color: "#1565c0" },
          ],
          fillColor: rowColor,
        }
      : usdTotal > 0
      ? {
          text: formatCurrency(term.usdAmountPerPax || term.total_amount / totalPax, "USD"),
          style: "tableCell",
          alignment: "center",
          fillColor: rowColor,
        }
      : {
          text: formatCurrency(term.phpAmountPerPax || term.total_amount / totalPax, "PHP"),
          style: "tableCell",
          alignment: "center",
          fillColor: rowColor,
        };

    const totalAmountCell: any = hasBoth
      ? {
          stack: [
            { text: formatCurrency(phpTotal, "PHP"), style: "tableCell", alignment: "center", bold: true },
            { text: formatCurrency(usdTotal, "USD"), style: "tableCell", alignment: "center", bold: true, color: "#1565c0" },
          ],
          fillColor: rowColor,
        }
      : usdTotal > 0
      ? {
          text: formatCurrency(usdTotal, "USD"),
          style: "tableCell",
          alignment: "center",
          bold: true,
          color: isFullPayment ? "#2e7d32" : "#1565c0",
          fillColor: rowColor,
        }
      : {
          text: formatCurrency(phpTotal || term.total_amount, "PHP"),
          style: "tableCell",
          alignment: "center",
          bold: true,
          color: isFullPayment ? "#2e7d32" : "#1565c0",
          fillColor: rowColor,
        };

    body.push([
      {
        stack: [
          { text: term.description, style: "tableCell", bold: true, color: isFullPayment ? "#2e7d32" : "#1565c0" },
          !isFullPayment
            ? { text: `Payment #${term.payment_number} of ${paymentTerms.length}`, style: "tableCell", fontSize: 8, color: "#666666", margin: [0, 2, 0, 0] }
            : {},
        ],
        fillColor: rowColor,
      } as any,
      amountPerPaxCell,
      { text: totalPax.toString(), style: "tableCell", alignment: "center", fillColor: rowColor } as any,
      totalAmountCell,
      { text: formatDueDate(term.due_date), style: "tableCell", alignment: "center", fillColor: rowColor } as any,
    ] as PdfMakeRow);
  });

  const projectedPhpTotal = paymentTerms.reduce((sum, t) => sum + (t.phpTotal || 0), 0);
  const projectedUsdTotal = paymentTerms.reduce((sum, t) => sum + (t.usdTotal || 0), 0);
  const projectedHasBoth = projectedPhpTotal > 0 && projectedUsdTotal > 0;

  body.push([
    {
      text: isFullPayment ? "TOTAL AMOUNT DUE" : "TOTAL ESTIMATED PAYMENT",
      colSpan: 3,
      alignment: "right",
      style: "tableHeader",
      bold: true,
      fillColor: totalRowColor,
    } as any,
    {},
    {},
    (projectedHasBoth
      ? {
          stack: [
            { text: formatCurrency(projectedPhpTotal, "PHP"), style: "tableCell", alignment: "center", bold: true, fontSize: 10 },
            { text: formatCurrency(projectedUsdTotal, "USD"), style: "tableCell", alignment: "center", bold: true, fontSize: 10, color: "#1565c0" },
          ],
          fillColor: totalRowColor,
        }
      : {
          text: formatCurrency(adjustedTotal, currency),
          style: "tableCell",
          alignment: "center",
          bold: true,
          fontSize: 11,
          color: isFullPayment ? "#1b5e20" : "#0d47a1",
          fillColor: totalRowColor,
        }) as any,
    {
      text: isFullPayment ? "Pay in full" : "Subject to change",
      style: "tableCell",
      alignment: "center",
      fontSize: 8,
      color: "#666666",
      fillColor: totalRowColor,
    } as any,
  ] as PdfMakeRow);

  const content: unknown[] = [
    {
      table: { headerRows: 1, widths: ["*", "20%", "12%", "20%", "20%"], body },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 2 : 1),
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 2 : 1),
        hLineColor: () => "#222A35",
        vLineColor: () => "#222A35",
      },
      margin: [0, 0, 0, 10],
    },
    {
      table: {
        widths: ["*"],
        body: [
          [
            {
              stack: [
                { text: "Important Notes:", style: "textHeader", fontSize: 10, bold: true, margin: [0, 0, 0, 5] },
                {
                  ul: isFullPayment
                    ? [
                        `Full payment is required on or before ${
                          paymentTerms[0]?.due_date ? formatDueDate(paymentTerms[0].due_date) : "the due date"
                        }`,
                        "Your booking will be confirmed upon receipt of full payment",
                        "No installment options are available for this booking",
                        "Please ensure payment is made before the deadline to secure your reservation",
                      ]
                    : [
                        "Payment amounts and dates are estimates based on current package settings",
                        "Final payment schedule will be generated upon booking confirmation",
                        "Actual due dates may vary based on booking date and package availability",
                        "Full terms and conditions will be provided in your booking confirmation",
                      ],
                  style: "textBody",
                  fontSize: 8,
                },
              ],
              fillColor: noteColor,
              border: [true, true, true, true],
              margin: [5, 5, 5, 5],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: () => 2,
        vLineWidth: () => 2,
        hLineColor: () => (isFullPayment ? "#81c784" : "#fdd835"),
        vLineColor: () => (isFullPayment ? "#81c784" : "#fdd835"),
      },
    },
  ];

  return content;
}