import { describe, it, expect } from "vitest";
import type { Booking, BookingSlot } from "@prisma/client";
import {
  rotatingCode,
  verifyRotatingCode,
  otpSecondsRemaining,
  isCurrentSlotValid,
  OTP_STEP_SECONDS,
} from "./rules";

const SECRET = "test-qr-secret-0123456789abcdef";
// 固定参照时刻(北京 2026-05-31 09:30,落在 09:00–11:00 时段内)
const NOW_MS = Date.parse("2026-05-31T01:30:00.000Z");

describe("rotatingCode / verifyRotatingCode — 30s 滚动核销码(±1 窗 + 防侧信道)", () => {
  it("生成 6 位纯数字码", () => {
    expect(rotatingCode(SECRET, NOW_MS)).toMatch(/^\d{6}$/);
  });

  it("当前窗码 → 校验通过", () => {
    const code = rotatingCode(SECRET, NOW_MS);
    expect(verifyRotatingCode(SECRET, code, NOW_MS)).toBe(true);
  });

  it("±1 窗容时钟漂移 → 校验通过", () => {
    const prev = rotatingCode(SECRET, NOW_MS, -1);
    const next = rotatingCode(SECRET, NOW_MS, +1);
    expect(verifyRotatingCode(SECRET, prev, NOW_MS)).toBe(true);
    expect(verifyRotatingCode(SECRET, next, NOW_MS)).toBe(true);
  });

  it("±2 窗(超出容差)→ 校验拒绝", () => {
    const far = rotatingCode(SECRET, NOW_MS, +2);
    // 极小概率与 ±1 窗碰撞;碰撞则换参照时刻。常态应拒绝。
    expect(verifyRotatingCode(SECRET, far, NOW_MS)).toBe(false);
  });

  it("错误密钥派生的码 → 校验拒绝", () => {
    const code = rotatingCode("another-secret", NOW_MS);
    expect(verifyRotatingCode(SECRET, code, NOW_MS)).toBe(false);
  });

  it("非 6 位数字格式 → 直接拒绝", () => {
    expect(verifyRotatingCode(SECRET, "12345", NOW_MS)).toBe(false);
    expect(verifyRotatingCode(SECRET, "abcdef", NOW_MS)).toBe(false);
    expect(verifyRotatingCode(SECRET, "1234567", NOW_MS)).toBe(false);
  });
});

describe("otpSecondsRemaining — 倒计时", () => {
  it("落在 [1, OTP_STEP_SECONDS] 区间", () => {
    const s = otpSecondsRemaining(NOW_MS);
    expect(s).toBeGreaterThanOrEqual(1);
    expect(s).toBeLessThanOrEqual(OTP_STEP_SECONDS);
  });

  it("整步起点剩余满步长", () => {
    const aligned = 1_700_000_010 * 1000; // 1700000010 可被 30 整除
    expect(otpSecondsRemaining(aligned)).toBe(OTP_STEP_SECONDS);
  });
});

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "b1",
    slotId: "s1",
    slotDate: new Date("2026-05-31"),
    visitorName: "张三",
    idCard: "11010519491231002X",
    phone: "13800000000",
    plate: "川A12345",
    noVehicleDeclared: false,
    channel: "MINI_PROGRAM",
    status: "CONFIRMED",
    qrCode: "bk-xxx",
    qrSecret: SECRET,
    checkedInAt: null,
    cancelledAt: null,
    noShowAt: null,
    metadata: null,
    createdAt: new Date("2026-05-01T00:00:00+08:00"),
    updatedAt: new Date("2026-05-01T00:00:00+08:00"),
    ...overrides,
  } as Booking;
}

function makeSlot(overrides: Partial<BookingSlot> = {}): BookingSlot {
  return {
    id: "s1",
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

describe("isCurrentSlotValid — 当前时段窗口校验(+08:00)", () => {
  const slot = makeSlot();

  it("时段内 + CONFIRMED → 有效", () => {
    const now = new Date("2026-05-31T01:30:00Z"); // 北京 09:30
    expect(isCurrentSlotValid(makeBooking(), slot, now)).toBe(true);
  });

  it("恰开场(09:00 北京)→ 有效(含端点)", () => {
    const now = new Date("2026-05-31T01:00:00Z");
    expect(isCurrentSlotValid(makeBooking(), slot, now)).toBe(true);
  });

  it("恰结束(11:00 北京)→ 有效(含端点)", () => {
    const now = new Date("2026-05-31T03:00:00Z");
    expect(isCurrentSlotValid(makeBooking(), slot, now)).toBe(true);
  });

  it("开场前 → 无效", () => {
    const now = new Date("2026-05-31T00:30:00Z"); // 北京 08:30
    expect(isCurrentSlotValid(makeBooking(), slot, now)).toBe(false);
  });

  it("结束后 → 无效", () => {
    const now = new Date("2026-05-31T03:30:00Z"); // 北京 11:30
    expect(isCurrentSlotValid(makeBooking(), slot, now)).toBe(false);
  });

  it("非 CONFIRMED 状态(已核销/取消)→ 无效", () => {
    const now = new Date("2026-05-31T01:30:00Z");
    expect(isCurrentSlotValid(makeBooking({ status: "CHECKED_IN" }), slot, now)).toBe(false);
    expect(isCurrentSlotValid(makeBooking({ status: "CANCELLED" }), slot, now)).toBe(false);
  });
});
