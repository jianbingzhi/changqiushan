# 数字大屏（C1–C7）执行计划

> 依据 `docs/PRD.md` 第三章（大数据平台与数字孪生大屏）、设计稿 `prompts/C1~C7*.txt`、现有 B 端代码编写。
> 由 `/multi-plan` 双视角分析（后端架构 + 前端可视化）交叉验证后合成。
> **核心约束：大屏页面无须登录**（挂墙展示，值守人员不登录）。

## Task Type
- [x] Fullstack（前端为主：echarts 可视化 + 大屏外壳；后端少量：聚合查询 + middleware 放行 + 公开只读端点）

---

## 一、技术方案（综合双视角）

### 1. 无登录架构（关键）
- **新 route group `src/app/(screen)/`**，URL 前缀 `/screen/*`，挂**独立全屏暗色 layout**（不继承 `(admin)` 的 sidebar/topbar/浅色主题）。
- **middleware 放行**：`src/middleware.ts` 的 `PUBLIC_PATHS` 增加 `"/screen"`（`startsWith` 已覆盖 `/screen/*`）。matcher 不动；`ROUTE_ROLE_GATES`（/system /analytics /content /riskcontrol）与 `/screen` 无交集，天然隔离。
- **数据通道（裁决）**：
  - **首屏** = RSC 页面（`force-dynamic`）直读各模块 repo（RSC 读 repo **不触发 requireRole**，无登录可用）。沿用现有 `realtime/page.tsx` 的 `Promise.all + .catch(()=>默认值)` 范式。
  - **刷新/轮询** = 新增**公开 GET** route handler `src/app/api/screen/[metric]/route.ts`（白名单 metric、可加 `SCREEN_TOKEN` 软门、可加缓存 TTL）。
  - **禁止**在 `/screen` 用带 `requireRole` 的 server action（无登录会报"未登录"）。现有无门的 `getScreenOccupancy` 可保留或改为本 route handler。
- **弱鉴权兜底（可选，强烈建议生产启用）**：
  - 应用层 `SCREEN_TOKEN`（`?k=<token>` / cookie，在 `(screen)/layout.tsx` RSC 层比对 `process.env.SCREEN_TOKEN`），**未配置时降级为完全开放**（本地/演示零摩擦）。
  - 生产以 **Nginx/反代 IP 白名单**为主（大屏机固定内网/专网 IP）。
- **PII 白名单铁律**：`/screen` 所有端点**只能出聚合/计数/状态枚举**。`getProfileOverview`/`getTravelPreference` 返回值已是聚合（dimension/value/percentage，**无 PII**），安全。**严禁**返回 `bookingRepository` 原始 Booking 行、`findBlacklistAll`、`listAppeals`（均含身份证/车牌/姓名）——黑名单只出**条数**。

### 2. 实时刷新策略（裁决：轮询为基线）
- 现有 SSE 路由 `/api/sse/[topic]` **强制 `getSession()`，无登录 401**；且 Vercel/`REALTIME_ENABLED=false` 时 503。
- **基线 = 客户端轮询**：大屏组件 `setInterval`（15–30s）GET `/api/screen/[metric]`，两栖部署皆可、无长连、无登录友好。承载 90% 熔断不要求秒级，轮询足够。
- **可选（二阶段）**：自托管补一个**公开 SSE topic**（如 `screen_tick`，加入 listener `CHANNELS` + route `ALLOWED_TOPICS`，且该 topic 不走 getSession）实现秒级。复用现有 `REALTIME_ENABLED` flag 双模式。
- **承载 90% 闪红熔断**：熔断已落地——**核销写路径内联** `pauseSlotsForCircuitBreak`（`instrumentation-node.ts:62` 注记 + `booking/service/booking.ts:40` `isCircuitBroken` 阻止新预约）。大屏读 `listSlotsByDate` 的 `status=PAUSED` + 占用率即可**如实**显示"已自动暂停"，无需大屏触发任何写入。

