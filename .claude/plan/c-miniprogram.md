# 实施计划：长秋山森林公园 C 端游客微信小程序（总览/索引）

> 产出自 `/multi-plan`（PRD 预读 + 后端/前端双视角分析 + 交叉验证）。仅规划，不含生产代码。
> 工作区：小程序代码落 `../Changqiushan-mobile`（worktree，`mobile` 分支）；BFF 落现有 `app/`。

## 📁 拆分计划索引（各文件可独立 `/multi-execute`）

| 文件 | 内容 | 阶段 | 依赖 |
|---|---|---|---|
| [`c-00-执行汇总.md`](./c-00-执行汇总.md) | **编排入口/进度看板** — 逐个执行顺序+状态回写 | — | — |
| **本文件** | 总览·决策·红线·架构·阶段化路线图 | — | — |
| [`c-02-wechat-auth.md`](./c-02-wechat-auth.md) | 微信登录 + 游客 JWT + A1（**最先做**，被所有鉴权端点依赖） | S0 | — |
| [`c-01-backend-bff.md`](./c-01-backend-bff.md) | C 端 BFF 路由组 + 复用端点 + 黑名单预检 + 精确查询/统计 | S0–S2 | c-02 |
| [`c-04-frontend-foundation.md`](./c-04-frontend-foundation.md) | Taro 工程地基 + 设计令牌 + 共享组件 + A2/A3/A4/A6/A11 | S0–S2 | c-01,c-02 |
| [`c-03-checkin-otp.md`](./c-03-checkin-otp.md) | 动态核销码 30s（checkin/gate 改造）+ A5 | S1 | c-01 |
| [`c-06-activity-payment.md`](./c-06-activity-payment.md) | 活动报名 + 微信支付（隔离，二期可选）+ A8/A9 | S3,S6 | c-01,c-04 |
| [`c-05-ai-chat.md`](./c-05-ai-chat.md) | AI 问答 modules/ai（直连大模型，不做 RAG）+ A7 流式 | S4 | c-01,c-04 |
| [`c-07-guide-map.md`](./c-07-guide-map.md) | 导览 POI + 停车实时 + A10 | S5 | c-01,c-04 |

> 建议执行顺序：**c-02 → c-01 → c-04 → c-03**（预约闭环）→ c-06(免费报名) → c-05 → c-07 → c-06(支付二期)。

## Task Type
- [x] Frontend（Taro 微信小程序，A1–A11 共 11 页）
- [x] Backend（`app/` 内 C 端 BFF + 微信登录/AI/支付/POI 新模块）
- [x] Fullstack

---

## 0. 已定决策（默认取双路分析首推项，可覆盖）

| 决策点 | 选定 | 理由（交叉验证结论） |
|---|---|---|
| **小程序技术栈** | **Taro 4.x（React + TS）** | 团队 React/TS 零迁移；可直接 import `app/` 的 `createBookingSchema` 做端内同源双要素校验（红线#2 最佳落地）；微信 `login/手机号/支付/chunked` 全支持 |
| **BFF 落点** | **现有 Next.js 内 `app/src/app/api/c/*` 路由组** | C 端预约**唯一**经 `bookingService.createBooking` → 与现场补录/OTA/后台手工共用同一 schema 同一事务（红线#2）；handler 属 `type:"app"`，eslint 边界天然合规；复用同一连接池/SSE |
| **游客鉴权** | **新 `modules/wechat` + `wechat_visitor` 表 + 自签游客 JWT**（独立密钥 `VISITOR_JWT_SECRET`，与 admin GoTrue 隔离） | 游客无密码无 admin 角色，硬塞 GoTrue 得不偿失；`jose` 已是现成依赖 |
| **身份↔预约关联** | **绑定 idCard/phone**，Booking 不加 FK | 身份证为预约唯一主体（红线#2 语义）；一个微信号可管名下多张不同身份证的单 |
| **动态核销码** | **TOTP 派生**（`Booking.qrSecret` 服务端保管，30s 滚动），`qrCode` 退居核销主键不下发；离线降级显示文本码人工核销 | 弱网友好、服务端无状态、闸机协议改动最小、幂等事务原样保留 |
| **实时（库存/车位）** | **客户端轮询**（slot 5s / parking 30s），BFF 仍保留 SSE 供 B 端/大屏 | 小程序无 EventSource；轮询最稳、审核零风险；未来可平滑切 WebSocket 网关 |
| **AI 流式（A7）** | **`Taro.request({enableChunked})` + `onChunkReceived`**，BFF 把 Gemini 上游流转 chunked | 小程序唯一原生流式；失败降级整段返回+打字机动画 |
| **交付节奏** | **分阶段：预约闭环优先**（见 §阶段化路线图），AI/活动/支付/地图顺次接入 | 红线最密集处（预约/核销/熔断）先验证；支付与审核风险后置 |
| **微信支付** | **建独立 `modules/payment` 但排在后期**；一期可先只放免费活动报名，付费报名按钮置灰"敬请期待" | 支付链路隔离红线（仅二消，入园零支付）；降低本期审核复杂度 |

