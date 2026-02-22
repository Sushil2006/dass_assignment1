import nodemailer, { type Transporter } from "nodemailer";
import { env } from "../config/env";
import type { TicketEventType } from "./tickets";

type TicketEmailInput = {
  toEmail: string;
  toName: string;
  eventName: string;
  eventType: TicketEventType;
  ticketId: string;
  qrPayload: string;
};

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth:
      env.SMTP_USER && env.SMTP_PASS
        ? {
            user: env.SMTP_USER,
            pass: env.SMTP_PASS,
          }
        : undefined,
  });

  return transporter;
}

function buildTicketEmailText(input: TicketEmailInput): string {
  return [
    `hello ${input.toName},`,
    "",
    `your ${input.eventType.toLowerCase()} ticket is confirmed for ${input.eventName}.`,
    `ticket id: ${input.ticketId}`,
    "",
    "qr payload:",
    input.qrPayload,
    "",
    "keep this email for check-in.",
  ].join("\n");
}

function buildTicketEmailHtml(input: TicketEmailInput): string {
  return `
    <p>hello ${input.toName},</p>
    <p>your ${input.eventType.toLowerCase()} ticket is confirmed for <strong>${input.eventName}</strong>.</p>
    <p><strong>ticket id:</strong> ${input.ticketId}</p>
    <p><strong>qr payload:</strong></p>
    <pre>${input.qrPayload}</pre>
    <p>keep this email for check-in.</p>
  `.trim();
}

export async function sendTicketEmail(input: TicketEmailInput): Promise<void> {
  const mailer = getTransporter();
  await mailer.sendMail({
    from: env.SMTP_FROM,
    to: input.toEmail,
    subject: `Felicity Ticket - ${input.eventName}`,
    text: buildTicketEmailText(input),
    html: buildTicketEmailHtml(input),
  });
}

export async function sendTicketEmailSafe(
  input: TicketEmailInput,
): Promise<void> {
  try {
    await sendTicketEmail(input);
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn(`ticket email send failed: ${message}`);
  }
}
