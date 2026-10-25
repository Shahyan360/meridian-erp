import "./lib/config.js";
import { prisma } from "./lib/db.js";
import { seed } from "./seed.js";
import { createApp } from "./app.js";
import { registerChat } from "./chat.js";
import { assertCloudConfiguration } from "../../shared/database-config.js";

assertCloudConfiguration();
await prisma.$connect();
await seed(prisma);
const port = Number(process.env.PORT || 4000);
const app = createApp(prisma, { registerChat });
const server = app.listen(port, () =>
  process.stdout.write(`Meridian is ready at http://localhost:${port}\n`),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    }),
  );
