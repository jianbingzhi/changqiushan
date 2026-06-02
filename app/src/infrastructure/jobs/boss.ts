import { PgBoss } from "pg-boss";

const globalForBoss = globalThis as unknown as { __pgBoss?: PgBoss };

export function createBoss(): PgBoss {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  return new PgBoss(connectionString);
}

export function getBoss(): PgBoss | undefined {
  return globalForBoss.__pgBoss;
}

export function setBoss(boss: PgBoss): void {
  globalForBoss.__pgBoss = boss;
}
