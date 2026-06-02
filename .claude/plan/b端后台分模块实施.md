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
| D3 | 认证/会话 | **混合**：JWT(httpOnly cookie) 供 middleware 粗粒度守卫（edge 不能用 Prisma）；细粒度 RBAC + 即时吊销下沉 Route/Action 查 `sys_*` | 兼顾 edge 守卫与可吊销性 |
| D4 | analytics 刷新 | **物化视图 + pg-boss 调度 `REFRESH CONCURRENTLY`** | 架构 §4 倾向快照；pg-boss 已装，负责定时刷新 + 大导出异步 |
| D5 | 图表库 | **ECharts**（按需引入 + `dynamic ssr:false`） | 唯一同吃地理热力 + 大屏深色 + 后台浅色，避免两套库 |
| D6 | UI 数据源 | **B-design-system.md 唯一权威**；截图仅布局参考；丢弃每页 .md 主题 | .md 是 Stitch boilerplate（#154212 蓝/Inter），与设计系统（#2D5A27 绿/中文）矛盾 |

---

## 二、Pre-flight（阶段 0 之前必做）

### 2.1 修复 baseline 既有红线违规
- `app/src/app/layout.tsx`：`lang="en"` → `zh-CN`，英文 metadata → 中文，去 latin-only Geist → 中文优先字体栈。
- `app/src/app/(admin)/booking/slots/page.tsx:14`：`toISOString().slice(0,10)` ISO 日期 → 中文日期（待 `shared/format` 就位后替换）。
- `app/src/app/globals.css`：重写 Tailwind v4 `@theme` token（`--color-primary:#2D5A27`、侧栏 `#1F3F1A`、背景 `#F9FAFB`、卡白、边 `#E5E7EB`），去 `prefers-color-scheme:dark` 自动深色。

### 2.2 安装缺失依赖（分阶段，非一次性）
| 依赖 | 阶段 | 用途 |
|---|---|---|
| 密码哈希（argon2 或 bcrypt）| 阶段 1 | system 认证 |
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
5. `src/lib/ui/` 原子组件：`Card/Section`、`PageHeader`、`StatCard/KpiRow`、`DataTable`(RSC 基础)、`Pagination`、`StatusChip`、`FilterBar`、`Input/Select/Textarea/FormField`、`Dialog`、`Drawer/Stepper`、`DatePicker/DateRangePicker`(中文输出/内部 ISO)、`ChartContainer`(dynamic wrapper)、`ExcelExportButton`、`EmptyState/Skeleton/LiveDot`。重 client 依赖一律 `next/dynamic({ssr:false})`。
6. `src/app/(admin)/layout.tsx` 全局壳（RSC）+ `Sidebar`(client/usePathname)+`Topbar`(client) + `src/lib/ui/nav/menu.ts`（菜单常量，逐字照抄 B-design-system 五大分组 16 项，**不增减**）。
7. `src/app/(auth)/layout.tsx` + `(auth)/login/page.tsx` 壳（无侧栏）。
8. `src/middleware.ts` 空守卫（先只判 cookie 存在 → 重定向 login，RBAC 待阶段 1）。

**交付物**：`pnpm lint`+`tsc` 通过；现有 booking 页有壳可看；ISO 日期已替换。

### 阶段 1 · system（认证地基）
**后端**：新建 `src/modules/system/`，删 `src/modules/profile/`。
- prisma `models/system.prisma`：`sys_admin`(密码哈希)/`sys_role`/`sys_permission`(+role-permission 关联)/`sys_audit_log`/会话表(若 DB session)。
- `infrastructure/auth/`：JWT 签发/校验 + 密码哈希。
- domain：菜单权限映射、审计写入助手。service：`login/logout/checkPermission/writeAudit`（公共面暴露，供 app 层注入其他模块审计）。
- `middleware.ts` 升级为真实 JWT 守卫；`(admin)/layout.tsx` 接 `getSession` + `filterMenuByPerm`。

**前端**：B01 登录（模式 E，Server Action）；B25 系统管理（模式 A，左 Tab：账号/角色权限矩阵/审计只读表；入口走 Topbar 头像下拉，**不进侧栏**）。

**交付物**：登录可用、后台被守卫、审计可写、菜单按权限渲染。

