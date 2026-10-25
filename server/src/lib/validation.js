import { z } from "zod";
import { catalog } from "../../../shared/catalog.js";

const money = z.coerce
  .number()
  .finite()
  .min(0)
  .max(1000000000)
  .multipleOf(0.01);
export const lineSchema = z
  .object({
    productId: z.coerce.number().int().positive(),
    quantity: z.coerce.number().int().min(1).max(1000000),
    unitPrice: money.optional(),
  })
  .strict();
export function schemaFor(resource) {
  const config = catalog[resource];
  const shape = {};
  for (const field of config.fields) {
    let schema;
    if (field.boolean)
      schema = z
        .union([z.boolean(), z.enum(["true", "false"])])
        .transform((v) => v === true || v === "true");
    else if (field.type === "number") {
      schema = z.coerce
        .number()
        .finite()
        .min(field.min ?? 0)
        .max(field.max ?? 1000000000);
      schema = field.integer ? schema.int() : schema.multipleOf(0.01);
    } else if (field.type === "relation")
      schema = z.coerce.number().int().positive();
    else if (field.type === "date")
      schema = z.coerce
        .date()
        .transform(
          (d) => new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`),
        );
    else if (field.type === "select") schema = z.enum(field.options);
    else {
      schema = z
        .string()
        .trim()
        .max(field.type === "textarea" ? 4000 : 254);
      if (field.type === "email")
        schema = schema.email().transform((v) => v.toLowerCase());
      else if (field.type === "password") schema = schema.min(12).max(128);
      else if (field.pattern)
        schema = schema.regex(new RegExp(field.pattern), "Use YYYY-MM format.");
      else if (field.required)
        schema = schema.min(1, `${field.label} is required.`);
    }
    if (!field.required)
      schema = z.preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        schema.optional(),
      );
    if (field.default !== undefined) schema = schema.default(field.default);
    shape[field.key] = schema;
  }
  if (config.order) shape.lines = z.array(lineSchema).min(1).max(100);
  if (resource === "students")
    shape.guardianIds = z
      .array(z.coerce.number().int().positive())
      .max(10)
      .optional();
  return z
    .object(shape)
    .strict()
    .superRefine((data, ctx) => {
      if (data.fromDate && data.toDate && data.toDate < data.fromDate)
        ctx.addIssue({
          code: "custom",
          path: ["toDate"],
          message: "End date must be on or after start date.",
        });
      if (data.issueDate && data.dueDate && data.dueDate < data.issueDate)
        ctx.addIssue({
          code: "custom",
          path: ["dueDate"],
          message: "Due date must be on or after issue date.",
        });
      if (data.period && !/^(\d{4})-(0[1-9]|1[0-2])$/.test(data.period))
        ctx.addIssue({
          code: "custom",
          path: ["period"],
          message: "Enter a valid month as YYYY-MM.",
        });
    });
}
export const contactSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().email().max(254),
    subject: z.string().trim().min(2).max(150),
    message: z.string().trim().min(10).max(4000),
    website: z.string().max(200).optional().default(""),
  })
  .strict();
export const paymentSchema = z
  .object({
    amount: money.refine((v) => v > 0),
    method: z.enum(["Cash", "Bank transfer", "Card"]),
    paidAt: z.coerce.date().optional(),
  })
  .strict();
export const settingsSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
    currency: z.enum(["PKR", "USD", "EUR", "GBP", "AED"]),
    email: z.string().email().max(254),
    address: z.string().max(500),
    timezone: z
      .string()
      .max(100)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }, "Choose a valid IANA timezone."),
  })
  .strict();
