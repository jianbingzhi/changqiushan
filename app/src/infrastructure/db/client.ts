// 注意:不要在此 import "dotenv/config" —— Next 会把 dotenv(依赖 node path/fs)打进
// instrumentation 的 edge 编译导致全站 500。Next 运行时自动加载 .env;tsx 脚本各自在
// 入口 import "dotenv/config" 先于本模块求值,故运行时 process.env 均已就绪。
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
  // serverless(Vercel)多实例各开池 → 直连会爆连接数,须走 Supabase pooler(6543)+ 小池;
  // 本地常驻进程(docker)用默认池上限。可用 DB_POOL_MAX 覆盖。
  const max = Number(process.env.DB_POOL_MAX) || (process.env.VERCEL ? 1 : 10);
  const adapter = new PrismaPg({ connectionString, max });
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
