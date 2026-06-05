import { describe, it, expect } from "vitest";
import type { BookingSlot, BookingChannel } from "@prisma/client";
import {
  assertDualElements,
  canBook,
  isCircuitBroken,
  canResume,
  canCancel,
} from "./rules";

// 合法身份证(校验位正确,仅用于测试):11010519491231002X 末位 X
const VALID_ID = "11010519491231002X";
// 同号但末位改 1 → 校验位错
const BAD_ID = "110105194912310021";

function makeSlot(overrides: Partial<BookingSlot> = {}): BookingSlot {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: "上午场",
    date: new Date("2026-05-31"),
    startTime: "09:00",
    endTime: "11:00",
    capacity: 1000,
    miniProgramQuota: 0,
    onsiteQuota: 0,
    otaQuota: 0,
    adminQuota: 0,
    miniProgramBooked: 0,
    onsiteBooked: 0,
    otaBooked: 0,
    adminBooked: 0,
    bookedCount: 0,
    checkedInCount: 0,
    status: "ACTIVE",
    remark: null,
    createdAt: new Date("2026-05-01T00:00:00+08:00"),
    updatedAt: new Date("2026-05-01T00:00:00+08:00"),
    ...overrides,
  };
}

describe("assertDualElements — 双要素强校验(红线 #2)", () => {
  it("身份证校验位合法 + 合法车牌 → 通过", () => {
    expect(assertDualElements(VALID_ID, "川A12345", false).ok).toBe(true);
  });

  it("身份证校验位非法 → 拒收", () => {
    const r = assertDualElements(BAD_ID, "川A12345", false);
    expect(r.ok).toBe(false);
  });

  it("新能源车牌(D/F 开头 6 位)合法 → 通过", () => {
    expect(assertDualElements(VALID_ID, "川AD12345", false).ok).toBe(true);
    expect(assertDualElements(VALID_ID, "川AF12345", false).ok).toBe(true);
  });

  it("车牌格式非法 → 拒收", () => {
    expect(assertDualElements(VALID_ID, "ABC", false).ok).toBe(false);
  });

  // plate XOR noVehicleDeclared 四象限
  it("四象限:仅车牌(无声明)→ 通过", () => {
    expect(assertDualElements(VALID_ID, "川A12345", false).ok).toBe(true);
  });

  it("四象限:仅声明无车(无车牌)→ 通过", () => {
    expect(assertDualElements(VALID_ID, undefined, true).ok).toBe(true);
    expect(assertDualElements(VALID_ID, "", true).ok).toBe(true);
  });

  it("四象限:既无车牌也无声明 → 拒收", () => {
    const r = assertDualElements(VALID_ID, undefined, false);
    expect(r.ok).toBe(false);
  });

  it("四象限:车牌与无车声明并存 → 拒收", () => {
    const r = assertDualElements(VALID_ID, "川A12345", true);
    expect(r.ok).toBe(false);
  });
});

describe("isCircuitBroken — 90% 承载力熔断(红线 #4)", () => {
  it("89% 不熔断", () => {
    expect(isCircuitBroken(89, 100)).toBe(false);
  });

  it("恰 90% 熔断(>= 边界)", () => {
    expect(isCircuitBroken(90, 100)).toBe(true);
  });

  it("91% 熔断", () => {
    expect(isCircuitBroken(91, 100)).toBe(true);
  });

  it("capacity=0 防除零 → 不熔断", () => {
    expect(isCircuitBroken(0, 0)).toBe(false);
    expect(isCircuitBroken(50, 0)).toBe(false);
  });
});

