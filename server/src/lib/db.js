import "./config.js";
import { demoDatabaseUrl } from "../../../shared/database-url.js";
import { databaseMode } from "../../../shared/database-config.js";

export const activeDatabaseMode = databaseMode();
export const demoDatabase = activeDatabaseMode === "demo";
const { PrismaClient, Prisma } =
  activeDatabaseMode === "postgres"
    ? await import("../../../generated/postgres-client/index.js")
    : demoDatabase
      ? await import("../../../generated/demo-client/index.js")
      : await import("@prisma/client");
export { Prisma };
export function createDatabase() {
  return new PrismaClient({
    datasources: {
      db: { url: demoDatabase ? demoDatabaseUrl() : process.env.DATABASE_URL },
    },
    transactionOptions: {
      maxWait: 10000,
      timeout: 20000,
      isolationLevel: "Serializable",
    },
  });
}
export const prisma = createDatabase();
