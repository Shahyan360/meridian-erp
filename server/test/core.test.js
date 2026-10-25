import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { copyFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../src/app.js";
import { PrismaClient } from "../../generated/demo-client/index.js";
import { csvCell } from "../src/lib/exports.js";

const file = resolve(`prisma/test-${randomUUID()}.db`);
let db, app, admin, employee, manager, product, customer, order;
const mutation = (agent, method, url) =>
  agent[method](url).set("X-Requested-With", "Meridian");
before(async () => {
  await copyFile(resolve("prisma/demo.db"), file);
  db = new PrismaClient({
    datasources: { db: { url: `file:${file.replaceAll("\\", "/")}` } },
  });
  app = createApp(db);
  admin = request.agent(app);
  employee = request.agent(app);
  manager = request.agent(app);
  for (const [agent, role] of [
    [admin, "admin"],
    [employee, "employee"],
    [manager, "manager"],
  ]) {
    const result = await mutation(agent, "post", "/api/auth/login").send({
      email: `${role}@meridian.demo`,
      password: "Demo@Meridian26!",
    });
    assert.equal(result.status, 200);
    assert.equal(result.body.user.role, role.toUpperCase());
    assert.ok(!JSON.stringify(result.body).includes("passwordHash"));
  }
});
after(async () => {
  if (db) await db.$disconnect();
  await unlink(file).catch(() => {});
});
test("unauthenticated APIs, role restrictions, and CSRF checks", async () => {
  assert.equal((await request(app).get("/api/products")).status, 401);
  assert.equal((await employee.get("/api/employees")).status, 403);
  assert.equal((await employee.get("/api/reports")).status, 403);
  assert.equal((await manager.get("/api/users")).status, 403);
  assert.equal(
    (await mutation(employee, "post", "/api/products").send({})).status,
    403,
  );
  assert.equal((await admin.post("/api/products").send({})).status, 403);
  assert.equal(
    (
      await mutation(admin, "post", "/api/products")
        .set("Origin", "https://untrusted.example")
        .send({})
    ).status,
    403,
  );
});
test("server-side validation rejects invalid and extra fields", async () => {
  const result = await mutation(admin, "post", "/api/products").send({
    sku: "INVALID",
    name: "",
    category: "Test",
    salePrice: -1,
    purchasePrice: 0,
    role: "ADMIN",
  });
  assert.equal(result.status, 400);
  assert.ok(result.body.fields);
  assert.equal((await admin.get("/api/products?page=-1")).status, 400);
});
test("CRUD, pagination, search, sorting and stock adjustment", async () => {
  const created = await mutation(admin, "post", "/api/products").send({
    sku: "TEST-CRUD",
    name: "Test product",
    category: "Testing",
    salePrice: 150,
    purchasePrice: 70,
    active: true,
  });
  assert.equal(created.status, 201);
  product = created.body;
  const found = await admin.get(
    "/api/products?q=TEST-CRUD&pageSize=1&sort=sku&direction=asc",
  );
  assert.equal(found.body.total, 1);
  assert.equal(found.body.data[0].id, product.id);
  const inventory = await db.inventoryItem.findUnique({
    where: { productId: product.id },
  });
  assert.equal(Number(inventory.quantity), 0);
  assert.equal(
    (
      await mutation(admin, "put", `/api/inventory/${inventory.id}`).send({
        productId: product.id,
        quantity: 10,
        reorderLevel: 2,
        unitCost: 70,
      })
    ).status,
    200,
  );
  const update = await mutation(
    admin,
    "put",
    `/api/products/${product.id}`,
  ).send({
    sku: product.sku,
    name: "Updated test product",
    category: "Testing",
    salePrice: 150,
    purchasePrice: 70,
    active: true,
  });
  assert.equal(update.status, 200);
  customer = (
    await mutation(admin, "post", "/api/customers").send({
      name: "Test customer",
      email: "test@example.com",
      active: true,
    })
  ).body;
});
test("draft orders do not move stock; posting is atomic and balanced", async () => {
  const payload = {
    customerId: customer.id,
    issueDate: "2026-10-25",
    taxRate: 5,
    discount: 10,
    lines: [{ productId: product.id, quantity: 2, unitPrice: 150 }],
  };
  const created = await mutation(admin, "post", "/api/sales").send(payload);
  assert.equal(created.status, 201);
  order = created.body;
  assert.equal(Number(order.total), 304.5);
  assert.equal(
    Number(
      (await db.inventoryItem.findUnique({ where: { productId: product.id } }))
        .quantity,
    ),
    10,
  );
  const posted = await mutation(
    admin,
    "post",
    `/api/sales/${order.id}/post`,
  ).send({});
  assert.equal(posted.status, 200);
  assert.equal(posted.body.status, "POSTED");
  assert.equal(
    Number(
      (await db.inventoryItem.findUnique({ where: { productId: product.id } }))
        .quantity,
    ),
    8,
  );
  assert.equal(
    (await mutation(admin, "post", `/api/sales/${order.id}/post`).send({}))
      .status,
    409,
  );
  assert.equal(
    (await mutation(admin, "put", `/api/sales/${order.id}`).send(payload))
      .status,
    409,
  );
  const entry = await db.journalEntry.findUnique({
    where: { number: `SALE-${order.id}` },
    include: { lines: true },
  });
  assert.equal(
    entry.lines.reduce(
      (n, l) =>
        n +
        Math.round(Number(l.debit) * 100) -
        Math.round(Number(l.credit) * 100),
      0,
    ),
    0,
  );
});
test("partial payments, overpayment prevention, and full settlement", async () => {
  assert.equal(
    (
      await mutation(admin, "post", `/api/sales/${order.id}/payments`).send({
        amount: 100,
        method: "Cash",
      })
    ).status,
    201,
  );
  assert.equal((await admin.get(`/api/sales/${order.id}`)).body.balance, 204.5);
  assert.equal(
    (
      await mutation(admin, "post", `/api/sales/${order.id}/payments`).send({
        amount: 205,
        method: "Cash",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await mutation(admin, "post", `/api/sales/${order.id}/payments`).send({
        amount: 204.5,
        method: "Bank transfer",
      })
    ).status,
    201,
  );
  assert.equal((await admin.get(`/api/sales/${order.id}`)).body.status, "PAID");
  assert.equal(
    (await mutation(admin, "post", `/api/sales/${order.id}/cancel`).send({}))
      .status,
    409,
  );
});
test("insufficient stock rolls back; unpaid cancellation reverses stock and journal", async () => {
  const payload = {
    customerId: customer.id,
    issueDate: "2026-10-25",
    taxRate: 0,
    discount: 0,
    lines: [{ productId: product.id, quantity: 99999 }],
  };
  const invalid = (await mutation(admin, "post", "/api/sales").send(payload))
    .body;
  assert.equal(
    (await mutation(admin, "post", `/api/sales/${invalid.id}/post`).send({}))
      .status,
    409,
  );
  assert.equal(
    (await db.sale.findUnique({ where: { id: invalid.id } })).status,
    "DRAFT",
  );
  assert.equal(
    await db.journalEntry.count({ where: { number: `SALE-${invalid.id}` } }),
    0,
  );
  const valid = (
    await mutation(admin, "post", "/api/sales").send({
      ...payload,
      lines: [{ productId: product.id, quantity: 1 }],
    })
  ).body;
  await mutation(admin, "post", `/api/sales/${valid.id}/post`).send({});
  assert.equal(
    (await mutation(admin, "post", `/api/sales/${valid.id}/cancel`).send({}))
      .status,
    200,
  );
  assert.equal(
    Number(
      (await db.inventoryItem.findUnique({ where: { productId: product.id } }))
        .quantity,
    ),
    8,
  );
  assert.equal(
    await db.journalEntry.count({ where: { number: `REV-SALE-${valid.id}` } }),
    1,
  );
});
test("reports balance, validate date ranges, and export CSV/PDF", async () => {
  const result = await admin.get("/api/reports");
  assert.equal(result.status, 200);
  assert.equal(result.body.balanced, true);
  assert.equal(
    (await admin.get("/api/reports?from=2026-12-01&to=2026-01-01")).status,
    400,
  );
  const csv = await admin.get("/api/export/products?format=csv");
  assert.equal(csv.status, 200);
  assert.match(csv.headers["content-type"], /text\/csv/);
  const pdf = await admin.get("/api/export/reports?format=pdf");
  assert.equal(pdf.status, 200);
  assert.match(pdf.headers["content-type"], /application\/pdf/);
  assert.equal(csvCell("=SUM(1)"), '"\'=SUM(1)"');
});
test("contact submissions persist; honeypot is silently discarded", async () => {
  const payload = {
    name: "Test visitor",
    email: "visitor@example.com",
    subject: "A test message",
    message: "Please show this message in the admin inbox.",
    website: "",
  };
  assert.equal(
    (await mutation(request(app), "post", "/api/contact").send(payload)).status,
    201,
  );
  const before = await db.contactMessage.count();
  assert.equal(
    (
      await mutation(request(app), "post", "/api/contact").send({
        ...payload,
        website: "spam.example",
      })
    ).status,
    201,
  );
  assert.equal(await db.contactMessage.count(), before);
  assert.equal(
    (await admin.get("/api/inbox?q=A%20test%20message")).body.total,
    1,
  );
});
test("administrator self-protection and session revocation", async () => {
  const me = (await admin.get("/api/auth/me")).body.user;
  assert.equal(
    (await mutation(admin, "delete", `/api/users/${me.id}`).send()).status,
    400,
  );
  const agent = request.agent(app);
  await mutation(agent, "post", "/api/auth/login").send({
    email: "employee@meridian.demo",
    password: "Demo@Meridian26!",
  });
  assert.equal(
    (await mutation(agent, "post", "/api/auth/logout").send({})).status,
    200,
  );
  assert.equal((await agent.get("/api/products")).status, 401);
});
test("dashboard contains real data and working notifications", async () => {
  const result = await admin.get("/api/dashboard");
  assert.equal(result.status, 200);
  assert.ok(result.body.trend.length === 6);
  assert.ok(result.body.revenue > 0);
  assert.ok(result.body.inboxCount > 0);
});
test("weighted-average receipts and posting-time cost snapshots keep valuation consistent", async () => {
  const supplier = await db.vendor.findFirst();
  const draft = (
    await mutation(admin, "post", "/api/sales").send({
      customerId: customer.id,
      issueDate: "2026-10-25",
      taxRate: 0,
      discount: 0,
      lines: [{ productId: product.id, quantity: 1 }],
    })
  ).body;
  const purchase = (
    await mutation(admin, "post", "/api/purchases").send({
      vendorId: supplier.id,
      issueDate: "2026-10-25",
      taxRate: 0,
      discount: 10,
      lines: [{ productId: product.id, quantity: 2, unitPrice: 100 }],
    })
  ).body;
  assert.equal(
    (
      await mutation(admin, "post", `/api/purchases/${purchase.id}/post`).send(
        {},
      )
    ).status,
    200,
  );
  const stock = await db.inventoryItem.findUnique({
    where: { productId: product.id },
  });
  assert.equal(Number(stock.quantity), 10);
  assert.equal(Number(stock.unitCost), 75);
  assert.equal(
    (await mutation(admin, "post", `/api/sales/${draft.id}/post`).send({}))
      .status,
    200,
  );
  const posted = await db.sale.findUnique({
    where: { id: draft.id },
    include: { lines: true },
  });
  assert.equal(Number(posted.lines[0].unitCost), 75);
  assert.equal(
    (
      await mutation(
        admin,
        "post",
        `/api/purchases/${purchase.id}/cancel`,
      ).send({})
    ).status,
    409,
  );
  const report = (await admin.get("/api/reports")).body;
  assert.equal(report.balanced, true);
});
test("school class capacity, guardian links, unpaid fee revisions and payment protections", async () => {
  const section = (
    await mutation(admin, "post", "/api/classes").send({
      className: "Test grade",
      section: "T",
      capacity: 1,
      active: true,
    })
  ).body;
  const guardian = (
    await mutation(admin, "post", "/api/guardians").send({
      name: "Test guardian",
      email: "guardian@example.com",
    })
  ).body;
  const payload = {
    firstName: "Test student",
    classSectionId: section.id,
    guardianIds: [guardian.id],
    active: true,
  };
  const student = await mutation(admin, "post", "/api/students").send(payload);
  assert.equal(student.status, 201);
  assert.equal(
    (
      await mutation(admin, "post", "/api/students").send({
        ...payload,
        firstName: "Overflow student",
      })
    ).status,
    409,
  );
  const details = await admin.get(`/api/students?q=Test%20student`);
  assert.equal(details.body.data[0].guardianLinks[0].guardianId, guardian.id);
  const feePayload = {
    studentId: student.body.id,
    feeType: "Tuition",
    amount: 100,
    dueDate: "2026-11-01",
  };
  const fee = (await mutation(admin, "post", "/api/fees").send(feePayload))
    .body;
  assert.equal(
    (
      await mutation(admin, "put", `/api/fees/${fee.id}`).send({
        ...feePayload,
        amount: 120,
      })
    ).status,
    200,
  );
  assert.equal(
    await db.journalEntry.count({ where: { number: `REV-FEES-${fee.id}` } }),
    1,
  );
  assert.equal(
    (
      await mutation(admin, "post", "/api/fee-payments").send({
        feeRecordId: fee.id,
        amount: 120,
        method: "Cash",
        paidAt: "2026-10-25",
      })
    ).status,
    201,
  );
  assert.equal(
    (
      await mutation(admin, "post", "/api/fee-payments").send({
        feeRecordId: fee.id,
        amount: 1,
        method: "Cash",
        paidAt: "2026-10-25",
      })
    ).status,
    400,
  );
  assert.equal(
    (await mutation(admin, "delete", `/api/fees/${fee.id}`).send()).status,
    409,
  );
});
test("manual journals are balanced, immutable, and protected from employee writes", async () => {
  const debit = await db.account.findUnique({ where: { code: "1000" } });
  const credit = await db.account.findUnique({ where: { code: "3000" } });
  const payload = {
    debitAccountId: debit.id,
    creditAccountId: credit.id,
    amount: 500,
    memo: "Additional owner deposit",
    entryDate: "2026-10-25",
  };
  const result = await mutation(manager, "post", "/api/journal").send(payload);
  assert.equal(result.status, 201);
  assert.equal(
    (await mutation(manager, "delete", `/api/journal/${result.body.id}`).send())
      .status,
    409,
  );
  assert.equal(
    (await mutation(employee, "post", "/api/journal").send(payload)).status,
    403,
  );
  assert.equal(
    (
      await mutation(admin, "post", "/api/journal").send({
        ...payload,
        creditAccountId: debit.id,
      })
    ).status,
    400,
  );
  assert.equal((await admin.get("/api/reports")).body.balanced, true);
});
test("contact rate limit and malformed requests return safe errors", async () => {
  const isolated = createApp(db);
  const agent = request(isolated);
  const data = {
    name: "Rate test",
    email: "rate@example.com",
    subject: "Rate limit",
    message: "A sufficiently long test message.",
    website: "honeypot",
  };
  for (let i = 0; i < 5; i++)
    assert.equal(
      (await mutation(agent, "post", "/api/contact").send(data)).status,
      201,
    );
  const limited = await mutation(agent, "post", "/api/contact").send(data);
  assert.equal(limited.status, 429);
  assert.match(limited.body.error, /Too many requests/);
  const malformed = await mutation(admin, "post", "/api/products")
    .set("Content-Type", "application/json")
    .send("{invalid");
  assert.equal(malformed.status, 400);
  assert.ok(!JSON.stringify(malformed.body).includes("SyntaxError"));
});