> 覆盖方式：若你要 uni-app/原生、或要 PRD 一期全量并发、或支付提前/省略，告诉我，我改本文件。

---

## 1. Technical Solution（总体方案）

### 1.1 架构全景
```
微信小程序 (Taro/React/TS, ../Changqiushan-mobile)
  │  Taro.request (Bearer 游客JWT)  +  轮询(slot/parking)  +  chunked(AI)
  ▼
BFF: app/src/app/api/c/*  (type:"app" 路由层, 组合模块公共面)
  │  仅经 @/modules/<m> 公共面, 不碰内部 service/repository 私有路径
  ▼
现有模块: booking(复用) · checkin(改造支持OTP) · content(补signup) · riskcontrol(暴露申诉/预检)
         · traffic(复用) ＋ 新模块: wechat(登录) · ai(直连大模型对话) · payment(报名费, 隔离)
  ▼
Postgres18 + Prisma7（新增 wechat/ai/poi/qrSecret 字段，沿用 @@map 约定）
```

### 1.2 红线落点（必须在代码层兑现，违反即返工）
1. **免费预约·入园零支付**：`api/c/booking` 不 import 任何 payment；支付仅出现在 `api/c/.../signup/pay`。
2. **双要素强校验单一路径**：端内 + BFF 共用 `createBookingSchema`；C 端 handler 固定塞 `channel:"MINI_PROGRAM"`，校验无第二实现。
3. **预约前黑名单预检（缺口）**：现 `createBooking` 未调黑名单。在 `api/c/booking` 路由层先 `riskcontrolService.isBlacklistedByIdCard(idCard)` 再 `createBooking`（app 层组合两公共面，标准模式），同一组合复用到其它渠道入口保持四路一致。
4. **承载力 90% 熔断**：`createBooking` 内 `isCircuitBroken` 已返回 `CIRCUIT_BREAKER_OPEN`；C 端映射友好文案 + 轮询灰掉满/暂停时段。
5. **动态核销码 30s**：见 §4 改造点；展示码不含 `qrCode/qrSecret`。
6. **100% 中文 / 中文日期 / 禁门票票价购票退款**：端内复用 B 端 `lint-cn` 思路 + CI 关键词扫描；日期统一 `2026年6月15日`。
7. **密钥不下发**：微信 AppSecret/支付 mch/AI key/存储 key 全部服务端集成配置中心读取；C 端响应体静态审计不得含 `*Secret/*Key/session_key`。

---

## 2. 后端 BFF 与新模块（`app/`）

