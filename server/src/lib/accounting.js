import { HttpError } from "./security.js";
export const defaultAccounts = [
  ["1000", "Cash & bank", "ASSET"],
  ["1100", "Accounts receivable", "ASSET"],
  ["1200", "Inventory", "ASSET"],
  ["1300", "Input tax", "ASSET"],
  ["2000", "Accounts payable", "LIABILITY"],
  ["2200", "Sales tax payable", "LIABILITY"],
  ["3000", "Opening capital", "EQUITY"],
  ["4000", "Sales & fee revenue", "INCOME"],
  ["5000", "Cost of goods sold", "EXPENSE"],
  ["5100", "Salaries & wages", "EXPENSE"],
  ["5200", "Rent & facilities", "EXPENSE"],
  ["5300", "Utilities", "EXPENSE"],
  ["5400", "Operating expenses", "EXPENSE"],
];
export const cents = (v) => Math.round(Number(v) * 100);
export const amount = (v) => Number((v / 100).toFixed(2));
export async function seedAccounts(db) {
  for (const [code, name, type] of defaultAccounts)
    await db.account.upsert({
      where: { code },
      update: {},
      create: { code, name, type },
    });
}
export async function postJournal(
  tx,
  { number, source, memo, date = new Date(), lines },
) {
  const nonzero = lines.filter(
    (line) => cents(line.debit || line.credit || 0) > 0,
  );
  if (!nonzero.length) return;
  if (
    nonzero.reduce(
      (n, l) => n + cents(l.debit || 0) - cents(l.credit || 0),
      0,
    ) !== 0
  )
    throw new HttpError(400, "Journal debits and credits must balance.");
  const accounts = await tx.account.findMany({
    where: { code: { in: nonzero.map((l) => l.code) }, active: true },
  });
  if (nonzero.some((l) => !accounts.find((a) => a.code === l.code)))
    throw new HttpError(400, "A required posting account is unavailable.");
  return tx.journalEntry.create({
    data: {
      number,
      source,
      memo,
      entryDate: date,
      lines: {
        create: nonzero.map((line) => ({
          ...(line.debit
            ? { debitAccountId: accounts.find((a) => a.code === line.code).id }
            : {
                creditAccountId: accounts.find((a) => a.code === line.code).id,
              }),
          debit: line.debit || 0,
          credit: line.credit || 0,
        })),
      },
    },
  });
}
export const expenseAccountCode = (category = "") =>
  /rent/i.test(category)
    ? "5200"
    : /salar/i.test(category)
      ? "5100"
      : /utilit/i.test(category)
        ? "5300"
        : "5400";
export async function reverseJournal(tx, originalNumber) {
  const entry = await tx.journalEntry.findUnique({
    where: { number: originalNumber },
    include: {
      lines: { include: { debitAccount: true, creditAccount: true } },
    },
  });
  if (!entry) return;
  return postJournal(tx, {
    number: `REV-${originalNumber}`,
    source: "REVERSAL",
    memo: `Reversal of ${originalNumber}`,
    lines: entry.lines.map((l) => ({
      code: (l.debitAccount || l.creditAccount).code,
      debit: Number(l.credit),
      credit: Number(l.debit),
    })),
  });
}
