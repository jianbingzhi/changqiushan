# B 端后台 · 联调 Bug 清单

> 配合 `docs/B端联调测试清单.md`。逐页测试时实时登记。**当前阶段只记录、不修**（用户指示），遇阻塞才处理以继续。
> 严重度：🔴 阻断 · 🟠 高 · 🟡 中 · 🔵 低
> 状态：🆕 新登记 · 🔍 排查中 · 🧪 待复核 · 🛠️ 待修 · ✅ 已修 · ❎ 非 Bug/按设计

---

### 🎨 设计系统统一策略〔用户决策 2026-06-04，框住所有 UI 类问题〕

后续 UI/样式类问题（B18 登录页、B19 表格+token、B20 按钮，及之后所有视觉项）**不逐页逐组件改**，统一收口到 **theme**，最后一次性调：

1. **样式集中到 theme**：颜色/圆角/间距/阴影/字号等都走 `@theme` token + 组件层，**禁止再往各页内联 style / 硬编码 hex / `text-[12px]` 打补丁**（这正是 B19/B20 的病根）。
2. **支持深色/浅色双主题切换**：theme 要按 light/dark 两套 token 设计（如 `:root` 与 `.dark` 或 `data-theme`），组件只引用语义 token（`--color-bg`/`--color-fg`/`--color-muted`…），切换主题=换 token 值，组件零改动。
3. **不必 100% 还原 UI 设计图**：设计稿是参考，具体样式以 theme 实现为准，允许偏差；优先保证一致性、可切换、可维护。
4. **节奏**：联调阶段只记录 UI 问题、不单独改；**最后统一调 theme 一次性解决**。

> 据此，B18/B19/B20 等的"建议"都应理解为"汇入这次统一 theme 调整"，而非各自单独动手。

---

| # | 严重度 | 状态 | 页面/位置 | 现象 | 初步判断 | 证据 |
|---|---|---|---|---|---|---|

## B1 · 富文本编辑器（TipTap）经 VPN/dev 不挂载
- **严重度** 🟠 高　**状态** 🧪 待复核　**页面** `/content/news/new`（及所有富文本新建/编辑）
- **现象**：页面整体渲染正常（标题/摘要/正文/封面字段、保存按钮都在），但正文区永远停在占位框 `<div aria-busy="true">`，等到 +8s 仍 `contenteditable=false`、无工具栏，无法输入。
- **关键线索**：控制台刷屏 `WebSocket connection to 'ws://10.7.0.1:3000/_next/webpack-hmr' failed`——dev 模式 HMR 热更 WS 经 VPN 连不上浏览器。
- **对比**：同代码在服务器**本地** headless Chrome（localhost，HMR WS 正常）下编辑器**能挂载+输入+加粗+保存**（已实测）。
- **初步判断**（已收窄）：**仪表盘的客户端实时卡片 + SSE 在同环境(VPN/dev)下正常渲染**（见 B3），故**排除"客户端组件普遍挂不上"**，问题**收窄为 TipTap `useEditor` 专属**——疑 React 19 dev StrictMode 双挂载 / TipTap v3 SSR(`immediatelyRender:false`) 初始化竞态致 editor 恒为 null。**未必是业务代码 bug**。**待复核**：生产构建是否正常；或调整 useEditor 初始化时机。
- **证据**：`/tmp/shot-5-editor.jpg`、`/tmp/shot-editor-diag.jpg`；容器 DOM = `<div class="min-h-[260px] ..." aria-busy="true"></div>`。

## B2 · 登录表单提交失效——点「登录」按钮也不跳转〔升级:确认真 bug〕
- **严重度** 🔴 高（UI 登录走不通）　**状态** 🔴 确认　**页面** `/login`
- **现象（实测确认）**：在你浏览器**真实点击**「登 录」按钮（非 requestSubmit、非回车）填对账号密码后**仍停在 `/login`，不跳转**。靠 CDP 注入 cookie 才登进。→ 排除"CDP 交互"的解释,**表单 action 根本没触发**。
- **同根三联**：B15(回车不提交)、B17(密码错无提示) 与本条**同一根因**——`<form action={formAction}>`(React 19 useActionState)的提交链路在运行时没跑(成功不 redirect、失败不回显 error)。
- **待查**：是真代码 bug 还是 **dev/VPN 下客户端水合问题**(同 B1 编辑器:本地 headless 能用、跨 VPN 不行)。需在**本地直连**或**生产构建**复测点登录是否生效来定性。
- **影响**：当前真人**无法经登录页登录**(只能靠注入 cookie)。
- **证据**：`scripts/cdp-login.cjs` 输出(表单点登录未跳转→cookie 兜底成功);`/tmp/shot-0-login.jpg`(表单已正确填充)。

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