### 2.1 纯包壳端点（复用现有 service/repo，零业务新逻辑）
| 端点 | 包装 | 鉴权 |
|---|---|---|
| `GET /api/c/slots?date=` | `bookingRepository.listSlotsByDate` | 公开读 |
| `POST /api/c/booking` | 黑名单预检 → `bookingService.createBooking`（固定 MINI_PROGRAM） | 游客 |
| `POST /api/c/booking/:id/cancel` | 校验归属 → `bookingService.cancelBooking` | 游客 |
| `GET /api/c/me/bookings` | `bookingRepository.listBookings`（**新增精确版** `listBookingsByIdCardExact`，防枚举越权） | 游客 |
| `GET /api/c/me/stats` | 新增 `bookingService.getVisitorStats(idCard)` 只读聚合（待履约/已核销/爽约数） | 游客 |
| `GET /api/c/intro` `/news` `/knowledge` `/activities` `/activities/:id` | `contentRepository.*` | 公开读 |
| `GET /api/c/parking` | `trafficRepository.listParkingLots` | 公开读 |
| `POST /api/c/appeals` | `riskcontrolService.submitAppeal`（已有 service，仅暴露 API） | 游客 |

### 2.2 真·新后端工作
| 项 | 落点（守边界） | 说明 |
|---|---|---|
| 微信登录 | 新 `modules/wechat`：`service/auth.ts`(code2session+upsert+签发)、`repository.ts`、`index.ts`；`infrastructure/auth/visitor-session.ts`(`getVisitorSession`) | `POST /api/c/auth/wechat-login {code}`；`session_key` 仅服务端短时用于解密手机号 |
| 活动报名建单 | `content` 新增 `contentService.createSignup` + `createSignupSchema`（复用身份证/手机校验） | `POST /api/c/activities/:id/signup` |
| AI 流式问答+历史 | 新 `modules/ai`：会话/消息 repo + `aiService.streamChat`（直连大模型，key 走配置中心，**不做 RAG**；景区知识作 system prompt 背景） | `POST /api/c/ai/chat`(chunked)、`GET /api/c/ai/conversations`、`/:id/messages` |
| 微信支付（后期） | 新 `modules/payment`：`createWxOrder`(JSAPI)、`handleCallback`(验签+解密+幂等+金额校验)；写 `paymentStatus` 经 `content.markSignupPaid` 公共面，不跨写表 | `POST /api/c/.../pay`、`POST /api/c/payment/wechat/callback`(无游客鉴权，靠微信签名)。**绝不进入 booking** |
| 导览 POI | `content` 新增 `ContentPoi` 表 + `listPois` | `GET /api/c/poi` |
| 动态核销码 | `checkin` 改造（§4） | `GET /api/c/checkin-code`（返回当前 OTP，不返回 secret） |

### 2.3 数据模型新增（沿用 uuid pk / `@db.Timestamptz(3)` / `@@map("<m>_<entity>")`）
- `wechat.prisma`：`WechatVisitor`(openid 唯一、unionid、boundIdCard、phone)
- `ai.prisma`：`AiConversation`(visitorId 应用层关联)、`AiMessage`(role 枚举、content)　// 直连大模型，无 sources/RAG
- `content.prisma`：新增 `ContentPoi`(name/category/经纬度 Decimal/status)；`ContentActivitySignup` 补 `wxOrderId/wxTransactionId/paidAt`（或 payment 独立 `payment_order` 表，二选一）
- `booking.prisma`：`Booking` 加 `qrSecret String @map("qr_secret")`（建单生成，不下发）；可选 `publicRef` 作不可枚举闸机定位
- 迁移：`prisma migrate dev`（打包纪律见 CLAUDE.md：先停 dev/docker，再限速）

---

## 3. 前端小程序（`../Changqiushan-mobile`，Taro 4.x）

### 3.1 工程结构（自包含，pnpm）
```
Changqiushan-mobile/
├── project.config.json / app.config.ts        # appid / pages / subPackages / tabBar
├── shared-schema/booking.ts                    # ★ 从 app/ 抽出的同源 zod（仅 zod，无 Prisma/Next 依赖）
├── src/
│   ├── pages/  login(A1) home(A2,Tab) booking-calendar(A3) booking-form(A4)
│   │           booking-success(A5) my-bookings(A6,Tab) profile(A11,Tab)
│   ├── subpkg-ai/chat(A7)  subpkg-activity/{list(A8),detail(A9)}  subpkg-map/index(A10)
│   ├── components/  VerifyCodeCard StatusBadge SlotCard ActivityCard MpHtml
│   │                EmptyState NoticeCard CountdownPill CalendarMonth
│   ├── api/  client.ts(token注入/统一Result/401静默重登) booking.ts activity.ts ai.ts map.ts auth.ts realtime.ts(usePolling)
│   ├── store/  authStore bookingDraftStore themeStore (zustand)
│   ├── hooks/  useCountdown useVerifyCode usePolling
│   └── styles/tokens.scss                       # ★ 设计令牌同源 B 端
```
- **TabBar 4 项**：首页(A2)·预约(进 A3)·我的预约(A6)·我的(A11)；AI/活动/地图作首页快捷入口进分包（不占 Tab）。
- **分包**：主包仅 A1–A6/A11 高频页；AI/活动/地图进分包 + `preloadRule` 预下载；图片走 public/ 公网 URL 不进包。

