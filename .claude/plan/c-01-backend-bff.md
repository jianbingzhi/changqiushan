# 子计划 01 · 后端 BFF 路由组（C 端对外 API）

> 上游：[`c-miniprogram.md`](./c-miniprogram.md) 总览。本文件可独立 `/multi-execute`。
> 依赖：[`c-02-wechat-auth.md`](./c-02-wechat-auth.md) 的 `requireVisitor`（游客鉴权 helper）。

## Task Type
- [x] Backend

## 范围
在现有 Next.js (`app/`) 内新建 `src/app/api/c/*` 路由组，**组合模块公共面**对外暴露 C 端 REST/JSON。所有 handler 属 `type:"app"`，只 `import { xxxService } from "@/modules/<m>"`，不碰内部 `service/repository` 私有路径（eslint-boundaries 合规）。

## 红线
1. C 端预约写库**唯一**经 `bookingService.createBooking`，固定 `channel:"MINI_PROGRAM"` → 与现场补录/OTA/后台共用同一 schema 同一事务（红线#2）。
2. 预约前**黑名单预检缺口**：`createBooking` 现未查黑名单。在 `api/c/booking` 路由层先 `riskcontrolService.isBlacklistedByIdCard(idCard)` 再 `createBooking`（app 层组合两公共面，标准模式）。
3. **越权读单**：`bookingRepository.listBookings` 用 `contains` 模糊匹配 → C 端必须用**精确** idCard 查询。
4. 90% 熔断：透传 `CIRCUIT_BREAKER_OPEN` 错误码 → 友好文案。
5. 响应体静态审计：不得含 `*Secret/*Key/session_key`。

## Key Files
| File | Operation | Description |
|---|---|---|
| `app/src/app/api/c/_lib/respond.ts` | Create | 统一 `Result` 序列化 + 错误码→HTTP 映射 + 密钥字段剔除 |
| `app/src/app/api/c/slots/route.ts` | Create | `GET ?date=` → `bookingRepository.listSlotsByDate` |
| `app/src/app/api/c/booking/route.ts` | Create | `POST` 黑名单预检→`createBooking(MINI_PROGRAM)` |
| `app/src/app/api/c/booking/[id]/cancel/route.ts` | Create | `POST` 校验归属→`cancelBooking` |
| `app/src/app/api/c/me/bookings/route.ts` | Create | `GET` → 精确查询（见下） |
| `app/src/app/api/c/me/stats/route.ts` | Create | `GET` → `getVisitorStats(idCard)` |
| `app/src/app/api/c/{intro,news,knowledge,activities,parking}/route.ts` | Create | 公开读，包 `contentRepository.*`/`trafficRepository.listParkingLots` |
| `app/src/app/api/c/appeals/route.ts` | Create | `POST` → `riskcontrolService.submitAppeal`（仅暴露 API） |
| `app/src/modules/booking/repository.ts` | Modify | 新增 `listBookingsByIdCardExact(idCard)`、`getVisitorStats(idCard)` |
| `app/src/modules/booking/index.ts` | Modify | re-export 上述只读方法（如经 service 暴露 `getVisitorStats`） |
| `app/middleware.ts` | Verify/Modify | 确认 matcher 不把 `/api/c/*` 卷入 admin 鉴权重定向 |

## 步骤 + 伪码
1. `respond.ts`：`ok(data)`/`fail(code,msg)`；剔除敏感字段后 `Response.json`。
2. 精确查询（防枚举）：
   ```ts
   // repository.ts
   listBookingsByIdCardExact(idCard: string) =>
     db.booking.findMany({ where: { idCard }, include: { slot: true }, orderBy:{ createdAt:"desc" }, take:200 })
   ```
3. 预约 handler：
   ```ts
   // api/c/booking/route.ts
   const v = await requireVisitor(req)               // 游客 JWT → { visitorId, boundIdCard }
   const body = await req.json()
   if (await riskcontrolService.isBlacklistedByIdCard(body.idCard)) return fail("BLACKLISTED","...申诉")
   const res = await bookingService.createBooking({ ...body, channel:"MINI_PROGRAM" })
   return res.ok ? ok(res.value) : fail(res.code, res.message)   // CIRCUIT_BREAKER_OPEN/SLOT_FULL/INVALID_INPUT...
   ```
4. 我的预约：用 `v.boundIdCard`（token 绑定，不接受前端任意 idCard）→ `listBookingsByIdCardExact`。
5. 取消：先 `getBookingWithSlot(id)` 校验 `booking.idCard === v.boundIdCard` 再 `cancelBooking`。

## Risks & Mitigation
| 风险 | 缓解 |
|---|---|
| 绕过 service 直连 repo | C 端写仅 `createBooking`；repo 仅读 |
| 前端传他人 idCard | 过滤主体强制取 token 绑定值 |
| admin 中间件误伤 | `middleware.ts` matcher 显式排除/放行 `/api/c/*` |

## Checkpoint
| Sub-step | Done |
|---|---|
| respond.ts + 公开读端点(slots/intro/news/knowledge/activities/parking) | [ ] |
| 精确 repo 方法 + me/bookings + me/stats | [ ] |
| booking POST（黑名单预检+createBooking）+ cancel | [ ] |
| appeals 暴露 | [ ] |
| `pnpm lint` + `tsc --noEmit` 通过 | [ ] |
