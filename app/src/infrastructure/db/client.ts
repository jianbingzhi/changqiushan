import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Prisma 7:必须通过 driver adapter 注入数据库连接
// Next.js dev HMR 会重复加载模块,用 globalThis 单例避免连接泄漏
const globalForPrisma = globalThis as unknown as { __prismaClient?: PrismaClient };

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });
}

export const db = globalForPrisma.__prismaClient ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.__prismaClient = db;
