import "../server/src/lib/config.js";
import { copyFile, mkdir, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../generated/demo-client/index.js";
import { saveContact, emailConfigured } from "../server/src/lib/contact.js";
if (!emailConfigured())
  throw new Error(
    "Set SMTP_PASS or RESEND_API_KEY and the sender/recipient environment settings before testing email.",
  );
await mkdir("artifacts", { recursive: true });
const file = resolve(`artifacts/email-check-${randomUUID()}.db`);
await copyFile(resolve("prisma/demo.db"), file);
const db = new PrismaClient({
  datasources: { db: { url: `file:${file.replaceAll("\\", "/")}` } },
});
try {
  const contact = await saveContact(db, {
    name: "Meridian release verification",
    email: process.env.CONTACT_NOTIFICATION_EMAIL,
    subject: "Contact notifications are working",
    message:
      "This is the single requested release test of your Meridian contact notification. The message was saved in an isolated test Inbox before email delivery. No customer data is included.",
  });
  const report = {
    checkedAt: new Date().toISOString(),
    status: contact.notification.status,
    attempts: contact.notification.attempts,
    provider: process.env.RESEND_API_KEY ? "Resend" : "SMTP",
  };
  await writeFile(
    "artifacts/email-live-report.json",
    JSON.stringify(report, null, 2),
  );
  process.stdout.write(JSON.stringify(report));
  if (report.status !== "SENT") process.exitCode = 1;
} finally {
  await db.$disconnect();
  await unlink(file).catch(() => {});
}