### 3. 图表技术选型（裁决：echarts 客户端 + 自研深色条形）
- **echarts@6 + echarts-for-react@3**（已装、全仓零使用，从零起步）画：多曲线/双 Y 轴折线（C2/C3）、雷达（C2）、漏斗（C2）、环形/饼（C1/C3/C6）、堆叠条（C1/C3）、散点（C7）、**7×24 热力矩阵**（C4）、仪表 gauge（C6）。
- **自研深色 `DarkBarList`**（由现有浅色 `BarList` 派生）画简单 TOP5/占比条，省 echarts 实例。
- **分层**：RSC 取数 → 序列化 props → `"use client"` echarts 组件。
- **工程化**：
  - 大屏专用 echarts 主题 `src/lib/ui/screen/echarts-theme.ts`（集中注入色板 #0A1F0A/#2D5A27/#4A8E3F/#4FB3E0/#D97706/#DC2626 + #E8F5E9 文字 + 辉光 shadow + 暗色 tooltip + `backgroundColor:transparent`）。
  - **按需注册** `src/lib/ui/screen/echarts-setup.ts`（`echarts/core` + 显式 `LineChart/BarChart/PieChart/RadarChart/FunnelChart/ScatterChart/HeatmapChart/GaugeChart` + `Grid/Tooltip/Legend/VisualMap` + `CanvasRenderer`），用 `echarts-for-react/lib/core` 传入实例，控体积。
  - 封装 `src/lib/ui/screen/charts/`：`LineTrend` `RadarChart` `FunnelChart` `DonutChart` `StackedBar` `ScatterChart` `Heatmap724` `GaugeRing`。

### 4. 大屏布局体系（裁决：transform scale 等比缩放）
- **1920×1080 固定画布 + `transform: scale(min(vw/1920, vh/1080))`** + `transform-origin: top left`，外层黑底（#050D05）居中 letterbox。数据大屏行业惯例，设计稿 1:1 还原、跨分辨率零回流、一处缩放全页共享。
- 共享外壳 `ScreenShell`（缩放容器）+ `ScreenHeader`（标题 + 北京墙钟 + 数据源状态 + 全屏按钮）。
- **滚动条隐藏**限定 `.screen-root` 作用域，不污染后台。
- **墙钟** `useCnClock`（Intl `Asia/Shanghai`）从现有 `_big-screen.tsx` 抽到 `src/lib/ui/screen/use-cn-clock.ts` 共享；`useScreenScale` 新建。

### 5. 大屏设计系统（token 隔离）
- `src/app/(screen)/screen-theme.css`：`--screen-*` 命名空间变量，仅在 `.screen-root` 作用域生效。**不进** `globals.css` 的 `:root`/`.dark`（避免污染后台双主题；符合待办清单"always-dark 大屏内联色保留"判定）。
- 复用组件清单：`ScreenShell`/`ScreenHeader`/`ScreenCard(GlowPanel)`/`KpiTile`(大屏大字版，派生自 `_big-screen`)/`AlertTicker`/`Legend`/`ScreenStatusBar`(内含复用 `LiveDot`)/`DarkBarList`。
- 字号体系（远观可读，突破后台 12px 手持规范）：大 KPI 48–64、区块标题 24–28、卡片标题 18–20、轴/标注 14–16（随 scale 等比缩放）。

### 6. 红线落地
- 承载闪红 **色 + 文字双编码**（横幅明确中文，色盲友好；橙/红配图标+标签不靠纯色）。
- 中文日期统一 `formatCnDate`/`useCnClock`，**禁 ISO**（轴标签转"M月D日"，沿用现有 page.tsx 第 54–58 行做法）。
- 100% 中文（echarts series/legend/tooltip 全中文）；**唯一例外** C6 地图标题"导览图 / Tour Map"（PRD 明确允许）。
- 免费景区红线：C5"剩余名额"= Σ(capacity − bookedCount)，**严禁**"门票/票价/退款/余额(票务语义)"。

---

## 二、数据供给矩阵（逐页：✅已有 / 🟡需新增聚合 / 🔴本期占位）