### 阶段 2 · booking 补全（红线最密集，核心）
**后端**
- prisma：补 `booking_channel`（渠道库存切分）；`Booking` 加 `noVehicleDeclared Boolean`（与 plate 互斥）；复合索引 `(idCard,date)`；DB `CHECK(booked_count<=capacity)` + `CHECK(plate IS NOT NULL XOR no_vehicle_declared)`。
- domain `rules.ts`：`assertDualElements`（身份证校验位+车牌+无车互斥）、`canBook(slot,occupancy)`（含 90% 熔断判定）、`withinDailyLimit`、`canCancel(slot,now)`（截止时间规则）。
- domain `schema.ts`：`createBookingSchema`（三渠道 MINI_PROGRAM/OTA/ONSITE/ADMIN 共用，红线 2 核心）。经 index.ts re-export 给 app 层复用。
- repository：乐观锁扣减、单日计数、B22 按 idCard/plate 查单分组、回滚库存。
- service：`createBooking`/`cancelBooking`/`pauseSlotsForCircuitBreak`。
- 实时：`slot_changed` 已全通，无需新增。

**前端**：B08 配额配置（模式 B，月历+时段表+90% 阈值块，达 90% 行变红）；B09 渠道接入（模式 A）；B10 现场补录（模式 B+D，4 步 Stepper 双要素互斥校验 + 右侧 `checkin_event` SSE 待补录队列）；B22 预约单查询（模式 A，查询条+状态 Tab+幂等手动核销）。

**交付物**：双要素拒收、超约并发、熔断三类 service 单测绿。

### 阶段 3 · riskcontrol + checkin
**后端 riskcontrol**（新建文件夹）：prisma `risk_noshow_counter`/`risk_blacklist`(三键)/`risk_appeal`；domain 爽约计数+拉黑+申诉状态机；service `scanNoShow`(pg-boss)/`submitAppeal`/`reviewAppeal`/`isBlacklisted`。
**后端 checkin**：prisma `checkin_log`(幂等键)；domain `isCurrentSlotValid`+核销幂等(条件更新 affected rows)+车牌预扣；service `checkin` 挂 `api/gate/checkin/route.ts`(高频独立)；`checkin_event` 已全通。
**跨模块**（app 层组合，不互 import）：核销 Route 组合 checkin+booking 公共面；熔断 checkin_event 累加→`bookingService.pauseSlotsForCircuitBreak`；下单前 app 层 Server Action 先 `isBlacklisted` 再 `createBooking`。
**前端**：B11 爽约风控与黑名单（模式 A，脱敏 RSC 渲染+申诉工作流）。
**交付物**：核销幂等、爽约扫描、拉黑拦截端到端。

### 阶段 4 · content
**后端**：prisma 4 表 + `content_activity_signup`(B23)+`content_activity_award`(B24)+报名费/支付状态；domain 发布状态机+报名审核状态机；service CRUD+审计；**唯一注入微信支付 client**（红线 3，eslint 边界兜底 booking/checkin 不依赖支付）。
**前端**：B03/B05/B07 列表（模式 A）；B04 编辑（模式 B，富文本 TipTap 动态 import）；B06 知识库（模式 B）；B23 报名审核 + B24 获奖公示（从 B05 操作进入，不进侧栏）。
**交付物**：支付边界 eslint 通过。

### 阶段 5 · traffic
**后端**：prisma `traffic_parking_lot`；`lib/amap/`（4 类路况+停车+分流，超时/重试/降级）；domain 拥堵分流/满闲；**补 `parking_state` trigger SQL migration**（频道已注册但无 trigger）或 service 直接 `bus.publish`。
**前端**：B12 路况 / B13 停车（模式 D，高德 JS API + `AmapMap` wrapper dynamic ssr:false；`parking_state` SSE 更新标记色；旁附等价数据表做 a11y 兜底）。
**交付物**：`tsx scripts/verify-realtime.ts` 验 parking_state。

### 阶段 6 · iot
**后端**：prisma `iot_device`+`iot_heartbeat`(时序可月分区)；domain 在线率/延时/丢包/超时判定/告警分级；service CRUD+心跳；**补 `iot_event` trigger**；pg-boss 心跳超时扫描。
**前端**：B20 设备列表（模式 D，分类 KPI+SSE 行状态+离线变红）；B21 详情心跳（模式 D，近 24h 延迟折线 SSE 追加点+时间范围切换）。
**交付物**：verify-realtime 验 iot_event。

