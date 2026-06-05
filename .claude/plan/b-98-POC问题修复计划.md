# B 端后台 · POC 问题修复计划（功能 + 红线纠偏）

> 依据 `docs/B端POC全量测试发现.md`（F1–F5 / U1–U2 / N1–N3 / P1–P10）与 `docs/B端联调BUG清单.md`（B1–B24）编制。
> 经 **后端 + 前端双视角分析**（`/multi-plan` 双子代理，已逐条对照真实代码核验）综合，并经**一轮审计校准**（2026年6月5日，审计发现已就地折入正文）。
> **与 `b-99-收尾计划.md` 分工**：b-99 管"质量/安全加固"（R1–R7）；**本文管"POC 巡检发现的功能错误与红线纠偏"**。b-99 的当前落地状态见 §0.A，重叠处下文逐条标注接缝。
> **范围边界**：按 BUG清单的设计系统统一决策，所有**纯视觉/样式项**（B18 登录视觉 / B19 表格美化 / B20 按钮层级 / B24 侧栏铺底 / **B14 菜单分组折叠交互**（需客户端状态+localStorage，非纯视觉但同归交互/theme pass）/ 字体 / 内联 style 清理）归入后续**统一 theme 一次性调整**，**不在本计划**。本计划只做功能正确性、红线 6（100% 中文）、红线 4（承载熔断）相关项。

---

## 0 · 前置状态与关键修正（务必先读）

### 0.A · b-99 收尾计划已大部落地（按 `git log` HEAD 核验）

R1–R5、R7 **均已合入**，**仅 R6（高德地图）未做**：

| 项 | 提交 | 落地证据 |
|---|---|---|
| R1 domain 单测 | `5cc460c`/`e822401` | `package.json` 有 `test:vitest`；`booking/checkin/riskcontrol/domain/*.test.ts` 三件齐 |
| R2 SSE 鉴权 | `c20f68e` | `api/sse/[topic]/route.ts:23` `await getSession()` → 未登录 401 |
| R3 路由 RBAC | `527e7c7` | `shared/auth/roles.ts` + middleware 自解 JWT 按前缀拦 |
| R4 a11y | `5c8f2fb` | `window.prompt` 已消（重置密码/链接/图片改内联表单 + label） |
| R5 英文 lint | `916f1e4` | `lint-cn.mjs` JSX 孤立英文启发式 + 白名单 |
| R7 写操作审计 | `3d0d770` | create/reset 透传 actorId + 写 audit_log + 层级校验 |
| R6 高德 | — | ⏳ **未做**（阻塞外部 key） |

**对本计划的连带影响（已折入对应集群）**：
- 执行顺序无须"R2 接线前置"——`getSession` 门**已在**，C3/C6 接 SSE 时**验证即可**，非新工作。
- C2 菜单角色过滤**现在就能做**（R3 已落地，不再"先全显再补"）。
- C5 时区 lint / C7 频道名英文断言**往现有 `lint-cn.mjs` 增量加规则**（不是"与 R5 合并一次写"）。
- C-defer 的 RichTextEditor `window.prompt` **已闭合**（R4）。
- 仅 C3/C6 的高德占位假设（依赖 R6 未做）**仍成立**。

### 0.B · 源文档技术判断的修正（双代理核验）

1. **时区基础设施已就位**：`docker-compose.yml` 已对 app/pg/gotrue/minio **全部设 `TZ=Asia/Shanghai`**（P10 称"docker 均无 TZ"过时）。仍需修的是**与进程 TZ 无关**的 `toISOString().slice(0,10)` 取业务日（恒按 UTC，北京 0–8 点偏到昨天）。
2. **pg-boss 已在跑**（`instrumentation-node.ts` 已 start，注册了 `refresh-analytics-mv` cron + 熔断监听）。加"每日生成时段"只是再注册一个 schedule，**零新增基础设施**。
3. **在园数 SSE（B11）有两条路径**：`checkin/service/checkin.ts:157` 进程内 `bus.publish` **携 `checkedInCount`**；DB 触发器 `notify_checkin_event` 那条 **无该字段**被前端忽略。脆弱点：**多实例下 `bus.publish` 不跨进程，只有触发器路径跨实例而它缺字段** → 在园数不更新、熔断自动暂停（红线 4）也依赖单进程。
   - ⚠️ **待运行时复验**："单实例走 service 时在园数会更新"是**读码推断**，非实测——B11 当时经 `/realtime` 调试页**手动 DB UPDATE** 触发，只走触发器（畸形 payload）路径，未走 service `bus.publish`。**C3 默认"脏信号+回拉"已绕开 payload 形状、风险被吸收；实施 C3 时顺手实测一次 service 核销路径确认即可。**