### 3.2 设计系统落地（令牌同源、形态自洽，不像素克隆）
- `tokens.scss`：主色 `#2D5A27`、橙 `#D97706`、红 `#DC2626`、绿 `#059669`、灰 `#9CA3AF`、提示卡 `#FFFBEB`、圆角 16、**字号锁 px 最小 12px**（不用 rpx 缩字）、行高 1.6、西文优先中文字体栈。
- 双主题：`page` 挂 `data-theme` + `Taro.getSystemInfo().theme`/`onThemeChange`，store 存手动覆盖。
- B 端桌面构件（侧边栏/Topbar/1440 画布）**不移植**；共识只在 token 层。

### 3.3 关键交互
- **A4 双要素表单**：提交前 `createBookingSchema.safeParse`（同源），zod 中文报错映射字段；车牌/无车互斥；入园人数 ± 受单证单日上限约束。
- **A4 5 分钟占位倒计时**：以 BFF 返回 `holdExpiresAt` 服务端时间为准算 remaining（`useDidShow` 重算，防切后台漂移），归零回 A3。
- **A5 30s 核销码**：`useVerifyCode` 每秒递减、到点拉新 OTP；`onHide` 暂停/`onShow` 立即刷新；防截图水印 + `onUserCaptureScreen` 提示；断网降级显示文本码"长秋山-2026-06-15-A1023"。
- **A3/A10 实时**：`usePolling`，页面可见时轮询（slot 5s / parking 30s），`onHide` 停。
- **A7 流式**：chunked 累加 → Markdown 经 `MpHtml`(marked→白名单) 渲染；帧内结构化"库存指令"渲染"立即预约"按钮闭环跳 A3/A4（直连后端轻增强，非 RAG）。
- **富文本**：A9/景区介绍/资讯/知识库统一 `MpHtml`(mp-html + 白名单 + 图片懒加载/失败占位)，图来自 public/ HTTPS。

---

## 4. 动态核销码改造（checkin 模块）— 红线关键
现状：`Booking.qrCode` 静态 hex，闸机 `findUnique({where:{qrCode}})`，可截图转发。
改造（展示码与核销主键解耦，TOTP）：
1. **数据层**：`Booking.qrSecret`（建单随机生成，不下发）；`qrCode` 保留作核销主键。
2. **domain/rules.ts**：新增 `verifyRotatingCode(qrSecret, otp, now)`（HMAC + ±1 时间窗容漂移）。
3. **service/checkin.ts**：新增 `checkinByOtp({bookingRef, otp})` → 定位单 → 校验 OTP → **复用现有幂等事务原封不动**（`UPDATE WHERE status='CONFIRMED'` + `checkin_log ON CONFLICT DO NOTHING` + slot+1 + bus 发 `checkin_event`）。
4. **gate route**：`api/gate/checkin` 解析 `{bookingRef, otp}` 透传；`x-gate-key` 不变（保留旧 `checkin(qrCode)` 兼容旧固件）。
5. **C 端**：`GET /api/c/checkin-code` 鉴权游客 + 校验归属 → 返回当前 OTP（不返回 secret）。

---

