import { createHmac, timingSafeEqual } from "crypto";
import type { Booking, BookingSlot } from "@prisma/client";

export const QR_PREFIX = "bk-";

// ── 动态核销码(TOTP / RFC6238 风格)──────────────────────────────────
// 展示码 = HMAC(qrSecret, floor(now/30)) 截断为 6 位;校验落当前窗 ±1 步容时钟漂移
export const OTP_STEP_SECONDS = 30;
const OTP_DIGITS = 6;

/** 由 qrSecret 派生当前(或偏移 step 步)的滚动核销码 */
export function rotatingCode(qrSecret: string, nowMs: number, step = 0): string {
  const counter = Math.floor(nowMs / 1000 / OTP_STEP_SECONDS) + step;
  const mac = createHmac("sha256", qrSecret).update(String(counter)).digest();
  // 动态截断(RFC4226)取 4 字节 → 6 位十进制
  const offset = mac[mac.length - 1] & 0x0f;
  const bin =
    ((mac[offset] & 0x7f) << 24) |
    ((mac[offset + 1] & 0xff) << 16) |
    ((mac[offset + 2] & 0xff) << 8) |
    (mac[offset + 3] & 0xff);
  return (bin % 10 ** OTP_DIGITS).toString().padStart(OTP_DIGITS, "0");
}

/** 闸机侧校验 OTP:当前窗 ±1 步,timingSafeEqual 防侧信道 */
export function verifyRotatingCode(qrSecret: string, otp: string, nowMs: number): boolean {
  if (!/^\d{6}$/.test(otp)) return false;
  const provided = Buffer.from(otp);
  for (const step of [-1, 0, 1]) {
    const expect = Buffer.from(rotatingCode(qrSecret, nowMs, step));
    if (expect.length === provided.length && timingSafeEqual(expect, provided)) return true;
  }
  return false;
}

/** 剩余有效秒数(供 C 端展示倒计时) */
export function otpSecondsRemaining(nowMs: number): number {
  return OTP_STEP_SECONDS - (Math.floor(nowMs / 1000) % OTP_STEP_SECONDS);
}

export function isCurrentSlotValid(booking: Booking, slot: BookingSlot, now: Date): boolean {
  if (booking.status !== "CONFIRMED") return false;
  const dateStr = slot.date.toISOString().slice(0, 10);
  const start = new Date(`${dateStr}T${slot.startTime}:00+08:00`);
  const end   = new Date(`${dateStr}T${slot.endTime}:00+08:00`);
  return now >= start && now <= end;
}
