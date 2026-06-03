# B 端后台 · 联调 Bug 清单

> 配合 `docs/B端联调测试清单.md`。逐页测试时实时登记。**当前阶段只记录、不修**（用户指示），遇阻塞才处理以继续。
> 严重度：🔴 阻断 · 🟠 高 · 🟡 中 · 🔵 低
> 状态：🆕 新登记 · 🔍 排查中 · 🧪 待复核 · 🛠️ 待修 · ✅ 已修 · ❎ 非 Bug/按设计

| # | 严重度 | 状态 | 页面/位置 | 现象 | 初步判断 | 证据 |
|---|---|---|---|---|---|---|

## B1 · 富文本编辑器（TipTap）经 VPN/dev 不挂载
- **严重度** 🟠 高　**状态** 🧪 待复核　**页面** `/content/news/new`（及所有富文本新建/编辑）
- **现象**：页面整体渲染正常（标题/摘要/正文/封面字段、保存按钮都在），但正文区永远停在占位框 `<div aria-busy="true">`，等到 +8s 仍 `contenteditable=false`、无工具栏，无法输入。
- **关键线索**：控制台刷屏 `WebSocket connection to 'ws://10.7.0.1:3000/_next/webpack-hmr' failed`——dev 模式 HMR 热更 WS 经 VPN 连不上浏览器。
- **对比**：同代码在服务器**本地** headless Chrome（localhost，HMR WS 正常）下编辑器**能挂载+输入+加粗+保存**（已实测）。
- **初步判断**（已收窄）：**仪表盘的客户端实时卡片 + SSE 在同环境(VPN/dev)下正常渲染**（见 B3），故**排除"客户端组件普遍挂不上"**，问题**收窄为 TipTap `useEditor` 专属**——疑 React 19 dev StrictMode 双挂载 / TipTap v3 SSR(`immediatelyRender:false`) 初始化竞态致 editor 恒为 null。**未必是业务代码 bug**。**待复核**：生产构建是否正常；或调整 useEditor 初始化时机。
- **证据**：`/tmp/shot-5-editor.jpg`、`/tmp/shot-editor-diag.jpg`；容器 DOM = `<div class="min-h-[260px] ..." aria-busy="true"></div>`。

## B2 · 登录表单经 CDP 点提交不跳转
- **严重度** 🟡 中（测试侧）　**状态** 🔍 排查中　**页面** `/login`
- **现象**：CDP 填好手机号/密码、点「登 录」（或 `requestSubmit()`）后停在 `/login`，无 `[role=alert]` 报错，也未跳转。
- **对比/反证**：同一 `loginAction` 经 HTTP 直连（GoTrue 取 token + 写 cookie）正常；引导管理员、各页 cookie 鉴权均工作。
- **初步判断**：疑 CDP 远程交互/React 19 server-action 表单在被驱动时的提交未触发，或与 B1 同源的 dev HMR 客户端运行时问题；**未必是登录代码 bug**。当前用 CDP 注入 cookie 绕过以继续测页。
- **证据**：`/tmp/shot-0-login.jpg`（表单已正确填充）；脚本 `scripts/cdp-verify.cjs` 输出。

## B3 · 仪表盘被遮蔽：根路径 `/` 被强制重定向到 `/booking/slots`〔已修〕
- **严重度** 🟠 高（仪表盘 B02 完全不可达）　**状态** ✅ 已修（阻塞用户指定要测的仪表盘，按"遇阻塞才处理"修复）　**页面** `/`
- **根因**：存在**两个解析到 `/` 的页面** —— `src/app/page.tsx`（一行 `redirect("/booking/slots")` 的旧脚手架）遮蔽了真正的仪表盘 `src/app/(admin)/page.tsx`。导致登录后永远落到分时预约页，仪表盘形同死代码。
- **修复**：删除 `src/app/page.tsx`，让 `(admin)/page.tsx`（带后台壳的仪表盘）接管 `/`。修后 `/` → 200「仪表盘」，CDP 实测通过。
- **证据**：`curl -I /` 修前 307→/booking/slots、修后 200；`/tmp/shot-dash.jpg`（仪表盘完整渲染：在园17/1050、今日259、设备60%、SSE 绿点）。
- **附带结论**：仪表盘的实时卡片 + SSE(`checkin_event`)在 VPN/dev 下**正常**，故 **B1 编辑器不挂载是 TipTap 专属问题，非通用 HMR/客户端运行时问题**（已回写 B1）。