## 5. Key Files
| File | Operation | Description |
|---|---|---|
| `app/src/app/api/c/**/route.ts` | Create | C 端 BFF 路由组（slots/booking/me/activities/intro/news/knowledge/parking/appeals/auth/ai/checkin-code/poi/pay/callback） |
| `app/src/app/api/c/_lib/requireVisitor.ts` | Create | 游客 JWT 鉴权 helper（所有 C 端 handler 共用） |
| `app/src/modules/wechat/{index,service/auth,repository,domain}.ts` | Create | 微信登录模块 |
| `app/src/infrastructure/auth/visitor-session.ts` | Create | `getVisitorSession`（对称 `session.ts`，独立密钥） |
| `app/src/modules/ai/**` | Create | AI 对话模块（会话/消息 repo + streamChat 直连大模型；景区知识作 system prompt，不做 RAG） |
| `app/src/modules/payment/**` | Create（后期） | 微信支付（活动报名费，隔离） |
| `app/src/modules/booking/repository.ts` | Modify | 新增 `listBookingsByIdCardExact`、`getVisitorStats` 聚合；建单写 `qrSecret` |
| `app/src/modules/checkin/{service/checkin,domain/rules}.ts` | Modify | `checkinByOtp` + `verifyRotatingCode`（幂等事务不动） |
| `app/src/app/api/gate/checkin/route.ts` | Modify | 接收 `{bookingRef, otp}` |
| `app/src/modules/content/{service,domain/schema}.ts` | Modify | `createSignup` + `markSignupPaid` + `createSignupSchema`；`listPois` |
| `app/prisma/models/{wechat,ai}.prisma` | Create | 新模型 |
| `app/prisma/models/{booking,content}.prisma` | Modify | `qrSecret` / `ContentPoi` / signup 支付字段 |
| `app/src/app/api/sse/[topic]/route.ts`、`middleware.ts` | Verify | 确认 `/api/c/*` 不被 admin 鉴权误伤；C 端轮询不直连 SSE |
| `../Changqiushan-mobile/**` | Create | Taro 工程全量（§3） |
| `../Changqiushan-mobile/shared-schema/booking.ts` | Create | 同源 zod（与 `app/.../domain/schema.ts` 哈希一致，CI 校验） |

---

## 6. Risks and Mitigation
| 风险 | 缓解 |
|---|---|
| 绕过 `createBooking` 直连 repo → 双要素/事务旁路 | C 端写库**仅** `bookingService.createBooking`；code review + eslint 边界；repo 仅用于读 |
| 越权读他人预约（`listBookings` 用 contains 模糊） | 新增**精确** `listBookingsByIdCardExact`，永以 token 绑定 idCard 为过滤主体，不接受前端任意查询条件 |
| 微信支付回调无鉴权入口 | 强制 APIv3 验签+解密；幂等(`wxTransactionId` 唯一)；金额二次校验=`registrationFee`；边缘 IP ACL；与 booking 物理隔离 |
| 预约前未查黑名单（现缺口） | app 路由层组合 `isBlacklistedByIdCard`+`createBooking`，四路一致 |
| 小程序无 SSE / 弱网 | 轮询为主（onHide 停）；核销码 TOTP 离线可算+文本码降级 |
| `enableChunked` 老基础库兼容 | 真机多版本回归；降级整段+打字机；设最低基础库版本 |
| 双要素 schema 跨端漂移 | 单一源 `shared-schema/booking.ts`，CI 校验两端哈希一致；zod 对齐 `^4.4.3`、TS strict |
| 审核误判票务/需支付 | 入园零支付；类目选景区服务/政务非票务；提审强调免费预约+主体资质 |
| 域名备案/白名单未配 → 真机全挂 | BFF 域名先 ICP 备案 + 配 request/socket/downloadFile 白名单；上线前开 `urlCheck` 全链路真机验 |
| 本机内存紧张（dev/build） | 遵 CLAUDE.md 打包纪律：先停 dev+docker 再限速 build；小程序工程独立不与 app dev 抢内存 |

---

## 7. 阶段化路线图（Checkpoint Plan）
> 每阶段自底向上：prisma model → repository → domain/schema → service → BFF route → 小程序页；每步 `pnpm lint`(边界) + `tsc --noEmit` 可验。

