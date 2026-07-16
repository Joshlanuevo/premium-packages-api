import PdfPrinter from "pdfmake";
import { getFirestore } from "../../config/firebase";
import { Collections } from "../../constants/collections";
import { computeSOAData } from "./soaData.calc";
import type { UserContext } from "./soaData.calc";
import { computeSOAItems } from "./soaItems.calc";
import { computeSOATravellers } from "./soaTravellers.calc";
import { computeSOAPayments } from "./soaPayments.calc";
import { computeProjectedPayments } from "./projectedPayments.calc";
import { buildSOADocumentContent, buildSOADocumentDefinition } from "./documentAssembly";
import type { SOAAssemblyData, BankDetailEntry } from "./documentAssembly";
import { compositeBannerWithLogo, fetchImageBuffer } from "./bannerCompositor";
import { PaymentTermError } from "../paymentTerms.calc";
import * as fs from "node:fs";
import * as path from "node:path";

// KNOWN GAP: agencies/bank-details Firestore collections have not been
// confirmed yet (schema never seen). Accepted as request inputs for now —
// same as legacy, which also supports user-provided overrides for these —
// rather than guessing at a collection structure. Revisit once confirmed.
export interface GenerateSOAParams {
  confirmationNumber: string;
  isClientSOA: boolean;
  agencyDetails?: { agencyName?: string; brand_logo?: string; email?: string; contactNumber?: string };
  bankDetails?: BankDetailEntry[];
  leadGuest?: { firstName?: string; lastName?: string; email?: string; phoneNumber?: string };
}

