# Implementation Plan: 长秋山 B 端后台 · 分模块实施

> 综合后端架构 + 前端实现双视角分析。基线已实地核实（非架构文档理想态）。
> 权威优先级：**PRD 红线 > B-design-system.md > 架构 §8 路由 > 截图视觉 > 每页 .md（仅参考栅格）**。
> 生成日期：2026 年 6 月 2 日。

### Task Type
- [x] Fullstack（B 端后台 app/，8 模块）

---

## 一、技术方案综述

模块化单体（Next.js 16 App Router + Prisma 7 + Postgres 18），eslint-plugin-boundaries 硬边界。自下而上：`prisma model → repository → domain/{rules,schema} → service → index.ts → page`。RSC 默认直读 repository，写走 Server Action + zod，实时走 SSE。

### 已敲定的关键架构决策（可在 review 推翻）
| # | 决策 | 选择 | 理由 |
|---|---|---|---|
| D1 | profile 模块 | **删除，并入 system** | 空壳零回归；架构 §2 明确；侧栏无 profile 项 |
| D2 | booking 库存并发 | **乐观锁** `UPDATE...WHERE booked_count+n<=capacity` + affected rows + DB `CHECK` 兜底 | 免费抢约峰值高，单语句原子、无锁等待；单日上限作前置查询 |
| D3 | 认证/会话 | **GoTrue 自托管(同库)**：GoTrue 跑独立 Go 服务但连**同一 Postgres**、独占 `auth` schema；签发 JWT，role 写入 `app_metadata` 随 token 走。middleware 用 **`jose`** 验 GoTrue 的 JWT(共享 `GOTRUE_JWT_SECRET` 或 JWKS)做粗粒度角色门;细粒度 RBAC/吊销下沉 Route/Action 查 `public.sys_*`。**身份单源 = `auth.users.id`(UUID)**，public 侧 RBAC/审计以该 UUID 为键，经**只读视图**缝合读侧 | 不自搓 crypto/会话、更安全；UUID+视图消除身份分裂；RBAC/审计仍自写 |
| D4 | analytics 刷新与查询 | **双轨**：物化视图承载固定聚合（pg-boss 调度 `REFRESH CONCURRENTLY`）+ **运行时参数化 `$queryRaw` 承载省/市/县多选下钻**（PRD 3.7/3.10/3.12）。Prisma 不能查物化视图，查询一律 `$queryRaw` + 手写 TS 返回类型 | 物化视图对自由下钻表达受限，固定聚合与下钻分开承载 |
| D5 | 图表库 | **ECharts**（按需引入 + `dynamic ssr:false`） | 唯一同吃地理热力 + 大屏深色 + 后台浅色，避免两套库 |
| D6 | UI 数据源 | **B-design-system.md 唯一权威**；截图仅布局参考；丢弃每页 .md 主题 | .md 是 Stitch boilerplate（#154212 蓝/Inter），与设计系统（#2D5A27 绿/中文）矛盾 |
| D7 | UI 组件库 | **shadcn/ui + Radix**（`npx shadcn` 复制源码进 `lib/ui/`，按设计系统改 token） | 与 Tailwind v4 同源；源码可逐行改、无运行时锁定；Radix 内建 a11y；深绿 #2D5A27 直接写 @theme；Radix 体量小、webpack 内存友好 |

---

## 二、Pre-flight（阶段 0 之前必做）

### 2.1 修复 baseline 既有红线违规
- `app/src/app/layout.tsx`：`lang="en"` → `zh-CN`，英文 metadata → 中文，去 latin-only Geist → 中文优先字体栈。
- `app/src/app/(admin)/booking/slots/page.tsx:14`：`toISOString().slice(0,10)` ISO 日期 → 中文日期（待 `shared/format` 就位后替换）。
- `app/src/app/globals.css`：重写 Tailwind v4 `@theme` token（`--color-primary:#2D5A27`、侧栏 `#1F3F1A`、背景 `#F9FAFB`、卡白、边 `#E5E7EB`），去 `prefers-color-scheme:dark` 自动深色。

### 2.2 安装缺失依赖（分阶段，非一次性）
| 依赖 | 阶段 | 用途 |
|---|---|---|
| `npx shadcn@latest init` + 按需 `add`（带入 Radix primitives + cva/clsx/tailwind-merge）| 阶段 0 | UI 组件库（源码落 `lib/ui/`，components.json 指向 `src/lib/ui`）。Next 16 较新，init 若报 peer-dep 手动调版本 |
| **GoTrue** 服务（docker compose，连同库）+ service_role key | 阶段 0/1 | 认证(同库 `auth` schema)；钉死版本，配 `GOTRUE_DISABLE_SIGNUP=true` |
| `jose` | 阶段 1 | middleware edge runtime 验 **GoTrue 签发**的 JWT |
| ~~密码哈希 argon2/bcrypt~~ | — | **不再需要**：密码/会话交给 GoTrue |
| `@hookform/resolvers@>=4`（适配 zod v4）| 阶段 2 | ⚠️ resolvers v3 仅对应 zod v3，与已装 `zod@4` 不兼容会静默失效；若 v4 resolver 仍 rc，**改用 Server Action `schema.parse` 兜底校验**，client 仅字段级 UI 提示 |
| `echarts` + `echarts-for-react` | 阶段 7（或更早做组件）| 图表 |
| `exceljs`（+ `@types/exceljs`）| 阶段 7 | Excel 导出（红线 5）|
| `react-hook-form` + `@hookform/resolvers`（可选）| 阶段 2 | B10 多步/B08 批量复杂表单 |
| 高德 JS API | 阶段 5 | 脚本注入（非 npm）|

---

## 三、分阶段实施（对齐架构 §9，每阶段可独立 `pnpm lint` + `tsc`）

