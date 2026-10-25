import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { copyFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { PrismaClient } from "../../generated/demo-client/index.js";
import { createApp } from "../src/app.js";
import {
  saveContact,
  deliverNotification,
  sendOwnerEmail,
} from "../src/lib/contact.js";
import { DatabaseRateLimitStore } from "../src/lib/rate-limit-store.js";
import {
  deploymentOrigins,
  assertCloudConfiguration,
  demoEnabled,
  databaseMode,
} from "../../shared/database-config.js";
const file = resolve(`prisma/deployment-test-${randomUUID()}.db`);
let db;
before(async () => {
  await copyFile(resolve("prisma/demo.db"), file);
  db = new PrismaClient({
    datasources: { db: { url: `file:${file.replaceAll("\\", "/")}` } },
  });
});
after(async () => {
  await db.$disconnect();
  await unlink(file).catch(() => {});
});
test("cloud configuration rejects ephemeral storage and enables exact stable/preview origins", () => {
  assert.throws(
    () => assertCloudConfiguration({ VERCEL: "1", DATABASE_MODE: "demo" }),
    /persistent/,
  );
  assert.throws(
    () =>
      assertCloudConfiguration({
        NODE_ENV: "production",
        DEMO_MODE: "true",
        APP_ORIGIN: "https://example.com",
      }),
    /disabled/,
  );
  assert.throws(
    () =>
      deploymentOrigins({
        APP_ORIGIN: "https://example.com/path",
        NODE_ENV: "production",
      }),
    /only the protocol/,
  );
  assert.throws(
    () => databaseMode({ DATABASE_MODE: "unknown" }),
    /DATABASE_MODE/,
  );
  assert.equal(demoEnabled({ NODE_ENV: "production" }), false);
  const origins = deploymentOrigins({
    NODE_ENV: "production",
    APP_ORIGIN: "https://erp.example.com",
    VERCEL_URL: "preview.vercel.app",
    VERCEL_PROJECT_PRODUCTION_URL: "stable.vercel.app",
  });
  assert.deepEqual(
    [...origins],
    [
      "https://erp.example.com",
      "https://preview.vercel.app",
      "https://stable.vercel.app",
    ],
  );
  assert.equal(origins.has("https://evil.example"), false);
});
test("deployed HTTPS origin passes CSRF checks; forged origins cannot write", async () => {
  const old = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://erp.example.com";
  try {
    const app = createApp(db);
    const body = {
      name: "Origin test",
      email: "origin@example.com",
      subject: "Hosted contact",
      message: "This request comes from the legitimate application host.",
    };
    assert.equal(
      (
        await request(app)
          .post("/api/contact")
          .set("Origin", "https://erp.example.com")
          .set("X-Requested-With", "Meridian")
          .send(body)
      ).status,
      201,
    );
    assert.equal(
      (
        await request(app)
          .post("/api/contact")
          .set("Origin", "https://evil.example")
          .set("X-Requested-With", "Meridian")
          .send(body)
      ).status,
      403,
    );
  } finally {
    if (old === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = old;
  }
});
test("database-backed rate limits survive store recreation and isolate route namespaces", async () => {
  const first = new DatabaseRateLimitStore(db, "check"),
    second = new DatabaseRateLimitStore(db, "check"),
    other = new DatabaseRateLimitStore(db, "other");
  for (const store of [first, second, other]) store.init({ windowMs: 60000 });
  assert.equal((await first.increment("client")).totalHits, 1);
  assert.equal((await second.increment("client")).totalHits, 2);
  assert.equal((await other.increment("client")).totalHits, 1);
  await first.decrement("client");
  assert.equal((await second.increment("client")).totalHits, 2);
  await db.rateLimitBucket.update({
    where: { id: first.key("client") },
    data: { resetAt: new Date(0) },
  });
  assert.equal((await second.increment("client")).totalHits, 1);
  await first.resetKey("client");
});
test("contact saves before notification, records success and avoids duplicate retries", async () => {
  let sent = 0;
  const sender = async (contact) => {
    sent++;
    assert.ok(
      await db.contactMessage.findUnique({ where: { id: contact.id } }),
    );
    return { id: "provider-test-id" };
  };
  const contact = await saveContact(
    db,
    {
      name: "Email test",
      email: "sender@example.com",
      subject: "Delivery test",
      message: "The durable Inbox must exist before attempting delivery.",
    },
    "CONTACT",
    { sender, configured: () => true },
  );
  assert.equal(contact.notification.status, "SENT");
  assert.equal(sent, 1);
  await deliverNotification(db, contact.notification.id, {
    sender,
    configured: () => true,
  });
  assert.equal(sent, 1);
});
test("email outage never loses Inbox messages and a later retry can recover", async () => {
  const contact = await saveContact(
    db,
    {
      name: "Outage test",
      email: "sender@example.com",
      subject: "Provider outage",
      message: "Keep this message even when the provider is unavailable.",
    },
    "CONTACT",
    {
      sender: async () => {
        throw new Error("PRIVATE_PROVIDER_DETAILS");
      },
      configured: () => true,
    },
  );
  assert.equal(contact.notification.status, "FAILED");
  assert.ok(
    !contact.notification.lastError.includes("PRIVATE_PROVIDER_DETAILS"),
  );
  assert.ok(await db.contactMessage.findUnique({ where: { id: contact.id } }));
  await deliverNotification(db, contact.notification.id, {
    sender: async () => ({ id: "recovered" }),
    configured: () => true,
  });
  assert.equal(
    (
      await db.emailNotification.findUnique({
        where: { id: contact.notification.id },
      })
    ).status,
    "SENT",
  );
});
test("Resend sends only to configured owner, validates input and keeps keys in headers", async () => {
  const oldFetch = globalThis.fetch,
    original = {
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
      CONTACT_NOTIFICATION_EMAIL: process.env.CONTACT_NOTIFICATION_EMAIL,
    };
  Object.assign(process.env, {
    RESEND_API_KEY: "test-private-email-key",
    EMAIL_FROM: "Meridian <verified@example.com>",
    CONTACT_NOTIFICATION_EMAIL: "owner@example.com",
  });
  try {
    globalThis.fetch = async (url, options) => {
      assert.equal(url, "https://api.resend.com/emails");
      assert.equal(
        options.headers.Authorization,
        "Bearer test-private-email-key",
      );
      assert.equal(options.headers["Idempotency-Key"], "meridian-contact-123");
      const payload = JSON.parse(options.body);
      assert.deepEqual(payload.to, ["owner@example.com"]);
      assert.equal(payload.reply_to, "visitor@example.com");
      assert.ok(!payload.subject.includes("\n"));
      return Response.json({ id: "email-123" });
    };
    assert.equal(
      (
        await sendOwnerEmail({
          id: 123,
          name: "Visitor",
          email: "visitor@example.com",
          subject: "Hello\nTest",
          message: "A useful contact message.",
        })
      ).id,
      "email-123",
    );
  } finally {
    globalThis.fetch = oldFetch;
    for (const [key, value] of Object.entries(original)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
