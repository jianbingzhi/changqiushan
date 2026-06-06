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
    return raw != null && Number.isFinite(v) ? v : fallback;
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

  listAll() {
    return systemRepository.findAllConfig();
  },

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