4. **`iot_event` / `parking_state` 两频道运行时都收不到事件，成因不对称**：
   - **`iot_event`**：真·零发布源（全仓只有频道常量 `iot/events.ts` + listener + route + UI 文案，无任何 NOTIFY/`bus.publish`）。
   - **`parking_state`**：发布契约**已写好但是死代码**——`traffic/service/traffic.ts:13` `syncParkingStatus` 里有 `bus.publish("parking_state", …)`，但**该函数全仓无人调用**，且停车页无 `EventSource`、无跨进程触发器 → 运行时同样收不到。
   - 结论不变：本轮设备/停车页**不加/不接 `EventSource`**（否则又造假实时）；下一迭代成本不同——parking 缺的只是"调用 `syncParkingStatus` 的写入口 + 页面订阅"，iot 还要从零造发布源。
5. **登录失效（F3/B2/B15/B17）最可能是环境问题（B21）非代码**：cookie `secure: NODE_ENV==="production"`，容器 QA 经 http(VPN) 访问 → 浏览器不回传 secure cookie → middleware 读不到 → 表现为"点登录没反应"。`Input` 是纯原生 input、表单结构与错误回显逻辑都正常。**须先在 docker 生产构建 + https/或临时 secure=false 复测定性，再决定是否改代码**。

---

## Task Type
- [x] Fullstack（后端：SSE 契约 / 时段生成 / 时区 / 画像 SQL / 登录环境；前端：状态语义 / 导航 / 大屏 / 英文收口 / 画像展示）

---

## 一、待用户拍板的产品决策（已给推荐默认值，可直接按默认执行）

| # | 决策点 | 推荐默认 | 影响集群 |
|---|---|---|---|
| D1 | **瞬时承载量口径**（红线 4）：当前 dashboard 用"当日各时段容量求和=1050"当分母 → 90% 闪红几乎永不触发（B4） | 定一个**瞬时承载量常量/配置**（占位先用单值 env `PARK_INSTANT_CAPACITY`），dashboard 与大屏统一引用。⚠️ **PRD 给数前这是占位**——机制就绪但阈值任意，红线 4 只能记"**机制就绪、待 PRD 数值确认**"，勿当完全闭合 | C3、C6 |
| D2 | **iot/parking 是否要真实时** | 本轮**否**——删假文案即可。成因不对称（见 §0.B.4）：`iot_event` 真零发布源；`parking_state` 已有 `bus.publish` 但是死代码。真心跳/车位上报排下一迭代，parking 成本更低 | C3、C6 |
| D3 | **时段滚动生成**：天数 N + 节假日日历来源 | N=14 天；节假日先**手工维护**（模板 dateType=工作日/周末/节假日） | C4 |
| D4 | **生产是否上 https 反代** | 是（cookie secure 才成立）；过渡期给 secure 加 `COOKIE_SECURE` env 开关 | C9 |
| D5 | **数据大屏范围** | **MVP**：复用现有 repo + `checkin_event`/`slot_changed` SSE，车位/地图先占位+数据表 | C6 |
| D6 | **内容状态动词统一**（B10） | chip 用「草稿/已发布/已下线」；按钮统一「发布/下线」 | C1 |
| D7 | **OTA 是否中文化** | 定中文「第三方平台」并全站统一（同时进 R5 lint 白名单兜底） | C7 |
| D8 | **滑动续期（B16）是否本轮做** | 否——本轮只统一 `GOTRUE_JWT_EXP` 与 cookie `maxAge`；滑动续期排下一迭代 | C9 |

> 若用户不另行指示，**执行时按上表推荐默认值进行**。

---

## 二、修复集群（按"功能+红线优先"排序，C1–C10）

