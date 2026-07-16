import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { generateSOAPdf } from "../services/soa/pdfGenerator.service";

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