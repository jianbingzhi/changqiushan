import { describe, it, expect } from "vitest";
import { inferDayType } from "./quota-rule";

describe("inferDayType — 日期类型推断(B23 配额规则)", () => {
  it("工作日(周一)推断为 WEEKDAY", () => {
    // 2026-06-08 是周一
    expect(inferDayType("2026-06-08")).toBe("WEEKDAY");
  });

  it("周六/周日推断为 WEEKEND", () => {
    // 2026-06-06 周六、2026-06-07 周日
    expect(inferDayType("2026-06-06")).toBe("WEEKEND");
    expect(inferDayType("2026-06-07")).toBe("WEEKEND");
  });

  it("特例覆盖优先于星期推算(调休:周日上班=WEEKDAY)", () => {
    expect(inferDayType("2026-06-07", "WEEKDAY")).toBe("WEEKDAY");
  });

  it("特例可把工作日标为节假日", () => {
    expect(inferDayType("2026-06-08", "HOLIDAY")).toBe("HOLIDAY");
  });

  it("override 为 null/undefined 时回退星期推算", () => {
    expect(inferDayType("2026-06-08", null)).toBe("WEEKDAY");
    expect(inferDayType("2026-06-08", undefined)).toBe("WEEKDAY");
  });
});
