import { systemRepository } from "../repository";
import { resolveInstantCapacity } from "@/shared/lib/capacity";

// 运营配置读取层。进程内缓存 TTL 60s,避免热路径反复打库;setConfig 立即失效对应键。
// 跨模块所需配置由 app 路由层经此读出后以参数注入(模块间不互相 import,守 eslint-boundaries)。

const TTL_MS = 60_000;

type CacheEntry = { value: string | null; expires: number };
const cache = new Map<string, CacheEntry>();

async function readRaw(key: string): Promise<string | null> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const row = await systemRepository.findConfig(key);
  cache.set(key, { value: row?.value ?? null, expires: Date.now() + TTL_MS });
  return row?.value ?? null;
}

export const configService = {
  /** 原始字符串值;不存在返回 null。 */
  getRaw(key: string): Promise<string | null> {
    return readRaw(key);
  },

  async getInt(key: string, fallback: number): Promise<number> {
    const raw = await readRaw(key);
    const v = Number(raw);
    // 契约保证整数:库里存了 "14.5" 也截断,免下游误用小数。
    return raw != null && Number.isFinite(v) ? Math.trunc(v) : fallback;
  },

  async getFloat(key: string, fallback: number): Promise<number> {
    const raw = await readRaw(key);
    const v = Number(raw);
    return raw != null && Number.isFinite(v) ? v : fallback;
  },

  /** 瞬时承载量:配置(park.instant_capacity)→ env → 默认值 兜底。 */
  async getInstantCapacity(): Promise<number> {
    return resolveInstantCapacity(await readRaw("park.instant_capacity"));
  },

  /** B31 防黄牛三阈值。app 路由层读出后注入 booking.createBooking(守 eslint-boundaries)。
   *  total_stock / per_phone 默认 0=不限;per_idcard 默认 1。 */
  async getBookingLimits(): Promise<{ dailyTotalStock: number; perIdCard: number; perPhone: number }> {
    const [dailyTotalStock, perIdCard, perPhone] = await Promise.all([
      this.getInt("booking.daily_total_stock", 0),
      this.getInt("booking.daily_limit_per_idcard", 1),
      this.getInt("booking.daily_limit_per_phone", 0),
    ]);
    return { dailyTotalStock, perIdCard, perPhone };
  },

  listAll() {
    return systemRepository.findAllConfig();
  },

  // 注:cache.delete 仅清本进程缓存;多实例(Vercel 多函数实例/docker 扩容)下其他实例
  // 最多沿用旧值至 TTL(60s)过期 —— 进程内 TTL 缓存的既定取舍,非强一致。
  async setConfig(input: { key: string; value: string; valueType?: string; label?: string }) {
    const row = await systemRepository.upsertConfig({
      key: input.key,
      value: input.value,
      valueType: input.valueType ?? "string",
      label: input.label ?? input.key,
    });
    cache.delete(input.key);
    return row;
  },
};
