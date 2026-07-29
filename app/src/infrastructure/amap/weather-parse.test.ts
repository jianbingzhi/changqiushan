import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchWeather } from "./index";
import { formatWeatherHeader, formatWeatherTile } from "@/shared/lib/weather";

// b-105 · N08 防回归:高德字段缺失/空串**绝不可**回落成 0。
// `Number("")` 是 0 —— 上游漏传气温时若用 `?? 0` 兜底,七月的挂墙大屏会理直气壮显示
// 「0℃」,与真实读数不可区分,比诚实显示「—」更糟。约定:缺值一律 NaN,由展示层降级。

const OK_HEADERS = { infocode: "10000", status: "1" };

function stubFetch(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok, json: async () => body })),
  );
}

describe("fetchWeather 字段解析", () => {
  beforeEach(() => {
    vi.stubEnv("AMAP_KEY", "test-key");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("气温为空串时降级为不可用,不得渲染 0℃", async () => {
    stubFetch({
      ...OK_HEADERS,
      lives: [{ city: "蒲江县", weather: "阴", temperature: "", humidity: "60", reporttime: "" }],
    });
    const r = await fetchWeather();
    expect(Number.isNaN(r.live?.temperature)).toBe(true);
    expect(formatWeatherHeader(r)).toBeNull();
    expect(formatWeatherTile(r).value).toBe("—");
  });

  it("气温字段整个缺失时同样降级,不得渲染 0℃", async () => {
    stubFetch({ ...OK_HEADERS, lives: [{ city: "蒲江县", weather: "多云", humidity: "55" }] });
    const r = await fetchWeather();
    expect(formatWeatherTile(r).value).toBe("—");
  });

  it("湿度为空串时只丢湿度那一段,天气本身仍照常展示", async () => {
    stubFetch({
      ...OK_HEADERS,
      lives: [{ city: "蒲江县", weather: "晴", temperature: "31", humidity: "" }],
    });
    const r = await fetchWeather();
    const header = formatWeatherHeader(r);
    expect(header).toContain("31℃");
    expect(header).not.toContain("湿度");
    expect(header).not.toContain("NaN");
  });

  it("合法读数照常透传,含 0℃ 与负温不被吞", async () => {
    for (const temperature of ["0", "-3", "31"]) {
      stubFetch({
        ...OK_HEADERS,
        lives: [{ city: "蒲江县", weather: "阴", temperature, humidity: "0" }],
      });
      const r = await fetchWeather();
      expect(r.source).toBe("amap");
      expect(formatWeatherTile(r).value).toBe(temperature);
      expect(formatWeatherHeader(r)).toContain(`${temperature}℃`);
      expect(formatWeatherHeader(r)).toContain("湿度 0%");
    }
  });

  it("未配置 AMAP_KEY 时三态之 unconfigured,且不发请求", async () => {
    vi.stubEnv("AMAP_KEY", "");
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    const r = await fetchWeather();
    expect(r.source).toBe("unconfigured");
    expect(spy).not.toHaveBeenCalled();
  });
});