### C1 · StatusChip 语义错配【S，最快闭合最离谱实例】（F1/B10/P2/P5）
- **根因**：`app/src/lib/ui/status-chip.tsx` 仅 8 个预约/风控状态键，被全站 13 处复用；调用方 JSX 里硬塞三元把各领域状态翻译成预约词（设备 离线→"已取消"、告警→"已拉黑"；路况→"启用/已暂停"；内容 草稿/归档→"已暂停"）。
- **方案（推荐 A，纯加法不破坏现有键）**：扩 `StatusKey` 联合 + `STATUS_CONFIG` 加领域键：
  - 设备：`DEVICE_ONLINE`「在线」绿 / `DEVICE_OFFLINE`「离线」灰 / `DEVICE_ALERT`「告警」红
  - 路况：`ROAD_SMOOTH`「畅通」绿 / `ROAD_SLOW`「缓行」黄 / `ROAD_JAM`「拥堵」红
  - 内容：`DRAFT`「草稿」灰 / `PUBLISHED_OK`「已发布」绿 / `OFFLINE_CONTENT`「已下线」灰
  - 停车：`LOT_OPEN`「空闲」绿 / `LOT_FULL`「已满」红 / `LOT_CLOSED`「关闭」灰
  - 调用方把三元 map 目标键换成领域键。旧键全部仍合法（TS 联合兜底）。
- **改的调用点（已核验）**：`iot/devices/page.tsx:69`、`iot/[deviceId]/page.tsx:54`、`traffic/road/page.tsx:54`、`traffic/parking/page.tsx:72`、`content/news:38`、`content/intro:37`、`content/activities:59`、`content/knowledge:68`。**勿动**（已正确）：`booking/bookings:139`、`booking/slots:134`、`riskcontrol/blacklist:100`、`(admin)/page.tsx:80`、`system/page.tsx:57`、`content/.../signups:53`。
- **D6 附带**：内容状态切换按钮动词统一（intro/activities 已是「发布/下线」，knowledge 改用同一套，弃「启用/停用」）。
- **a11y**：告警(红)/离线(灰) 文字必须明确区分（不靠颜色）；同步修 B6（仪表盘 LiveDot 把 ALERT 当灰点 = 同源语义，见 C3）。
- **演进**：统一 theme pass 时可下沉为 `<Chip color label>` 原语 + 领域映射表（方案 B），与 A 不冲突。
- **关闭**：F1、B10、P2、P5；推进红线 6。

### C2 · 导航可达性【S】（N1/N2/N3/B13/B22）
均在 `app/src/lib/ui/nav/menu.ts` / `breadcrumb.tsx` / `sidebar.tsx`：
- **N2 菜单坏链**：`menu.ts:51` `/iot/detail` 真实路由是 `/iot/[deviceId]` → 查 id="detail" 报"设备不存在"。**删除该菜单项**（设备详情是列表行进入的子页，不该是顶级入口）。
- **N1 缺失入口**：`/booking/bookings`（预约单查询）加入"预约管理中心"组；`/system`（系统管理）加入菜单（新建"系统设置"组或并入合适分组）。**`/system` 仅 SUPER_ADMIN 可见 → 直接按角色过滤**（R3 已落地，`shared/auth/roles` 就位，role 可用；不再"先全显再补"）。
- **N3/B13 返回首页**：`sidebar.tsx:54-67` logo 块包成 `<Link href="/" aria-label="返回仪表盘首页">`。
- **B22 面包屑中间层不可点**：`breadcrumb.tsx:31-37` group/page 均 `<span>`。改为：`pathname !== item.href`（在子页）时 page 段渲染 `<Link href={item.href}>` 可返回列表，子页名（新建/编辑）作末段 span；`pathname === item.href` 保持 span。补 `aria-current="page"`。
- **关闭**：N1/N2/N3、B13、B22、P4。

### C3 · 在园数 SSE 契约 + 删假实时文案 + LiveDot 真连接态【dashboard 契约 M / 删文案 S】（F2/P6/B5/B11/B6）
- **dashboard 在园数（B11，必做）**：**推荐默认走"脏信号 + 回拉"轻量方案**——触发器只发脏信号，前端收到后回拉一个轻量 server action 取最新在园数。理由：POC 基本单实例 docker，单实例下 service 的 `bus.publish` 路径在园数应已工作（**实施时按 §0.B.3 实测一次 service 核销路径确认**）；重写触发器"核销后重算再 NOTIFY"成本/风险高（须回归 `verify-realtime.ts`），且与 b-99 的多实例加固重叠，宜降级到"多实例上线前再做"。
  - 备选（多实例上线时再做）：统一 `checkin_event` payload 契约，触发器输出与 service 同 shape `{slotId, checkedInCount, capacity, circuitBroken}`（在 `listener.ts` 归一 snake/camel），连带加固红线 4 熔断在多实例下的可靠性（`instrumentation-node.ts:42` 熔断监听同依赖该 payload）。
  - **C6 大屏在园数须与本项方案一致**：若本项走"回拉"，C6 也走同一回拉，勿依赖统一 payload shape。