### 阶段 7 · analytics
**后端**：prisma `analytics_*_snapshot` 物化视图；`lib/excel`(exceljs)；service 多维聚合+省/市/县下钻+`api/export/[module]/route.ts` 返 xlsx 流；pg-boss 定时 `REFRESH CONCURRENTLY`。
**前端**：B14–B19（统一模式 C，KpiRow+DateRangePicker+ExcelExportButton+ECharts；B15 地理热力、B16 分省着色用高德/ECharts 叠加）。**每页必须有 Excel 导出（红线 5）**。
**交付物**：6 报表 Excel 导出可用。

### 阶段 8 · B02 仪表盘（收口）
`app/(admin)/page.tsx` RSC 跨模块**只读聚合**（分别 await booking/checkin/iot/content/analytics 公共面，不新建模块）；在园人数卡接 `checkin_event` SSE 实时，达 90% 闪红。
**交付物**：多公共面拼装 + SSE 实时刷新。

### 横切（贯穿，阶段 0 起持续）
- 100% 中文 lint 规则：扫 .tsx 孤立英文/Lorem/ISO 日期/红线词（门票/票价/购票/退款/票务）→ CI 报错，挂进 `pnpm lint`。
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
| `app/src/middleware.ts` | Create | JWT 守卫 |
| `app/src/modules/system/**` | Create | 认证/RBAC/审计（吸收 profile）|
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
| 截图头衔/菜单含英文且自相矛盾 | 以 B-design-system.md 文字为唯一权威，菜单/头衔硬编码逐字校对 |
| 每页 .md 是 boilerplate 主题（蓝/Inter）| 丢弃其 color/typography，仅取 8px 栅格参考 |
| parking_state/iot_event 频道无 trigger | traffic/iot 阶段补 trigger（或 bus.publish），verify-realtime 验证 |
| 并发超约 / 熔断时序竞态 | 乐观锁 + DB CHECK 双保险；熔断 pause 幂等；在园人数计数落库（勿用进程内变量）|
| 双要素与 plate 可空张力 | domain assertDualElements + zod + DB CHECK 三层兜底 |
| 跨层 schema 复用触发 boundaries | 经 modules/<m>/index.ts re-export schema 给 app |
| baseline 红线违规（ISO/lang=en）| Pre-flight 第一步即修 |
| 缺依赖（exceljs/哈希/echarts）| 各阶段前 pnpm add |
| Prisma 7 多文件 schema | 每模块一个 model 文件自动合并；trigger 手写 SQL migration |

---

## 六、Checkpoint Plan

| 阶段 | 子步 | Done | Commit |
|---|---|---|---|
| 0 地基 | 0.1 shared 三件 · 0.2 globals/layout 中文化 · 0.3 lib/ui 组件 · 0.4 (admin)/layout 壳 · 0.5 (auth) 壳 · 0.6 空 middleware | [ ] | — |
| 1 system | 1.1 sys_* 模型 · 1.2 auth+哈希 · 1.3 真实 middleware · 1.4 B01 登录 · 1.5 B25 系统管理 | [ ] | — |
| 2 booking | 2.1 模型+约束 · 2.2 domain 双要素/熔断 · 2.3 乐观锁 repo · 2.4 service · 2.5 B08 · 2.6 B09 · 2.7 B10 · 2.8 B22 · 2.9 红线单测 | [ ] | — |
| 3 risk+checkin | 3.1 riskcontrol 模型/状态机 · 3.2 checkin 幂等+闸机 Route · 3.3 跨模块熔断/拦截 · 3.4 B11 | [ ] | — |
| 4 content | 4.1 模型 · 4.2 状态机+支付注入 · 4.3 B03-07 · 4.4 B23/B24 | [ ] | — |
| 5 traffic | 5.1 lib/amap · 5.2 模型+trigger · 5.3 B12/B13 | [ ] | — |
| 6 iot | 6.1 模型 · 6.2 trigger+pg-boss 扫描 · 6.3 B20/B21 | [ ] | — |
| 7 analytics | 7.1 物化视图 · 7.2 lib/excel · 7.3 导出 Route · 7.4 pg-boss 刷新 · 7.5 B14-19 | [ ] | — |
| 8 仪表盘 | 8.1 B02 跨模块聚合 + SSE | [ ] | — |
| 横切 | X.1 中文红线 lint · X.2 黑名单断言 · X.3 a11y 走查 | [ ] | — |
