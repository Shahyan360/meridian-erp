import { randomUUID } from "node:crypto";
import { catalog } from "../../../shared/catalog.js";
import { schemaFor, paymentSchema } from "./validation.js";
import {
  assertAccess,
  HttpError,
  hashPassword,
  publicUser,
} from "./security.js";
import {
  cents,
  amount,
  postJournal,
  reverseJournal,
  expenseAccountCode,
  defaultAccounts,
} from "./accounting.js";

export const reference = (prefix) =>
  `${prefix}-${randomUUID().slice(0, 8).toUpperCase()}`;
export async function audit(tx, user, action, entity, id) {
  await tx.auditLog.create({
    data: {
      userId: user?.id,
      actor: user?.name || "Website visitor",
      action,
      entity,
      recordId: String(id),
    },
  });
}
const posted = (record) => ["POSTED", "PAID"].includes(record?.status);
export const orderInclude = {
  lines: { include: { product: true } },
  payments: true,
};
export function decorate(resource, record) {
  if (resource === "inbox")
    return {
      ...record,
      notificationStatus: record.notification?.status || "NOT_REQUESTED",
    };
  if (resource === "users") return publicUser(record);
  if (["sales", "purchases"].includes(resource))
    return {
      ...record,
      balance: amount(
        cents(record.total) -
          (record.payments || []).reduce((s, p) => s + cents(p.amount), 0),
      ),
    };
  return record;
}
async function stock(tx, productId, delta, ref, type, incomingValue) {
  let item = await tx.inventoryItem.findUnique({ where: { productId } });
  if (!item) {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new HttpError(400, "Product no longer exists.");
    item = await tx.inventoryItem.create({
      data: {
        productId,
        sku: product.sku,
        name: product.name,
        category: product.category,
        quantity: 0,
        reorderLevel: 10,
        unitCost: product.purchasePrice,
      },
    });
  }
  const beforeValue = cents(item.unitCost) * Number(item.quantity);
  const nextQuantity = Number(item.quantity) + delta;
  const nextCost =
    incomingValue !== undefined && delta > 0 && nextQuantity > 0
      ? amount(Math.round((beforeValue + incomingValue) / nextQuantity))
      : Number(item.unitCost);
  if (delta < 0) {
    const changed = await tx.inventoryItem.updateMany({
      where: { id: item.id, quantity: { gte: -delta } },
      data: { quantity: { decrement: -delta } },
    });
    if (!changed.count)
      throw new HttpError(
        409,
        `Insufficient stock for ${item.name}. Available: ${item.quantity}.`,
      );
  } else
    await tx.inventoryItem.update({
      where: { id: item.id },
      data: { quantity: { increment: delta }, unitCost: nextCost },
    });
  await tx.stockMovement.create({
    data: {
      inventoryItemId: item.id,
      quantity: delta,
      reference: ref,
      movementType: type,
    },
  });
  return {
    previousUnitCost: Number(item.unitCost),
    valueDelta: cents(nextCost) * nextQuantity - beforeValue,
  };
}
async function prepareOrder(tx, resource, data) {
  const sale = resource === "sales";
  const { lines, ...fields } = data;
  const partner = await tx[sale ? "customer" : "vendor"].findUnique({
    where: { id: fields[sale ? "customerId" : "vendorId"] },
  });
  if (!partner?.active)
    throw new HttpError(400, "Choose an active customer or supplier.");
  const seen = new Set();
  const prepared = [];
  for (const line of lines) {
    if (seen.has(line.productId))
      throw new HttpError(400, "Combine duplicate products into one line.");
    seen.add(line.productId);
    const product = await tx.product.findUnique({
      where: { id: line.productId },
      include: { inventory: true },
    });
    if (!product?.active) throw new HttpError(400, "Choose an active product.");
    prepared.push({
      productId: product.id,
      quantity: line.quantity,
      unitPrice:
        line.unitPrice ??
        Number(sale ? product.salePrice : product.purchasePrice),
      unitCost: Number(product.inventory[0]?.unitCost ?? product.purchasePrice),
    });
  }
  const subtotal = prepared.reduce(
    (n, line) => n + cents(line.unitPrice) * line.quantity,
    0,
  );
  const discount = cents(fields.discount);
  if (discount > subtotal)
    throw new HttpError(400, "Discount cannot exceed the subtotal.");
  const tax = Math.round(
    ((subtotal - discount) * Number(fields.taxRate)) / 100,
  );
  return {
    ...fields,
    [sale ? "customerName" : "supplierName"]: partner.name,
    description:
      fields.description ||
      `${prepared.length} product${prepared.length === 1 ? "" : "s"}`,
    total: amount(subtotal - discount + tax),
    status: "DRAFT",
    lines: { create: prepared },
  };
}
async function postOrder(tx, resource, record) {
  const sale = resource === "sales";
  const ref = sale ? record.invoiceNo : record.billNo;
  const net =
    record.lines.reduce((sum, l) => sum + cents(l.unitPrice) * l.quantity, 0) -
    cents(record.discount);
  const tax = cents(record.total) - net;
  const subtotal = net + cents(record.discount);
  let inventoryDelta = 0,
    allocated = 0;
  for (const [index, line] of record.lines.entries()) {
    const lineNet =
      index === record.lines.length - 1
        ? net - allocated
        : Math.round(
            cents(line.unitPrice) *
              line.quantity *
              (subtotal ? net / subtotal : 0),
          );
    allocated += lineNet;
    const movement = await stock(
      tx,
      line.productId,
      line.quantity * (sale ? -1 : 1),
      ref,
      sale ? "DELIVERY" : "RECEIPT",
      sale ? undefined : lineNet,
    );
    inventoryDelta += movement.valueDelta;
    await tx.orderLine.update({
      where: { id: line.id },
      data: { unitCost: movement.previousUnitCost },
    });
  }
  const cost = -inventoryDelta;
  const rounding = net - inventoryDelta;
  const lines = sale
    ? [
        { code: "1100", debit: Number(record.total) },
        { code: "4000", credit: amount(net) },
        { code: "2200", credit: amount(tax) },
        { code: "5000", debit: amount(cost) },
        { code: "1200", credit: amount(cost) },
      ]
    : [
        {
          code: "1200",
          ...(inventoryDelta >= 0
            ? { debit: amount(inventoryDelta) }
            : { credit: amount(-inventoryDelta) }),
        },
        { code: "1300", debit: amount(tax) },
        { code: "2000", credit: Number(record.total) },
        {
          code: "5400",
          ...(rounding >= 0
            ? { debit: amount(rounding) }
            : { credit: amount(-rounding) }),
        },
      ];
  await postJournal(tx, {
    number: `${sale ? "SALE" : "PURCHASE"}-${record.id}`,
    source: sale ? "SALE" : "PURCHASE",
    memo: ref,
    date: record.issueDate,
    lines,
  });
  return tx[catalog[resource].model].update({
    where: { id: record.id },
    data: { status: Number(record.total) === 0 ? "PAID" : "POSTED" },
    include: orderInclude,
  });
}
async function guardAdmin(tx, user, record, data, deleting = false) {
  if (
    record.id === user.id &&
    (deleting || data.active === false || (data.role && data.role !== "ADMIN"))
  )
    throw new HttpError(
      400,
      "You cannot remove your own administrator access.",
    );
  if (
    record.role === "ADMIN" &&
    record.active &&
    (deleting || data.active === false || (data.role && data.role !== "ADMIN"))
  ) {
    if ((await tx.user.count({ where: { role: "ADMIN", active: true } })) <= 1)
      throw new HttpError(400, "Keep at least one active administrator.");
  }
}
async function prepareData(tx, resource, data, old, user) {
  if (catalog[resource].order) return prepareOrder(tx, resource, data);
  const fields = { ...data };
  if (resource === "users") {
    if (old) await guardAdmin(tx, user, old, data);
    if (!old && !data.password)
      throw new HttpError(
        400,
        "A password of at least 12 characters is required.",
      );
    if (data.password) fields.passwordHash = hashPassword(data.password);
    delete fields.password;
  }
  if (resource === "employees" && !fields.employeeNo)
    fields.employeeNo = old?.employeeNo || reference("EMP");
  if (resource === "students") {
    if (!fields.admissionNo)
      fields.admissionNo = old?.admissionNo || reference("STU");
    if (fields.classSectionId) {
      const section = await tx.classSection.findUnique({
        where: { id: fields.classSectionId },
        include: { _count: { select: { students: true } } },
      });
      if (!section?.active) throw new HttpError(400, "Choose an active class.");
      if (
        section._count.students -
          (old?.classSectionId === fields.classSectionId ? 1 : 0) >=
        section.capacity
      )
        throw new HttpError(409, "This class has reached its capacity.");
      fields.className = section.className;
      fields.section = section.section;
    } else {
      fields.classSectionId = null;
      fields.className = "";
      fields.section = "";
    }
    if (fields.guardianIds) {
      if (old)
        await tx.studentGuardian.deleteMany({ where: { studentId: old.id } });
      fields.guardianLinks = {
        create: [...new Set(fields.guardianIds)].map((guardianId, i) => ({
          guardianId,
          isPrimary: i === 0,
        })),
      };
      delete fields.guardianIds;
    }
  }
  if (
    resource === "classes" &&
    old &&
    fields.capacity <
      (await tx.student.count({ where: { classSectionId: old.id } }))
  )
    throw new HttpError(
      409,
      "Capacity cannot be less than current enrollment.",
    );
  if (resource === "inventory") {
    const product = await tx.product.findUnique({
      where: { id: fields.productId },
    });
    if (!product?.active) throw new HttpError(400, "Choose an active product.");
    if (old && old.productId !== fields.productId)
      throw new HttpError(
        400,
        "The product on an existing stock record cannot be changed.",
      );
    fields.name = product.name;
    fields.sku = product.sku;
    fields.category = product.category;
    if (
      old &&
      Number(old.unitCost) !== fields.unitCost &&
      Number(old.quantity) > 0
    )
      throw new HttpError(
        400,
        "Unit cost is locked while stock is on hand. Receive a purchase to update it.",
      );
  }
  if (resource === "payroll") {
    if (
      await tx.payroll.findFirst({
        where: {
          employeeId: fields.employeeId,
          period: fields.period,
          ...(old ? { id: { not: old.id } } : {}),
        },
      })
    )
      throw new HttpError(
        409,
        "Payroll already exists for this employee and month.",
      );
    fields.netSalary = amount(
      cents(fields.basicSalary) +
        cents(fields.allowances) -
        cents(fields.deductions),
    );
    if (fields.netSalary < 0)
      throw new HttpError(
        400,
        "Deductions cannot exceed salary and allowances.",
      );
  }
  if (resource === "fees") {
    const student = await tx.student.findUnique({
      where: { id: fields.studentId },
    });
    if (!student?.active) throw new HttpError(400, "Choose an active student.");
    if (old && (await tx.feePayment.count({ where: { feeRecordId: old.id } })))
      throw new HttpError(409, "A fee with payments cannot be edited.");
    fields.studentName =
      `${student.firstName} ${student.lastName || ""}`.trim();
    fields.admissionNo = student.admissionNo;
    fields.status = "POSTED";
  }
  if (resource === "fee-payments") {
    if (old) throw new HttpError(409, "Receipts are immutable.");
    const fee = await tx.feeRecord.findUnique({
      where: { id: fields.feeRecordId },
      include: { payments: true },
    });
    if (!fee || fee.status === "CANCELLED")
      throw new HttpError(400, "Choose an outstanding fee assignment.");
    const outstanding =
      cents(fee.amount) - fee.payments.reduce((n, p) => n + cents(p.amount), 0);
    if (cents(fields.amount) > outstanding)
      throw new HttpError(400, "Payment exceeds the outstanding fee.");
    fields.studentId = fee.studentId;
    fields.receiptNo = reference("FEE");
  }
  return fields;
}
async function postSimple(tx, resource, record, old) {
  const key = `${resource.toUpperCase()}-${record.id}`;
  if (resource === "inventory") {
    const delta = Number(record.quantity) - Number(old?.quantity || 0);
    if (delta) {
      await tx.stockMovement.create({
        data: {
          inventoryItemId: record.id,
          movementType: old ? "ADJUSTMENT" : "OPENING",
          quantity: delta,
          reference: reference("ADJ"),
        },
      });
      const value = amount(Math.abs(delta) * cents(record.unitCost));
      await postJournal(tx, {
        number: reference("STOCK"),
        source: "STOCK",
        memo: `${record.name} · ${delta > 0 ? "+" : ""}${delta} units`,
        lines: [
          {
            code: "1200",
            ...(delta > 0 ? { debit: value } : { credit: value }),
          },
          {
            code: "3000",
            ...(delta > 0 ? { credit: value } : { debit: value }),
          },
        ],
      });
    }
  }
  if (
    ["expenses", "payroll"].includes(resource) &&
    posted(record) &&
    !posted(old)
  ) {
    const value = Number(
      resource === "payroll" ? record.netSalary : record.amount,
    );
    await postJournal(tx, {
      number: key,
      source: resource.toUpperCase(),
      date: record.expenseDate,
      memo:
        resource === "payroll"
          ? `Payroll ${record.period}`
          : record.description,
      lines: [
        {
          code:
            resource === "payroll"
              ? "5100"
              : expenseAccountCode(record.category),
          debit: value,
        },
        { code: "1000", credit: value },
      ],
    });
  }
  if (resource === "fees") {
    if (old) {
      const prior = await tx.journalEntry.findFirst({
        where: {
          OR: [{ number: key }, { source: `FEE_ASSIGNMENT-${record.id}` }],
        },
        orderBy: { id: "desc" },
      });
      if (prior) await reverseJournal(tx, prior.number);
    }
    await postJournal(tx, {
      number: old ? `${key}-${randomUUID().slice(0, 8)}` : key,
      source: `FEE_ASSIGNMENT-${record.id}`,
      memo: `${record.studentName} · ${record.feeType}`,
      lines: [
        { code: "1100", debit: Number(record.amount) },
        { code: "4000", credit: Number(record.amount) },
      ],
    });
  }
  if (resource === "fee-payments") {
    await postJournal(tx, {
      number: key,
      source: "FEE PAYMENT",
      date: record.paidAt,
      memo: record.receiptNo,
      lines: [
        { code: "1000", debit: Number(record.amount) },
        { code: "1100", credit: Number(record.amount) },
      ],
    });
    const fee = await tx.feeRecord.findUnique({
      where: { id: record.feeRecordId },
      include: { payments: true },
    });
    await tx.feeRecord.update({
      where: { id: fee.id },
      data: {
        status:
          fee.payments.reduce((n, p) => n + cents(p.amount), 0) >=
          cents(fee.amount)
            ? "PAID"
            : "POSTED",
      },
    });
  }
  if (resource === "bank" && !old && Number(record.openingBalance) > 0)
    await postJournal(tx, {
      number: key,
      source: "OPENING",
      memo: record.name,
      lines: [
        { code: "1000", debit: Number(record.openingBalance) },
        { code: "3000", credit: Number(record.openingBalance) },
      ],
    });
}
export async function mutate(db, user, resource, operation, payload, id) {
  assertAccess(user, resource, true);
  const config = catalog[resource];
  if (!config || config.readOnly)
    throw new HttpError(403, "This resource is read-only.");
  if (config.immutable && operation !== "create")
    throw new HttpError(
      409,
      "Posted journal entries are immutable. Create a reversing entry instead.",
    );
  const parsed =
    operation === "delete" ? null : schemaFor(resource).parse(payload);
  return db.$transaction(async (tx) => {
    if (resource === "journal") {
      if (parsed.debitAccountId === parsed.creditAccountId)
        throw new HttpError(400, "Choose different debit and credit accounts.");
      const debit = await tx.account.findUnique({
        where: { id: parsed.debitAccountId },
      });
      const credit = await tx.account.findUnique({
        where: { id: parsed.creditAccountId },
      });
      if (!debit?.active || !credit?.active)
        throw new HttpError(400, "Choose active posting accounts.");
      const entry = await postJournal(tx, {
        number: reference("JE"),
        source: "MANUAL",
        memo: parsed.memo || "Manual journal",
        date: parsed.entryDate,
        lines: [
          { code: debit.code, debit: parsed.amount },
          { code: credit.code, credit: parsed.amount },
        ],
      });
      await audit(tx, user, "Posted", resource, entry.id);
      return entry;
    }
    const old = id
      ? await tx[config.model].findUnique({
          where: { id },
          ...(config.order ? { include: orderInclude } : {}),
        })
      : null;
    if (id && !old) throw new HttpError(404, "This record could not be found.");
    if (
      old &&
      ((config.order && old.status !== "DRAFT") ||
        (["expenses", "payroll"].includes(resource) &&
          old.status !== "DRAFT") ||
        resource === "fee-payments")
    )
      throw new HttpError(
        409,
        "Posted records cannot be edited or deleted. Cancel an unpaid order to reverse it.",
      );
    if (operation === "delete") {
      if (
        resource === "customers" &&
        (await tx.sale.count({ where: { customerId: id } }))
      )
        throw new HttpError(
          409,
          "Customers with sales history must be archived instead of deleted.",
        );
      if (
        resource === "vendors" &&
        (await tx.purchase.count({ where: { vendorId: id } }))
      )
        throw new HttpError(
          409,
          "Suppliers with purchase history must be archived instead of deleted.",
        );
      if (
        resource === "classes" &&
        (await tx.student.count({ where: { classSectionId: id } }))
      )
        throw new HttpError(
          409,
          "Classes with enrolled students cannot be deleted. Move the students first or archive the class.",
        );
      if (resource === "users") await guardAdmin(tx, user, old, {}, true);
      if (
        resource === "accounts" &&
        defaultAccounts.some(([code]) => code === old.code)
      )
        throw new HttpError(409, "System posting accounts cannot be deleted.");
      if (
        resource === "inventory" &&
        (Number(old.quantity) ||
          (await tx.stockMovement.count({ where: { inventoryItemId: id } })))
      )
        throw new HttpError(
          409,
          "Stock records with movement history cannot be deleted.",
        );
      if (resource === "bank" && Number(old.openingBalance))
        throw new HttpError(
          409,
          "A bank account with an opening deposit cannot be deleted.",
        );
      if (resource === "fees") {
        if (await tx.feePayment.count({ where: { feeRecordId: id } }))
          throw new HttpError(409, "A fee with receipts cannot be deleted.");
        const prior = await tx.journalEntry.findFirst({
          where: {
            OR: [{ number: `FEES-${id}` }, { source: `FEE_ASSIGNMENT-${id}` }],
          },
          orderBy: { id: "desc" },
        });
        if (prior) await reverseJournal(tx, prior.number);
      }
      if (resource === "products") {
        const item = await tx.inventoryItem.findUnique({
          where: { productId: id },
        });
        if (item) {
          if (
            Number(item.quantity) ||
            (await tx.stockMovement.count({
              where: { inventoryItemId: item.id },
            }))
          )
            throw new HttpError(
              409,
              "Products with stock history can be archived by setting them inactive.",
            );
          await tx.inventoryItem.delete({ where: { id: item.id } });
        }
      }
      await tx[config.model].delete({ where: { id } });
      await audit(tx, user, "Deleted", resource, id);
      return null;
    }
    if (
      resource === "accounts" &&
      old &&
      defaultAccounts.some(([code]) => code === old.code) &&
      (parsed.code !== old.code || parsed.type !== old.type || !parsed.active)
    )
      throw new HttpError(
        409,
        "System posting account codes, types, and active status are protected.",
      );
    if (
      resource === "bank" &&
      old &&
      Number(old.openingBalance) !== parsed.openingBalance
    )
      throw new HttpError(409, "Opening deposits are immutable.");
    const data = await prepareData(tx, resource, parsed, old, user);
    if (config.order) {
      if (old)
        await tx.orderLine.deleteMany({
          where: { [resource === "sales" ? "saleId" : "purchaseId"]: id },
        });
      else
        data[resource === "sales" ? "invoiceNo" : "billNo"] = reference(
          resource === "sales" ? "INV" : "PO",
        );
    }
    const record = await tx[config.model][old ? "update" : "create"]({
      ...(old ? { where: { id } } : {}),
      data,
      ...(config.order ? { include: orderInclude } : {}),
    });
    if (resource === "products")
      await tx.inventoryItem.upsert({
        where: { productId: record.id },
        create: {
          productId: record.id,
          name: record.name,
          sku: record.sku,
          category: record.category,
          quantity: 0,
          reorderLevel: 10,
          unitCost: record.purchasePrice,
        },
        update: {
          name: record.name,
          sku: record.sku,
          category: record.category,
        },
      });
    if (
      resource === "users" &&
      old &&
      (parsed.password || parsed.role !== old.role || !parsed.active)
    )
      await tx.session.deleteMany({ where: { userId: old.id } });
    await postSimple(tx, resource, record, old);
    await audit(tx, user, old ? "Updated" : "Created", resource, record.id);
    return decorate(resource, record);
  });
}
export async function transitionOrder(db, user, resource, id, action) {
  assertAccess(user, resource, true);
  if (!["sales", "purchases"].includes(resource))
    throw new HttpError(400, "Unsupported order type.");
  return db.$transaction(async (tx) => {
    const model = tx[catalog[resource].model];
    const record = await model.findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!record) throw new HttpError(404, "Order not found.");
    if (action === "post") {
      if (record.status !== "DRAFT")
        throw new HttpError(409, "Only draft orders can be posted.");
      const result = await postOrder(tx, resource, record);
      await audit(tx, user, "Posted", resource, id);
      return decorate(resource, result);
    }
    if (record.status === "CANCELLED")
      throw new HttpError(409, "This order is already cancelled.");
    if (record.payments.length)
      throw new HttpError(409, "Orders with payments cannot be cancelled.");
    if (posted(record)) {
      const ref = record.invoiceNo || record.billNo;
      for (const line of record.lines) {
        const item = await tx.inventoryItem.findUnique({
          where: { productId: line.productId },
        });
        const original =
          item &&
          (await tx.stockMovement.findFirst({
            where: { inventoryItemId: item.id, reference: ref },
            orderBy: { id: "desc" },
          }));
        if (
          !original ||
          (await tx.stockMovement.count({
            where: { inventoryItemId: item.id, id: { gt: original.id } },
          }))
        )
          throw new HttpError(
            409,
            "Stock has moved since this order was posted. Its history is protected; cancel only before later movements.",
          );
        await stock(
          tx,
          line.productId,
          line.quantity * (resource === "sales" ? 1 : -1),
          `CANCEL-${ref}`,
          "REVERSAL",
          resource === "sales"
            ? cents(line.unitCost) * line.quantity
            : undefined,
        );
        if (resource === "purchases")
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: { unitCost: line.unitCost },
          });
      }
      await reverseJournal(
        tx,
        `${resource === "sales" ? "SALE" : "PURCHASE"}-${id}`,
      );
    }
    await audit(tx, user, "Cancelled", resource, id);
    return decorate(
      resource,
      await model.update({
        where: { id },
        data: { status: "CANCELLED" },
        include: orderInclude,
      }),
    );
  });
}
export async function allocatePayment(db, user, resource, id, payload) {
  assertAccess(user, resource, true);
  const data = paymentSchema.parse(payload);
  return db.$transaction(async (tx) => {
    const sale = resource === "sales";
    const record = await tx[sale ? "sale" : "purchase"].findUnique({
      where: { id },
      include: orderInclude,
    });
    if (!record || record.status !== "POSTED")
      throw new HttpError(409, "Payments require a posted, outstanding order.");
    const due =
      cents(record.total) -
      record.payments.reduce((n, p) => n + cents(p.amount), 0);
    if (cents(data.amount) > due)
      throw new HttpError(400, "Payment exceeds the outstanding balance.");
    const payment = await tx.payment.create({
      data: {
        ...data,
        [sale ? "saleId" : "purchaseId"]: id,
        reference: reference("PAY"),
      },
    });
    await postJournal(tx, {
      number: `PAYMENT-${payment.id}`,
      source: "PAYMENT",
      date: payment.paidAt,
      memo: payment.reference,
      lines: sale
        ? [
            { code: "1000", debit: data.amount },
            { code: "1100", credit: data.amount },
          ]
        : [
            { code: "2000", debit: data.amount },
            { code: "1000", credit: data.amount },
          ],
    });
    if (cents(data.amount) === due)
      await tx[sale ? "sale" : "purchase"].update({
        where: { id },
        data: { status: "PAID" },
      });
    await audit(tx, user, "Recorded payment", resource, id);
    return payment;
  });
}