## B12 · 首页头部:不需要"仪表盘"title + title 字号过大 + 无面包屑〔用户反馈〕✅ 已改
- **严重度** 🟡 中　**状态** ✅ 已改　**页面** `/`（及全站 PageHeader）
- **已改**：`page-header.tsx` title 28px→`text-xl`(20px)+ title 改可选；新增 `breadcrumb.tsx`（首页/分组/页面，由路由反查菜单）；仪表盘省略 title；topbar 去掉重复的居中面包屑。CDP 截图确认。

## B13 · 没有返回首页/仪表盘的入口〔用户反馈〕
- **严重度** 🟠 高　**状态** 🆕 新登记　**页面** 全局壳
- **现象**：菜单(`MENU_GROUPS`)无"首页/仪表盘"项；侧边栏 logo+名称、topbar logo+名称**都不是链接**，点了无反应。唯一入口是 B12 新加的面包屑"首页"（仅子页有）。
- **建议**：侧边栏顶部 logo+名称包成 `<Link href="/">`（最通用习惯）；可选再给菜单加"首页/仪表盘"项。

## B14 · 左侧菜单拥挤,分组应可折叠〔用户反馈〕
- **严重度** 🟡 中　**状态** 🆕 新登记　**页面** 侧边栏 `sidebar.tsx`
- **现象**：5 个分组(基础宣传管理/预约管理中心/出行服务/数据可视化与分析/物联网设备监控)全部常驻展开,菜单项多时拥挤、需滚动(底部"物联网/系统管理"被挤出视口)。
- **建议**：分组标题做成可点击折叠/展开(accordion);记住展开态(localStorage);当前页所在分组默认展开。需把 sidebar 由纯展示改为带状态的客户端交互。

## B15 · 登录页回车不触发登录〔用户反馈〕
- **严重度** 🟡 中　**状态** 🆕 新登记　**页面** `/login`
- **现象**：在手机号/密码框按回车不提交，必须手点「登 录」。（与 B2"CDP 提交不跳转"可能同源:表单提交链路有问题。）
- **疑点**：`<form action={formAction}>` + 自定义 `Input` 组件;正常单/多输入框+submit 按钮按回车应触发原生提交。需查 Input 是否吞了 Enter,或 React 19 action form 的提交未走原生 submit。
- **建议**：确保按 Enter 走表单 submit（必要时给密码框加 `onKeyDown` Enter→requestSubmit）。

## B16 · Session 1 小时硬过期、非滑动、无刷新〔用户反馈〕
- **严重度** 🟡 中（联调/体验）　**状态** 🟡 联调已缓解 / 生产待做滑动续期　**页面** 认证
- **现象**：登录后满 1 小时被踢回登录页,中途操作不续期。原 `GOTRUE_JWT_EXP=3600` + cookie `maxAge:3600`,无 refresh 逻辑。
- **已处理(联调)**：`GOTRUE_JWT_EXP` 调到 **604800(7 天)**(compose),已重建 gotrue 生效,免得测试中频繁被踢。
- **仍待做(生产)**：① 生产改回短时效(如 3600);② **滑动续期**:存 GoTrue 的 `refresh_token`,access token 临期用 `grant_type=refresh_token` 静默续期(或 middleware 检测临期重签);③ 登录页 cookie `maxAge:3600` 硬编码(`login/page.tsx`)未随之调整——真实表单登录时 cookie 仍 1h 过期(当前靠注入绕过,叠加 B21)。

## B17 · 密码错误无提示〔用户反馈〕
- **严重度** 🟡 中　**状态** 🆕 新登记　**页面** `/login`
- **现象**：输错密码后页面无任何错误提示。
- **代码核对**：逻辑其实**存在**——`login/page.tsx:28` 错误时 `return "手机号或密码错误"`；`_login-form.tsx:53-55` `{error && <p role="alert">…</p>}` 展示。故为运行时未生效。
- **疑根因**：极可能与 **B15(回车不提交)/B2(表单提交链路)** 同源——用户按回车未触发提交→action 没跑→自然无提示。需实测确认:**点按钮**输错密码是否会显示"手机号或密码错误"。若点按钮也不显示,则 useActionState 回显本身有问题。
- **待办**：CDP 实测(填错密码→点登录→看是否出红字)。

