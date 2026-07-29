import { describe, expect, it } from "vitest";
import {
  formatWeatherHeader,
  formatWeatherTile,
  weatherFallbackText,
  type WeatherLive,
  type WeatherResult,
} from "./weather";

function live(patch: Partial<WeatherLive> = {}): WeatherLive {
  return {
    city: "蒲江县",
    weather: "阴",
    temperature: 12,
    windDirection: "东北",
    windPower: "≤3",
    humidity: 60,
    reportTime: "2026-07-29 10:00:00",
    ...patch,
  };
}
const ok = (patch: Partial<WeatherLive> = {}): WeatherResult => ({ source: "amap", live: live(patch) });
const unconfigured: WeatherResult = { source: "unconfigured", live: null };
const errored: WeatherResult = { source: "error", live: null };

describe("天气展示口径(N08 收口)", () => {
  it("test_weather_text_no_ascii_letters:三态输出串均无孤立英文(红线 6),且 AQI 不复活", () => {
    const results: WeatherResult[] = [ok(), unconfigured, errored];
    for (const r of results) {
      const tile = formatWeatherTile(r);
      const texts = [
        formatWeatherHeader(r),
        weatherFallbackText(r),
        tile.value,
        tile.unit,
        tile.sub,
      ].filter((t): t is string => typeof t === "string");
      for (const t of texts) expect(t).not.toMatch(/[A-Za-z]/);
    }
  });

  it("test_weather_zero_degree_not_swallowed:0℃ 不被 falsy 吞掉", () => {
    const r = ok({ temperature: 0 });
    expect(formatWeatherHeader(r)).toContain("0℃");
    expect(formatWeatherTile(r).value).toBe("0");
  });

  it("test_weather_negative_and_zero_humidity:负温与 0 湿度均如实呈现", () => {
    expect(formatWeatherHeader(ok({ temperature: -3 }))).toContain("-3℃");
    const zeroHumidity = ok({ humidity: 0 });
    expect(formatWeatherHeader(zeroHumidity)).toContain("湿度 0%");
    expect(formatWeatherTile(zeroHumidity).sub).toContain("湿度 0%");
  });

  it("test_weather_tile_value_unit_separated:KpiTile 的 value 与 unit 必须分离", () => {
    const t = formatWeatherTile(ok());
    expect(t.value).not.toContain("℃");
    expect(t.unit).toBe("℃");

    const down = formatWeatherTile(errored);
    expect(down.value).toBe("—");
    expect(down.unit).toBeUndefined();
  });

  it("test_weather_three_states_distinct:未配置与服务异常文案不同,且不渲染 undefined/NaN", () => {
    expect(weatherFallbackText(unconfigured)).not.toBe(weatherFallbackText(errored));

    // catch 分支可造出 source=amap 但 live=null,必须走不可用态
    const halfBaked: WeatherResult = { source: "amap", live: null };
    expect(formatWeatherHeader(halfBaked)).toBeNull();
    const tile = formatWeatherTile(halfBaked);
    expect(tile.value).toBe("—");
    expect(tile.unit).toBeUndefined();

    // 数值字段异常同样不得漏出到界面
    const nanTemp: WeatherResult = { source: "amap", live: live({ temperature: Number.NaN }) };
    expect(formatWeatherHeader(nanTemp)).toBeNull();
    expect(formatWeatherTile(nanTemp).value).toBe("—");

    for (const r of [halfBaked, nanTemp, unconfigured, errored]) {
      const t = formatWeatherTile(r);
      for (const text of [formatWeatherHeader(r), t.value, t.sub, weatherFallbackText(r)]) {
        if (typeof text !== "string") continue;
        expect(text).not.toContain("undefined");
        expect(text).not.toContain("NaN");
      }
    }
  });

  it("test_weather_city_fallback:城市名缺失回落蒲江县", () => {
    const r = ok({ city: "" });
    expect(formatWeatherHeader(r)).toContain("蒲江县");
    expect(formatWeatherTile(r).sub).toContain("蒲江县");
  });

  it("test_weather_header_and_tile_same_source:两屏同一入参派生,温度呈现一致(N08 回归护栏)", () => {
    for (const temperature of [-3, 0, 12, 38]) {
      const r = ok({ temperature });
      const header = formatWeatherHeader(r);
      const tile = formatWeatherTile(r);
      expect(header).not.toBeNull();
      expect(header).toContain(`${tile.value}${tile.unit}`);
    }
  });
});
