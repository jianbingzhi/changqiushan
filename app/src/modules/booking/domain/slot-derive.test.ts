import { describe, it, expect } from "vitest";
import type { SysSlotTemplate } from "@prisma/client";
import { deriveSlots, deriveSlotId } from "./slot-derive";

function tpl(over: Partial<SysSlotTemplate> & Pick<SysSlotTemplate, "dayType" | "startTime">): SysSlotTemplate {
  return {
    id: "t-" + over.startTime,
    name: "测试场",
    endTime: "10:30",
    miniProgramQuota: 100,
    onsiteQuota: 50,
    otaQuota: 30,
    adminQuota: 20,
    enabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as SysSlotTemplate;
}

const WEEKDAY = tpl({ dayType: "WEEKDAY", startTime: "09:00" });
const WEEKEND = tpl({ dayType: "WEEKEND", startTime: "10:30" });

describe("deriveSlotId", () => {
  it("同 (日期,开始时间) 恒得同一确定性 id", () => {
    expect(deriveSlotId("2026-06-10", "09:00")).toBe(deriveSlotId("2026-06-10", "09:00"));
  });
  it("不同入参得到不同 id,且为合法 UUIDv5", () => {
    const a = deriveSlotId("2026-06-10", "09:00");
    const b = deriveSlotId("2026-06-10", "10:30");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe("deriveSlots", () => {
  it("闭园特例 → 空数组", () => {
    expect(deriveSlots("2026-06-10", [WEEKDAY], { dayType: null, closed: true })).toEqual([]);
  });

  it("工作日(2026-06-10 周三)只选 WEEKDAY 模板", () => {
    const slots = deriveSlots("2026-06-10", [WEEKDAY, WEEKEND]);
    expect(slots).toHaveLength(1);
    expect(slots[0].startTime).toBe("09:00");
    expect(slots[0].capacity).toBe(200);
    expect(slots[0].materialized).toBe(false);
    expect(slots[0].bookedCount).toBe(0);
    expect(slots[0].id).toBe(deriveSlotId("2026-06-10", "09:00"));
  });

  it("特例覆盖 dayType=WEEKEND 时改选周末模板", () => {
    const slots = deriveSlots("2026-06-10", [WEEKDAY, WEEKEND], { dayType: "WEEKEND", closed: false });
    expect(slots).toHaveLength(1);
    expect(slots[0].startTime).toBe("10:30");
  });

  it("结果按开始时间升序", () => {
    const t1 = tpl({ dayType: "WEEKDAY", startTime: "14:00" });
    const t2 = tpl({ dayType: "WEEKDAY", startTime: "09:00" });
    const slots = deriveSlots("2026-06-10", [t1, t2]);
    expect(slots.map((s) => s.startTime)).toEqual(["09:00", "14:00"]);
  });
});
