import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
export function demoDatabaseUrl() {
  const path = (process.env.DEMO_DATABASE_URL || "file:./demo.db").replace(
    /^file:/,
    "",
  );
  return `file:${(isAbsolute(path) ? path : resolve(fileURLToPath(new URL("../prisma/", import.meta.url)), path)).replaceAll("\\", "/")}`;
}