| 页 | ✅ 直接可用（repo 方法） | 🟡 需新增聚合/MV | 🔴 本期占位/mock |
|---|---|---|---|
| **C1 综合态势主屏** | 在园/承载（`booking.listSlotsByDate`Σ + `system.getInstantCapacity`）、履约（Σbooked vs Σchecked）、性别/年龄环（`analytics.getProfileOverview`）、渠道占比（`analytics.getVisitorSource`）、今日活动（`content.listActivitiesWithCounts`）、告警（`iot.listDevices` filter ALERT） | 客源地 TOP5（`analytics.getVisitorRegionTop`，需 id_card 行政区划码表） | 中央 3D 地图 8POI（R6 高德阻塞；POI 元数据可用 `content.listPois` 真实坐标，仅渲染层占位） |
| **C2 运营态势面板** | 近30天 预约/入园/爽约多曲线（`analytics.getDailyTraffic` 一次拿 total/checked/cancelled/noshow） | 爽约雷达多维（前端从日序列重组 or 轻聚合） | 漏斗顶层"浏览量"（无埋点 → 漏斗从"预约→入园→履约/爽约"三层起，顶层占位或省略） |
| **C3 客流与预约趋势** | 近30天多曲线（`getDailyTraffic`）、时段堆叠（`analytics.getHourlyPeak`）、周末占比（前端按 dow 分组）、统计表 | 本/外区县·市·省占比饼（同 C1 地域，需行政区划派生） | — |
| **C4 预约分时热力** | POI 阈值/熔断状态（`getInstantCapacity` + 在园数算 90%；slot.status 真读）、导出 | **7×24 热力**（现 `getHourlyPeak` 仅 24h 单维 → 新增 MV `analytics_weekly_hourly_heat` dow×hour）、POI 级阈值（system config） | 阈值动态档案、历史回放（无快照表 → 占位，或建快照表 + pg-boss 二阶段） |
| **C5 数据概览首屏** | 预约/核销/在园/剩余名额（`listSlotsByDate`）、停车（`traffic.listParkingLots`Σ）、活动（`content`）、告警（`iot`）、画像快照（`getProfileOverview`+`getTravelPreference`）、同期对比（`getDailyTraffic` 两区间） | 同期对比可前端两次取数相减（无需新方法） | 天气/AQI（外部 API 占位） |
| **C6 数字孪生导览图** | KPI3卡（同C1）、告警/设备数据/运维（`iot.listDevices`+`getRecentHeartbeats`） | 区域分布（无 POI 级在园计数 → 按时段近似 or 占位） | 3D 地图 12POI（高德阻塞；POI 用 `content.listPois`） |
| **C7 运营宣传一张图** | 运营KPI热力（复用C1/C4）、设施调度（`traffic`+`iot`）、多维分析散点（复用 analytics） | — | GIS 基础、沉浸三维漫游（强依赖地图 → 占位） |

**新增方法建议（遵守边界：聚合放对应模块 repo，大屏页在 `(screen)` 路由层组合多模块公共面）：**
- `analytics.getVisitorRegionTop(limit)` / `getVisitorRegionBreakdown(level)` 🟡（需行政区划码表，否则降级占位）
- `analytics.getWeeklyHourlyHeat()` 🟡（推荐新增 MV `analytics_weekly_hourly_heat`，dow×hour 聚合 booking/checkin）
- 同期对比 → `getDailyTraffic` 两次调用即可 ✅（无需新方法）

---

## 三、实施步骤（分阶段交付）

### 阶段 0 — 地基（一次建好，7 页共用）
1. middleware 放行 `/screen` + `(screen)/layout.tsx` 暗色全屏外壳 + `(screen)/screen-theme.css`（`--screen-*` 隔离 token）+ 可选 `SCREEN_TOKEN` 软门。— **交付物**：无登录可访问的空大屏壳
2. `ScreenShell`（scale 缩放）+ `useScreenScale` + `useCnClock`（抽出）+ `ScreenHeader`/`ScreenStatusBar`（复用 `LiveDot`）。— **交付物**：缩放外壳 + 墙钟 + 状态条
3. echarts 按需注册 `echarts-setup.ts` + 大屏主题 `echarts-theme.ts` + 6+2 类封装组件（`LineTrend`/`RadarChart`/`FunnelChart`/`DonutChart`/`StackedBar`/`ScatterChart`/`Heatmap724`/`GaugeRing`）+ `DarkBarList`（派生）+ `ScreenCard`/`KpiTile`(大屏版)。— **交付物**：大屏图表库
4. 公开数据端点骨架 `src/app/api/screen/[metric]/route.ts`（白名单 + 软门 + 缓存 TTL）。— **交付物**：轮询数据源