## B4 · 大屏「在园/承载率 + 90% 熔断」口径错（PRD 红线 4）
- **严重度** 🟠 高（触红线 4）　**状态** 🆕 新登记　**页面** `/`（仪表盘 OccupancyCard）
- **现象/根因**：`(admin)/page.tsx` 把 `todayCapacity = 各时段容量之和`（200+200+250+250+150=**1050**）当作分母传给 OccupancyCard；卡片用 `在园/1050` 算占比与 `pct>=90` 闪红 + 「在园达 90%，预约已自动暂停」。
- **问题**：PRD 红线 4 是「在园人数达**瞬时承载量** 90% 闪红」。瞬时承载量 ≠ 当日各时段容量累加。后果：① 大屏占比被稀释（在园 17 显示 2%）；② **90% 大屏闪红/熔断几乎永不触发**（需在园达 945），红线 4 的大屏告警形同虚设；③ 与真实熔断口径（按**单时段** checkedInCount/该时段容量）不一致，卡片"已自动暂停"提示与实际暂停逻辑不同源。
- **证据**：`page.tsx:28` todayCapacity 求和、`:48` 传入；`_occupancy-card.tsx:28-29` pct/isRed。

## B5 · 大屏「checkin_event 实时」绿点写死，不反映 SSE 真实连接
- **严重度** 🟡 中　**状态** 🆕 新登记　**页面** `/`（仪表盘 Header）
- **现象**：`page.tsx:39` `<LiveDot alive />` —— alive 恒为 true。SSE 断开/未连时绿点仍亮、仍显示"实时"，有误导（运维以为实时在线）。OccupancyCard 内的 EventSource 才是真连接，但其状态没回传给这个指示点。
- **证据**：`page.tsx:39`；对比 `_occupancy-card.tsx` 的 EventSource 无 onerror/连接态上报。

## B6 · 告警(ALERT)设备在大屏显示成"离线"灰点，且在线率把告警算作不在线
- **严重度** 🟡 中　**状态** 🆕 新登记　**页面** `/`（设备在线状态）+ 设备在线率卡
- **现象**：设备列表 `page.tsx:102` `<LiveDot alive={d.status === "ONLINE"} />` —— ALERT(告警)设备 alive=false，显示灰点，**与 OFFLINE(离线)视觉完全一样**，运维分不清"告警 vs 掉线"。在线率 `onlineDevices = 仅 ONLINE` → 把告警设备计为不在线（5 台里观景台摄像头 ALERT，算出 60% 而非含告警的口径）。
- **证据**：`page.tsx:102`（列表）、`:onlineDevices`（在线率）；截图 `/tmp/shot-dash.jpg` 观景台摄像头-01 灰点。

## B7 · UI 直接露出 SSE 频道英文名（违反 PRD 红线 6：100% 中文）〔用户发现〕
- **严重度** 🟠 高（触红线 6）　**状态** 🆕 新登记　**页面** 多页通病（4 页 6 处）
- **现象**：实时指示文案把英文频道名直接显示给用户：
  - `(admin)/page.tsx:40` 「**checkin_event** 实时」（仪表盘）
  - `traffic/parking/page.tsx:26,40` 「**parking_state** 频道」「已接入 **parking_state** SSE 频道…」
  - `iot/[deviceId]/page.tsx:74` 「心跳数据通过 **iot_event** SSE 频道实时追加」
  - `iot/devices/page.tsx:28,42` 「**iot_event** 频道」「已接入 **iot_event** SSE 频道…」
- **建议改法**（待修）：频道名是技术标识，UI 不该露；改成纯中文，如「实时」「实时更新中」「已接入实时推送」。
- **附带**：`scripts/lint-cn.mjs` 只扫门票/ISO 等固定红线，**不扫 UI 孤立英文**，所以红线 6 这类漏网——lint 全绿是假绿，建议补一条"JSX 文案禁英文单词"规则。

## B8 · 字体最小号 <12px + 字体观感欠佳（设计规范）〔用户反馈〕✅ 已修
- **严重度** 🟡 中（全站观感）　**状态** ✅ 已修（用户要求当场改）　**页面** 全站
- **现象**：① 全站 **13 处 `text-[11px]`** 低于"最小 12px"硬规定；② 字体栈纯系统字体、无字体平滑/统一行高/数字等宽。
- **规则**：**最小字号 = 12px，不得更小**（用户定，长期生效）。
- **已改**：
  - 13 处 `text-[11px]` → `text-xs`(12px)，全站 0 处 <12px；
  - `globals.css`：`--font-sans` 西文优先栈（system-ui/Segoe→苹方/鸿蒙/雅黑/思源）+ `-webkit-font-smoothing:antialiased` + `text-rendering:optimizeLegibility` + `line-height:1.6` + `font-feature-settings:"tnum"`(数字等宽)。
- **验证**：lint-cn 绿；CDP 截图（系统管理页）观感明显改善，西文/数字用西文字形、小字 ≥12px。`/tmp/shot-system-font.jpg`。
- **关联**：B7 暴露的 `lint-cn` 不扫 UI 英文/字号，建议后续补 lint 规则防回退。

