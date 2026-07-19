import { htmlToText } from "html-to-text";
import { SESClient, SendEmailCommand, SendRawEmailCommand, type SendEmailCommandInput } from "@aws-sdk/client-ses";
import { unhash } from "../../utils/crypto";

const SES_REGION = "ap-southeast-1";

export interface SendEmailOptions {
  html_body: string;
  recipient_emails: string[];
  subject: string;
  sender_email?: string;
  from_name?: string;
  reply_to?: string[];
  ccAdrs?: string[];
  bccAdrs?: string[];
}

export interface EmailAttachment {
  path: string;
  name: string;
}

export interface SendEmailWithAttachmentOptions extends SendEmailOptions {
  attachments: EmailAttachment[];
}

interface EmailResultSuccess {
  status: 1;
  notice: string;
  data: string;
  email: string[];
  subject: string;
  result: unknown;
}

interface EmailResultError {
  status: 0;
  notice: string;
  data?: unknown;
  email: string[];
  subject: string;
}

type EmailResult = EmailResultSuccess | EmailResultError;

export class EmailService {
  private async getCredentials(): Promise<{ accessKeyId: string; secretAccessKey: string }> {
    let accessKeyId: string | null | undefined;
    let secretAccessKey: string | null | undefined;

    try {
      accessKeyId = await unhash(process.env.AWS_SES_KEY!);
      secretAccessKey = await unhash(process.env.AWS_SES_SECRET!);
    } catch (err: any) {
      throw new Error(`Failed to decrypt AWS SES credentials: ${err?.message || err}`);
    }

    if (!accessKeyId || !secretAccessKey) {
      throw new Error("Missing AWS SES credentials (AWS_SES_KEY / AWS_SES_SECRET).");
    }

    return { accessKeyId, secretAccessKey };
  }

  async sendEmail({
    html_body,
    recipient_emails,
    subject,
    sender_email = "support@pinoyonlinebiz.com",
    from_name = "Gladex",
    reply_to,
    ccAdrs = [],
    bccAdrs = [],
  }: SendEmailOptions): Promise<EmailResult> {
    try {
      const { accessKeyId, secretAccessKey } = await this.getCredentials();

      const sesClient = new SESClient({
        region: SES_REGION,
        credentials: { accessKeyId, secretAccessKey },
      });

      const plaintext_body = htmlToText(html_body, { wordwrap: 130, preserveNewlines: true });
      const replyToAddresses = reply_to && reply_to.length > 0 ? reply_to : [sender_email];

      const params: SendEmailCommandInput = {
        Destination: {
          ToAddresses: recipient_emails,
          CcAddresses: ccAdrs.length > 0 ? ccAdrs : undefined,
          BccAddresses: bccAdrs.length > 0 ? bccAdrs : undefined,
        },
        ReplyToAddresses: replyToAddresses,
        Source: `${from_name} <${sender_email}>`,
        Message: {
          Subject: { Charset: "UTF-8", Data: subject },
          Body: {
            Html: { Charset: "UTF-8", Data: html_body },
            Text: { Charset: "UTF-8", Data: plaintext_body },
          },
        },
      };

      const result = await sesClient.send(new SendEmailCommand(params));

      return {
        status: 1,
        notice: `Email sent! Message ID: ${result.MessageId}`,
        data: result.MessageId || "",
        email: recipient_emails,
        subject,
        result,
      };
    } catch (error: any) {
      console.error("Email sending error:", error);
      return {
        status: 0,
        notice: error.message || "Error sending email",
        data: error,
        email: recipient_emails,
        subject,
      };
    }
  }

  async sendEmailWithAttachment({
    html_body,
    recipient_emails,
    subject,
    sender_email = "support@pinoyonlinebiz.com",
    from_name = "Gladex",
    ccAdrs = [],
    bccAdrs = [],
    attachments,
  }: SendEmailWithAttachmentOptions): Promise<EmailResult> {
    try {
      const { accessKeyId, secretAccessKey } = await this.getCredentials();

      const sesClient = new SESClient({
        region: SES_REGION,
        credentials: { accessKeyId, secretAccessKey },
      });

      const plaintext_body = htmlToText(html_body, { wordwrap: 130, preserveNewlines: true });

      const boundary = `boundary_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      const boundaryAlt = `boundary_alt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

      const lines: string[] = [];
      lines.push(`From: ${from_name} <${sender_email}>`);
      lines.push(`To: ${recipient_emails.join(", ")}`);
      if (ccAdrs.length > 0) lines.push(`Cc: ${ccAdrs.join(", ")}`);
      if (bccAdrs.length > 0) lines.push(`Bcc: ${bccAdrs.join(", ")}`);
      lines.push(`Subject: ${subject}`);
      lines.push("MIME-Version: 1.0");
      lines.push(`Content-Type: multipart/mixed; boundary="${boundary}"`);
      lines.push("");
      lines.push(`--${boundary}`);
      lines.push(`Content-Type: multipart/alternative; boundary="${boundaryAlt}"`);
      lines.push("");
      lines.push(`--${boundaryAlt}`);
      lines.push("Content-Type: text/plain; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: 7bit");
      lines.push("");
      lines.push(plaintext_body);
      lines.push("");
      lines.push(`--${boundaryAlt}`);
      lines.push("Content-Type: text/html; charset=UTF-8");
      lines.push("Content-Transfer-Encoding: 7bit");
      lines.push("");
      lines.push(html_body);
      lines.push("");
      lines.push(`--${boundaryAlt}--`);

      for (const attachment of attachments) {
        const fs = await import("node:fs");
        if (!fs.existsSync(attachment.path)) continue;

        const fileContent = fs.readFileSync(attachment.path);
        const encoded = fileContent.toString("base64");
        const mimeType = attachment.name.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "application/octet-stream";

        lines.push(`--${boundary}`);
        lines.push(`Content-Type: ${mimeType}; name="${attachment.name}"`);
        lines.push(`Content-Description: ${attachment.name}`);
        lines.push(`Content-Disposition: attachment; filename="${attachment.name}"`);
        lines.push("Content-Transfer-Encoding: base64");
        lines.push("");
        for (let i = 0; i < encoded.length; i += 76) {
          lines.push(encoded.slice(i, i + 76));
        }
        lines.push("");
      }

      lines.push(`--${boundary}--`);

      const rawMessage = lines.join("\r\n");

      const result = await sesClient.send(
        new SendRawEmailCommand({
          RawMessage: { Data: Buffer.from(rawMessage) },
        })
      );

      return {
        status: 1,
        notice: `Email with attachment sent! Message ID: ${result.MessageId}`,
        data: result.MessageId || "",
        email: recipient_emails,
        subject,
        result,
      };
    } catch (error: any) {
      console.error("Email with attachment sending error:", error);
      return {
        status: 0,
        notice: error.message || "Error sending email with attachment",
        data: error,
        email: recipient_emails,
        subject,
      };
    }
  }
}