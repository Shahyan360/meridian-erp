import PDFDocument from "pdfkit";
import { catalog, labelFor } from "../../../shared/catalog.js";
import { listRecords, getReport } from "./queries.js";
import { assertAccess, HttpError } from "./security.js";
import { orderInclude, decorate } from "./operations.js";

export const csvCell = (value) => {
  let text = value instanceof Date ? value.toISOString() : String(value ?? "");
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
};
export function sendCsv(res, filename, columns, rows) {
  res
    .type("text/csv; charset=utf-8")
    .attachment(`${filename}.csv`)
    .send(
      "\uFEFF" +
        [
          columns.map(labelFor).map(csvCell).join(","),
          ...rows.map((row) => columns.map((c) => csvCell(row[c])).join(",")),
        ].join("\r\n"),
    );
}
export function pdfStart(res, filename, title, settings) {
  res.type("application/pdf").attachment(`${filename}.pdf`);
  const doc = new PDFDocument({ margin: 48, size: "A4", bufferPages: true });
  doc.pipe(res);
  doc
    .fillColor("#315ee8")
    .fontSize(25)
    .text(settings?.name || "Meridian");
  doc
    .moveDown(0.4)
    .fillColor("#64748b")
    .fontSize(10)
    .text("BUSINESS, IN HARMONY");
  doc.moveDown(1.8).fillColor("#14233b").fontSize(23).text(title);
  doc
    .moveDown()
    .fontSize(10)
    .fillColor("#64748b")
    .text(
      `Generated ${new Date().toISOString().slice(0, 10)} | ${settings?.currency || "PKR"}`,
    );
  doc.moveDown(1.4);
  return doc;
}
export async function exportResource(db, req, res) {
  const resource = req.params.resource;
  const format = req.query.format === "pdf" ? "pdf" : "csv";
  if (resource === "reports") {
    const report = await getReport(db, req.user, req.query);
    if (format === "csv")
      return sendCsv(
        res,
        "meridian-trial-balance",
        [
          "code",
          "name",
          "type",
          "openingBalance",
          "movement",
          "balance",
          "debit",
          "credit",
        ],
        report.accounts,
      );
    const settings = await db.workspaceSetting.findUnique({ where: { id: 1 } });
    const doc = pdfStart(
      res,
      "meridian-financial-report",
      "Financial report",
      settings,
    );
    doc
      .fillColor("#14233b")
      .fontSize(12)
      .text(`Period: ${report.from || "Beginning"} to ${report.to || "Today"}`)
      .moveDown();
    for (const key of [
      "income",
      "expenses",
      "profit",
      "cash",
      "receivables",
      "payables",
      "assets",
      "liabilities",
      "equity",
    ])
      doc
        .text(
          `${labelFor(key)}: ${Number(report[key]).toLocaleString("en", { minimumFractionDigits: 2 })}`,
        )
        .moveDown(0.4);
    doc.moveDown().fontSize(16).text("Trial balance").moveDown();
    for (const row of report.accounts) {
      if (doc.y > 730) doc.addPage();
      doc
        .fontSize(10)
        .text(`${row.code}  ${row.name}`, { continued: false })
        .fillColor("#64748b")
        .text(
          `Debit ${row.debit.toFixed(2)}    Credit ${row.credit.toFixed(2)}`,
        )
        .fillColor("#14233b")
        .moveDown(0.5);
    }
    doc.text(
      `Balanced: ${report.balanced ? "Yes" : "No"} | Total debits ${report.totalDebit} | Total credits ${report.totalCredit}`,
    );
    return doc.end();
  }
  if (!catalog[resource]) throw new HttpError(404, "Export not found.");
  assertAccess(req.user, resource);
  const rows = [];
  let result;
  for (let page = 1; page <= 100; page++) {
    result = await listRecords(db, req.user, resource, {
      ...req.query,
      page,
      pageSize: 100,
    });
    rows.push(...result.data);
    if (page >= result.pages) break;
  }
  if (result.total > 10000)
    throw new HttpError(
      400,
      "Use filters to export at most 10,000 records at a time.",
    );
  if (format === "csv")
    return sendCsv(
      res,
      `meridian-${resource}`,
      catalog[resource].columns,
      rows,
    );
  const settings = await db.workspaceSetting.findUnique({ where: { id: 1 } });
  const doc = pdfStart(
    res,
    `meridian-${resource}`,
    catalog[resource].title,
    settings,
  );
  for (const row of rows) {
    if (doc.y > 630) doc.addPage();
    for (const column of catalog[resource].columns)
      doc
        .fontSize(10)
        .fillColor("#14233b")
        .text(
          `${labelFor(column)}: ${row[column] instanceof Date ? row[column].toISOString().slice(0, 10) : (row[column] ?? "-")}`,
        );
    doc.moveDown();
  }
  doc.end();
}
export async function exportDocument(db, req, res) {
  const { resource } = req.params;
  if (!["sales", "purchases", "payroll", "fee-payments"].includes(resource))
    throw new HttpError(404, "Document not found.");
  assertAccess(req.user, resource);
  const record = await db[catalog[resource].model].findUnique({
    where: { id: Number(req.params.id) },
    ...(catalog[resource].order ? { include: orderInclude } : {}),
  });
  if (!record) throw new HttpError(404, "Document not found.");
  const settings = await db.workspaceSetting.findUnique({ where: { id: 1 } });
  const ref =
    record.invoiceNo ||
    record.billNo ||
    record.receiptNo ||
    `PAYSLIP-${record.id}`;
  const doc = pdfStart(
    res,
    ref,
    resource === "sales"
      ? "Sales invoice"
      : resource === "purchases"
        ? "Purchase order"
        : resource === "payroll"
          ? "Employee payslip"
          : "Fee receipt",
    settings,
  );
  doc.fillColor("#14233b").fontSize(12).text(ref).moveDown();
  doc
    .fontSize(10)
    .text(`Status: ${record.status || "RECEIVED"}`)
    .text(
      record.customerName ||
        record.supplierName ||
        `Employee / student: ${record.employeeId || record.studentId}`,
    )
    .moveDown();
  if (record.lines) {
    for (const line of record.lines) {
      if (doc.y > 710) doc.addPage();
      doc
        .text(
          `${line.product.name}  |  ${line.quantity} x ${line.unitPrice}  |  ${(line.quantity * Number(line.unitPrice)).toFixed(2)}`,
        )
        .moveDown(0.8);
    }
    const data = decorate(resource, record);
    doc
      .moveDown()
      .text(`Discount: ${record.discount} | Tax: ${record.taxRate}%`)
      .moveDown()
      .fontSize(17)
      .text(
        `Total: ${settings?.currency || "PKR"} ${Number(record.total).toFixed(2)}`,
      )
      .fontSize(11)
      .moveDown()
      .text(`Balance due: ${data.balance.toFixed(2)}`);
  } else
    for (const key of catalog[resource].columns)
      doc
        .text(
          `${labelFor(key)}: ${record[key] instanceof Date ? record[key].toISOString().slice(0, 10) : (record[key] ?? "-")}`,
        )
        .moveDown(0.5);
  doc.end();
}
