# 子计划 03 · 动态核销码 30 秒刷新（checkin 改造）

> 上游：[`c-miniprogram.md`](./c-miniprogram.md)。红线关键，属预约闭环 S1。

## Task Type
- [x] Backend（checkin/gate）  - [x] Frontend（A5 核销码 UX）

## 现状 → 目标
现状：`Booking.qrCode` 为建单时静态 hex，闸机 `findUnique({where:{qrCode}})` —— 可截图转发，违反"30s 刷新防截图"红线。
目标：**展示码与核销主键解耦**。DB `qrCode` 退居稳定核销主键（不下发），小程序展示**由 `qrSecret` 派生、每 30s 滚动的 TOTP**；闸机验 OTP→定位 bookingId→**幂等 checkin 事务原样保留**。

## 方案：TOTP（RFC6238 风格）
- 每单一个 `qrSecret`（建单生成，存 DB，永不下发）。
- 展示码 `otp = HMAC(qrSecret, floor(now/30))` 截断短串；闸机校验落 **当前窗 ±1 步**（容时钟漂移/网络延迟）。
- 弱网友好：小程序本地可算/可拉，离线降级显示文本码人工核销。

## Key Files
| File | Operation | Description |
|---|---|---|
| `app/prisma/models/booking.prisma` | Modify | `Booking` 加 `qrSecret String @map("qr_secret")`；可选 `publicRef String @unique`（不可枚举闸机定位） |
| `app/src/modules/booking/repository.ts` | Modify | `createBookingOptimistic` 建单时生成 `qrSecret`（randomBytes） |
| `app/src/modules/checkin/domain/rules.ts` | Modify | 新增 `verifyRotatingCode(qrSecret, otp, now)`（HMAC + ±1 窗） |
| `app/src/modules/checkin/service/checkin.ts` | Modify | 新增 `checkinByOtp({bookingRef, otp})`；保留 `checkin(qrCode)` 兼容旧固件 |
| `app/src/app/api/gate/checkin/route.ts` | Modify | 解析 `{bookingRef, otp}` 透传；`x-gate-key` 不变 |
| `app/src/app/api/c/checkin-code/route.ts` | Create | `GET ?bookingId=` 鉴权游客+校验归属→返回**当前 OTP**（不返回 secret） |
| `app/src/modules/checkin/index.ts` | Modify | re-export `checkinByOtp` |
| `../Changqiushan-mobile/src/pages/booking-success/*` | Create | A5 成功页 |
| `../Changqiushan-mobile/src/components/VerifyCodeCard.tsx`、`hooks/useVerifyCode.ts` | Create | 二维码+倒计时+水印+离线降级 |

## 伪码
```ts
// checkin/domain/rules.ts
verifyRotatingCode(qrSecret, otp, now) {
  for (const step of [-1, 0, 1]) {
    const expect = hmacTrunc(qrSecret, Math.floor(now/30) + step)
    if (timingSafeEqual(expect, otp)) return true
  }
  return false
}
```
```ts
// checkin/service/checkin.ts
async checkinByOtp({ bookingRef, otp }) {
  const b = await repo.getByRef(bookingRef)
  if (!b || !verifyRotatingCode(b.qrSecret, otp, Date.now())) return err("INVALID_CODE")
  return this._idempotentCheckin(b)   // 现有 L44 幂等事务原封不动: UPDATE WHERE status='CONFIRMED' + checkin_log ON CONFLICT DO NOTHING + slot+1 + bus checkin_event
}
```
```ts
// A5 useVerifyCode.ts (端)
每秒递减"剩余28秒"; 到 0 → GET /api/c/checkin-code 拉新 otp → 重绘二维码
onHide 暂停; onShow 立即刷新一次再续
断网 → 显示最后有效码灰化 + 文本码"长秋山-2026-06-15-A1023" + 提示人工核销
onUserCaptureScreen → toast"截图无效, 请出示实时码"
```

## Risks & Mitigation
| 风险 | 缓解 |
|---|---|
| 时钟漂移 | ±1 时间窗容忍 |
| secret 泄漏 | OTP 单向派生不可逆推；展示码不含 qrCode/qrSecret；secret 仅服务端 |
| 旧闸机固件 | 保留 `checkin(qrCode)` 重载兼容 |
| 截图复用 | 30s 失效 + 动态水印 + nonce |

## Checkpoint
| Sub-step | Done |
|---|---|
| booking.prisma qrSecret + migrate + 建单生成 | [ ] |
| verifyRotatingCode + checkinByOtp（幂等事务不动） | [ ] |
| gate route 改造 + 旧重载兼容 | [ ] |
| `GET /api/c/checkin-code` | [ ] |
| A5 + VerifyCodeCard 30s 刷新 + 离线降级 | [ ] |
| `tsx scripts/verify-realtime.ts` 复测 checkin_event；闸机 OTP 端到端 | [ ] |
