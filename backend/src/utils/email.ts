import nodemailer, { type Transporter } from "nodemailer";
import crypto from "node:crypto";
import QRCode from "qrcode";
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
let gmailTokenCache: { accessToken: string; expiresAtMs: number } | null = null;
const TICKET_QR_CID = "ticket-qr-code";

type GmailApiConfig = {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  user: string;
};

function getGmailApiConfig(): GmailApiConfig | null {
  const clientId = env.GMAIL_API_CLIENT_ID;
  const clientSecret = env.GMAIL_API_CLIENT_SECRET;
  const refreshToken = env.GMAIL_API_REFRESH_TOKEN;

  const hasAny = Boolean(clientId || clientSecret || refreshToken);
  const hasAll = Boolean(clientId && clientSecret && refreshToken);

  if (hasAny && !hasAll) {
    throw new Error(
      "GMAIL_API_CLIENT_ID, GMAIL_API_CLIENT_SECRET, and GMAIL_API_REFRESH_TOKEN must all be set together",
    );
  }

  if (!hasAll) return null;

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    refreshToken: refreshToken!,
    user: env.GMAIL_API_USER,
  };
}

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
    "ticket qr code is attached in this email.",
    "",
    "qr payload:",
    input.qrPayload,
    "",
    "keep this email for check-in.",
  ].join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildTicketEmailHtml(input: TicketEmailInput): string {
  const safeName = escapeHtml(input.toName);
  const safeEventName = escapeHtml(input.eventName);
  const safeTicketId = escapeHtml(input.ticketId);
  const safeQrPayload = escapeHtml(input.qrPayload);

  return `
    <p>hello ${safeName},</p>
    <p>your ${input.eventType.toLowerCase()} ticket is confirmed for <strong>${safeEventName}</strong>.</p>
    <p><strong>ticket id:</strong> ${safeTicketId}</p>
    <p><strong>ticket qr code:</strong></p>
    <p><img src="cid:${TICKET_QR_CID}" alt="ticket qr code" width="220" height="220" /></p>
    <p><strong>qr payload:</strong></p>
    <pre>${safeQrPayload}</pre>
    <p>keep this email for check-in.</p>
  `.trim();
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function toMimeCrlf(value: string): string {
  return value.replace(/\r?\n/g, "\r\n");
}

function splitBase64Lines(input: string, lineLength = 76): string {
  const chunks: string[] = [];
  for (let index = 0; index < input.length; index += lineLength) {
    chunks.push(input.slice(index, index + lineLength));
  }
  return chunks.join("\r\n");
}

async function buildTicketQrPngBuffer(input: TicketEmailInput): Promise<Buffer> {
  return QRCode.toBuffer(input.qrPayload, {
    type: "png",
    width: 360,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

function buildGmailRawMessage(input: TicketEmailInput, qrPngBuffer: Buffer): string {
  const subject = `Felicity Ticket - ${input.eventName}`;
  const textBody = toMimeCrlf(buildTicketEmailText(input));
  const htmlBody = toMimeCrlf(buildTicketEmailHtml(input));
  const relatedBoundary = `related_${crypto.randomBytes(8).toString("hex")}`;
  const alternativeBoundary = `alt_${crypto.randomBytes(8).toString("hex")}`;
  const qrPngBase64 = splitBase64Lines(qrPngBuffer.toString("base64"));

  return [
    `From: ${env.SMTP_FROM}`,
    `To: ${input.toEmail}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${relatedBoundary}"`,
    "",
    `--${relatedBoundary}`,
    `Content-Type: multipart/alternative; boundary="${alternativeBoundary}"`,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    textBody,
    "",
    `--${alternativeBoundary}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    htmlBody,
    "",
    `--${alternativeBoundary}--`,
    "",
    `--${relatedBoundary}`,
    'Content-Type: image/png; name="ticket-qr.png"',
    "Content-Transfer-Encoding: base64",
    'Content-Disposition: inline; filename="ticket-qr.png"',
    `Content-ID: <${TICKET_QR_CID}>`,
    "",
    qrPngBase64,
    "",
    `--${relatedBoundary}--`,
  ].join("\r\n");
}

async function getGmailAccessToken(config: GmailApiConfig): Promise<string> {
  if (gmailTokenCache && gmailTokenCache.expiresAtMs > Date.now() + 30_000) {
    return gmailTokenCache.accessToken;
  }

  const body = new URLSearchParams({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    refresh_token: config.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `gmail oauth token request failed with status ${response.status}: ${details}`,
    );
  }

  const data = (await response.json()) as {
    access_token?: unknown;
    expires_in?: unknown;
  };

  if (typeof data.access_token !== "string" || data.access_token.length === 0) {
    throw new Error("gmail oauth token response missing access_token");
  }

  const expiresInSeconds =
    typeof data.expires_in === "number" && Number.isFinite(data.expires_in)
      ? data.expires_in
      : 3600;

  gmailTokenCache = {
    accessToken: data.access_token,
    expiresAtMs: Date.now() + expiresInSeconds * 1000,
  };

  return data.access_token;
}

async function sendTicketEmailViaGmailApi(
  input: TicketEmailInput,
  config: GmailApiConfig,
  qrPngBuffer: Buffer,
): Promise<void> {
  const accessToken = await getGmailAccessToken(config);
  const raw = toBase64Url(buildGmailRawMessage(input, qrPngBuffer));

  const response = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${encodeURIComponent(config.user)}/messages/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ raw }),
    },
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `gmail api send failed with status ${response.status}: ${details}`,
    );
  }
}

export async function sendTicketEmail(input: TicketEmailInput): Promise<void> {
  const qrPngBuffer = await buildTicketQrPngBuffer(input);
  const gmailApiConfig = getGmailApiConfig();
  if (gmailApiConfig) {
    await sendTicketEmailViaGmailApi(input, gmailApiConfig, qrPngBuffer);
    return;
  }

  const mailer = getTransporter();
  await mailer.sendMail({
    from: env.SMTP_FROM,
    to: input.toEmail,
    subject: `Felicity Ticket - ${input.eventName}`,
    text: buildTicketEmailText(input),
    html: buildTicketEmailHtml(input),
    attachments: [
      {
        filename: "ticket-qr.png",
        content: qrPngBuffer,
        contentType: "image/png",
        cid: TICKET_QR_CID,
      },
    ],
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
