import { config } from "dotenv";
import { fileURLToPath } from "node:url";
export const workspaceRoot = fileURLToPath(
  new URL("../../../", import.meta.url),
);
config({ path: new URL("../../../.env", import.meta.url) });
