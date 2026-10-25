import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { rateLimit } from "express-rate-limit";
import { z } from "zod";
import { deploymentOrigins } from "../../../shared/database-config.js";
import { DatabaseRateLimitStore } from "./rate-limit-store.js";

export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export const asyncRoute = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const idSchema = z.coerce.number().int().positive();
export const publicUser = ({ id, name, email, role, active, createdAt }) => ({
  id,
  name,
  email,
  role,
  active,
  createdAt,
});
export const tokenHash = (token) =>
  createHash("sha256").update(token).digest("hex");
export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password, hash) {
  const [salt, key] = hash.split(":");
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(key || "", "hex");
  return expected.length === actual.length && timingSafeEqual(actual, expected);
}
export const cookies = (req) =>
  Object.fromEntries(
    (req.headers.cookie || "")
      .split(";")
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return [part.slice(0, index).trim(), part.slice(index + 1)];
      }),
  );
export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 1000 * 60 * 60 * 12,
  };
}
export const limiter = (limit, windowMs = 60000, db, namespace = "api") =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    ...(db &&
    (process.env.NODE_ENV === "production" ||
      process.env.RATE_LIMIT_STORE === "database")
      ? { store: new DatabaseRateLimitStore(db, namespace) }
      : {}),
    message: {
      error: "Too many requests. Please wait a moment and try again.",
    },
  });
export const requireAuth = (req, _res, next) =>
  req.user ? next() : next(new HttpError(401, "Please sign in to continue."));
export const requireRoles =
  (...roles) =>
  (req, _res, next) =>
    !req.user
      ? next(new HttpError(401, "Please sign in to continue."))
      : roles.includes(req.user.role)
        ? next()
        : next(
            new HttpError(
              403,
              "Your role does not have permission for this action.",
            ),
          );
export function canAccess(user, resource, write = false) {
  if (!user) return false;
  if (["users", "inbox", "settings", "audit"].includes(resource))
    return user.role === "ADMIN";
  if (user.role === "EMPLOYEE")
    return (
      !write &&
      [
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
      ].includes(resource)
    );
  return ["ADMIN", "MANAGER"].includes(user.role);
}
export function assertAccess(user, resource, write = false) {
  if (!canAccess(user, resource, write))
    throw new HttpError(
      user ? 403 : 401,
      user
        ? "Your role does not have permission for this action."
        : "Please sign in to continue.",
    );
}
export function sessionMiddleware(db) {
  return asyncRoute(async (req, _res, next) => {
    const token = cookies(req).meridian_session;
    if (token && /^[a-f0-9]{64}$/.test(token)) {
      const session = await db.session.findUnique({
        where: { id: tokenHash(token) },
        include: { user: true },
      });
      if (session && session.expiresAt > new Date() && session.user.active) {
        req.user = publicUser(session.user);
        req.sessionId = session.id;
      }
    }
    next();
  });
}
export function sameOrigin(req, _res, next) {
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    const expected = deploymentOrigins();
    if (
      req.get("x-requested-with") !== "Meridian" ||
      (origin && !expected.has(origin))
    )
      return next(
        new HttpError(
          403,
          "This request did not come from your workspace. Refresh and try again.",
        ),
      );
  }
  next();
}
export function registerAuth(app, db) {
  app.post(
    "/api/auth/login",
    limiter(12, 15 * 60000, db, "login"),
    asyncRoute(async (req, res) => {
      const data = z
        .object({
          email: z
            .string()
            .email()
            .max(254)
            .transform((v) => v.toLowerCase()),
          password: z.string().min(1).max(256),
        })
        .strict()
        .parse(req.body);
      const user = await db.user.findUnique({ where: { email: data.email } });
      const dummy = "00000000000000000000000000000000:" + "00".repeat(64);
      const valid = verifyPassword(data.password, user?.passwordHash || dummy);
      if (!user?.active || !valid)
        throw new HttpError(401, "Email or password is incorrect.");
      const token = randomBytes(32).toString("hex");
      await db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await db.session.create({
        data: {
          id: tokenHash(token),
          userId: user.id,
          expiresAt: new Date(Date.now() + 12 * 3600000),
        },
      });
      res
        .cookie("meridian_session", token, cookieOptions())
        .json({ user: publicUser(user) });
    }),
  );
  app.get("/api/auth/me", (req, res) => res.json({ user: req.user || null }));
  app.post(
    "/api/auth/logout",
    asyncRoute(async (req, res) => {
      if (req.sessionId)
        await db.session.deleteMany({ where: { id: req.sessionId } });
      const { maxAge: _maxAge, ...clearOptions } = cookieOptions();
      res.clearCookie("meridian_session", clearOptions).json({ ok: true });
    }),
  );
}