### 阶段 0 · 地基（所有模块依赖）
**后端**
1. `src/shared/result.ts` — `Result<T>` 判别联合 + `ok/err` + 错误码枚举（所有 service 返回契约）。
2. `src/shared/format.ts` — `formatCnDate(d)=>"2026 年 5 月 31 日"`，禁 ISO。
3. `src/shared/validators.ts` — 身份证 18 位含校验位算法 + 车牌（含新能源）正则（纯函数，前后端/三渠道共用）。

**前端**
4. `globals.css` @theme 重写 + 根 layout 中文化（见 2.1）。
5. `src/lib/ui/` 组件：**基于 shadcn/ui（D7）**——`shadcn init`（components.json 指向 `src/lib/ui`，base color 设为自定义）→ `add` 进 Button/Input/Select/Textarea/Table/Card/Dialog/Drawer(Sheet)/Tabs/Badge/Pagination/Popover(给 DatePicker) 等源码 → **按 B-design-system.md 改 token/样式**（深绿 #2D5A27、侧栏 #1F3F1A、圆角/阴影）。shadcn 未覆盖的业务组件手写：`PageHeader`、`StatCard/KpiRow`、`StatusChip`(基于 Badge)、`FilterBar`、`FormField`、`Stepper`、`DatePicker/DateRangePicker`(基于 Popover+日历，**中文输出/内部 ISO**)、`ChartContainer`(dynamic wrapper)、`ExcelExportButton`、`EmptyState/Skeleton/LiveDot`。Sidebar/Topbar 手写。重 client 依赖一律 `next/dynamic({ssr:false})`。
6. `src/app/(admin)/layout.tsx` 全局壳（RSC）+ `Sidebar`(client/usePathname)+`Topbar`(client) + `src/lib/ui/nav/menu.ts`（菜单常量，逐字照抄 B-design-system 五大分组 16 项，**不增减**）。
7. `src/app/(auth)/layout.tsx` + `(auth)/login/page.tsx` 壳（无侧栏）。
8. `src/middleware.ts` 空守卫（先只判 cookie 存在 → 重定向 login，RBAC 待阶段 1）。
9. `src/instrumentation.ts`（Next 16 `register()` hook，仅 Node runtime）——**统一启动 pg-listen + pg-boss**（`boss.start()`）。阶段 4/7 的定时任务依赖此地基，缺则定时刷新/异步导出静默不触发。