### 阶段 1 — 数据齐全页（纯前端高保真，验证地基）
5. **C5 数据概览首屏**（落地最快，全聚合数据，仅天气占位）。
6. **C3 客流与预约趋势**（折线+堆叠+饼+表+Excel；地域饼占位）。
7. **C2 运营态势面板**（漏斗三层+雷达+双轴折线+状态条）。
8. **C4 预约分时热力**（新增 `analytics_weekly_hourly_heat` MV → 7×24 真热力；阈值档案/历史回放占位）。

### 阶段 2 — 主体真实、地图占位
9. **C1 综合态势主屏**（迁移现有 realtime 并重着色为绿色科技风；左右纵栏全真，中央地图占位 + POI 列表降级；客源 TOP5 待地域数据）。处置旧 `(dashboard)/realtime`：重定向到 `/screen/situation` 或移除。
10. **C6 数字孪生导览图**（右侧孪生面板全真：iot 设备/告警/运维；地图 12POI 占位）。

### 阶段 3 — 综合宣传图（半占位，收口）
11. **C7 运营宣传一张图**（运营KPI/设施调度/散点三区真实；GIS/三维漫游占位）。

### 阶段 4（阻塞解除后，不进本期验收）
12. R6 高德 key 到位 → 补 C1/C6/C7 地图层、数字孪生、沉浸漫游、GIS；自托管公开 SSE topic 秒级刷新。

---

## 四、关键文件

| 文件 | 操作 | 说明 |
|---|---|---|
| `app/src/middleware.ts:14` | 改 | `PUBLIC_PATHS` 增 `"/screen"` |
| `app/src/app/(screen)/layout.tsx` | 新建 | 暗色全屏外壳 + 可选 SCREEN_TOKEN 软门 |
| `app/src/app/(screen)/screen-theme.css` | 新建 | `--screen-*` 隔离 token |
| `app/src/app/(screen)/{situation,operation,trend,heatmap,overview,twin,poster}/page.tsx` | 新建 | C1~C7 RSC 取数页（force-dynamic，Promise.all 直读 repo） |
| `app/src/app/(screen)/_components/` | 新建 | 页面专属展示组件 |
| `app/src/lib/ui/screen/{use-screen-scale,use-cn-clock,echarts-setup,echarts-theme}.ts` | 新建/抽出 | 缩放 hook、墙钟（抽自 realtime）、echarts 注册与主题 |
| `app/src/lib/ui/screen/{ScreenShell,ScreenHeader,ScreenCard,KpiTile,ScreenStatusBar,AlertTicker,Legend,DarkBarList}.tsx` | 新建/派生 | 大屏复用组件（KpiTile 派生自 `_big-screen`，DarkBarList 派生自 `BarList`） |
| `app/src/lib/ui/screen/charts/{LineTrend,RadarChart,FunnelChart,DonutChart,StackedBar,ScatterChart,Heatmap724,GaugeRing}.tsx` | 新建 | echarts 封装（"use client"） |
| `app/src/app/api/screen/[metric]/route.ts` | 新建 | 公开只读 GET（白名单+软门+缓存），轮询数据源 |
| `app/src/modules/analytics/repository.ts` | 改 | 新增 `getWeeklyHourlyHeat`（C4 7×24）、`getVisitorRegionTop`（地域，可降级占位） |
| `app/prisma/models/analytics.prisma` + migration | 新建 | MV `analytics_weekly_hourly_heat`（dow×hour） |
| `app/src/app/(dashboard)/realtime/*` | 迁移/删 | 并入 `(screen)/situation`（C1），旧路由重定向或移除 |
| `docs/待办清单.md` | 改 | 登记占位边界（天气/地域/漏斗浏览量/历史回放/地图）+ 大屏交付项 |

---

## 五、风险与缓解