- **iot/parking 假实时（F2/P6，D2=否）**：这两频道运行时都收不到事件（见 §0.B.4），**本轮不加 EventSource**；删除"已接入 parking_state/iot_event SSE 频道，实时更新"等误导文案（`traffic/parking/page.tsx:26,40`、`iot/devices/page.tsx:28,42`、`iot/[deviceId]/page.tsx:74`），改为中性「数据定时刷新」。这些英文频道名同属 C7 红线 6。
- **LiveDot 写死（B5）**：`(admin)/page.tsx:38` `<LiveDot alive />` 改为由 OccupancyCard 的 EventSource `onopen/onerror` 上报真实连接态；OccupancyCard 补 `onerror`。
- **B6 告警灰点**：仪表盘设备点 `page.tsx:102` `alive={d.status==="ONLINE"}` 把 ALERT 显示成离线灰点 → 改为三态（在线/告警/离线，与 C1 设备语义一致）。
- **接缝**：SSE route 的 `getSession` 鉴权门（R2）**已在**，验证即可。
- **关闭**：B11、B5、B6、F2/P6；间接加固红线 4。**风险**：若选备选方案，触发器重写需回归 `tsx scripts/verify-realtime.ts`。

### C4 · 每日时段生成（B23/P3 未来段，🔴 跨日/未来日预约+补录瘫痪）
- **根因（结构性）**：`booking_slot` 仅由 seed 造数，**过了 seed 覆盖区间当天即 0 时段** → onsite + 在线预约同时空窗。配额配置页（`booking/slots/page.tsx`）**只读**，运营无法后台补建（R-cfg 缺）。
- **诊断澄清（与 C5 分工，勿改正确代码）**：巡检 P3 的"**当天**有 5 个 ACTIVE 时段却下拉为空"**不是本 cluster 的问题**——`getOnsiteSlots`（`onsite/actions.ts`）已正确以 `new Date(date+"T00:00:00Z")` 匹配 `@db.Date`，`listSlotsByDate` 精确匹配**本身正确，勿动**。P3 当天空窗的真正诱因是**表单默认日期偏移**（`onsite/page.tsx:24` 的 `toISOString`，北京 0–8 点偏到昨天）→ 归 **C5** 处理。C4 只负责"跨日/未来日的结构性 0 时段"。
- **方案 B 先止血【S，本轮】**：`booking/slots/page.tsx` 加"按模板/复制昨日生成本日时段"+"新建单个时段" server action（`requireRole(ADMIN_UP)`），日期走 `chinaToday()`（见 C5）。先写好 `booking/service` 的"建时段"用例（A/B 共用）。
- **方案 A 根治【L，下一迭代】**：新增 `slot_template` 模型（按 `dateType` 工作日/周末/节假日存时段名/起止/各渠道配额）+ pg-boss `generate-daily-slots` cron（每日 00:05 Asia/Shanghai，幂等 `ON CONFLICT (date,start_time) DO NOTHING`，滚动生成未来 N=14 天，D3）。
- **受影响**：`booking/service/booking.ts`、`booking/repository.ts`（createSlots/upsert）、`booking/slots/page.tsx`（表单+action）；A 另加 `prisma/models/booking.prisma` + 迁移 + `instrumentation-node.ts` cron 注册。
- **关闭**：B23/P3，补齐 R-cfg。**风险**：cron 与手动建撞 → 幂等唯一键（参考既有 `booking_daily_unique` 约束）。

### C5 · 时区统一 time.ts【S~M，C5a 须先于 C4】（P10）
> ⚠️ **C5a（建 `time.ts`）必须先于 C4** —— C4 止血建时段的日期走 `chinaToday()`。C5b（onsite/export 改写 + lint）可在 C4 之后。

