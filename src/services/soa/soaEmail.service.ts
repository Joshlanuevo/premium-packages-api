import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { getFirestore } from "../../config/firebase";
import { Collections } from "../../constants/collections";
import { generateSOAPdf } from "./pdfGenerator.service";
import { EmailService } from "../../services/email/email.service";
import { PaymentTermError } from "../paymentTerms.calc";

const BRAND_NAME = "Gladex";
const SUPPORT_TEAM = "Gladex Support Team";
const CONTACT_HREF = "mailto:support@pinoyonlinebiz.com";
const CONTACT_LABEL = "support@pinoyonlinebiz.com";
const DEFAULT_FROM = "support@pinoyonlinebiz.com";

export interface SendSOAEmailParams {
  confirmationNumber: string;
  to: string[];
  isClientSOA: boolean;
  isUpdated?: boolean;
}

export async function sendSOAEmail(params: SendSOAEmailParams): Promise<{ message: string; recipients: string[] }> {
  const db = getFirestore();

  const submissionSnap = await db.collection(Collections.holidayPackageSubmissions).doc(params.confirmationNumber).get();
  if (!submissionSnap.exists) {
    throw new PaymentTermError(404, "Booking not found.");
  }
  const submission = submissionSnap.data() as Record<string, any>;
  const request = submission?.meta?.request ?? {};

  const packageTitle = submission?.meta?.package_details?.title ?? "Package";
  const leadGuest = request.lead_guest ?? {};
  const leadGuestName =
    `${leadGuest.first_name ?? leadGuest.firstName ?? ""} ${leadGuest.last_name ?? leadGuest.lastName ?? ""}`.trim() ||
    leadGuest.full_name ||
    "Valued Client";

  const pdfBuffer = await generateSOAPdf({
    confirmationNumber: params.confirmationNumber,
    isClientSOA: params.isClientSOA,
  });

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "soa-email-"));
  const safeFilename = `${params.confirmationNumber}.pdf`.replace(/[^a-zA-Z0-9_.-]/g, "_");
  const attachmentPath = path.join(tempDir, safeFilename);
  fs.writeFileSync(attachmentPath, pdfBuffer);

  try {
    const title = params.isUpdated ? "Updated Statement of Account" : "Statement of Account";
    const intro = params.isUpdated
      ? `Please find attached your <strong>Updated Statement of Account</strong> for your transaction with <span style="color: #1a73e8;">${BRAND_NAME}</span>. This document reflects the latest updates to your payment details and any adjustments made to your account.`
      : `Please find attached your <strong>Statement of Account</strong> for your recent transaction with <span style="color: #1a73e8;">${BRAND_NAME}</span>. This document outlines the details of your payment and any remaining balance.`;

    const html = `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background: #f9f9f9; padding: 32px 24px; border-radius: 8px; color: #222;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #1a73e8; margin: 0;">${title}</h2>
        </div>
        <p style="font-size: 16px;">Dear ${leadGuestName},</p>
        <p style="font-size: 15px; line-height: 1.6;">
          We hope this message finds you well.<br><br>
          ${intro}
        </p>
        <div style="background: #ffffff; padding: 16px; border-radius: 6px; margin: 20px 0; border-left: 4px solid #1a73e8;">
          <p style="font-size: 14px; margin: 4px 0;"><strong>Transaction ID:</strong> ${params.confirmationNumber}</p>
          <p style="font-size: 14px; margin: 4px 0;"><strong>Package:</strong> ${packageTitle}</p>
        </div>
        <p style="font-size: 15px; line-height: 1.6;">
          If you have any questions or need further clarification, please reach out to us at
          <a href="${CONTACT_HREF}" style="color: #1a73e8; text-decoration: none;">${CONTACT_LABEL}</a>.
        </p>
        <div style="margin: 32px 0 16px 0; border-top: 1px solid #e0e0e0;"></div>
        <p style="font-size: 15px;">
          Thank you for choosing <span style="color: #1a73e8;">${BRAND_NAME}</span>.<br>
          We look forward to serving you again.
        </p>
        <p style="font-size: 15px; margin-top: 32px;">
          Best regards,<br>
          <strong>${SUPPORT_TEAM}</strong>
        </p>
      </div>
    `;

    const emailService = new EmailService();
    const result = await emailService.sendEmailWithAttachment({
      html_body: html,
      recipient_emails: params.to,
      subject: `${title} for ${params.confirmationNumber}`,
      sender_email: DEFAULT_FROM,
      from_name: BRAND_NAME,
      attachments: [{ path: attachmentPath, name: `${params.confirmationNumber} - SOA.pdf` }],
    });

    if (result.status === 0) {
      throw new PaymentTermError(500, `Failed to send SOA email: ${result.notice}`);
    }

    return { message: `${title} email sent successfully.`, recipients: params.to };
  } finally {
    try {
      fs.unlinkSync(attachmentPath);
      fs.rmdirSync(tempDir);
    } catch {
      // best-effort cleanup, not worth failing the request over
    }
  }
}