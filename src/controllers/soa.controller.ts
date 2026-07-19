import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { generateSOAPdf } from "../services/soa/pdfGenerator.service";
import { sendSOAEmail as sendSOAEmailService } from "../services/soa/soaEmail.service";

export async function generateSOA(req: AuthedRequest, res: Response) {
  const { confirmation_number, isClientSOA, agencyDetails, bankDetails, leadGuest } = req.body ?? {};

  const pdfBuffer = await generateSOAPdf({
    confirmationNumber: confirmation_number,
    isClientSOA: isClientSOA ?? false,
    agencyDetails,
    bankDetails,
    leadGuest,
  });

  const asBase64 = req.query.format === "base64";

  if (asBase64) {
    return res.json({
      status: true,
      data: {
        base64: pdfBuffer.toString("base64"),
        filename: `${confirmation_number} - SOA.pdf`,
      },
    });
  }

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${confirmation_number} - SOA.pdf"`);
  return res.send(pdfBuffer);
}

export async function sendSOAEmail(req: AuthedRequest, res: Response) {
  const { confirmation_number, to, isClientSOA, isUpdated } = req.body ?? {};

  const recipients = Array.isArray(to) ? to : typeof to === "string" ? [to] : [];
  if (recipients.length === 0) {
    return res.status(400).json({ status: false, error: "At least one recipient email is required." });
  }

  const result = await sendSOAEmailService({
    confirmationNumber: confirmation_number,
    to: recipients,
    isClientSOA: isClientSOA ?? false,
    isUpdated: isUpdated ?? false,
  });

  return res.json({ status: true, ...result });
}