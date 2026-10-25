import { createHash } from "node:crypto";
export class DatabaseRateLimitStore {
  localKeys = false;
  constructor(db, prefix) {
    this.db = db;
    this.prefix = prefix;
  }
  init({ windowMs }) {
    this.windowMs = windowMs;
  }
  key(client) {
    return `${this.prefix}:${createHash("sha256").update(client).digest("hex")}`;
  }
  async increment(client) {
    const id = this.key(client),
      now = new Date();
    await this.db.rateLimitBucket.deleteMany({
      where: { id, resetAt: { lte: now } },
    });
    const row = await this.db.rateLimitBucket.upsert({
      where: { id },
      create: {
        id,
        count: 1,
        resetAt: new Date(now.getTime() + this.windowMs),
      },
      update: { count: { increment: 1 } },
    });
    return { totalHits: row.count, resetTime: row.resetAt };
  }
  async decrement(client) {
    await this.db.rateLimitBucket.updateMany({
      where: { id: this.key(client), count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });
  }
  async resetKey(client) {
    await this.db.rateLimitBucket.deleteMany({
      where: { id: this.key(client) },
    });
  }
}
