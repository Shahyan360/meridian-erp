import nodemailer from "nodemailer";
import { z } from "zod";
import { contactSchema } from "./validation.js";
import { HttpError } from "./security.js";

export function emailConfigured(env = process.env) {
  return Boolean(
    env.CONTACT_NOTIFICATION_EMAIL &&
    env.EMAIL_FROM &&
    (env.RESEND_API_KEY || (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)),
  );
}
export async function sendOwnerEmail(message) {
  const to = z.string().email().parse(process.env.CONTACT_NOTIFICATION_EMAIL);
  const from = z
    .string()
    .min(3)
    .max(254)
    .refine((v) => !/[\r\n]/.test(v))
    .parse(process.env.EMAIL_FROM);
  const payload = {
    from,
    to,
    replyTo: message.email,
    subject: `[Meridian] ${message.subject.replace(/[\r\n]/g, " ")}`,
    text: `A new message was saved to your Meridian Inbox.\n\nName: ${message.name}\nEmail: ${message.email}\nSubject: ${message.subject}\n\n${message.message}\n\nReply directly to reach the sender. Sign in to Meridian to manage the message.`,
  };
  if (process.env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `meridian-contact-${message.id}`,
      },
      body: JSON.stringify({
        from: payload.from,
        to: [to],
        reply_to: payload.replyTo,
        subject: payload.subject,
        text: payload.text,
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error("Email provider rejected delivery.");
    const result = await response.json();
    return { id: result.id };
  }
  const port = z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .parse(process.env.SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass:
        process.env.SMTP_HOST === "smtp.gmail.com"
          ? process.env.SMTP_PASS?.replace(/\s/g, "")
          : process.env.SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });
  try {
    const result = await transport.sendMail({
      ...payload,
      messageId: `<meridian-contact-${message.id}@meridian.local>`,
    });
    return { id: result.messageId };
  } finally {
    transport.close();
  }
}
export async function deliverNotification(
  db,
  id,
  { sender = sendOwnerEmail, configured = emailConfigured } = {},
) {
  const item = await db.emailNotification.findUnique({
    where: { id },
    include: { contactMessage: true },
  });
  if (!item) throw new HttpError(404, "Notification not found.");
  if (item.status === "SENT") return { status: "SENT" };
  if (!configured()) {
    await db.emailNotification.update({
      where: { id },
      data: {
        status: "NOT_CONFIGURED",
        lastError: "Configure the server email provider to enable delivery.",
      },
    });
    return { status: "NOT_CONFIGURED" };
  }
  const claim = await db.emailNotification.updateMany({
    where: {
      id,
      OR: [
        { status: { in: ["PENDING", "FAILED", "NOT_CONFIGURED"] } },
        {
          status: "SENDING",
          attemptedAt: { lt: new Date(Date.now() - 5 * 60000) },
        },
      ],
    },
    data: {
      status: "SENDING",
      attempts: { increment: 1 },
      attemptedAt: new Date(),
      lastError: null,
    },
  });
  if (!claim.count) return { status: "SENDING" };
  try {
    const result = await sender(item.contactMessage);
    await db.emailNotification.update({
      where: { id },
      data: {
        status: "SENT",
        sentAt: new Date(),
        providerId: String(result?.id || "").slice(0, 254),
        lastError: null,
      },
    });
    return { status: "SENT" };
  } catch {
    await db.emailNotification.update({
      where: { id },
      data: {
        status: "FAILED",
        lastError:
          "Email delivery failed. Your message is safely saved; retry delivery from Inbox.",
      },
    });
    return { status: "FAILED" };
  }
}
export async function saveContact(
  db,
  raw,
  source = "CONTACT",
  deliveryOptions,
) {
  const { website, ...data } = contactSchema.parse(raw);
  if (website) return null;
  const contact = await db.contactMessage.create({
    data: { ...data, source, notification: { create: {} } },
    include: { notification: true },
  });
  await deliverNotification(db, contact.notification.id, deliveryOptions);
  return db.contactMessage.findUnique({
    where: { id: contact.id },
    include: { notification: true },
  });
}