## B18 · 登录页视觉太"默认"、缺品牌与场景感〔用户反馈·UI〕
- **严重度** 🟡 中（体验/品牌）　**状态** 🆕 新登记　**页面** `/login`（`(auth)/layout.tsx` + `login/page.tsx` + `_login-form.tsx`）
- **现象**：用户主观反馈"没设计的好看"。实测截图(`/tmp/login-now.jpg`)为一张 400px 白卡片孤悬于纯灰底(`#F9FAFB`)正中，整体像默认脚手架，毫无"森林公园"气质。
- **设计层问题**：
  1. **整屏纯灰底无场景感**：森林公园项目登录页却一片死灰，~90% 画布空置。同类智慧景区后台多用**左图右表**（左侧山林实景/品牌插画 + slogan，右侧表单）。
  2. **卡片孤悬正中、信息密度低**，视觉重心飘、缺落地感。
  3. **品牌符号弱**：48px 小圆 + 简笔山形 svg 识别度低；标题纯黑字无层次。
  4. **输入框扁平**：灰边框 + 灰 placeholder，无前置图标（手机/锁），辨识度低。
  5. **主色未铺开**：`#2D5A27` 仅用于 logo 与按钮，背景/标题/聚焦全中性灰，绿色没有温度。
- **代码层问题（同时记入）**：
  - **内联 `style` 残留**（触用户定的"最严重问题"）：`page.tsx` logo 圆底 `style={{ backgroundColor:"#2D5A27" }}`、`_login-form.tsx` 登录按钮 `style={{ backgroundColor:"#2D5A27", color:"#FFFFFF" }}`——应改 Tailwind / `bg-primary`。
  - 颜色硬编码 `#2D5A27` 散落多处，未走 `@theme` token。
- **建议方向**：改**左右分栏**——左侧用导览图主视觉 + 深绿渐变蒙版 + slogan，右侧表单卡片下沉、输入框加前置图标（手机/锁）、按钮与品牌色统一走 Tailwind token（`bg-primary`，去内联 style）。
- **可用素材**：用户已提供登录页背景图，归档在 `UI/素材/登录页背景-导览图.jpg`（长秋山森林公园手绘导览图，5120×2560）。开发实现时复制到 `app/public/` 引用，上线前建议压缩/转 WebP。
- **证据**：`/tmp/login-now.jpg`；`src/app/(auth)/login/page.tsx`、`_login-form.tsx`、`(auth)/layout.tsx`。

## B19 · 列表表格丑/松散 + shadcn token 缺失致组件整体降级〔用户反馈·UI·系统性〕
- **严重度** 🟠 高（影响所有列表/表单页观感）　**状态** 🆕 新登记　**页面** 全站列表（`/content/intro`、`/content/activities`、资讯、设备列表、预约单查询…共用 `src/lib/ui/table.tsx`）
- **现象**：用户在景区介绍维护页反馈"表格太丑"。实测（`/tmp/intro-now.jpg`）表格松散、层次弱、像没排版的草稿。
- **根因一 · shadcn token 未在 `@theme` 定义【系统性·真因】**：组件是标准 shadcn/ui，但本项目 `globals.css @theme` **缺** `--color-muted` / `--color-muted-foreground` / `--color-ring` / `--color-input` / `--color-foreground`（只有个不同名的 `--color-text-muted`）。导致组件内：
  - `table.tsx` 表头 `text-muted-foreground` → 字色解析为空、发虚；行 `hover:bg-muted/50` → 悬停无反馈；
  - `input/select/textarea` 的 `border-input`、`bg-background`、focus `ring` 同样失效；
  - 受影响组件 ≥8：table/input/select/tabs/sheet/card/dialog/textarea。
  - **同根历史**：`button.tsx` 顶部注释已记同一坑（缺 primary-foreground 等 token，按钮文字曾变透明，被迫各页内联 style）。→ 应**一次性把 shadcn token 集补进 `@theme`**，而非逐组件内联打补丁。
- **根因二 · Table 当裸原语用、未做版式**：shadcn Table 只给骨架，需调用方设列宽/密度，但本项目直接 `w-full` 铺满：
  - **列宽失控**：5 列短内容被均摊到整屏宽 → 标题贴最左、操作贴最右，中间"排序/发布时间"孤悬大片空白，扫读要横扫一屏；
  - **行又高又松**：`TableCell p-4`(上下16px) + `TableHead h-12`，3 行数据撑大半屏，密度极低；
  - **无斑马纹/无列分隔/无最大宽度约束/无分页**，层次扁平。
  - 操作列按钮风格混杂（编辑/下线=outline 描边、发布=实心绿），同列视觉跳。