| Step | Sub-step | Done | Commit |
|---|---|---|---|
| **S0 地基** | 0.1 `../Changqiushan-mobile` Taro 工程脚手架 + tokens.scss + api/client + zustand | [ ] | — |
| | 0.2 `shared-schema/booking.ts` 同源 zod + CI 哈希校验 | [ ] | — |
| | 0.3 `modules/wechat` + `visitor-session` + `POST /api/c/auth/wechat-login` | [ ] | — |
| | 0.4 A1 登录授权页打通（wx.login→换 openid→签发→存储） | [ ] | — |
| **S1 预约闭环（红线最密，优先）** | 1.1 `GET /api/c/slots` + A3 日历/时段卡 + 轮询库存 | [ ] | — |
| | 1.2 黑名单预检 + `POST /api/c/booking`（复用 createBooking）+ A4 双要素表单 + 占位倒计时 | [ ] | — |
| | 1.3 `Booking.qrSecret` 迁移 + checkin `checkinByOtp`/`verifyRotatingCode` + gate route 改造 | [ ] | — |
| | 1.4 `GET /api/c/checkin-code` + A5 成功页 + 30s 动态码 + 离线降级 | [ ] | — |
| | 1.5 精确 `listBookingsByIdCardExact` + `GET /api/c/me/bookings` + A6 列表/取消 | [ ] | — |
| | 1.6 红线回归：双要素拒收/超约并发/90%熔断/越权读单 用例 | [ ] | — |
| **S2 内容 + 首页 + 我的中心** | 2.1 `GET /api/c/intro|news|knowledge` + `MpHtml` 白名单渲染 | [ ] | — |
| | 2.2 A2 首页（轮播/快捷入口/掠影/今日活动）+ A11 个人中心 + `me/stats` 聚合 | [ ] | — |
| | 2.3 `POST /api/c/appeals`（暴露 submitAppeal）+ A11 申诉入口 | [ ] | — |
| **S3 活动（免费报名）** | 3.1 `content.createSignup` + `GET activities`/`:id` + `POST signup` | [ ] | — |
| | 3.2 A8 列表（筛选）+ A9 详情（mp-html + 报名通道，付费按钮置灰） | [ ] | — |
| **S4 AI 问答** | 4.1 `modules/ai` 会话/消息表 + `aiService.streamChat`（直连大模型，景区知识作 system prompt） | [ ] | — |
| | 4.2 `POST /api/c/ai/chat`(chunked) + 历史接口 + A7 流式对话页 + 库存指令闭环 | [ ] | — |
| **S5 导览地图** | 5.1 `ContentPoi` + `GET /api/c/poi` + `GET /api/c/parking` | [ ] | — |
| | 5.2 A10 手绘地图 + POI 筛选 + 停车场抽屉 30s 轮询 + 2D/3D 切换 | [ ] | — |
| **S6 微信支付（隔离，可选/二期）** | 6.1 `modules/payment` JSAPI 下单 + 回调验签幂等 + `content.markSignupPaid` | [ ] | — |
| | 6.2 A9 付费报名 `Taro.requestPayment` 接通（入园主流程零支付不变） | [ ] | — |
| **S7 上线准备** | 7.1 域名备案+白名单+`urlCheck` 真机全链路回归；中文/红线词 CI 扫描；分包体积治理 | [ ] | — |
| | 7.2 `miniprogram-ci` 上传体验版 + 提审材料（免费预约/类目/资质） | [ ] | — |

---

## 8. 验证方式
- **后端边界**：`cd app && pnpm lint`（eslint-boundaries 报错=架构违例）；`pnpm exec tsc --noEmit`。
- **红线回归（service 单测）**：双要素拒收、超约并发、90% 熔断、OTP 时间窗、越权读单。
- **核销链路**：`tsx scripts/verify-realtime.ts` 复测 `checkin_event`；闸机 OTP 端到端。
- **小程序**：`taro build --type weapp` + 微信开发者工具/真机；A5 30s 刷新、A7 chunked 流式、轮询、占位倒计时逐项真机验。
- **合规**：中文/禁词扫描；响应体密钥泄漏静态审计；图片公网可达校验。
