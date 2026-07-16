import { formatCurrency, getReadableDate } from "./formatters";
import { buildPesoPaymentTableBody, buildDollarPaymentTableBody } from "./pdfTableBuilders";
import type { PaymentTableParams, DollarPaymentTableParams } from "./pdfTableBuilders";
import { buildActualPaymentTermsTable } from "./actualPaymentTermsTable";
import type { ActualPaymentTermsData } from "./actualPaymentTermsTable";
import { buildProjectedPaymentScheduleTable } from "./projectedPaymentScheduleTable";
import type { ProjectedScheduleData } from "./projectedPaymentScheduleTable";
import {
  computeDisplayTotal,
  computeRemainingBalanceForDocument,
  computeDisplayEmail,
  computeDisplayContact,
} from "./documentDisplay.calc";
import type { DisplayUserContext, AgencyDetailsForDisplay } from "./documentDisplay.calc";

function keepTogether(contentBlock: unknown) {
  return { stack: [contentBlock], pageBreak: "avoid" };
}

export interface BankDetailEntry {
  isActive?: boolean;
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
}

export interface SOAAssemblyData {
  isGladex?: boolean;
  isPremiumPackages?: boolean;
  recipientName: string;
  referenceNumber: string;
  travelInfo: {
    recipientEmail?: string;
    contactEmail?: string;
    estimatedArrival?: Date | string | null;
    estimatedDeparture?: Date | string | null;
    totalPax: number;
    bookingDate?: Date | string;
    hotelInfo?: string;
    area?: string;
    packageTitle?: string;
    preparedBy?: string;
    agencyDetails?: AgencyDetailsForDisplay;
    leadGuest?: { email?: string; phoneNumber?: string; phone_number?: string; phone?: string };
  };
  pesoPayment: PaymentTableParams;
  dollarPayment?: DollarPaymentTableParams & { hasUsdItems?: boolean };
  paymentSchedule?: {
    installmentCurrency?: string;
    guaranteeDepositDeadline?: Date | string | null;
    guaranteeDepositAmount?: number;
    fullPaymentDeadline?: Date | string | null;
    remainingBalance?: number;
    balanceCurrency?: string;
    currencyMismatch?: boolean;
    totalPax?: number;
    downpaymentStatus?: string;
    packageStatus?: string;
  };
  fullPayment?: {
    fullpaymentCurrency?: string;
    fullPaymentDeadline?: Date | string | null;
    perPaxAmount?: number;
    totalPax?: number;
    packageStatus?: string;
  };
  fullPaymentInfo?: {
    currency?: string;
    totalAmount?: number;
    totalPax?: number;
    packageStatus?: string;
  };
  bookingPayload?: { isFullpayment?: boolean };
  actualPaymentTerms?: ActualPaymentTermsData | null;
  projectedPaymentSchedule?: ProjectedScheduleData | null;
}

export interface DocumentAssemblyOptions {
  bannerBase64: string;
  isClientSOA: boolean;
  bankDetails: BankDetailEntry[];
  effectiveAgencyDetails: AgencyDetailsForDisplay | undefined;
  user: DisplayUserContext;
}