- **C5a · 建收口函数（先做）**：新建 `app/src/shared/lib/time.ts`——`chinaToday()`（**用 `Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai'})` 取 CST 营业日，禁再用 `toISOString`**）、`cstStartOf()`、`formatCnDate`/`formatCnDateTime`（复用/迁 `shared/format.ts`）。
- **C5b · 改真 bug（与进程 TZ 无关）**：`onsite/page.tsx:24`、`api/export/[module]/route.ts:98`（文件名）+`:59-61`（30 天范围端点）的 `new Date().toISOString().slice(0,10)` 改用 `chinaToday()`；`analytics/repository.ts:35-36` 端点来自上面 export 的 `new Date()`，链路上一并改。
- **勿动（已正确）**：`booking/domain/rules.ts:54` canCancel（`@db.Date` 还原日历日 + `+08:00` 锚北京墙钟）、`booking/slots/page.tsx:15`、`checkin` rules、所有 `paidAt/createdAt` 瞬时戳。
- **lint 防回归**：R5 英文断言已落地（`916f1e4`）→ **往现有 `lint-cn.mjs` 增量加**时区规则（禁 `toISOString().slice` 取业务日 + 裸 `+08:00`，time.ts 豁免），与 C7 频道名英文断言同一次改。
- **可选纵深**：`Dockerfile` 补 `ENV TZ=Asia/Shanghai`。
- **关闭**：P10、B23 次因（默认日期偏移）。