- **建议**：① 补全 `@theme` 的 shadcn token 集（muted/muted-foreground/ring/input/foreground/accent…）使组件默认态恢复；② Table 给关键列设 `width`/收紧 padding（如 `py-3`）/操作列右对齐定宽/加斑马纹或更清晰的行分隔；③ 操作按钮统一为同一弱化样式（如统一 ghost/outline，主操作才实心）。
- **证据**：`/tmp/intro-now.jpg`；`src/lib/ui/table.tsx`、`src/app/globals.css @theme`(14-22 行附近)、`src/lib/ui/button.tsx` 顶部注释。

## B20 · 按钮样式不统一 / 主次不分 / 字号被各页覆盖〔用户反馈·UI·系统性〕
- **严重度** 🟠 高　**状态** 🆕 新登记　**页面** 全站（共用 `src/lib/ui/button.tsx`，典型见 `/content/intro`、`/content/activities`）
- **现象**：用户反馈"按钮也（不）乖"。实测同一行操作里 `编辑`(outline 淡描边) 与 `发布/下线`(实心深绿) 权重悬殊、视觉跳，看不出谁是主操作。
- **具体问题**：
  1. **主次不分**：列表操作列把同级操作（编辑/下线/发布/报名审核…）混用 outline 与实心，一行里实心深绿格外抢眼，主次规则缺失。
  2. **实心主色过重**：default 变体 `bg-primary(#2D5A27)` 偏深，大面积实心显沉闷老气；hover 还**硬编码** `bg-[#3a7232]`（未走 `--color-primary-hover` token）。
  3. **字号被各页覆盖、不统一**：Button 默认 `text-sm`(14px)，但**全站 11 处**列表操作按钮被 `text-[12px]` 覆盖 → 同界面按钮字号不一致，且压在 12px 红线下限（再小即违规）。
  4. **outline 几乎不可见**：边框 `#E5E7EB` 过浅、hover `#F9FAFB` 反馈极弱 → outline 按钮看着像纯文字链接，无"可点"感。
  5. **变体单一**：全站只用了 default(18 处) 与 outline(16 处) 两种，secondary/ghost/link 基本没用 → 缺"低权重次操作"层级，导致次操作只能塞 outline、与主操作挤在一起。
- **建议**：① 定义清晰的按钮层级（主操作=实心/一行一个、次操作=outline、轻操作=ghost/link）并在列表操作列统一用弱化样式；② hover 走 `--color-primary-hover` token、考虑主色提亮或加浅色次级按钮；③ 去掉各页 `text-[12px]` 覆盖，按钮字号统一交给 size 变体（列表用 `size="sm"` 而非改字号）。与 [B19] 同属"组件层没收口、各页打补丁"。
- **证据**：`/tmp/intro-now.jpg`；`src/lib/ui/button.tsx`(default hover 硬编码)；`grep 'text-\[12px\]'` 命中 11 处列表按钮。

## B21 · 生产环境 http 下 secure cookie 致真实表单登录失效〔环境/安全〕
- **严重度** 🟡 中（QA 环境 + 上线前须知）　**状态** 🆕 新登记　**页面** 认证（`(auth)/login/page.tsx`）
- **现象/根因**：登录成功时写 cookie `sb-access-token` 设 `secure: process.env.NODE_ENV === "production"`。容器化 QA（`NODE_ENV=production`）经 **http**(VPN 10.7.0.1) 访问时，浏览器**不会回传 secure cookie** → 即便表单提交链路修好(B2/B15)，真人也登不进；middleware 读不到 cookie → 永远 307 回 /login。
- **影响**：① 当前容器 QA 真人表单登录走不通（叠加 B2），需继续用 **CDP 注入非 secure cookie**（http 下能回传、middleware 照验，已实测放行）；② 上线必须走 **https**，否则生产用户全部无法登录。
- **建议**：① 正式部署在反代/网关层做 TLS（cookie secure 才成立）；② 若需 http 内网部署，给 cookie secure 加可配开关（如 `COOKIE_SECURE` env），勿仅绑死 `NODE_ENV`。
- **证据**：`(auth)/login/page.tsx` 的 `cookieStore.set(... secure: NODE_ENV==="production")`；容器实测 `curl 带注入token→200 / 无token→307`。
