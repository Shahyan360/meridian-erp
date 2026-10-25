import "../server/src/lib/config.js";
import { prisma } from "../server/src/lib/db.js";
import { createApp } from "../server/src/app.js";
import { registerChat } from "../server/src/chat.js";
import { assertCloudConfiguration } from "../shared/database-config.js";

assertCloudConfiguration();
// One Prisma client per warm function instance. Persistent data lives in the hosted database.
export default createApp(prisma, { registerChat });
