import { describe, it, expect } from "vitest";

import { resolveFetchedAt, ROAD_CACHE_SECONDS } from "./index";

// round-01 N07 防回归:「最后更新」必须是上游取数时刻,不能是本次渲染时刻。
// 路况 fetch 走 Next Data Cache(60s 再验证),命中缓存时函数体仍会重跑 —— 若在此处取
// `new Date()`,时间戳就恒等于当前时刻,把最旧 60 秒的数据说成刚取的。
describe("resolveFetchedAt", () => {
  const now = new Date("2026-07-28T10:44:00Z");

  it("有合法响应头 Date 时取上游时刻,而非当前时刻", () => {
    expect(resolveFetchedAt("Tue, 28 Jul 2026 10:43:05 GMT", now)).toBe("2026-07-28T10:43:05.000Z");
  });

  it("同一份缓存响应重复渲染,时间戳保持不变", () => {
    const header = "Tue, 28 Jul 2026 10:43:05 GMT";
    const first = resolveFetchedAt(header, new Date("2026-07-28T10:43:10Z"));
    const later = resolveFetchedAt(header, new Date("2026-07-28T10:44:00Z"));
    expect(later).toBe(first);
  });

  it("响应头缺失时回落当前时刻(退化为旧口径,不编造)", () => {
    expect(resolveFetchedAt(null, now)).toBe(now.toISOString());
    expect(resolveFetchedAt(undefined, now)).toBe(now.toISOString());
  });

  it("响应头不可解析时同样回落当前时刻", () => {
    expect(resolveFetchedAt("not-a-date", now)).toBe(now.toISOString());
  });

  it("缓存窗口常量与 UI 文案口径(约 1 分钟)一致", () => {
    expect(ROAD_CACHE_SECONDS).toBe(60);
  });
});
