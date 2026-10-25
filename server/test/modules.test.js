import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { copyFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { PrismaClient } from "../../generated/demo-client/index.js";
import { createApp } from "../src/app.js";
import { catalog } from "../../shared/catalog.js";
const file = resolve(`prisma/modules-test-${randomUUID()}.db`);
let db, app, admin, manager, employee;
const send = (agent, method, path, body) =>
  agent[method](path).set("X-Requested-With", "Meridian").send(body);
before(async () => {
  await copyFile(resolve("prisma/demo.db"), file);
  db = new PrismaClient({
    datasources: { db: { url: `file:${file.replaceAll("\\", "/")}` } },
  });
  app = createApp(db);
  [admin, manager, employee] = [
    request.agent(app),
    request.agent(app),
    request.agent(app),
  ];
  for (const [agent, role] of [
    [admin, "admin"],
    [manager, "manager"],
    [employee, "employee"],
  ])
    assert.equal(
      (
        await send(agent, "post", "/api/auth/login", {
          email: `${role}@meridian.demo`,
          password: "Demo@Meridian26!",
        })
      ).status,
      200,
    );
});
after(async () => {
  await db.$disconnect();
  await unlink(file).catch(() => {});
});
test("every module enforces read and employee-write permissions", async () => {
  const employeeReads = new Set([
    "products",
    "product-categories",
    "inventory",
    "stock-movements",
    "customers",
    "vendors",
    "sales",
    "purchases",
    "students",
    "classes",
    "guardians",
    "attendance",
    "student-leaves",
  ]);
  const adminOnly = new Set(["users", "inbox", "audit"]);
  for (const resource of Object.keys(catalog)) {
    assert.equal(
      (await admin.get(`/api/${resource}?pageSize=1`)).status,
      200,
      `Admin read ${resource}`,
    );
    assert.equal(
      (await manager.get(`/api/${resource}?pageSize=1`)).status,
      adminOnly.has(resource) ? 403 : 200,
      `Manager read ${resource}`,
    );
    assert.equal(
      (await employee.get(`/api/${resource}?pageSize=1`)).status,
      employeeReads.has(resource) ? 200 : 403,
      `Employee read ${resource}`,
    );
    assert.equal(
      (await send(employee, "post", `/api/${resource}`, {})).status,
      403,
      `Employee write ${resource}`,
    );
  }
});
test("supplier/customer/category CRUD and linked records cannot be destructively removed", async () => {
  for (const resource of ["customers", "vendors"]) {
    const created = await send(admin, "post", `/api/${resource}`, {
      name: `Release ${resource}`,
      email: `${resource}@example.com`,
      active: true,
    });
    assert.equal(created.status, 201);
    assert.equal(
      (
        await send(admin, "put", `/api/${resource}/${created.body.id}`, {
          name: `Updated ${resource}`,
          email: `${resource}@example.com`,
          active: true,
        })
      ).status,
      200,
    );
    assert.equal(
      (await send(admin, "delete", `/api/${resource}/${created.body.id}`))
        .status,
      204,
    );
    assert.equal(
      (await admin.get(`/api/${resource}/${created.body.id}`)).status,
      404,
    );
  }
  const category = await send(admin, "post", "/api/product-categories", {
    name: "Release category",
    description: "Testing classification",
    active: true,
  });
  assert.equal(category.status, 201);
  assert.equal(
    (await send(admin, "delete", `/api/product-categories/${category.body.id}`))
      .status,
    204,
  );
  const linkedCustomer = await db.customer.findFirst({
    where: { sales: { some: {} } },
  });
  assert.equal(
    (await send(admin, "delete", `/api/customers/${linkedCustomer.id}`)).status,
    409,
  );
});
test("HR payroll calculations, duplicate periods, posted locks, and employee leave validation", async () => {
  const payload = {
    firstName: "Release",
    lastName: "Employee",
    designation: "Analyst",
    department: "Operations",
    salary: 60000,
    active: true,
  };
  const person = await send(manager, "post", "/api/employees", payload);
  assert.equal(person.status, 201);
  const payroll = {
    employeeId: person.body.id,
    period: "2031-02",
    basicSalary: 60000,
    allowances: 5000,
    deductions: 1000,
    status: "DRAFT",
  };
  const result = await send(manager, "post", "/api/payroll", payroll);
  assert.equal(result.status, 201);
  assert.equal(Number(result.body.netSalary), 64000);
  assert.equal(
    (await send(manager, "post", "/api/payroll", payroll)).status,
    409,
  );
  assert.equal(
    (
      await send(manager, "put", `/api/payroll/${result.body.id}`, {
        ...payroll,
        status: "POSTED",
      })
    ).status,
    200,
  );
  assert.equal(
    (await send(manager, "delete", `/api/payroll/${result.body.id}`)).status,
    409,
  );
  const leave = {
    employeeId: person.body.id,
    leaveType: "Annual",
    fromDate: "2031-02-01",
    toDate: "2031-02-03",
    reason: "Planned leave",
    status: "PENDING",
  };
  const created = await send(manager, "post", "/api/employee-leaves", leave);
  assert.equal(created.status, 201);
  assert.equal(
    (
      await send(manager, "put", `/api/employee-leaves/${created.body.id}`, {
        ...leave,
        status: "APPROVED",
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await send(manager, "post", "/api/employee-leaves", {
        ...leave,
        toDate: "2031-01-01",
      })
    ).status,
    400,
  );
});
test("expenses post exactly once and draft records remain editable", async () => {
  const body = {
    category: "Utilities",
    description: "Release utility bill",
    amount: 1200.5,
    expenseDate: "2031-02-01",
    status: "DRAFT",
  };
  const result = await send(manager, "post", "/api/expenses", body);
  assert.equal(result.status, 201);
  assert.equal(
    await db.journalEntry.count({
      where: { number: `EXPENSES-${result.body.id}` },
    }),
    0,
  );
  assert.equal(
    (
      await send(manager, "put", `/api/expenses/${result.body.id}`, {
        ...body,
        status: "POSTED",
      })
    ).status,
    200,
  );
  assert.equal(
    await db.journalEntry.count({
      where: { number: `EXPENSES-${result.body.id}` },
    }),
    1,
  );
  assert.equal(
    (await send(manager, "put", `/api/expenses/${result.body.id}`, body))
      .status,
    409,
  );
});
test("attendance normalizes days; leaves reject invalid ranges; settings persist", async () => {
  const student = await db.student.findFirst();
  const body = {
    studentId: student.id,
    attendanceDate: "2031-03-01T10:00:00Z",
    status: "PRESENT",
    note: "Release attendance",
  };
  assert.equal(
    (await send(admin, "post", "/api/attendance", body)).status,
    201,
  );
  assert.equal(
    (
      await send(admin, "post", "/api/attendance", {
        ...body,
        attendanceDate: "2031-03-01T18:00:00Z",
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await send(admin, "post", "/api/student-leaves", {
        studentId: student.id,
        fromDate: "2031-03-04",
        toDate: "2031-03-01",
        reason: "Invalid range",
        status: "PENDING",
      })
    ).status,
    400,
  );
  const settings = (await admin.get("/api/settings")).body;
  delete settings.id;
  assert.equal(
    (
      await send(admin, "put", "/api/settings", {
        ...settings,
        name: "Release workspace",
        currency: "USD",
      })
    ).status,
    200,
  );
  assert.equal((await admin.get("/api/config")).body.currency, "USD");
  assert.equal(
    (
      await send(admin, "put", "/api/settings", {
        ...settings,
        timezone: "Invalid/Timezone",
      })
    ).status,
    400,
  );
});
test("administrator can add, change and remove a user, and password reset revokes sessions", async () => {
  const body = {
    name: "Release User",
    email: "release-user@example.com",
    password: "Release-test-password-42!",
    role: "EMPLOYEE",
    active: true,
  };
  const created = await send(admin, "post", "/api/users", body);
  assert.equal(created.status, 201);
  assert.equal(created.body.passwordHash, undefined);
  const member = request.agent(app);
  assert.equal(
    (
      await send(member, "post", "/api/auth/login", {
        email: body.email,
        password: body.password,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await send(admin, "put", `/api/users/${created.body.id}`, {
        ...body,
        password: "New-release-test-password-42!",
      })
    ).status,
    200,
  );
  assert.equal((await member.get("/api/products")).status, 401);
  assert.equal(
    (await send(admin, "delete", `/api/users/${created.body.id}`)).status,
    204,
  );
});