export function buildSOADocumentContent(soaData: SOAAssemblyData, options: DocumentAssemblyOptions): unknown[] {
  const { bannerBase64, isClientSOA, bankDetails, effectiveAgencyDetails, user } = options;

  const isInitial = (soaData.pesoPayment as any)?.initial || false;

  const pesoDisplayTotal = computeDisplayTotal(
    soaData.pesoPayment.totalAmount ?? 0,
    soaData.pesoPayment.commissionItems,
    soaData.pesoPayment.commissionItems?.[0]?.nonInfantPax ?? soaData.travelInfo.totalPax,
    isClientSOA
  );

  const usdDisplayTotal = soaData.dollarPayment
    ? computeDisplayTotal(
        soaData.dollarPayment.totalAmount ?? 0,
        soaData.dollarPayment.commissionItems,
        soaData.dollarPayment.commissionItems?.[0]?.nonInfantPax ?? soaData.travelInfo.totalPax,
        isClientSOA
      )
    : 0;

  const adjustedRemainingBalance = computeRemainingBalanceForDocument(soaData.paymentSchedule, pesoDisplayTotal, usdDisplayTotal);

  const displayEmail = computeDisplayEmail(soaData.travelInfo, user, effectiveAgencyDetails);
  const displayContact = computeDisplayContact(soaData.travelInfo, user, effectiveAgencyDetails);

  const content: unknown[] = [
    { image: bannerBase64, width: 520, alignment: "center", margin: [0, 0, 0, 0] },
    {
      table: {
        widths: ["65%", "35%"],
        body: [
          [
            {
              stack: [
                { text: "STATEMENT OF ACCOUNT FOR", style: "titleLabel", margin: [0, 4, 0, 0] },
                { text: soaData.recipientName, style: "titleValue", margin: [0, 6, 0, 8] },
              ],
              border: [true, true, true, true],
            },
            {
              stack: [
                { text: "REFERENCE NO.", style: "titleLabel", alignment: "right", margin: [0, 4, 0, 0] },
                { text: soaData.referenceNumber, style: "titleValue", alignment: "right", margin: [0, 6, 0, 8] },
              ],
              border: [true, true, true, true],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 2 : 0),
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 2 : 0),
        hLineColor: () => "#222A35",
        vLineColor: () => "#222A35",
      },
      margin: [0, 10, 0, 10],
    },
    { text: "Travel Information", style: "sectionTitle", margin: [0, 10, 0, 4] },
    {
      table: {
        widths: ["25%", "25%", "25%", "25%"],
        body: [
          [
            { text: "EMAIL ADDRESS", style: "gridLabel" },
            { text: displayEmail, style: "gridValue" },
            { text: "CONTACTS", style: "gridLabel" },
            { text: displayContact, style: "gridValue" },
          ],
          [
            { text: "ETA", style: "gridLabel" },
            { text: getReadableDate(soaData.travelInfo.estimatedArrival), style: "gridValue" },
            { text: "ETD", style: "gridLabel" },
            { text: getReadableDate(soaData.travelInfo.estimatedDeparture), style: "gridValue" },
          ],
          [
            { text: "NO. OF PAX", style: "gridLabel" },
            { text: soaData.travelInfo.totalPax, style: "gridValue" },
            { text: "BOOKING DATE", style: "gridLabel" },
            { text: getReadableDate(soaData.travelInfo.bookingDate), style: "gridValue" },
          ],
          [
            { text: "HOTEL", style: "gridLabel" },
            { text: soaData.travelInfo.hotelInfo, style: "gridValue" },
            { text: "AREA", style: "gridLabel" },
            {
              text: soaData.travelInfo.area?.includes("[Edit Me]") ? "TBD" : soaData.travelInfo.area || "TBD",
              style: "gridValue",
            },
          ],
          [
            { text: "PACKAGE TITLE", style: "gridLabel" },
            { text: soaData.travelInfo.packageTitle, style: "gridValue" },
            { text: "PREPARED BY", style: "gridLabel" },
            { text: soaData.travelInfo.preparedBy, style: "gridValue" },
          ],
        ],
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 2 : 1),
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 2 : 1),
        hLineColor: () => "#222A35",
        vLineColor: () => "#222A35",
      },
    },
    { text: "Peso Payment", style: "sectionTitle", margin: [0, 10, 0, 4] },
    {
      table: {
        headerRows: 1,
        widths: ["*", "22%", "15%", "20%"],
        body: buildPesoPaymentTableBody({ ...soaData.pesoPayment, totalAmount: pesoDisplayTotal, isClientSOA, initial: isInitial }),
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 2 : 1),
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 2 : 1),
        hLineColor: () => "#222A35",
        vLineColor: () => "#222A35",
      },
      margin: [0, 10, 0, 0],
    },
  ];

  if (soaData.dollarPayment && !soaData.isGladex) {
    content.push(
      { text: "Dollar Payment", style: "sectionTitle", margin: [0, 10, 0, 4] },
      {
        table: {
          headerRows: 1,
          widths: ["*", "22%", "15%", "20%"],
          body: buildDollarPaymentTableBody({
            ...soaData.dollarPayment,
            totalAmount: usdDisplayTotal,
            isClientSOA,
            initial: isInitial,
          }),
        },
        layout: {
          hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 2 : 1),
          vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 2 : 1),
          hLineColor: () => "#222A35",
          vLineColor: () => "#222A35",
        },
        margin: [0, 10, 0, 0],
      }
    );
  }

  if (!soaData.bookingPayload?.isFullpayment) {
    const ps = soaData.paymentSchedule;
    content.push({
      table: {
        headerRows: 1,
        widths: ["*", "22%", "15%", "20%"],
        body: [
          [
            { text: "", style: "yellowHeader", alignment: "right", fillColor: "#fff176" },
            { text: `UNIT PRICE (${ps?.installmentCurrency})`, style: "yellowHeader", alignment: "right", fillColor: "#fff176" },
            { text: "NO. OF PAX", style: "yellowHeader", alignment: "center", fillColor: "#fff176" },
            { text: `AMOUNT (${ps?.installmentCurrency})`, style: "yellowHeader", alignment: "right", fillColor: "#fff176" },
          ],
          [
            {
              stack: [
                { text: `DEADLINE FOR GUARANTEE DEPOSIT (${ps?.installmentCurrency})`, style: "yellowCell" },
                {
                  text: getReadableDate(ps?.guaranteeDepositDeadline) + (ps?.downpaymentStatus === "accepted" ? " (PAID)" : ""),
                  style: ps?.downpaymentStatus === "accepted" ? "paidGreen" : "unPaidRed",
                },
              ],
              colSpan: 1,
              fillColor: "#fff176",
              border: [true, true, true, true],
            },
            {
              text: formatCurrency((ps?.totalPax ?? 0) > 0 ? (ps?.guaranteeDepositAmount ?? 0) / (ps!.totalPax as number) : ps?.guaranteeDepositAmount, ps?.installmentCurrency),
              style: "yellowCell",
              alignment: "right",
              fillColor: "#fff176",
              margin: [0, 8, 0, 8],
            },
            { text: ps?.totalPax, style: "yellowCell", alignment: "center", fillColor: "#fff176", margin: [0, 8, 0, 8] },
            {
              text: formatCurrency(ps?.guaranteeDepositAmount, ps?.installmentCurrency),
              style: "yellowCell",
              alignment: "right",
              fillColor: "#fff176",
              margin: [0, 8, 0, 8],
            },
          ],
          [
            {
              stack: [
                {
                  text: `DEADLINE FOR FULL PAYMENT (${ps?.currencyMismatch ? ps?.balanceCurrency : ps?.installmentCurrency})`,
                  style: "yellowCell",
                },
                {
                  text: getReadableDate(ps?.fullPaymentDeadline) + (ps?.packageStatus === "paid" ? " (PAID)" : ""),
                  style: ps?.packageStatus === "paid" ? "paidGreen" : "unPaidRed",
                },
              ],
              colSpan: 4,
              fillColor: "#fff176",
              border: [true, true, true, true],
            },
            {},
            {},
            {},
          ],
          [
            { text: "", fillColor: "#fff176", border: [true, true, true, true] },
            { text: "", fillColor: "#fff176", border: [true, true, true, true] },
            { text: "", fillColor: "#fff176", border: [true, true, true, true] },
            {
              text: formatCurrency(adjustedRemainingBalance, ps?.currencyMismatch ? ps?.balanceCurrency : ps?.installmentCurrency),
              style: "yellowCell",
              alignment: "right",
              fillColor: "#fff176",
            },
          ],
        ],
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 2 : 1),
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 2 : 1),
        hLineColor: () => "#222A35",
        vLineColor: () => "#222A35",
      },
      margin: [0, 10, 0, 0],
    });
  }

  if (!soaData.bookingPayload?.isFullpayment) {
    const fp = soaData.fullPayment;
    content.push({
      table: {
        headerRows: 1,
        widths: ["*", "22%", "15%", "20%"],
        body: [
          [
            { text: "", style: "yellowHeader", alignment: "right", fillColor: "#fff176" },
            { text: `UNIT PRICE (${fp?.fullpaymentCurrency})`, style: "yellowHeader", alignment: "right", fillColor: "#fff176" },
            { text: "NO. OF PAX", style: "yellowHeader", alignment: "center", fillColor: "#fff176" },
            { text: `AMOUNT (${fp?.fullpaymentCurrency})`, style: "yellowHeader", alignment: "right", fillColor: "#fff176" },
          ],
          [
            {
              stack: [
                { text: `Deadline for Full Payment (${fp?.fullpaymentCurrency})`, style: "yellowCell", bold: true },
                {
                  text: `${getReadableDate(fp?.fullPaymentDeadline)}${fp?.packageStatus === "paid" ? " (PAID)" : ""}`,
                  style: fp?.packageStatus === "paid" ? "paidGreen" : "unPaidRed",
                  margin: [0, 4, 0, 0],
                },
              ],
              fillColor: "#fff176",
              border: [true, true, true, true],
            },
            {
              text: formatCurrency(fp?.perPaxAmount, fp?.fullpaymentCurrency),
              style: "yellowCell",
              alignment: "right",
              fillColor: "#fff176",
              margin: [0, 8, 0, 8],
            },
            {
              text: (fp?.perPaxAmount ?? 0) > 0 ? fp?.totalPax : 0,
              style: "yellowCell",
              alignment: "center",
              fillColor: "#fff176",
              margin: [0, 8, 0, 8],
            },
            {
              text: formatCurrency((fp?.perPaxAmount ?? 0) * (fp?.totalPax ?? 0), fp?.fullpaymentCurrency),
              style: "yellowCell",
              alignment: "right",
              fillColor: "#fff176",
              margin: [0, 8, 0, 8],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 2 : 1),
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 2 : 1),
        hLineColor: () => "#222A35",
        vLineColor: () => "#222A35",
      },
      margin: [0, 10, 0, 0],
    });
  }

  if (soaData.bookingPayload?.isFullpayment) {
    const fpi = soaData.fullPaymentInfo;
    const fullPaymentTotal = isClientSOA
      ? fpi?.currency === "USD"
        ? usdDisplayTotal
        : pesoDisplayTotal
      : fpi?.totalAmount ?? 0;

    const perPaxTotal = (fpi?.totalPax ?? 0) > 0 ? fullPaymentTotal / (fpi!.totalPax as number) : 0;

    content.push({
      table: {
        headerRows: 1,
        widths: ["*", "22%", "15%", "20%"],
        body: [
          [
            { text: "", style: "yellowHeader", alignment: "right", fillColor: "#fff176" },
            { text: `UNIT PRICE (${fpi?.currency})`, style: "yellowHeader", alignment: "right", fillColor: "#fff176" },
            { text: "NO. OF PAX", style: "yellowHeader", alignment: "center", fillColor: "#fff176" },
            { text: `AMOUNT (${fpi?.currency})`, style: "yellowHeader", alignment: "right", fillColor: "#fff176" },
          ],
          [
            {
              stack: [
                { text: `TOTAL PAYMENT (${fpi?.currency})`, style: "yellowCell", bold: true },
                {
                  text: fpi?.packageStatus === "paid" ? "PAID" : "UNPAID",
                  style: fpi?.packageStatus === "paid" ? "paidGreen" : "unPaidRed",
                  margin: [0, 4, 0, 0],
                },
              ],
              fillColor: "#fff176",
              border: [true, true, true, true],
            },
            { text: formatCurrency(perPaxTotal, fpi?.currency), style: "yellowCell", alignment: "right", fillColor: "#fff176", margin: [0, 8, 0, 8] },
            { text: fpi?.totalPax, style: "yellowCell", alignment: "center", fillColor: "#fff176", margin: [0, 8, 0, 8] },
            {
              text: formatCurrency(fullPaymentTotal, fpi?.currency),
              style: "yellowCell",
              alignment: "right",
              fillColor: "#fff176",
              bold: true,
              margin: [0, 8, 0, 8],
            },
          ],
        ],
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 2 : 1),
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 2 : 1),
        hLineColor: () => "#222A35",
        vLineColor: () => "#222A35",
      },
      margin: [0, 10, 0, 0],
    });
  }

  if (soaData.actualPaymentTerms?.terms && soaData.actualPaymentTerms.terms.length > 0) {
    const paymentTermsTable = buildActualPaymentTermsTable(soaData.actualPaymentTerms, isClientSOA, pesoDisplayTotal, usdDisplayTotal);
    if (paymentTermsTable) {
      content.push({ text: "Confirmed Payment Schedule", style: "sectionTitle", margin: [0, 15, 0, 4], color: "#2e7d32" }, paymentTermsTable);
    }
  }

  if (soaData.projectedPaymentSchedule?.paymentTerms && soaData.projectedPaymentSchedule.paymentTerms.length > 0) {
    const projectedTable = buildProjectedPaymentScheduleTable(soaData.projectedPaymentSchedule, isClientSOA, pesoDisplayTotal, usdDisplayTotal);
    if (projectedTable) {
      content.push(
        {
          text: soaData.projectedPaymentSchedule.isFullPayment ? "Full Payment Details" : "Estimated Payment Schedule",
          style: "sectionTitle",
          margin: [0, 15, 0, 4],
          color: soaData.projectedPaymentSchedule.isFullPayment ? "#2e7d32" : "#1976d2",
        },
        ...projectedTable
      );
    }
  }

  content.push(
    keepTogether({
      table: {
        headerRows: 1,
        widths: ["33%", "34%", "33%"],
        body: (() => {
          const body: unknown[][] = [
            [
              { text: "BANK", style: "tableHeader", alignment: "center", valign: "middle" },
              { text: "ACCOUNT NAME", style: "tableHeader", alignment: "center", valign: "middle" },
              { text: "ACCOUNT NO.", style: "tableHeader", alignment: "center", valign: "middle" },
            ],
          ];
          (bankDetails || []).forEach((item) => {
            if (item.isActive) {
              body.push([
                { text: item.bankName, style: "tableCell", alignment: "center", valign: "middle" },
                { text: item.accountName, style: "tableCell", alignment: "center", valign: "middle" },
                { text: item.accountNumber, style: "tableCell", alignment: "center", valign: "middle" },
              ]);
            }
          });
          body.push([
            {
              text: "*Note: For PESO deposit, we use BDO selling rate, PLUS 1 PESO otherwise USD is very much acceptable.",
              style: "bankNote",
              colSpan: 3,
              alignment: "center",
              valign: "middle",
              margin: [0, 8, 0, 8],
            },
            {},
            {},
          ]);
          return body;
        })(),
      },
      layout: {
        hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 2 : 1),
        vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 2 : 1),
        hLineColor: () => "#222A35",
        vLineColor: () => "#222A35",
      },
      margin: [0, 10, 0, 0],
    })
  );

  content.push({
    table: {
      widths: ["*"],
      body: [
        [
          {
            stack: [
              { text: "Terms and Conditions", style: "textHeader", margin: [0, 0, 0, 8] },
              {
                ul: [
                  "Deposit and Agreement: Upon receiving the guarantee deposit, the agency agrees to adhere to the company's terms and conditions.",
                  `Guarantee Deposit: ${formatCurrency(
                    soaData.paymentSchedule?.guaranteeDepositAmount,
                    soaData.paymentSchedule?.installmentCurrency
                  )} per person is required to secure the reservation. The guarantee deposit is non-refundable and must be settled within three (3) business days of receiving the Confirmation Invoice. Otherwise, the slot may be released.`,
                  "Booking Holding Period: The booking holding period is limited to three (3) business days only.",
                  "Full Payment: Full payment must be settled thirty (30) days before the Departure Date; otherwise, the slot may be released, and the deposit forfeited. If booked less than a month before departure, full payment must be made three (3) days after receiving the Confirmation Invoice.",
                  "Book and Buy: Upon acknowledgment of the deposit receipt, the booking is considered confirmed and final. Cancellation can no longer be processed.",
                  "Payment Method: All payments must be made via bank transfer. Cash payments are not accepted.",
                  "Ticket Issuance: Ticket issuance is finalized approximately one week before the departure date. Please note that this timeline is subject to adjustments influenced by the heightened demand experienced during peak seasons, as well as the operational capacity of our airline partners.",
                  "Cancellation Policy: Once the guarantee deposit has been made, cancellation is not permitted. Both the guarantee deposit and full payment will be forfeited in the event of cancellation.",
                  "Credit Note Policy: In the event of an overpayment, a credit note will be issued, transferring the overpaid amount into a TRAVEL FUND. This credit note is NON-REFUNDABLE and can only be applied to future bookings with Gladex Travel and Tours Corp.",
                  "Immigration Process: For passengers unable to pass the immigration process at any international airport, the entire tour package cost is non-refundable.",
                  "Flight Schedule Adjustments: In the event of sudden adjustments to the flight schedule made by the airline, clients are expected to follow the new set schedule.",
                ],
                style: "textBody",
              },
              { text: "All prices are exclusive of taxes", color: "red", margin: [0, 10, 0, 0], fontSize: 9 },
            ],
            border: [false, false, false, false],
            margin: [0, 10, 0, 10],
          },
        ],
      ],
    },
    layout: {
      hLineWidth: (i: number, node: any) => (i === 0 || i === node.table.body.length ? 3 : 1),
      vLineWidth: (i: number, node: any) => (i === 0 || i === node.table.widths.length ? 3 : 1),
      hLineColor: () => "#222A35",
      vLineColor: () => "#222A35",
    },
  });

  return content;
}