describe("canResume — 迟滞带(80% 恢复,80–90% 不抖动)", () => {
  it(">=90% 已断 且 不恢复", () => {
    expect(isCircuitBroken(90, 100)).toBe(true);
    expect(canResume(90, 100)).toBe(false);
  });

  it("85%(迟滞带内)既未达恢复阈值,也仍在熔断区上方 → 不抖动", () => {
    // 85% 时:isCircuitBroken=false(已低于90),但 canResume 也=false(未低于80)
    expect(isCircuitBroken(85, 100)).toBe(false);
    expect(canResume(85, 100)).toBe(false);
  });

  it("恰 80% 不恢复(< 边界)", () => {
    expect(canResume(80, 100)).toBe(false);
  });

  it("79% 恢复", () => {
    expect(canResume(79, 100)).toBe(true);
  });

  it("capacity<=0 → 恒可恢复(防卡死)", () => {
    expect(canResume(0, 0)).toBe(true);
    expect(canResume(100, -1)).toBe(true);
  });
});

describe("canBook — 渠道配额 off-by-one + 时段状态", () => {
  const channel: BookingChannel = "MINI_PROGRAM";

  it("差一额(booked=q-1)→ 可订", () => {
    const slot = makeSlot({ miniProgramQuota: 10, miniProgramBooked: 9 });
    expect(canBook(slot, channel)).toBe(true);
  });

  it("满额(booked=q)→ 不可订", () => {
    const slot = makeSlot({ miniProgramQuota: 10, miniProgramBooked: 10 });
    expect(canBook(slot, channel)).toBe(false);
  });

  it("超额(booked>q)→ 不可订", () => {
    const slot = makeSlot({ miniProgramQuota: 10, miniProgramBooked: 11 });
    expect(canBook(slot, channel)).toBe(false);
  });

  it("配额为 0 → 不可订", () => {
    const slot = makeSlot({ miniProgramQuota: 0, miniProgramBooked: 0 });
    expect(canBook(slot, channel)).toBe(false);
  });

  it("非 ACTIVE 时段(PAUSED/CLOSED)→ 拒绝", () => {
    expect(canBook(makeSlot({ miniProgramQuota: 10, status: "PAUSED" }), channel)).toBe(false);
    expect(canBook(makeSlot({ miniProgramQuota: 10, status: "CLOSED" }), channel)).toBe(false);
  });

  it("各渠道配额相互独立", () => {
    const slot = makeSlot({ otaQuota: 5, otaBooked: 5, adminQuota: 5, adminBooked: 0 });
    expect(canBook(slot, "OTA")).toBe(false);
    expect(canBook(slot, "ADMIN_MANUAL")).toBe(true);
  });
});

describe("canCancel — 距开场 2 小时阈值(+08:00 硬编码钉死)", () => {
  const slot = makeSlot({ date: new Date("2026-05-31"), startTime: "09:00" });
  // 开场 = 2026-05-31 09:00:00 +08:00 = 2026-05-31T01:00:00Z

  it("距开场 > 2 小时 → 可取消", () => {
    const now = new Date("2026-05-30T22:00:00Z"); // 北京 06:00,距开场 3h
    expect(canCancel(slot, now)).toBe(true);
  });

  it("距开场恰 2 小时 → 不可取消(非严格大于)", () => {
    const now = new Date("2026-05-30T23:00:00Z"); // 北京 07:00,距开场 2h
    expect(canCancel(slot, now)).toBe(false);
  });

  it("距开场 < 2 小时 → 不可取消", () => {
    const now = new Date("2026-05-31T00:30:00Z"); // 北京 08:30,距开场 0.5h
    expect(canCancel(slot, now)).toBe(false);
  });

  it("已过开场 → 不可取消", () => {
    const now = new Date("2026-05-31T02:00:00Z"); // 北京 10:00,已开场
    expect(canCancel(slot, now)).toBe(false);
  });

  it("跨时区:用 UTC 客户端 now 也按北京开场判定(+08:00 钉死语义)", () => {
    // 距开场 2h01m → 可取消;若漏了 +08:00 会算成 UTC 开场而误判
    const now = new Date("2026-05-30T22:59:00Z");
    expect(canCancel(slot, now)).toBe(true);
  });
});