**GoTrue 地基（D3）** — 标 ✅ 的为「搭建开发环境」时已落地并验证（2026-06-02）
10. ✅ `docker-compose.yml` 加 **GoTrue 服务**（`supabase/gotrue:v2.176.1` 钉死；连同一 Postgres、独占 `auth`；`GOTRUE_DISABLE_SIGNUP=true`、`${GOTRUE_JWT_SECRET}`；登录标识符=手机号 → 关 email/开 phone/`SMS_AUTOCONFIRM=true`）。**实测坑**：① 连接串须 `?search_path=auth`+`ALTER ROLE supabase_auth_admin SET search_path=auth`，否则迁移在 public 建表无权(PG15+)；② 去掉已废弃的 `GOTRUE_JWT_DEFAULT_GROUP_NAME`。
11. ✅ `docker/auth-bootstrap.sql`（幂等，`pnpm db:auth:bootstrap` 执行）：建角色 `supabase_auth_admin`(连库)/`anon`/`authenticated`/`service_role`/**`postgres`**（Supabase RLS 迁移会 GRANT 到 `postgres`，本库超管是 changqiushan，缺则迁移失败）+ `auth` schema + `pgcrypto`/`uuid-ossp` + 授 changqiushan 读 auth。
12. ⬜ **Prisma 圈地（头号地雷）**：**实测**——Prisma 单 schema 默认**已忽略 `auth`**（`migrate status` 干净，无需特殊配置）；仅当为读视图建 Prisma 模型时才开 `multiSchema=[public]`，并把视图模型用 `view`/`@@ignore` 标外部托管，确保 `prisma migrate` 永不碰 `auth.*` 与视图。
13. ⬜ **只读视图 + 授权**（手写 SQL migration，仿 `20260527160000_realtime_triggers`）：建 `public.app_user` 视图选稳定列（`id, phone, email, created_at, last_sign_in_at`，**手机号制以 phone 为主**）；授权已在 bootstrap 完成。
14. ⬜ `src/infrastructure/auth/`：GoTrue admin client（**用共享密钥 `GOTRUE_JWT_SECRET` 签 `role:service_role` 的 HS256 JWT 调 `/admin/users`**，已冒烟验证）+ `getSession()`。middleware 只用 jose，不引 GoTrue client（保边界）。

**交付物**：`pnpm lint`+`tsc` 通过；现有 booking 页有壳可看；ISO 日期已替换（仅 UI 展示处；`seed.ts` 的 `::date` ISO 值不算违规）；GoTrue 起得来、视图可读、Prisma 不碰 auth schema。
**环境复现**（新克隆）：`docker compose up -d postgres` → `pnpm db:auth:bootstrap` → `docker compose up -d gotrue`（自动迁移）→ `pnpm db:migrate && pnpm db:seed`。改 GoTrue env 后须 `docker compose up -d --force-recreate gotrue`（`start` 复用旧 env）。

### 阶段 1 · system（认证地基）
**后端**：新建 `src/modules/system/`，删 `src/modules/profile/`。**认证/密码/会话交给 GoTrue（D3），本模块只做授权(RBAC)+审计+账号编排。**
- prisma `models/system.prisma`：`sys_profile`(**PK=`auth.users.id` UUID**，存姓名/工号/状态)/`sys_role`/`sys_permission`(+role-permission 关联)/`sys_audit_log`(操作人=auth UUID)。**无密码/会话表**（GoTrue 管）。
- domain：菜单权限映射、审计写入助手。service：
  - `createAdmin`（**两步事务**：先调 GoTrue admin API 建 auth user（**`phone` + `password` + `phone_confirm:true`**，登录标识符=手机号）拿 UUID → 写 `sys_profile`+角色；public 失败则回调 admin API 删 auth user，防孤儿）、`resetPassword`（走 GoTrue admin API）、`disableAdmin`。
  - `checkPermission/writeAudit`（公共面暴露，供 app 层注入其他模块审计）。
- role 写入 GoTrue `app_metadata` 随 JWT 走；`middleware.ts` 用 jose 验 GoTrue JWT + 粗粒度角色门；`(admin)/layout.tsx` 接 `getSession` + `filterMenuByPerm`（细粒度查 `sys_*`）。
- ✅ **登录标识符口径已定（2026-06-02）：手机号**。compose 已配 `GOTRUE_EXTERNAL_PHONE_ENABLED=true`+`GOTRUE_SMS_AUTOCONFIRM=true`、关 email；登录 = 手机号+密码（`grant_type=password` 传 `phone`），无需 SMS 网关。

**前端**：B01 登录（模式 E，**手机号+密码**，提交到 GoTrue `token?grant_type=password` / Server Action 包装）；B25 系统管理（模式 A，左 Tab：账号(经 createAdmin/resetPassword)/角色权限矩阵/审计只读表；入口走 Topbar 头像下拉，**不进侧栏**）。

**交付物**：登录可用、后台被守卫、审计可写、菜单按权限渲染；建账号两步事务有回滚、无孤儿用户；Prisma 不触碰 auth schema。

### 阶段 2 · booking 补全（红线最密集，核心）
**后端**
- prisma（**2.1a 仅 model 字段**）：`Booking` 加 `noVehicleDeclared Boolean @default(false)`（与 plate 互斥）+ 复合索引 `(idCard,date)`；渠道库存按 **B1 方案 α**——`BookingSlot` 加 `miniProgramQuota/onsiteQuota/otaQuota/adminQuota Int @default(0)`（各渠道独立配额，固定渠道无需独立表）。
- **DB CHECK 约束（2.1b 手写 SQL migration，⚠️ Prisma 7 schema 不支持 CHECK，写进 .prisma 会被静默忽略）**：仿 `20260527160000_realtime_triggers/migration.sql` 手写 `ALTER TABLE booking_slot ADD CONSTRAINT ... CHECK(booked_count<=capacity)` + `ALTER TABLE booking ADD CONSTRAINT ... CHECK(plate IS NOT NULL OR no_vehicle_declared)`（互斥用 `(plate IS NOT NULL) <> no_vehicle_declared`）。
- domain `rules.ts`：`assertDualElements`（身份证校验位+车牌+无车互斥）、`canBook(slot)`（**仅判库存+slot 状态，Y1：不含熔断**）、`isCircuitBroken(occupancy,capacity)`（**独立闸门**：在园人数/承载量≥90%）、`canResume(occupancy)`（**A1 恢复判定**，人数回落可恢复）、`withinDailyLimit`、`canCancel(slot,now)`（截止时间规则）。
- domain `schema.ts`：`createBookingSchema`（三渠道 MINI_PROGRAM/OTA/ONSITE/ADMIN 共用，红线 2 核心）。经 index.ts re-export 给 app 层复用。
- repository：按渠道乐观锁扣减（`UPDATE...WHERE <channel>_booked+n<=<channel>_quota AND status='ACTIVE'` 查 affected rows）、单日计数、B22 按 idCard/plate 查单分组、回滚库存。
- service：`createBooking`/`cancelBooking`/`pauseSlotsForCircuitBreak`/**`resumePausedSlots`（A1，幂等，仅 PAUSED→ACTIVE）**。
- 实时：`slot_changed` 已全通，无需新增。
- ⚠️ **Y5**：本阶段 `createBooking` 暂无黑名单拦截，阶段 3 riskcontrol 就位后经 app 层补全。

**前端**：B08 配额配置（模式 B，月历+时段表+90% 阈值块，达 90% 行变红 + **A1 手动恢复入口**，挂 RBAC 权限）；B09 渠道接入（模式 A，配各渠道配额）；B10 现场补录（模式 B+D，4 步 Stepper 双要素互斥校验 + 右侧 `checkin_event` SSE 待补录队列）；B22 预约单查询（模式 A，查询条+状态 Tab；**B4：本阶段核销按钮 `disabled` + tooltip「核销功能阶段 3 启用」**，查单展示先行）。

**交付物**：双要素拒收、超约并发、熔断三类 service 单测绿；**B6 并发超约脚本** `app/tests/concurrent/overbook.ts`（k6/pgbench 模拟 100 并发抢同一时段，验 `booked_count` 不超 `capacity` 且 CHECK 触发 rollback）作为 done 判定之一。

### 阶段 3 · riskcontrol + checkin
**后端 riskcontrol**（新建文件夹）：prisma `risk_noshow_counter`/`risk_blacklist`(三键)/`risk_appeal`；domain 爽约计数+拉黑+申诉状态机；service `scanNoShow`(pg-boss)/`submitAppeal`/`reviewAppeal`/`isBlacklisted`。
**后端 checkin**：
- prisma：`checkin_log` 建 **UNIQUE `(booking_id)`**（N8：直接用 `booking.id` 做幂等键，无需新造字段）；**A4：`BookingSlot` 加 `checkedInCount Int @default(0) @map("checked_in_count")`** 承载在园计数。
- domain：`isCurrentSlotValid(booking,now)`；**核销幂等**用条件更新 `UPDATE booking SET status='CHECKED_IN' WHERE id=? AND status='CONFIRMED' RETURNING *`，零行即幂等命中（N8）；车牌预扣。
- service：`checkin` 挂 `api/gate/checkin/route.ts`（高频独立）。**B3 闸机协议**：`qrCode = "ck-"+bookingId`；闸机 `POST /api/gate/checkin { qrCode }`；服务端 strip 前缀查 bookingId。核销成功 `UPDATE booking_slot SET checked_in_count=checked_in_count+1 WHERE id=$slotId`（**原子，禁进程内变量**）。`checkin_event` 已全通。
- ⚠️ **A4 口径**：`checked_in_count` 求和为「今日累计入园」；90% 熔断要的「瞬时在园人数」严格需进/出场对冲。本期无离园事件，按「累计入园」作熔断代理（与 PRD 3.2「累计入园」对齐；真·在园需后续补离园事件，记入风险）。
**跨模块**（app 层组合，不互 import）：核销 Route 组合 checkin+booking 公共面；熔断判定 `isCircuitBroken(checkedInCount,capacity)` → `bookingService.pauseSlotsForCircuitBreak`（幂等）；下单前 app 层 Server Action 先 `isBlacklisted` 再 `createBooking`。
**前端**：B11 爽约风控与黑名单（模式 A，脱敏 RSC 渲染+申诉工作流）；**3.5 接通 B22 核销按钮**（移除阶段 2 的 disabled，经 app 层调 checkin 公共面）。
**交付物**：核销幂等、爽约扫描、拉黑拦截、熔断+恢复端到端。

### 阶段 4 · content
**后端**：prisma 4 表 + `content_activity_signup`(B23)+`content_activity_award`(B24)+报名费/**支付状态字段（只存/展示）**；domain 发布状态机+报名审核状态机；service CRUD+审计。**R1：B 端不调起微信支付**——报名与支付实际在 C 端小程序（不在本仓库），B 端仅存储/展示支付状态。支付隔离边界仍写（eslint 兜底 booking/checkin 不依赖支付），防误用。
**前端**：B03/B05/B07 列表（模式 A）；B04 编辑（模式 B，富文本 TipTap 动态 import）；B06 知识库（模式 B）；B23 报名审核（仅查看支付状态、通过/驳回）+ B24 获奖公示（从 B05 操作进入，不进侧栏）。
**交付物**：支付边界 eslint 通过；B 端无任何调起支付的代码路径。

### 阶段 5 · traffic
**后端**：prisma `traffic_parking_lot`；`lib/amap/`（4 类路况+停车+分流，超时/重试/降级）；domain 拥堵分流/满闲；**补 `parking_state` trigger SQL migration**（频道已注册但无 trigger）或 service 直接 `bus.publish`。
**前端**：B12 路况 / B13 停车（模式 D，高德 JS API + `AmapMap` wrapper dynamic ssr:false；`parking_state` SSE 更新标记色；旁附等价数据表做 a11y 兜底）。
**交付物**：`tsx scripts/verify-realtime.ts` 验 parking_state。

### 阶段 6 · iot
**后端**：prisma `iot_device`+`iot_heartbeat`(时序可月分区)；domain 在线率/延时/丢包/超时判定/告警分级；service CRUD+心跳；**补 `iot_event` trigger**；pg-boss 心跳超时扫描。
**前端**：B20 设备列表（模式 D，分类 KPI+SSE 行状态+离线变红）；B21 详情心跳（模式 D，近 24h 延迟折线 SSE 追加点+时间范围切换）。
**交付物**：verify-realtime 验 iot_event。

### 阶段 7 · analytics
**后端**：prisma 不建物化视图（手写 SQL migration 建 MV）；**B2：`analytics/repository.ts` 所有查询用 `$queryRaw<T>(Prisma.sql\`…\`)` + 在此集中定义手写 TS 返回类型**（Prisma 不能查 MV）；`lib/excel`(exceljs)；service 固定聚合读 MV + **省/市/县多选下钻走运行时 `$queryRaw` 参数化（D4 双轨）**；`api/export/[module]/route.ts` 返 xlsx 流；pg-boss 定时 `REFRESH MATERIALIZED VIEW CONCURRENTLY`。
**前端**：B14/B15/B16 三个独立菜单 + **R3：B17/B18/B19 收敛为单一「用户画像」菜单 + 子 tab（总览/出行偏好/APP 偏好）**，侧栏仍 16 项不增减。统一模式 C，KpiRow+DateRangePicker+ExcelExportButton+ECharts；B15 地理热力、B16 分省着色用高德/ECharts 叠加。**每页必须有 Excel 导出（红线 5）**。
**交付物**：6 报表 Excel 导出可用；侧栏「数据可视化与分析」恰 4 项。

### 阶段 8 · B02 仪表盘（收口）
`app/(admin)/page.tsx` RSC 跨模块**只读聚合**（分别 await booking/checkin/iot/content/analytics 公共面，不新建模块）；在园人数卡接 `checkin_event` SSE 实时，达 90% 闪红。
**交付物**：多公共面拼装 + SSE 实时刷新。

### 横切（贯穿，阶段 0 起持续）
- 100% 中文 lint 规则（**B5：用 grep 脚本，非 ESLint**）：`app/scripts/lint-cn.mjs` 精确匹配 JSX 字符串字面量内容 + red-list（门票/票价/购票/退款/票务/Lorem/ISO 日期格式），避免误报变量名；`package.json` 加 `"lint:cn": "node scripts/lint-cn.mjs"`，由 `pnpm lint` 串联。ESLint 只管架构边界，不做内容扫描。
- 设计系统英文黑名单断言测试（Dashboard/Settings/SMART FOREST…）。
- 每模块 `pnpm lint` 验边界 + 红线回归单测（domain 纯函数）。

---

## 四、Key Files

| 文件 | 操作 | 说明 |
|---|---|---|
| `app/src/app/layout.tsx` | Modify | lang=zh-CN + 中文 metadata + 中文字体 |
| `app/src/app/globals.css` | Modify | @theme token 重写（#2D5A27），去自动深色 |
| `app/src/app/(admin)/booking/slots/page.tsx:14` | Modify | ISO 日期 → formatCnDate |
| `app/src/shared/{result,format,validators}.ts` | Create | 地基纯函数（双要素算法在此）|
| `app/src/lib/ui/**` | Create | 共享组件库 + nav/menu.ts |
| `app/src/app/(admin)/layout.tsx` | Create | 全局壳 Sidebar+Topbar |
| `app/src/app/(auth)/layout.tsx` + `login/page.tsx` | Create | B01 无壳登录 |
| `app/src/middleware.ts` | Create | jose 验 GoTrue JWT + 粗粒度角色门 |
| `app/docker-compose.yml` | Modify | 加 GoTrue 服务（同库、auth schema、钉版本）|
| `app/src/infrastructure/auth/**` | Create | GoTrue admin client + getSession（D3）|
| `app/prisma/migrations/*_auth_view` | Create | 只读 `public.app_user` 视图 + auth schema 授权（手写 SQL）|
| `app/src/instrumentation.ts` | Create | register() 启动 pg-listen + pg-boss（A3）|
| `app/src/modules/analytics/repository.ts` | Create | 物化视图 `$queryRaw` + 手写返回类型（B2）|
| `app/scripts/lint-cn.mjs` | Create | 中文红线 grep 扫描（B5）|
| `app/tests/concurrent/overbook.ts` | Create | 并发超约验证（B6）|
| `app/src/modules/system/**` | Create | RBAC/审计/账号编排（认证交 GoTrue；吸收 profile）|
| `app/src/modules/profile/` | Delete | 并入 system |
| `app/src/modules/booking/{domain,service,repository,index}.ts` | Create/Modify | 双要素+乐观锁+熔断 |
| `app/src/modules/{riskcontrol,checkin,content,traffic,iot,analytics}/**` | Create | 各模块骨架 |
| `app/prisma/models/*.prisma` | Create | 每模块一个模型文件 |
| `app/prisma/migrations/*_realtime_*` | Create | parking_state + iot_event trigger |
| `app/src/infrastructure/realtime/listener.ts` | 参考 | CHANNELS 已含 4 频道 |
| `app/src/app/api/{gate/checkin,export/[module]}/route.ts` | Create | 闸机核销 + Excel 导出 |
| `app/src/lib/{amap,excel,charts}/**` | Create | 高德/Excel/ECharts 封装 |

---

## 五、Risks and Mitigation

| 风险 | 缓解 |
|---|---|
| webpack dev 内存（禁 turbopack）| 重依赖 `dynamic({ssr:false})`；最大化 RSC、client 收为岛；prisma 保持 `prisma-client-js` 单文件版 |
| **Prisma 误迁移 GoTrue 的 auth schema**（头号 GoTrue 地雷）| **实测**:单 schema 默认已忽略 auth(`migrate status` 干净);风险仅在为视图开 `multiSchema=[public]` 时——届时视图/auth 模型 `view`/`@@ignore` 标外部托管,`prisma migrate` 永不碰 `auth.*` |
| **建账号跨系统两步（GoTrue admin API + public）部分失败留孤儿** | 先 auth 后 public，public 失败回调 admin API 删 auth；加定期对账 |
| **GoTrue 升级改 `auth.users` 列致视图破裂** | 钉死 GoTrue 版本；视图只选稳定列；升级后复验视图 |
| ~~登录标识符待定~~ **已定:手机号** | compose 关 email/开 phone + SMS 自动确认;登录=手机号+密码,无需 SMS 网关 |
| **GoTrue JWT secret 与应用不同步致验签失败** | `GOTRUE_JWT_SECRET` 统一管理（同 .env 源）；或用 JWKS 非对称，轮换走灰度 |
| 截图头衔/菜单含英文且自相矛盾 | 以 B-design-system.md 文字为唯一权威，菜单/头衔硬编码逐字校对 |
| 每页 .md 是 boilerplate 主题（蓝/Inter）| 丢弃其 color/typography，仅取 8px 栅格参考 |
| parking_state/iot_event 频道无 trigger | traffic/iot 阶段补 trigger（或 bus.publish），verify-realtime 验证 |
| 并发超约 / 熔断时序竞态 | 乐观锁 + DB CHECK 双保险；熔断 pause 幂等；在园人数计数落库（勿用进程内变量）|
| 双要素与 plate 可空张力 | domain assertDualElements + zod + DB CHECK 三层兜底 |
| 跨层 schema 复用触发 boundaries | 经 modules/<m>/index.ts re-export schema 给 app |
| baseline 红线违规（ISO/lang=en）| Pre-flight 第一步即修 |
| 缺依赖（exceljs/哈希/echarts）| 各阶段前 pnpm add |
| Prisma 7 多文件 schema | 每模块一个 model 文件自动合并；trigger/CHECK 手写 SQL migration（schema 不支持 CHECK，A2）|
| zod v4 与 @hookform/resolvers 不兼容（A5）| 装 `@hookform/resolvers@>=4`；若仍 rc，改 Server Action `schema.parse` 兜底 |
| shadcn + Next 16 peer-dep（N1）| init 报错则手动调依赖版本；shadcn 已支持 Tailwind v4 + RSC |
| SSE `maxDuration=600` vs Vercel Hobby 60s 上限（N5）| 本项目自托管（docker compose），不受限；若改 Vercel 部署需 Pro |
| 「瞬时在园人数」需进/出场对冲，本期仅累计入园 | 按累计入园作熔断代理；离园事件列后续迭代（A4 口径）|

---

## 六、Checkpoint Plan

| 阶段 | 子步 | Done | Commit |
|---|---|---|---|
| 0 地基 | ✅0.1 shared 三件(311e624) · ✅0.2 globals/layout 中文化(907e95a) · ✅0.3 lib/ui 组件(2c9ab71) · ✅0.4 (admin)/layout壳(a8fff8b) · ✅0.5 (auth)壳(6f06714) · ✅0.6 空middleware(6f06714) · ✅0.7 GoTrue 起服务+bootstrap(同库,已验证) · ✅0.8 只读视图+auth基础设施(4c75ef1) · ✅0.9 instrumentation(4c75ef1) | ✅完成 | — |
| 1 system | ✅1.1 系统模型(6872288) · ✅1.2 GoTrue admin client+getSession(4c75ef1) · ✅1.3 jose middleware(4c75ef1) · ✅1.4 B01登录GoTrue(6872288) · ✅1.5 createAdmin两步事务(6872288) · ✅1.6 B25系统管理(6872288) | ✅完成 | 6872288 |
| 2 booking | ✅2.1a model字段(ee74099) · ✅2.1b CHECK migration(ee74099) · ✅2.2 domain rules(ee74099) · ✅2.3 乐观锁repo(ee74099) · ✅2.4 service(ee74099) · ✅2.5 B08(ee74099) · ✅2.6 B09(ee74099) · ✅2.7 B10(ee74099) · ✅2.8 B22(ee74099) · [ ]2.9 红线单测 · [ ]2.10 并发超约脚本 | [部分] | ee74099 |
| 3 risk+checkin | ✅3.1 riskcontrol模型+状态机(363f122) · ✅3.2 checkin幂等+qrCode+闸机Route(363f122) · ✅3.3 熔断bus监听(363f122) · ✅3.4 B11(363f122) · [ ]3.5 接通B22核销 | [部分] | 363f122 |
| 4 content | ✅4.1 模型(e23774b) · ✅4.2 状态机+支付边界(e23774b) · ✅4.3 B03-07(e23774b) · ✅4.4 B23/B24(e23774b) | ✅完成 | e23774b |
| 5 traffic | ✅5.1 lib/amap stub(ba0271d) · ✅5.2 模型+service(ba0271d) · ✅5.3 B12/B13(ba0271d) | ✅完成 | ba0271d |
| 6 iot | ✅6.1 模型(c018b07) · ✅6.2 service+pg-boss扫描stub(c018b07) · ✅6.3 B20/B21(c018b07) | ✅完成 | c018b07 |
| 7 analytics | ✅7.1 物化视图(2a9fe41) · ✅7.2 lib/excel(2a9fe41) · ✅7.3 导出Route(2a9fe41) · [ ]7.4 pg-boss刷新 · ✅7.5 B14-19(2a9fe41) | [部分] | 2a9fe41 |
| 8 仪表盘 | ✅8.1 B02 跨模块聚合+SSE(470afd1) | ✅完成 | 470afd1 |
| 横切 | ✅X.1 中文红线lint(7ae657b) · [ ]X.2 黑名单断言 · [ ]X.3 a11y走查 | [部分] | 7ae657b |

---

> **状态（2026-06-02，执行完成）**：全 8 阶段 + 横切 X.1 已执行完毕。tsc 0 错误，pnpm lint（含中文红线 lint）0 错误。末次 commit: `7ae657b`。
>
> 待补项（不阻断主体）：2.9 红线单测 · 2.10 并发超约脚本 · 3.5 B22核销接通 · 7.4 pg-boss刷新调度 · X.2 黑名单断言 · X.3 a11y走查
>
> **决策变更（2026-06-02，用户拍板）**：D3 由「自写 jose+argon2 混合认证」**改为 GoTrue 自托管（同库 auth schema + 共用 auth.users.id + 只读视图缝合）**。认证/密码/会话交 GoTrue，system 模块只做 RBAC/审计/账号编排；middleware 仍用 jose 验 GoTrue JWT。正文 D3、Pre-flight、阶段 0（新增 10–13）、阶段 1、Key Files、风险表、Checkpoint 0/1 均已同步。

## 附录 A · 审计意见（已落实正文，留作依据）

> 本附录是对正文计划的独立审计结论。执行计划时**先按此修正正文对应处再动手**，每条已注明落点。事实点已实地核实（prisma.config 指向 `prisma` 目录✓；仅 `checkin_event`/`slot_changed` 有 trigger✓；侧栏 16 项 5 分组✓；Tailwind v4 无 config、CSS-first✓；无 UI 库/echarts/exceljs/哈希✓；baseline `lang=en`+ISO 日期违规属实✓）。

### 🔴 必改（否则返工或违红线）

**R1 · 微信支付不在 B 端调起（修正阶段 4 + D 决策）**
活动报名与报名费支付实际发生在 **C 端小程序（不在本 app/ 仓库）**。B 端 content 只做活动配置 + B23 报名审核（**仅查看/展示**支付状态）。
- 动作：阶段 4「content 唯一注入微信支付 client」改为 **B 端不调起支付，仅存储/展示支付状态**；支付 SDK 注入是 C 端职责。
- 保留：eslint 支付隔离边界（booking/checkin 不依赖支付）仍写，防误用。

**R2 · JWT 必须用 edge 兼容库 `jose`（修正 D3 + Pre-flight 依赖 + 阶段 1）**
middleware 在 edge runtime 验 JWT，`jsonwebtoken` 跑不了 edge。
- 动作：Pre-flight 依赖表阶段 1 增 `jose`；middleware 用 `jose`(WebCrypto) 验签；密码哈希若用 argon2/bcrypt 注意只在 Node runtime（Route/Action）跑，不进 middleware。

**R3 · 数据分析侧栏 4 项 vs 6 页冲突（修正阶段 7）**
设计系统侧栏「数据可视化与分析」只有 4 项：客流/热力/来源/**用户画像**。计划把 B14–B19 当 6 独立页会违反「侧栏不得增减」红线。
- 动作：B17 总览 / B18 出行偏好 / B19 APP 偏好 收敛为 **1 个「用户画像」菜单 + 子 tab**（同 B04 之于景区介绍维护）。侧栏仍 16 项。

### 🟡 应澄清（逻辑缺口）

**Y1 · 熔断与库存是两套闸门，勿揉进一个函数（修正阶段 2 domain）**
① 下单受 `slot.capacity` 限（乐观锁）；② 90% 熔断是**全局在园人数**闸门（checkin 累加→pauseSlots）。
- 动作：`canBook` 只判库存 + slot 状态；熔断独立为 occupancy gauge 判定 → `pauseSlotsForCircuitBreak`。两者不耦合。

**Y2 · B22 手动核销跨模块（修正阶段 2）**
核销属 checkin domain，B22 在 booking 区不能直接核销。
- 动作：B22 核销动作经 **app 层组合 checkin 公共面**；依赖阶段 3，阶段 2 先做查单展示、核销按钮在阶段 3 接通。

**Y3 · analytics 多维下钻双轨（修正 D4 + 阶段 7）**
物化视图对省/市/县多选下钻表达受限，而 PRD 3.7/3.10/3.12 要大量自由下钻+多选对比。
- 动作：**物化视图承载固定聚合 + 运行时参数化查询承载下钻**双轨；pg-boss 仅调度物化视图刷新与大导出异步化。

**Y4 · 在园人数计数源权威化（修正阶段 3 checkin）**
熔断正确性依赖计数源，正文未定义。
- 动作：明确**落库 occupancy 计数行（原子增减）或 checkin_log 实时 count**，禁进程内变量（多实例/HMR 不安全）；pause 操作幂等。

**Y5 · 下单黑名单拦截的阶段依赖（标注阶段 2）**
阶段 2 `createBooking` 在阶段 3 riskcontrol 就位前无黑名单拦截。
- 动作：阶段 2 注明「下单黑名单拦截阶段 3 补全」，勿误判阶段 2 已完整。

### 🟢 提示（小项，执行时留意）

- **N1** shadcn + Next 16 兼容性需验：shadcn 已支持 Tailwind v4 + RSC，但 Next 16 较新，`init` 可能有 peer-dep 警告——视为风险项，必要时手动调依赖版本。
- **N2** `(dashboard)/realtime` 参考页去留：建议**保留作 SSE 样板**，或迁为文档示例；勿与 `(admin)` 实时页职责重叠。
- **N3** `prisma/seed.ts` 已存在（造时段数据）：阶段 2 改 booking 模型（加 `noVehicleDeclared`/`booking_channel`）后**同步更新 seed**。
- **N4** 测试策略补强：除 domain 红线单测，补 service 集成测试（test DB）+ 关键流程 E2E（登录→配额→补录→核销→熔断）；SSE 复用 `tsx scripts/verify-realtime.ts`（架构 §10）。

### ✅ 审计确认无误（计划可放心依赖）
9 阶段依赖链成立、地基先行正确、乐观锁/混合认证/shadcn 选型合理；上述均为局部修订，不动整体结构与阶段顺序。

---

## 附录 B · 首席架构师 + 高阶 QA 二次审计（2026-06-02）

> 基于实地核查代码库（`app/src/`、`app/prisma/`、`app/package.json`）对附录 A 之外的盲区补充审计。已验证事实：`booking.prisma` 无 `noVehicleDeclared`/CHECK 约束✓；`listener.ts` 4 频道但仅 2 个有 trigger SQL✓；`booking/index.ts` 直接 re-export repository（无 service 层）✓；`layout.tsx` lang=en + 英文 metadata✓；`globals.css` 含 dark mode 自动切换✓；`zod ^4.4.3` 已装✓；无 `jose`/`exceljs`/`echarts`/密码哈希库✓。

### 🔴 必须修正（否则运行时崩溃或逻辑漏洞）

**A1 · 熔断「暂停」只有一半——缺恢复机制**
计划定义了 `pauseSlotsForCircuitBreak`（写 PAUSED），但全文无任何"恢复"定义。人数降下去后无人能重新 ACTIVE 时段，当天时段永久停用。
- 落点：阶段 2 domain `rules.ts` 补 `canResume(occupancy, threshold)` + service `resumePausedSlots`（幂等，只改 PAUSED→ACTIVE）；B08 页面加手动恢复入口，挂 RBAC 权限（需 system 阶段 1 就位）。

**A2 · DB CHECK 约束无法写进 Prisma schema——计划未区分**
阶段 2 "prisma 补 DB CHECK(booked_count<=capacity) + CHECK(plate IS NOT NULL XOR no_vehicle_declared)"，但 Prisma 7 schema 文件不支持原生 CHECK，写进去会被静默忽略，DB 层无兜底。必须走手写 SQL migration（参考现有 `20260527160000_realtime_triggers/migration.sql`）。
- 落点：checkpoint 2.1 拆为 2.1a（prisma model 文件：加 `noVehicleDeclared Boolean @default(false)` 字段）+ 2.1b（手写 migration SQL：ALTER TABLE booking ADD CONSTRAINT … CHECK … + ALTER TABLE booking_slot ADD CONSTRAINT … CHECK …），两步显式分开。

**A3 · pg-boss 初始化时机缺失**
阶段 4/7 依赖 pg-boss 定时任务，但全文没有说明 `boss.start()` 在哪里调用。若漏掉，定时刷新和异步导出静默不触发。Next.js 16 推荐做法是 `src/instrumentation.ts`（`register()` hook，仅 Node runtime）。
- 落点：阶段 0 Key Files 增 `app/src/instrumentation.ts`（`register()` 同时启动 pg-boss + pg-listen）；阶段 4/7 均标注"依赖 instrumentation 地基"。

**A4 · 在园人数（occupancy）计数表 schema 未落地**
审计 Y4 只说"禁进程内变量"，但正文各阶段均未定义落库字段位置与原子增减 SQL。阶段 3 直接依赖此计数，若 schema 不定，执行者无从下手。
- 落点：阶段 3 checkin prisma 模型增 `checkin_in_count Int @default(0) @map("checked_in_count")` 字段至 `BookingSlot`（随 slot 粒度，语义最清晰）；service 用 `UPDATE booking_slot SET checked_in_count = checked_in_count + 1 WHERE id = $slotId` 原子操作；熔断判定读 `checkedInCount / capacity >= 0.9`。禁止 service 层累加进程内变量。

**A5 · zod v4 与 `@hookform/resolvers` 兼容性风险**
`package.json` 确认 `zod ^4.4.3`（Zod v4）。`@hookform/resolvers ^3.x` 仅对应 zod v3 API；若版本不对，`zodResolver` 在运行时静默返回空 errors，表单校验失效。
- 落点：§2.2 依赖表注明"需 `@hookform/resolvers@>=4` 以适配 zod v4"；若 v4 resolver 尚为 rc 版，改用 Server Action 端 `schema.parse` 做校验，Client 只做字段级 UI 提示，彻底规避此风险。

### 🟡 应澄清的逻辑缺口

**B1 · `booking_channel` 渠道库存切分具体 schema 缺失**
阶段 2 写"补 `booking_channel`（渠道库存切分）"但无 schema 细节。两种方案结构截然不同（`BookingSlot` 加字段 vs 独立 quota 表），不定则 B09 渠道配置页的 API 形态无法预判。
- 落点：建议方案 α——`BookingSlot` 加 `miniProgramQuota Int @default(0)` / `onsiteQuota` / `otaQuota` / `adminQuota`，各自独立乐观锁扣减（`UPDATE…WHERE channel_booked + n <= channel_quota`）；免费景区渠道数固定，无需动态扩展。

**B2 · analytics 物化视图查询执行方式未定义**
Prisma 不支持查询物化视图（未在 schema 里，无 TS 类型）。执行阶段 7 时必须用 `db.$queryRaw<ReturnType>(Prisma.sql\`…\`)` 手写 SQL + 手定返回类型，否则执行者临时决策各异。
- 落点：阶段 7 Key Files 增 `app/src/modules/analytics/repository.ts`，注明"所有物化视图查询均用 `$queryRaw` + 手写 TS 接口"，并在此文件中集中定义返回类型。

**B3 · qrCode 生成格式与闸机对接协议未定义**
`booking.prisma` 已有 `qrCode String @unique @db.VarChar(64)`，但全文未定义：① qrCode 值格式；② 闸机设备提交字段；③ 核销 API 接收什么。三者不对齐，硬件对接会返工。
- 落点：阶段 3 checkin service 规格明确：`qrCode = "ck-" + bookingId`（前缀防碰撞，64 字符内）；闸机提交 `POST /api/gate/checkin { qrCode: string }`；服务端 strip 前缀查 bookingId，zero-copy 不存冗余字段。

**B4 · B22 手动核销分期在 Checkpoint 未体现**
计划文字（Y2）说"阶段 2 先查单展示、核销按钮阶段 3 接通"，但 checkpoint 2.8 写"B22 预约单查询（…幂等手动核销）"——"幂等手动核销"放阶段 2 会让执行者误以为已完整。
- 落点：checkpoint 2.8 改为"B22 查单展示（核销按钮占位 `disabled`，tooltip 提示「核销功能阶段 3 启用」）"；新增 3.5"B22 核销按钮接通 checkin 公共面"。

**B5 · 中文 lint 规则实现工具未定义**
横切 X.1 "100% 中文 lint 规则…→ CI 报错"，但未说明用什么工具实现。自定义 ESLint plugin vs grep 脚本精度和维护成本差很大；"孤立英文"判定若不精确会误报变量名。
- 落点：用 shell grep 脚本精确匹配 JSX 字符串字面量内容 + red-list 词（门票/票价/Lorem/ISO 日期格式）；脚本放 `app/scripts/lint-cn.mjs`，`package.json` 加 `"lint:cn": "node scripts/lint-cn.mjs"`，由 `pnpm lint` 串联。ESLint 只做架构边界，不做内容扫描。

**B6 · 并发超约验证方式缺失**
计划依赖"乐观锁 + DB CHECK"，但无验证计划。Prisma 默认 READ COMMITTED，乐观锁正确性在高并发场景下需实测。
- 落点：阶段 2 交付物增"并发测试脚本 `app/tests/concurrent/overbook.ts`（`k6` 或 `pgbench`，模拟 100 并发下单同一时段），验证 `booked_count` 不超 `capacity` 且 DB CHECK 触发 rollback"；此测试作为阶段 2 done 判定之一。

### 🟢 小提示（执行时留意）

- **N5** SSE route `maxDuration=600` 在 Vercel Hobby 最多 60s；若目标是 Vercel 部署需升级 Pro 或改为 self-host。Risks 表补一条。
- ~~**N6** seed 无 qrCode~~ **【已核验：作废】** `qrCode` 早已存在于 `Booking` 模型（`booking.prisma:40`），且 `seed.ts` 只 INSERT `booking_slot`（时段）、不造 booking，根本不碰 qrCode。前提不成立。真正注意：seed 用显式列名 INSERT booking_slot，阶段 2 给 booking_slot 加的新列均带 `@default`，故 seed 无需改；其第 9 行 ISO 仅作 `::date` 值不展示，非红线违规。
- **N7** `(dashboard)/realtime` 与 `(admin)` 路由组共存；该页面不得进侧栏菜单，仅作 dev 演示，建议页面顶部加"[开发调试页，仅本地可见]"提示，防止截图流出被误认为产品功能。
- **N8** Checkin 幂等键建议直接用 `booking.id`（UUID 已够）：`checkin_log` 建 UNIQUE `(booking_id)`，核销用 `UPDATE booking SET status='CHECKED_IN' WHERE id=? AND status='CONFIRMED' RETURNING *`，零行即幂等命中，无需新造幂等字段。

### ✅ 二次审计确认无误
附录 A（R1/R2/R3 + Y1–Y5 + N1–N4）结论成立。本轮 A1–A5（🔴）为附录 A 未覆盖的执行层硬缺口，B1–B6（🟡）为执行中会产生"临时决策"的灰色地带，均应在动手前逐条落到对应阶段/checkpoint 正文。整体阶段依赖链与选型决策不变。