export function buildSOADocumentDefinition(content: unknown[]) {
  return {
    background: (_currentPage: number, pageSize: { width: number; height: number }) => ({
      canvas: [
        {
          type: "rect",
          x: 10,
          y: 10,
          w: pageSize.width - 20,
          h: pageSize.height - 20,
          r: 0,
          lineColor: "#333333",
          lineWidth: 2,
        },
      ],
    }),
    content,
    styles: {
      textHeader: { fontSize: 12, bold: true, margin: [0, 0, 0, 10] },
      textBody: { fontSize: 9, margin: [0, 0, 0, 5], font: "Roboto" },
      titleLabel: { fontSize: 11, color: "#222A35", bold: false, margin: [0, 0, 0, 0] },
      titleValue: { fontSize: 12, color: "#222A35", bold: true, margin: [0, 0, 0, 0] },
      sectionTitle: { fontSize: 12, bold: true, margin: [0, 10, 0, 3], font: "Roboto" },
      gridLabel: { fontSize: 9, bold: true, fillColor: "lightgray", alignment: "left" },
      gridValue: { fontSize: 9, alignment: "left" },
      tableHeader: { bold: true, fontSize: 10, fillColor: "#eeeeee", margin: [0, 3, 0, 3] },
      tableCell: { fontSize: 9, margin: [0, 1, 0, 1] },
      totalAmountCell: { fontSize: 9, color: "#222A35", bold: true },
      yellowHeader: { fontSize: 10, bold: true, fillColor: "#fff176", alignment: "center" },
      yellowCell: { fontSize: 10, fillColor: "#fff176" },
      paidGreen: { fontSize: 9, bold: true, color: "green" },
      unPaidRed: { fontSize: 9, bold: true, color: "red" },
      deadlineRed: { fontSize: 9, bold: true, color: "red" },
      bankTitle: { fontSize: 11, bold: true, margin: [0, 0, 0, 10] },
      bankLabel: { fontSize: 9, bold: true, color: "#222A35", margin: [0, 0, 0, 0] },
      bankValue: { fontSize: 9, color: "#222A35", margin: [0, 0, 0, 0] },
      bankNote: { fontSize: 9, bold: true, margin: [0, 10, 0, 0] },
    },
    defaultStyle: { font: "Roboto" },
  };
}