### C6 · 数据大屏 MVP（P1，🔴🔴 25 页最严重功能缺失）
- **现状**：`app/src/app/(dashboard)/realtime/page.tsx` 是调试页（深灰底、满屏英文 `slot_changed`/`Postgres NOTIFY`/`UPDATE booking_slot`、"等待事件…"）。`(dashboard)` 组无 layout → 天然全屏，适合大屏；middleware matcher 仍覆盖 → 已 auth-gated。
- **方案（MVP，D5）**：重写为全屏中文可视化，复用现有数据源：
  - 顶部：景区名 + 中文实时时钟「2026年6月5日 周五 14:30」+ 真实 SSE 连接态（中文，不露 channel 名）。
  - KPI 瓦片：① 在园人数/**瞬时承载量**+占比%（达 90% **整屏闪红**，落地红线 4 机制；口径用 D1，**不复用 B4 的当日累加**）；② 今日预约总数；③ 设备在线率（含告警分项）；④ 客流趋势（复用 `analyticsRepository.getDailyTraffic/getHourlyPeak` 物化视图 + `BarList`）；⑤ 分时段名额占用条。
  - 车位/路况上图：D2=否 + 阻塞高德 key（R6 未做）→ 先占位 + 数据表（a11y 等价）。
- **依赖**：C3 的在园数实时方案（默认"脏信号+回拉"，大屏须用同一方案，勿各自实现）；D1 瞬时承载量口径。
- **a11y**：红色闪烁需非颜色冗余（文字"承载预警"）+ 频率 ≤3Hz（癫痫安全）。
- **关闭**：P1、U1（大屏英文）；红线 4 大屏闪红**机制就绪**（⚠️ D1 阈值待 PRD 数值才算真闭合）。**全量大屏**（多屏轮播 + 高德地图 + 车位/心跳实时源）排下一迭代。

### C7 · 红线 6 英文泄漏收口 + 渠道页【S~M】（U1/P7/P8/B7 + 集群6）
- **可见英文清单（已核验）**：
  - SSE 频道名 `checkin_event`(`(admin)/page.tsx:40`)/`parking_state`(`parking:26,40`)/`iot_event`(`iot/devices:28,42`、`iot/[deviceId]:74`)/`slot_changed`(`realtime:49`) → C3/C6 顺手中文化（频道名是技术标识，UI 不该露）。
  - **渠道枚举码整列**（P7）：`booking/channels/page.tsx:6-9,32` 显示 `MINI_PROGRAM/ONSITE_MAKEUP/OTA/ADMIN_MANUAL` → **删该列或映射中文**；该页本就固定 4 种编译期常量，**只需中文 label map、无需真后端**（方案 A）。
  - `OTA`（`booking/bookings:20`、`booking/slots:89` 表头、`analytics/source`）三种写法不一 → 按 D7 统一中文「第三方平台」。
  - **完整 UUID**：`iot/[deviceId]/page.tsx:37` `设备 ID：${deviceId}` → 截断前 8 位或人类可读编号。
  - **BK-SEED 前缀**：仅种子数据（`prisma/seed.ts:100` `bk-seed-`；真实预约 `repository.ts:66` 是 `bk-`+hex，生产无此问题）→ 种子前缀改 `bk-` 对齐，或显示层用业务编号。
- **集中化**：现有 ≥3 份重复的"渠道枚举→中文" map（`export/[module]/route.ts:16-21`、`analytics/source/page.tsx:12`、`booking/bookings:20`）**抽到 `app/src/shared/labels.ts` 共用**，消除重复 + `OTA` 三写法。
- **接缝（b-99 R5 已落地 `916f1e4`）**：本集群任务 = ① 把白名单实际清单（`OTA`/品牌/单位 km、PM2.5）**补进 R5 已有白名单**；② 频道名英文断言**增量加进现有 `lint-cn.mjs`**（与 C5b 时区规则同一次改）；③ 清存量（上表各处）。
- **关闭**：U1、P7、P8、B7、红线 6。

### C8 · 用户画像【S】（P9）
- **内部编号泄漏**：`analytics/profile/page.tsx:19` description 含「（B17总览/B18出行偏好/B19APP偏好）」（PRD 需求条目号，不该给用户）→ 删括号编号，改纯中文描述；"APP 偏好" Tab 的 `APP` → 「应用偏好」（红线 6）。
- **维度排序混乱（根因 SQL）**：`analytics/repository.ts:87` `getProfileOverview` 末尾 `ORDER BY q.dimension`（按列 collation 排中文标签，无业务序）→ 性别年龄混排、年龄非单调、"18岁以下 0"空条夹中间。**方案 A**：SQL 加显式 `sort_order`（性别 1-2、年龄段 10/20/30/40/50 递增）`ORDER BY sort_order`。**须在 repo 层改**（`export route:84` 也调 `getProfileOverview`，前端重排会漏掉 Excel 导出）。可选在 Tab 内按"性别/年龄"前缀分组渲染。
- **关闭**：P9。**风险**：`getProfileOverview` 是运行时聚合非物化视图，改 SQL 无需 refresh。

### C9 · 登录链路定性 + B21【先复测 S，改 secure 开关 S】（F3/B2/B15/B17/B21/B16）
- **先定性（必做，勿先改代码）**：docker 生产构建下，(a) 经 https 反代点登录，或 (b) 临时 `secure:false` 走 http，复测点登录是否跳转 + 输错密码是否回显红字。**大概率证明是 B21 cookie 问题，登录代码无需改**（`Input` 原生、表单+`useActionState`+错误回显逻辑都在）。
- **永久修 B21（D4）**：cookie `secure` 改 `COOKIE_SECURE` env 开关（默认 prod=true，内网 http QA 置 false）；生产强制 https 反代。
- **兜底（低成本，可选）**：密码框 `onKeyDown` Enter→`requestSubmit`（B15 双保险）。
- **B16 会话（D8=本轮只对齐方向，须明确取舍）**：当前 `GOTRUE_JWT_EXP=604800`（7 天，QA 便利临时调大）与 login cookie `maxAge=3600`（1h）不一致、**JWT 寿命远超 cookie**。生产目标 = **短时效**（如 1h，二者对齐）。但**没有滑动续期就统一到短时效 = 已知体验回退**（每小时被踢），而滑动续期 D8 已推下一迭代 → 本轮取舍：**QA 期可临时留 7 天便利联调**；**生产上线前必须改回短时效 + 落地滑动续期（随 D8 一并下迭代），勿在无续期时把生产 cookie 也设成 7 天（安全回退）。**
- **受影响**：`(auth)/login/page.tsx`（secure 开关 + maxAge）、`_login-form.tsx`（可选 Enter 兜底）、`docker-compose.yml`/`.env.example`（`COOKIE_SECURE`）。
- **关闭**：F3/B2/B15/B17（多半经 B21 一并消失）、B21、B16（部分）。**纪律**：必须 docker prod 下定性，dev/VPN 现象不算（CLAUDE.md）。

### C10 · 原生日期控件中文化【S~M】（U1/B23 次要④）
- **原生 `type="date"`（渲染 `06/03/2026`）**：`booking/onsite/page.tsx:188`、`analytics/traffic/page.tsx:58`。
- **方案（推荐）**：交付期先做**最小**（控件旁同步显示 `formatCnDate(value)` 中文回显）保证可见日期中文；统一 theme pass 时做自定义 `lib/ui/date-picker.tsx`（值仍存 `YYYY-MM-DD` 不破契约，显示中文「2026年6月5日」）彻底替换。注意 CLAUDE.md 内存约束，避免重依赖。
- **关闭**：U1/P8 日期格式、B23 次要④。

### C-defer · 富文本编辑器（B1/F4）—— 无需修
- 已在 docker 生产构建复测**挂载正常**（dev/HMR/StrictMode 专属）。本计划**不修**；RichTextEditor 的 `window.prompt` 已由 b-99 R4（`5c8f2fb`）闭合。

---

## 三、与 `b-99-收尾计划.md` 的接缝

> 状态校准（按 `git log` HEAD，详见 §0.A）：R1–R5、R7 **均已落地**，仅 R6 未做。下表"关系"列已从"先行依赖"改为"在已落地成果上增量/验证"。

| b-99 项 | 状态 | 与本计划关系 |
|---|---|---|
| **R2 SSE 鉴权** | ✅ 已合 | C3/C6 接触 SSE 时 `getSession` 门**已在**——验证即可，非新工作 |
| **R3 RBAC** | ✅ 已合 | C2 菜单**直接按角色过滤**（`shared/auth/roles` 已就位），不再"先全显" |
| **R4 a11y** | ✅ 已合 | C-defer 的 RichTextEditor `window.prompt` 已闭合 |
| **R5 英文 lint 启发式** | ✅ 已合 | C5b 时区规则 + C7 频道名断言**增量加进现有 `lint-cn.mjs`**；C7 把白名单清单补进 R5 已有白名单 |
| **R1 单测** | ✅ 已合(可续) | C4 "建时段"用例、C3 在园数回拉值得**补挂到已有 vitest** |
| **R7 写操作审计** | ✅ 已合 | C4 建时段 / C9 登录等写操作经过审计层（已就位） |
| **R6 高德** | ⏳ 未做 | 仍阻塞 C6 全量大屏地图区 / C3 parking 实时 → MVP 阶段都用占位+数据表 |

---

## 四、建议执行顺序（功能+红线优先）

1. **C9 登录定性 + B21**（🔴 阻断真人登录，先复测后小改）
2. **C5a · 先建 `time.ts`（`chinaToday()` 等）** —— C4 依赖它，先落地核心收口函数
3. **C4 时段生成止血(B)**（🔴 当天瘫痪，日期用 `chinaToday()`）
4. **C1 StatusChip**（最离谱实例，S 快赢）
5. **C2 导航**（基本可用性，S；R3 已合可直接角色过滤）
6. **C3 在园数契约 + 删假文案 + LiveDot**（修 B11/B5/B6/F2 + 加固红线 4；`getSession` 门已在，验证即可；顺手实测 service 核销路径）
7. **C5b · 改 onsite/export 2 处 bug + lint 增量规则（连 R5 白名单、C7 断言）**
8. **C7 英文收口 + 渠道页** / **C8 画像**（S 合规快赢）
9. **C6 数据大屏 MVP**（🔴🔴 工作量 M-L，依赖 C3 在园数方案 + D1 口径）
10. **C10 原生日期中文化**
11. **下一迭代**：C4 cron 滚动生成(A)、C9 滑动续期、C6 全量大屏、iot/parking 真实时源、R6 高德地图

---

## Key Files

| File | Operation | Cluster |
|---|---|---|
| `app/src/lib/ui/status-chip.tsx` | Modify | C1 加领域状态键 |
| `app/src/app/(admin)/{iot/devices,iot/[deviceId],traffic/road,traffic/parking,content/*}/page.tsx` | Modify | C1 调用方换领域键 |
| `app/src/lib/ui/nav/menu.ts` | Modify | C2 删坏链 + 加入口 |
| `app/src/lib/ui/{sidebar,breadcrumb}.tsx` | Modify | C2 logo Link + 面包屑可点 |
| `app/prisma/migrations/*realtime*/migration.sql` · `app/src/infrastructure/realtime/listener.ts` · `app/src/modules/checkin/service/checkin.ts` | Modify | C3 在园数方案（默认回拉；备选 payload 契约统一时改） |
| `app/src/app/(admin)/page.tsx` · `_occupancy-card.tsx` · `app/src/lib/ui/live-dot.tsx` | Modify | C3 LiveDot 真态 + B6 |
| `app/src/app/(admin)/{traffic/parking,iot/devices,iot/[deviceId]}/page.tsx` | Modify | C3 删假 SSE 文案（含 C7 频道名） |
| `app/src/modules/booking/{service/booking.ts,repository.ts}` · `app/src/app/(admin)/booking/slots/page.tsx` | Modify | C4 建时段用例+入口 |
| `app/prisma/models/booking.prisma` + 新迁移 · `instrumentation-node.ts` | Create/Modify | C4 方案A（下一迭代）slot_template + cron |
| `app/src/shared/lib/time.ts` | Create | C5a 时区收口（先于 C4） |
| `app/src/app/(admin)/booking/onsite/page.tsx` · `app/src/app/api/export/[module]/route.ts` · `app/src/modules/analytics/repository.ts` | Modify | C5b toISOString→chinaToday |
| `app/scripts/lint-cn.mjs` | Modify | C5b 时区规则 + C7 频道名断言（增量加进现有 R5 lint） |
| `app/src/app/(dashboard)/realtime/page.tsx` + 新大屏卡片 | Modify/Create | C6 大屏 MVP |
| `app/src/shared/labels.ts` | Create | C7 渠道枚举中文 map 收口 |
| `app/src/app/(admin)/booking/channels/page.tsx` | Modify | C7 删英文枚举列 |
| `app/src/app/(admin)/iot/[deviceId]/page.tsx` | Modify | C7 UUID 截断 |
| `app/src/app/(admin)/analytics/profile/page.tsx` · `app/src/modules/analytics/repository.ts` | Modify | C8 去编号 + SQL 排序 |
| `app/src/app/(auth)/login/page.tsx` · `_login-form.tsx` · `docker-compose.yml` · `.env.example` | Modify | C9 cookie secure 开关 + maxAge |
| `app/src/app/(admin)/{booking/onsite,analytics/traffic}/page.tsx` | Modify | C10 日期中文回显 |

---

## Checkpoint

| 集群 | 子步 | Done |
|---|---|---|
| C1 StatusChip | 加领域键 + 8 处调用方换键 + 动词统一(D6) | [x] |
| C2 导航 | 删 /iot/detail + 加 bookings/system 入口(角色过滤) + logo Link + 面包屑可点 | [x] |
| C3 在园数/假SSE | 在园数回拉(实测 service 核销路径) + 删假文案 + LiveDot 真态 + B6 三态 | [x] (service 核销路径实测留待 docker QA) |
| C4 时段生成 | 建时段 service 用例 + slots 页手动建入口(止血B) | [x] |
| C5 时区 | **C5a time.ts 先于 C4** + C5b onsite/export 改 chinaToday + lint 增量规则 | [x] |
| C6 大屏 | /realtime 重写为中文 KPI 大屏 + 90% 闪红机制(口径 D1，**红线4 待 PRD 数值才算真闭合**) | [x] |
| C7 英文收口 | labels.ts 收口 + 渠道列中文 + UUID 截断 + OTA 统一(D7) + lint-cn 频道名英文清零回归 | [x] |
| C8 画像 | description 去编号 + getProfileOverview SQL 排序 | [x] |
| C9 登录 | docker prod 复测定性 → COOKIE_SECURE 开关 + maxAge 对齐(**生产=短时效，勿设7天；滑动续期下迭代**) | [x] (docker prod 复测定性留待 QA;代码侧已落 COOKIE_SECURE+maxAge 对齐) |
| C10 日期 | onsite/traffic 原生 date 旁中文回显 | [ ] |

---

## 验证
`cd app && pnpm lint && pnpm exec tsc --noEmit && node scripts/lint-cn.mjs && pnpm test`；实时链路 `tsx scripts/verify-realtime.ts`；登录定性必须 **docker 生产构建**下复测（dev/VPN 现象不算）；打包纪律严格按 CLAUDE.md（先停 dev → 停 docker → `pnpm build` 限速）。