// KNOWN GAP: server-side font files for Roboto have not been sourced.
// pdfMake in the browser uses an embedded Roboto vfs; here we substitute
// PDFKit's built-in standard fonts (Helvetica) so PDF generation works
// correctly TODAY, flagged clearly as a visual difference from the
// browser version rather than a silent equivalence. Swap in real Roboto
// .ttf files here once sourced.
const FONTS = {
  Roboto: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

const STATIC_BANNER_PATH = path.join(__dirname, "../../assets/premium-package-soa-header-final.jpg");

async function resolveBannerBase64(agencyLogoUrl: string | undefined): Promise<string> {
  const bannerBuffer = fs.readFileSync(STATIC_BANNER_PATH);

  if (!agencyLogoUrl) {
    return `data:image/jpeg;base64,${bannerBuffer.toString("base64")}`;
  }

  try {
    const logoBuffer = await fetchImageBuffer(agencyLogoUrl);
    const composited = await compositeBannerWithLogo(bannerBuffer, logoBuffer);
    return `data:image/jpeg;base64,${composited.toString("base64")}`;
  } catch (err) {
    // Matches legacy's own defensive try/catch around logo compositing —
    // a broken logo URL shouldn't break SOA generation entirely.
    return `data:image/jpeg;base64,${bannerBuffer.toString("base64")}`;
  }
}

/**
 * Full SOA generation pipeline: fetches authoritative booking/package/
 * installment/payment data from Firestore, runs it through the ported
 * composable pipeline (soaData -> soaItems -> soaTravellers -> soaPayments
 * -> projectedPayments), assembles the document, and renders a real PDF
 * buffer via pdfMake.
 */
export async function generateSOAPdf(params: GenerateSOAParams): Promise<Buffer> {
  const db = getFirestore();

  const submissionSnap = await db.collection(Collections.holidayPackageSubmissions).doc(params.confirmationNumber).get();
  if (!submissionSnap.exists) {
    throw new PaymentTermError(404, "Booking not found.");
  }
  const submission = submissionSnap.data() as Record<string, any>;
  const request = submission?.meta?.request ?? {};

  const packageId = request.package_id;
  const packageSnap = packageId ? await db.collection(Collections.holidayPackages).doc(packageId).get() : null;
  const packageData = packageSnap?.exists ? (packageSnap.data() as Record<string, any>) : {};

  const installmentSnap = await db
    .collection(Collections.installmentTransactions)
    .where("transactionId", "==", params.confirmationNumber)
    .limit(1)
    .get();
  const installment = installmentSnap.empty ? null : installmentSnap.docs[0].data();

  const payments = installment
    ? (
        await db.collection(Collections.installmentPayments).where("installmentId", "==", installment.id).get()
      ).docs.map((d) => d.data())
    : [];

  const userContext: UserContext = { isJuanworld: false, isGladex: true, isAdmin: false };

  const soaDataResult = computeSOAData(
    {
      recipientData: { name: submission.user_name, email: request.lead_guest?.email },
      packageData: { title: packageData.title, area: packageData.location, hotel: packageData?.hotels?.[0]?.hotel, variations: [] },
      selectedVariationId: request.variation_id,
      bookingData: { confirmationNumber: params.confirmationNumber, createdAt: submission.date_created, preparedBy: submission.agent_name },
      leadGuest: params.leadGuest ?? request.lead_guest,
      agencyDetails: params.agencyDetails ?? request.agency_details,
    },
    userContext
  );

  const isInitial = false;

  const itemsResult = computeSOAItems(
    {
      baggages: packageData.baggages,
      visa: packageData.visa,
      tours: packageData.tours,
      insurance: packageData.insurance,
      seats: packageData.seat,
      taxes: packageData.taxes,
      tips: packageData.tips,
      other_fees: packageData.other_fees,
      commisions: packageData.commisions,
    },
    isInitial
  );

  const travellersResult = computeSOATravellers({
    bookingPayload: { rooms: [], traveller_types: request.traveler_types },
    bookingData: { totalPax: request.pax ?? 1 },
    nonInfantPax: request.pax ?? 1,
  });

  const paymentsResult = computeSOAPayments(
    {
      packageData: {
        currency: packageData.currency,
        installment_terms: packageData.installment_terms,
        reservation_terms: packageData.reservation_terms,
      },
      paymentData: { currency: packageData.currency },
      bookingPayload: { installment_details: request.installment_details },
      isClientSOA: params.isClientSOA,
      initial: isInitial,
    },
    {
      ...travellersResult,
      ...itemsResult,
      estimatedArrival: soaDataResult.estimatedArrival,
    }
  );

  const projectedResult = computeProjectedPayments(
    {
      bookingData: { confirmationNumber: params.confirmationNumber },
      isFullPayment: request.isFullpayment,
      bookingPayload: { isFullpayment: request.isFullpayment },
      packageData: { installment_terms: packageData.installment_terms, reservation_terms: packageData.reservation_terms },
    },
    travellersResult.totalPax,
    soaDataResult.estimatedArrival,
    paymentsResult.totalPesoAmount,
    paymentsResult.totalUsdAmount
  );

  const bannerBase64 = await resolveBannerBase64(params.agencyDetails?.brand_logo);

  const soaAssemblyData: SOAAssemblyData = {
    isGladex: true,
    isPremiumPackages: true,
    recipientName: soaDataResult.recipientName,
    referenceNumber: soaDataResult.referenceNumber,
    travelInfo: {
      recipientEmail: soaDataResult.recipientEmail,
      contactEmail: soaDataResult.contactEmail,
      estimatedArrival: soaDataResult.estimatedArrival,
      estimatedDeparture: soaDataResult.estimatedDeparture,
      totalPax: travellersResult.totalPax,
      bookingDate: soaDataResult.bookingDate,
      hotelInfo: soaDataResult.hotelInfo,
      area: soaDataResult.area,
      packageTitle: soaDataResult.packageTitle,
      preparedBy: soaDataResult.preparedBy,
      leadGuest: params.leadGuest ?? request.lead_guest,
    },
    pesoPayment: {
      basePackage: [],
      infantTravellers: [],
      ...itemsResult,
      totalAmount: paymentsResult.totalPesoAmount,
      commissionItems: itemsResult.phpCommissionItems.map((c: any) => ({ ...c, nonInfantPax: travellersResult.nonInfantPax })),
    },
    bookingPayload: { isFullpayment: request.isFullpayment },
    projectedPaymentSchedule: projectedResult.isProjection
      ? {
          paymentTerms: projectedResult.projectedPaymentTerms,
          currency: paymentsResult.installmentCurrency,
          totalPax: travellersResult.totalPax,
          isFullPayment: projectedResult.isFullPayment,
        }
      : null,
    actualPaymentTerms:
      !projectedResult.isProjection && payments.length > 0
        ? {
            terms: payments as any,
            currency: paymentsResult.installmentCurrency as "PHP" | "USD",
            totalPax: travellersResult.totalPax,
          }
        : null,
  };

  const content = buildSOADocumentContent(soaAssemblyData, {
    bannerBase64,
    isClientSOA: params.isClientSOA,
    bankDetails: params.bankDetails ?? [],
    effectiveAgencyDetails: params.agencyDetails ?? request.agency_details,
    user: userContext,
  });

  const docDefinition = buildSOADocumentDefinition(content);

  const printer = new PdfPrinter(FONTS);
  const pdfDoc = printer.createPdfKitDocument(docDefinition as any);

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
    pdfDoc.on("error", reject);
    pdfDoc.end();
  });
}