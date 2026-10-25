import { copyFile, unlink } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
const file = resolve(`prisma/e2e-${randomUUID()}.db`);
await copyFile(resolve("prisma/demo.db"), file);
process.env.DATABASE_MODE = "demo";
process.env.DEMO_DATABASE_URL = `file:${file.replaceAll("\\", "/")}`;
process.env.PORT = "4100";
process.env.NODE_ENV = "test";
process.env.CONTACT_NOTIFICATION_EMAIL = "";
process.env.SMTP_PASS = "";
process.env.RESEND_API_KEY = "";
process.env.RATE_LIMIT_STORE = "memory";
process.env.APP_ORIGIN = "http://127.0.0.1:4100";
const { prisma } = await import("../server/src/lib/db.js");
const { createApp } = await import("../server/src/app.js");
const { registerChat } = await import("../server/src/chat.js");
const app = createApp(prisma, {
  registerChat: (app, db) => registerChat(app, db, { configured: () => false }),
});
const server = app.listen(4100, "127.0.0.1", () =>
  process.stdout.write("Browser test workspace ready.\n"),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await prisma.$disconnect();
      await unlink(file).catch(() => {});
      process.exit(0);
    }),
  );
