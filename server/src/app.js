import express from "express";
import helmet from "helmet";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { workspaceRoot } from "./lib/config.js";
import { demoEnabled } from "../../shared/database-config.js";
import { z } from "zod";
import { catalog } from "../../shared/catalog.js";
import {
  asyncRoute,
  HttpError,
  idSchema,
  limiter,
  registerAuth,
  requireAuth,
  requireRoles,
  sessionMiddleware,
  sameOrigin,
  assertAccess,
} from "./lib/security.js";
import { contactSchema, settingsSchema } from "./lib/validation.js";
import {
  mutate,
  transitionOrder,
  allocatePayment,
  orderInclude,
  decorate,
  audit,
} from "./lib/operations.js";
import {
  listRecords,
  getDashboard,
  getReport,
  journalInclude,
} from "./lib/queries.js";
import { exportResource, exportDocument } from "./lib/exports.js";
import { saveContact, deliverNotification } from "./lib/contact.js";

export function createApp(db, { registerChat } = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (process.env.VERCEL === "1") app.set("trust proxy", 1);
  else if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  else if (process.env.TRUST_PROXY === "loopback")
    app.set("trust proxy", "loopback");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          "script-src": ["'self'"],
          "style-src": ["'self'", "'unsafe-inline'"],
          "img-src": ["'self'", "data:", "blob:"],
          "connect-src": ["'self'"],
          "upgrade-insecure-requests":
            process.env.NODE_ENV === "production" ? [] : null,
        },
      },
    }),
  );
  app.use("/api", limiter(300, 60000, db, "api"));
  app.use(express.json({ limit: "64kb" }));
  app.use("/api", sameOrigin, sessionMiddleware(db));
  app.get(
    "/api/health",
    asyncRoute(async (_req, res) => {
      await db.$queryRaw`SELECT 1`;
      res.json({ ok: true, service: "meridian-api" });
    }),
  );
  app.get(
    "/api/config",
    asyncRoute(async (_req, res) => {
      const settings = await db.workspaceSetting.findUnique({
        where: { id: 1 },
      });
      res.json({
        demo: demoEnabled(),
        chatConfigured: Boolean(
          process.env.Gemini_API_KEY || process.env.GEMINI_API_KEY,
        ),
        workspace: settings?.name || "Meridian",
        currency: settings?.currency || "PKR",
      });
    }),
  );
  registerAuth(app, db);
  app.post(
    "/api/contact",
    limiter(5, 15 * 60000, db, "contact"),
    asyncRoute(async (req, res) => {
      const { website, ...data } = contactSchema.parse(req.body);
      if (website) return res.status(201).json({ ok: true });
      await saveContact(db, data);
      res.status(201).json({ ok: true });
    }),
  );
  if (registerChat) registerChat(app, db);
  app.use("/api", requireAuth);
  app.post(
    "/api/inbox/:id/notification",
    requireRoles("ADMIN"),
    limiter(10, 15 * 60000, db, "email-retry"),
    asyncRoute(async (req, res) => {
      const contact = await db.contactMessage.findUnique({
        where: { id: idSchema.parse(req.params.id) },
        include: { notification: true },
      });
      if (!contact?.notification)
        throw new HttpError(404, "No delivery record exists for this message.");
      res.json(await deliverNotification(db, contact.notification.id));
    }),
  );
  app.get(
    "/api/dashboard",
    asyncRoute(async (req, res) =>
      res.json(
        await getDashboard(
          db,
          req.user,
          z.coerce
            .number()
            .int()
            .min(3)
            .max(12)
            .default(6)
            .parse(req.query.months),
        ),
      ),
    ),
  );
  app.get(
    "/api/reports",
    requireRoles("ADMIN", "MANAGER"),
    asyncRoute(async (req, res) =>
      res.json(await getReport(db, req.user, req.query)),
    ),
  );
  app.get(
    "/api/settings",
    requireRoles("ADMIN"),
    asyncRoute(async (_req, res) =>
      res.json(await db.workspaceSetting.findUnique({ where: { id: 1 } })),
    ),
  );
  app.put(
    "/api/settings",
    requireRoles("ADMIN"),
    asyncRoute(async (req, res) => {
      const data = settingsSchema.parse(req.body);
      res.json(
        await db.$transaction(async (tx) => {
          const result = await tx.workspaceSetting.upsert({
            where: { id: 1 },
            create: { ...data, id: 1 },
            update: data,
          });
          await audit(tx, req.user, "Updated", "settings", 1);
          return result;
        }),
      );
    }),
  );
  app.get(
    "/api/export/:resource",
    asyncRoute((req, res) => exportResource(db, req, res)),
  );
  app.get(
    "/api/:resource/:id/document",
    asyncRoute(async (req, res) => {
      idSchema.parse(req.params.id);
      await exportDocument(db, req, res);
    }),
  );
  for (const resource of Object.keys(catalog)) {
    app.get(
      `/api/${resource}`,
      asyncRoute(async (req, res) =>
        res.json(await listRecords(db, req.user, resource, req.query)),
      ),
    );
    app.get(
      `/api/${resource}/:id`,
      asyncRoute(async (req, res) => {
        assertAccess(req.user, resource);
        const record = await db[catalog[resource].model].findUnique({
          where: { id: idSchema.parse(req.params.id) },
          ...(catalog[resource].order ? { include: orderInclude } : {}),
          ...(resource === "journal" ? { include: journalInclude } : {}),
          ...(resource === "inbox" ? { include: { notification: true } } : {}),
        });
        if (!record) throw new HttpError(404, "Record not found.");
        res.json(decorate(resource, record));
      }),
    );
    app.post(
      `/api/${resource}`,
      asyncRoute(async (req, res) =>
        res
          .status(201)
          .json(await mutate(db, req.user, resource, "create", req.body)),
      ),
    );
    app.put(
      `/api/${resource}/:id`,
      asyncRoute(async (req, res) =>
        res.json(
          await mutate(
            db,
            req.user,
            resource,
            "update",
            req.body,
            idSchema.parse(req.params.id),
          ),
        ),
      ),
    );
    app.delete(
      `/api/${resource}/:id`,
      asyncRoute(async (req, res) => {
        await mutate(
          db,
          req.user,
          resource,
          "delete",
          null,
          idSchema.parse(req.params.id),
        );
        res.status(204).end();
      }),
    );
  }
  for (const resource of ["sales", "purchases"]) {
    for (const action of ["post", "cancel"])
      app.post(
        `/api/${resource}/:id/${action}`,
        asyncRoute(async (req, res) =>
          res.json(
            await transitionOrder(
              db,
              req.user,
              resource,
              idSchema.parse(req.params.id),
              action,
            ),
          ),
        ),
      );
    app.post(
      `/api/${resource}/:id/payments`,
      asyncRoute(async (req, res) =>
        res
          .status(201)
          .json(
            await allocatePayment(
              db,
              req.user,
              resource,
              idSchema.parse(req.params.id),
              req.body,
            ),
          ),
      ),
    );
  }
  app.use("/api", (_req, _res, next) =>
    next(new HttpError(404, "This API route does not exist.")),
  );
  const dist = resolve(workspaceRoot, "client/dist");
  if (existsSync(dist)) {
    app.use(express.static(dist, { maxAge: "1h" }));
    app.get("*", (_req, res) => res.sendFile(resolve(dist, "index.html")));
  }
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return res.end();
    if (error instanceof z.ZodError)
      return res.status(400).json({
        error: "Please check the highlighted fields.",
        fields: Object.fromEntries(
          error.issues.map((i) => [i.path.join("."), i.message]),
        ),
      });
    const codes = {
      P2002: [409, "A record with these unique details already exists."],
      P2003: [
        409,
        "This record is linked to other records. Archive it or remove those links first.",
      ],
      P2025: [404, "This record no longer exists."],
      P2034: [409, "Another request changed this data. Refresh and try again."],
    };
    const known = codes[error.code];
    const status =
      known?.[0] ||
      error.status ||
      (error.type === "entity.too.large" ? 413 : 500);
    res.status(status).json({
      error:
        known?.[1] ||
        (error instanceof HttpError
          ? error.message
          : status === 413
            ? "This request is too large."
            : status === 400
              ? "Invalid request body."
              : "Something went wrong. Please try again."),
    });
  });
  return app;
}