| 风险 | 缓解 |
|---|---|
| 无登录数据泄露（聚合客流/承载/告警公开） | Nginx IP 白名单 + 应用层 `SCREEN_TOKEN` 软门；端点 PII 白名单（只出聚合/计数，**绝不出** Booking/blacklist/appeal 原始行） |
| 公开端点 DDoS/抓取 | `/api/screen/*` 加缓存（`revalidate`/内存 TTL 10–30s）；轮询天然限频；Nginx rate-limit |
| 高德地图阻塞（R6） | C1/C6/C7 地图层统一占位组件 + 真实 `content.listPois` 坐标做 POI 列表降级；key 到位仅换渲染层，不阻塞其余区块 |
| mock 数据被误当真（天气/浏览量/历史回放/地域） | 占位**视觉标注**"示例数据/待接入"；记入 `docs/待办清单.md` 单一入口；评审明确真/假边界 |
| 性能（force-dynamic 全量直读） | 每页 `Promise.all` 并发 + `.catch(默认值)`；重聚合走 MV；公开端点加缓存；7×24 建 MV 而非运行时全表扫 |
| Excel/PNG 导出在无登录下 | Excel：新增公开 `/api/screen/export/[metric]`（复用 `lib/excel`，可 token 门、只导聚合脱敏）；PNG：echarts `getDataURL()` 客户端导出，无后端无鉴权问题（最适合 C5/C7"截图一张图"） |
| 旧 realtime 蓝黑配色 ≠ 设计稿绿色科技风 | C1 迁移时按 `--screen-*` 重着色，旧屏仅作功能蓝本 |
| echarts 整包体积 | `echarts/core` 按需注册 + `echarts-for-react/lib/core` |
| 大屏 dev 专属现象 | 按 CLAUDE.md：HMR/StrictMode 双挂载等 dev 噪声不计 bug，疑似缺陷在 docker/生产构建复测 |

---

## 六、Checkpoint Plan

| 阶段 | 子步 | Done | Commit |
|---|---|---|---|
| 0 地基 | 0.1 middleware 放行 + `(screen)` 暗色 layout + theme.css + 软门 | [x] | 9398559 |
| | 0.2 ScreenShell/useScreenScale/useCnClock/ScreenHeader/StatusBar | [x] | _见下_ |
| | 0.3 echarts setup+theme + 8 封装图表 + DarkBarList/ScreenCard/KpiTile | [x] | _见下_ |
| | 0.4 `/api/screen/[metric]` 公开端点骨架 + useScreenPoll | [x] | _见下_ |
| 1 数据页 | 1.1 C5 数据概览首屏 | [x] | _见下_ |
| | 1.2 C3 客流与预约趋势（+Excel） | [x] | _见下_ |
| | 1.3 C2 运营态势面板 | [x] | _见下_ |
| | 1.4 C4 分时热力（+ `analytics_weekly_hourly_heat` MV） | [x] | _见下_ |
| 2 半占位 | 2.1 C1 综合态势（迁移 realtime + 重着色，地图占位） | [ ] | — |
| | 2.2 C6 数字孪生（孪生面板真实，地图占位） | [ ] | — |
| 3 收口 | 3.1 C7 运营宣传一张图（三区真实，GIS/漫游占位） | [ ] | — |
| | 3.2 占位边界登记 `docs/待办清单.md` + 静态闸（tsc/lint/中文红线） | [ ] | — |
| 4 阻塞后 | 4.1 高德 key 到位补地图层（不进本期验收） | [ ] | — |

---

## 备注
- **大屏全程无须登录**：middleware 放行 `/screen` 前缀；RSC 直读 repo（不触发 requireRole）；刷新走公开 GET route handler；禁用带 requireRole 的 server action；生产以 Nginx IP 白名单 + 可选 `SCREEN_TOKEN` 软门收口；PII 白名单铁律。
- 设计稿编号对照：C1 situation / C2 operation / C3 trend / C4 heatmap / C5 overview / C6 twin / C7 poster。
- 熔断已落地（核销写路径内联），大屏"已自动暂停"如实有效，仅被动反映 slot.status，不触发任何写入。
