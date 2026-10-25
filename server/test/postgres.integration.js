import { test, after } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { prisma } from "../src/lib/db.js";
import { createApp } from "../src/app.js";
import { DatabaseRateLimitStore } from "../src/lib/rate-limit-store.js";
const app = createApp(prisma),
  agent = request.agent(app);
const send = (method, url, data) =>
  agent[method](url).set("X-Requested-With", "Meridian").send(data);
after(async () => prisma.$disconnect());
test("native PostgreSQL initialization, role login, long messages, and case-insensitive search", async () => {
  const login = await send("post", "/api/auth/login", {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  assert.equal(login.status, 200);
  const product = await send("post", "/api/products", {
    sku: "POSTGRES-1",
    name: "PostgreSQL Pencil",
    category: "Stationery",
    salePrice: 125.5,
    purchasePrice: 80,
    active: true,
  });
  assert.equal(product.status, 201);
  const search = await agent.get("/api/products?q=postgresql");
  assert.equal(search.status, 200);
  assert.equal(search.body.total, 1);
  const customer = (
    await send("post", "/api/customers", {
      name: "PostgreSQL customer",
      active: true,
    })
  ).body;
  const item = await prisma.inventoryItem.findUnique({
    where: { productId: product.body.id },
  });
  assert.equal(
    (
      await send("put", `/api/inventory/${item.id}`, {
        productId: product.body.id,
        quantity: 10,
        reorderLevel: 3,
        unitCost: 80,
      })
    ).status,
    200,
  );
  const order = (
    await send("post", "/api/sales", {
      customerId: customer.id,
      issueDate: "2026-10-25",
      discount: 1,
      taxRate: 5,
      lines: [{ productId: product.body.id, quantity: 2 }],
    })
  ).body;
  assert.equal(
    (await send("post", `/api/sales/${order.id}/post`, {})).status,
    200,
  );
  assert.equal(
    (
      await send("post", `/api/sales/${order.id}/payments`, {
        amount: Number(order.total),
        method: "Cash",
      })
    ).status,
    201,
  );
  const report = await agent.get("/api/reports");
  assert.equal(report.status, 200);
  assert.equal(report.body.balanced, true);
  const contact = await send("post", "/api/contact", {
    name: "PostgreSQL visitor",
    email: "visitor@example.com",
    subject: "Long message",
    message: "A".repeat(3900),
  });
  assert.equal(contact.status, 201);
  const saved = await prisma.contactMessage.findFirst({
    where: { subject: "Long message" },
    include: { notification: true },
  });
  assert.equal(saved.message.length, 3900);
  assert.equal(saved.notification.status, "NOT_CONFIGURED");
});
test("native PostgreSQL rate limits persist across independent store instances", async () => {
  const first = new DatabaseRateLimitStore(prisma, "native-pg"),
    second = new DatabaseRateLimitStore(prisma, "native-pg");
  first.init({ windowMs: 60000 });
  second.init({ windowMs: 60000 });
  assert.equal((await first.increment("test")).totalHits, 1);
  assert.equal((await second.increment("test")).totalHits, 2);
  await second.resetKey("test");
});
