import { z } from "zod";
import { catalog } from "../../../shared/catalog.js";
import { Prisma, activeDatabaseMode } from "./db.js";
import { assertAccess, HttpError } from "./security.js";
import { decorate, orderInclude } from "./operations.js";
import { amount, cents } from "./accounting.js";

export const dateRangeSchema = z
  .object({
    from: z.string().date().optional(),
    to: z.string().date().optional(),
  })
  .refine(
    (v) => !v.from || !v.to || v.from <= v.to,
    "Start date must be before end date.",
  );
export const dateWhere = (range) => ({
  ...(range.from ? { gte: new Date(`${range.from}T00:00:00.000Z`) } : {}),
  ...(range.to ? { lte: new Date(`${range.to}T23:59:59.999Z`) } : {}),
});
export const journalInclude = {
  lines: { include: { debitAccount: true, creditAccount: true } },
};
const modelFields = (resource) =>
  Prisma.dmmf.datamodel.models.find(
    (m) => m.name.toLowerCase() === catalog[resource].model.toLowerCase(),
  ).fields;
export async function listRecords(db, user, resource, query = {}) {
  if (!catalog[resource]) throw new HttpError(404, "Module not found.");
  assertAccess(user, resource);
  const paging = z
    .object({
      page: z.coerce.number().int().min(1).max(1000000).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(10),
      q: z.string().max(200).default(""),
      sort: z.string().max(50).default("id"),
      direction: z.enum(["asc", "desc"]).default("desc"),
      status: z.string().max(50).optional(),
      from: z.string().date().optional(),
      to: z.string().date().optional(),
    })
    .parse(query);
  const fields = modelFields(resource);
  const sort = fields.find(
    (f) =>
      f.name === paging.sort &&
      ["String", "Int", "Decimal", "DateTime", "Boolean"].includes(f.type),
  )
    ? paging.sort
    : "id";
  const searchFields = fields
    .filter(
      (f) => f.type === "String" && !["passwordHash", "role"].includes(f.name),
    )
    .map((f) => f.name);
  const where = {};
  if (paging.q)
    where.OR = searchFields.map((name) => ({
      [name]: {
        contains: paging.q,
        ...(activeDatabaseMode === "postgres" ? { mode: "insensitive" } : {}),
      },
    }));
  if (paging.status) {
    if (
      ["true", "false"].includes(paging.status) &&
      fields.some((f) => f.name === "active")
    )
      where.active = paging.status === "true";
    else if (fields.some((f) => f.name === "status")) {
      const allowed = [
        "DRAFT",
        "POSTED",
        "PAID",
        "CANCELLED",
        "PENDING",
        "APPROVED",
        "REJECTED",
        "NEW",
        "READ",
        "ARCHIVED",
        "PRESENT",
        "ABSENT",
        "LATE",
        "EXCUSED",
      ];
      if (!allowed.includes(paging.status))
        throw new HttpError(400, "Unknown status filter.");
      where.status = paging.status;
    }
  }
  if (paging.from || paging.to) {
    dateRangeSchema.parse(paging);
    const field = [
      "issueDate",
      "expenseDate",
      "paidAt",
      "createdAt",
      "movementDate",
      "entryDate",
      "attendanceDate",
    ].find((key) => fields.some((f) => f.name === key));
    if (field) where[field] = dateWhere(paging);
  }
  const config = catalog[resource];
  const [records, total] = await db.$transaction([
    db[config.model].findMany({
      where,
      orderBy: { [sort]: paging.direction },
      skip: (paging.page - 1) * paging.pageSize,
      take: paging.pageSize,
      ...(config.order ? { include: orderInclude } : {}),
      ...(resource === "journal" ? { include: journalInclude } : {}),
      ...(resource === "inbox" ? { include: { notification: true } } : {}),
      ...(resource === "fees" ? { include: { payments: true } } : {}),
      ...(resource === "students"
        ? { include: { guardianLinks: { include: { guardian: true } } } }
        : {}),
      ...(resource === "users"
        ? {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              active: true,
              createdAt: true,
            },
          }
        : {}),
    }),
    db[config.model].count({ where }),
  ]);
  return {
    data: records.map((r) => decorate(resource, r)),
    total,
    page: paging.page,
    pageSize: paging.pageSize,
    pages: Math.max(1, Math.ceil(total / paging.pageSize)),
  };
}
export async function getReport(db, user, query = {}) {
  assertAccess(user, "reports");
  const range = dateRangeSchema.parse(query);
  const [accounts, entries, openings] = await Promise.all([
    db.account.findMany({ orderBy: { code: "asc" } }),
    db.journalEntry.findMany({
      where: range.to
        ? { entryDate: { lte: new Date(`${range.to}T23:59:59.999Z`) } }
        : {},
      include: { lines: true },
      orderBy: { entryDate: "asc" },
    }),
    db.openingBalance.findMany({
      where: range.to
        ? { asOf: { lte: new Date(`${range.to}T23:59:59.999Z`) } }
        : {},
    }),
  ]);
  const balances = accounts.map((account) => {
    let prior = openings
      .filter((o) => o.accountId === account.id)
      .reduce((n, o) => n + cents(o.amount) * (o.side === "DEBIT" ? 1 : -1), 0);
    let movement = 0;
    for (const entry of entries) {
      const value = entry.lines.reduce(
        (n, l) =>
          n +
          (l.debitAccountId === account.id ? cents(l.debit) : 0) -
          (l.creditAccountId === account.id ? cents(l.credit) : 0),
        0,
      );
      if (
        range.from &&
        entry.entryDate < new Date(`${range.from}T00:00:00.000Z`)
      )
        prior += value;
      else movement += value;
    }
    return {
      ...account,
      openingBalance: amount(prior),
      movement: amount(movement),
      balance: amount(prior + movement),
      debit: amount(Math.max(0, prior + movement)),
      credit: amount(Math.max(0, -prior - movement)),
    };
  });
  const sum = (type, key, sign = 1) =>
    amount(
      balances
        .filter((a) => a.type === type)
        .reduce((n, a) => n + cents(a[key]) * sign, 0),
    );
  const income = sum("INCOME", "movement", -1),
    expenses = sum("EXPENSE", "movement");
  const profit = amount(cents(income) - cents(expenses));
  const retained = amount(
    -balances
      .filter((a) => ["INCOME", "EXPENSE"].includes(a.type))
      .reduce((n, a) => n + cents(a.balance), 0),
  );
  const totalDebit = amount(balances.reduce((n, a) => n + cents(a.debit), 0)),
    totalCredit = amount(balances.reduce((n, a) => n + cents(a.credit), 0));
  return {
    ...range,
    income,
    expenses,
    profit,
    cash: balances.find((a) => a.code === "1000")?.balance || 0,
    receivables: balances.find((a) => a.code === "1100")?.balance || 0,
    payables: -(balances.find((a) => a.code === "2000")?.balance || 0),
    accounts: balances,
    assets: sum("ASSET", "balance"),
    liabilities: sum("LIABILITY", "balance", -1),
    equity: amount(cents(sum("EQUITY", "balance", -1)) + cents(retained)),
    retainedEarnings: retained,
    totalDebit,
    totalCredit,
    balanced: cents(totalDebit) === cents(totalCredit),
  };
}
export function businessDate(
  date = new Date(),
  timezone = process.env.BUSINESS_TIMEZONE || "Asia/Karachi",
) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export async function getDashboard(db, user, months = 6) {
  const [
    settings,
    sales,
    purchases,
    inventory,
    products,
    customerCount,
    employeeCount,
    activity,
    inboxCount,
  ] = await Promise.all([
    db.workspaceSetting.findUnique({ where: { id: 1 } }),
    db.sale.findMany({ include: orderInclude, orderBy: { issueDate: "desc" } }),
    db.purchase.findMany({ where: { status: { in: ["POSTED", "PAID"] } } }),
    db.inventoryItem.findMany({ orderBy: { name: "asc" } }),
    db.product.findMany(),
    db.customer.count({ where: { active: true } }),
    db.employee.count({ where: { active: true } }),
    db.auditLog.findMany({ take: 8, orderBy: { createdAt: "desc" } }),
    user.role === "ADMIN"
      ? db.contactMessage.count({ where: { status: "NEW" } })
      : 0,
  ]);
  const timezone =
    settings?.timezone || process.env.BUSINESS_TIMEZONE || "Asia/Karachi";
  const today = businessDate(new Date(), timezone);
  const month = today.slice(0, 7);
  const active = sales.filter((s) => ["POSTED", "PAID"].includes(s.status));
  const current = active.filter((s) =>
    businessDate(s.issueDate, timezone).startsWith(month),
  );
  const [year, monthNumber] = month.split("-").map(Number);
  const trend = Array.from({ length: months }, (_, i) => {
    const date = new Date(Date.UTC(year, monthNumber - months + i, 15));
    const key = date.toISOString().slice(0, 7);
    return {
      month: date.toLocaleDateString("en", { month: "short", timeZone: "UTC" }),
      key,
      revenue: amount(
        active
          .filter((s) => businessDate(s.issueDate, timezone).startsWith(key))
          .reduce((n, s) => n + cents(s.total), 0),
      ),
      purchases: amount(
        purchases
          .filter((s) => businessDate(s.issueDate, timezone).startsWith(key))
          .reduce((n, s) => n + cents(s.total), 0),
      ),
    };
  });
  const previousKey = new Date(Date.UTC(year, monthNumber - 2, 15))
    .toISOString()
    .slice(0, 7);
  const revenue = current.reduce((n, s) => n + cents(s.total), 0);
  const previous = active
    .filter((s) => businessDate(s.issueDate, timezone).startsWith(previousKey))
    .reduce((n, s) => n + cents(s.total), 0);
  const lowStock = inventory.filter(
    (i) => Number(i.quantity) <= Number(i.reorderLevel),
  );
  const topProducts = products
    .map((p) => {
      const lines = current
        .flatMap((s) => s.lines)
        .filter((l) => l.productId === p.id);
      return {
        id: p.id,
        name: p.name,
        category: p.category,
        units: lines.reduce((n, l) => n + l.quantity, 0),
        revenue: amount(
          lines.reduce((n, l) => n + cents(l.unitPrice) * l.quantity, 0),
        ),
      };
    })
    .filter((p) => p.units)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 4);
  return {
    settings,
    today,
    revenue: amount(revenue),
    revenueChange: previous
      ? Number((((revenue - previous) / previous) * 100).toFixed(1))
      : 0,
    orders: current.length,
    customers: customerCount,
    employees: employeeCount,
    lowStock,
    inventoryValue: amount(
      inventory.reduce((n, i) => n + cents(i.unitCost) * Number(i.quantity), 0),
    ),
    stockCount: inventory.reduce((n, i) => n + Number(i.quantity), 0),
    trend,
    topProducts,
    recentSales: sales.slice(0, 5).map((r) => decorate("sales", r)),
    activity: user.role === "EMPLOYEE" ? [] : activity,
    inboxCount,
    todaySales: amount(
      active
        .filter((s) => businessDate(s.issueDate, timezone) === today)
        .reduce((n, s) => n + cents(s.total), 0),
    ),
    outstanding: amount(
      active.reduce(
        (n, s) =>
          n +
          cents(s.total) -
          s.payments.reduce((p, payment) => p + cents(payment.amount), 0),
        0,
      ),
    ),
    categoryStock: Object.entries(
      inventory.reduce(
        (map, i) => ({
          ...map,
          [i.category || "Other"]:
            (map[i.category || "Other"] || 0) + Number(i.quantity),
        }),
        {},
      ),
    ).map(([name, value]) => ({ name, value })),
  };
}