## B9 · 大量内联 `style` 未用 Tailwind（含侧边栏 11px/9px）〔用户反馈·最严重〕🔧 进行中
- **严重度** 🟠 高　**状态** 🔧 进行中（61→24）　**页面** 全站
- **现象**：原 **61 处 `style={`/27 文件**。① 侧边栏 `管理后台`/分组标题 11px、topbar 徽章 9px 走内联 `style fontSize`（<12px，上次 className 替换没覆盖）；② `button.tsx` 默认变体用了 `@theme` **未定义**的 shadcn token(`primary-foreground/destructive/accent/ring…`)→默认按钮白字失效→各页被迫内联 `style={{…color:"#fff"}}` 补救（12 处）。
- **已修**：
  - `sidebar.tsx`/`topbar.tsx` 全量转 Tailwind（用 `bg-sidebar/text-sidebar-section/bg-primary` 令牌）；11px→`text-xs`、9px 徽章→`text-xs`(18px 圈)。
  - **根因**：`button.tsx` 变体改用设计系统具体色（`bg-primary text-white`/outline/danger）→按钮开箱即用→删 **13 处**冗余绿色内联 style。
  - **结果**：`style={` **61→24**；CDP 截图确认侧边栏/topbar/按钮(新建=绿底白字、编辑=描边)正常。tsc 0、lint-cn 绿。
- **剩余 24 处**：~8 处**真动态必须保留**（`width:${pct}%` 进度条、`height` prop、`latencyColor()`、`trendColor`——Tailwind 表达不了 JS 计算值，官方推荐内联）；~16 处**可转**（条件二值色 `isRed?…`/`circuitRed?…`、`padding:24`、`color:"#9CA3AF"`）→`cn()` 三元 class，**待续**。

## B10 · 内容状态标签语义错（草稿/归档都显示"已暂停"）
- **严重度** 🟠 高　**状态** 🆕 新登记　**页面** `/content/news`（及 intro/knowledge/activities 全部内容列表，同款映射）
- **现象**：内容状态(`DRAFT`/`PUBLISHED`/`ARCHIVED`)被硬塞进 StatusChip 的 `ACTIVE`/`PAUSED`：`status={item.status === "PUBLISHED" ? "ACTIVE" : "PAUSED"}`。
  - 草稿 `DRAFT` → "已暂停"（错，应"草稿"）；
  - 已归档 `ARCHIVED` → 也 "已暂停"（错，应"已下线"）；**草稿与归档视觉无法区分**；
  - 已发布 `PUBLISHED` → "启用"（措辞不当，应"已发布"）。
- **根因**：`status-chip.tsx` 的 STATUS_CONFIG 没有内容域的 `草稿/已发布/已下线` 标签，被复用成预约/设备的 启用/已暂停。
- **建议**：给 StatusChip 加内容状态键（DRAFT="草稿"灰、PUBLISHED="已发布"绿、ARCHIVED="已下线"灰），各内容列表按真实 status 渲染。
- **证据**：`/content/news/page.tsx:38`；截图 `/tmp/shot-btn-tw.jpg`（"园区步道临时维护通知（草稿）"显示"已暂停"）。

## B11 · 仪表盘「在园人数」SSE 实时更新失效（payload 契约不一致）〔实测确认〕
- **严重度** 🔴 高（红线4 实时大屏核心）　**状态** 🆕 新登记　**页面** `/`（OccupancyCard）
- **现象（实测）**：核销 1 笔后仪表盘"在园人数"**不变**（17→17）。
- **根因**：`notify_checkin_event` 触发器 NOTIFY 的 payload 是 `{id, slot_id, checked_in_at, channel}`——**没有** `checkedInCount`；`_occupancy-card.tsx:17-19` 只在 `typeof payload.checkedInCount==="number"` 时才 `setCount`，没这字段就**忽略**；`listener.ts` 也只原样转发不补 → 事件到了也不更新。
- **基础设施正常**：服务器本地 `curl -N /api/sse/checkin_event` + 核销，**能收到** `event: checkin_event`（触发器→pg-listen→bus→SSE 全通）。问题纯在 payload 契约 + 前端取值字段。
- **次因(环境)**：你浏览器**经 VPN 没收到任何 SSE 事件**（本地 curl 能收到）——dev 长连接跨 VPN 不通，与 HMR WS 同源；非生产 bug，但 VPN 联调时大屏看不到实时。
- **建议**：触发器/路由补出 `checkedInCount`（核销后重算在园数再推），或卡片改成"收到 checkin_event 就重新拉在园数"。
- **证据**：`scripts/cdp-sse-test.cjs`（前后都 17、`__sse=[]`）；本地 `/tmp/sse.out`；`prisma/migrations/*realtime*/migration.sql:36`。

---
_（新 Bug 在此续登）_
