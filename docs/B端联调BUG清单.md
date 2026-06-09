# B 端后台 · 联调 Bug 清单

> 📌 **未实现/遗留事项的单一汇总入口 → [`待办清单.md`](./待办清单.md)**(避免分散遗漏;本清单偏 B 系列明细)。

> 配合 `docs/B端联调测试清单.md`。逐页测试时实时登记。**当前阶段只记录、不修**（用户指示），遇阻塞才处理以继续。
> 严重度：🔴 阻断 · 🟠 高 · 🟡 中 · 🔵 低
> 状态：🆕 新登记 · 🔍 排查中 · 🧪 待复核 · 🛠️ 待修 · ✅ 已修 · ❎ 非 Bug/按设计
>
> **2026-06-05 同步**：b-98 POC 修复计划 C1–C10 已合入 main 并推送（见 [`.claude/plan/b-98-POC问题修复计划.md`](../.claude/plan/b-98-POC问题修复计划.md)）。

---

## ✅ QA 回归复核（2026-06-06）

> 复核手段:**无头浏览器(Playwright)真登录态实测线上 https://changqiushan.vercel.app** + 代码/接口核查。**逐条核对、只记录不改代码。**
> 结论:**✅ 关闭 14 项 · 🛠️/🧪 部分 3 项 · 归 theme/未做 7 项**。

| Bug | 复核方式 | 结果 | 状态 |
|---|---|---|---|
| B1 富文本(dev-only) | 生产页 `/content/news/new` `contenteditable=true` 挂载 | 通过 | ✅ 关闭 |
| B2 登录表单提交失效 | 真表单提交 → 跳转 `/` | 通过 | ✅ 关闭 |
| B3 根路径遮蔽仪表盘 | `/` 渲染仪表盘(非跳 /booking/slots) | 通过 | ✅ 关闭 |
| B4 承载量口径(红线4) | 大屏用瞬时承载量 + 90% 闪红机制就绪;阈值占位 | 机制就绪、待 PRD 数值 | 🧪 待数值 |
| B5 LiveDot 写死 | 连接态由真实驱动(实时关=「数据快照」) | 通过 | ✅ 关闭 |
| B6 告警设备灰点 | LiveDot 三态 在线/告警/离线 可区分 | 通过 | ✅ 关闭 |
| B7 SSE 频道英文名 | 页面无 checkin_event/parking_state 等 | 通过 | ✅ 关闭 |
| B8 字体 <12px | `text-[11px]`=0、无 <12px | 通过 | ✅ 关闭 |
| B9 内联 style | 仍 26 处(动态必需 + 待转) | 归 theme pass | 🔧 开放 |
| B10 内容状态错配 | 草稿/已发布/已下线 | 通过 | ✅ 关闭 |
| B11 在园数 SSE 实时 | Vercel 实时关(数据快照);回拉方案待自托管 docker 实测 | 待自托管实测 | 🧪 待实测 |
| B12 头部/面包屑 | 子页面包屑存在 | 通过 | ✅ 关闭 |
| B13 返回首页入口 | logo `a[href="/"]` | 通过 | ✅ 关闭 |
| B14 菜单折叠 | 未做 | 归交互/theme | 🆕 开放 |
| B15 回车不提交 | 回车 → 跳转 `/` | 通过 | ✅ 关闭 |
| B16 session 续期 | maxAge 已对齐;滑动续期未做 | 部分(下迭代) | 🛠️ 部分 |
| B17 密码错无提示 | 错误密码 → 回显「账号或密码错误」 | 通过 | ✅ 关闭 |
| B18 登录页视觉 | 未做 | 归 theme | 🆕 开放 |
| B19 表格/shadcn token | 未做 | 归 theme | 🆕 开放 |
| B20 按钮样式 | 未做 | 归 theme | 🆕 开放 |
| B21 secure cookie/http | `COOKIE_SECURE` 开关;https 登录通 | 通过 | ✅ 关闭 |
| B22 面包屑返回列表 | 子页点面包屑 → 回 `/content/news` | 通过 | ✅ 关闭 |
| B23 现场补录/时段生成 | 今日有时段 + **真实下单成功**(止血);滚动 cron 未做 | 止血关闭 / 结构性未做 | 🛠️ 部分 |
| B24 侧栏留白 | 未做 | 归 theme | 🆕 开放 |

**b-99 安全/质量项**:R1 单测(49 全过)✅ · R3 路由 RBAC(OPERATOR 越权 307 拦截、SUPER 放行)✅ · R4 无 window.prompt ✅ · R5 英文 lint ✅ · R7 写审计代码已合(actorId+writeAudit)✅ · **⚠️ R2 SSE 鉴权:鉴权代码在且 fail-closed,但 Vercel 上 SSE 路由整体 500(serverless 不兼容长连接、realtime 已关)→ 401 行为待自托管验证** · R6 高德地图 ⏳ 未做(阻塞外部 key)。

**POC P1–P10**:无头浏览器逐项复核**全部通过**(大屏/设备/补录/导航/路况/假SSE文案/渠道/英文/画像/时区)。

**复核中新发现**:`prisma/seed.ts` 用 UTC 取"今天"(`toISOString().slice`)与 app `chinaToday()`(Asia/Shanghai)不一致 → 北京 0–8 点"今天"无数据。**已修(提交 05fb3d6)**。

---

## ✅ QA 二轮复核(2026-06-08 · CDP 真登录线上逐页)

> 手段:**CDP 真登录态**(账号 `+8613800138000` / `Cqs-demo-2026`,邮箱 `admin@changqiushan.demo` 同密;`13900000000` 为本地 seed 账号、线上无效)逐页实测线上 https://changqiushan.vercel.app + 代码核查。只记录、不改代码。
> 触发:用户发现"富文本完全不是之前检查里的要求"——核出 06-06 那轮把 **B1 仅按"editor 挂载"判通过**,漏核"经典版"功能完整度,据此二轮复核。

**✅ 二轮确认仍成立(线上实测)**:B4(分母改瞬时承载量 5000、非 1050 时段累加)· B5(顶栏"数据快照"灰点,非写死绿点)· B6(设备三态:在线绿/告警**红**/离线灰,观景台摄像头-01 红点可辨)· B7(iot/traffic/详情/仪表盘均无 `checkin_event`/`parking_state`/`iot_event` 英文频道名)· B10(状态标签 草稿/已发布,四类内容动词统一"发布/下线",knowledge 不再"启用/停用")· 红线2(预约单查询出 身份证脱敏+车牌+「无车辆」,补录第3步"车辆信息")· 红线5(4 张分析报表"导出 Excel" **实测下载有效**:`/api/export/{traffic,profile,source,heatmap}` 均 200 + `application/vnd.openxmlformats…sheet` + xlsx 魔数 `50 4b 03 04`)· 内容编辑页正确回填正文(测试清单 #11 补通过)· 黑名单累计爽约 3 次自动加入。

**🆕 二轮新发现(详见下方 B25–B28)**:
| # | 严重度 | 摘要 |
|---|---|---|
| **B25** | 🟠 高 | 富文本编辑器**未达"经典版"要求**:插图仅粘 URL、无本地上传、**无视频**、封面为纯 URL 框、无素材库选择器;`/content/assets` 上传基建已独立存在但**没接进编辑器/封面**。四类内容通病。← 本轮触发项 |
| **B26** | 🔴 高 | 线上**今日(06-08)无任何可用时段**:仪表盘"今日暂无时段数据"、今日预约 0、在园 0;`/booking/quota-rules` **暂无模板**;`/booking/onsite` 卡在"当日暂无可预约时段"。B23 的结构性修复(滚动生成 cron)**在 Vercel 部署未生效 + 线上零时段模板** → 当天补录/在线预约链路再次瘫痪 |
| **B27** | 🟡 中 | 红线6:原生 `<input type=date>` 显示**英文格式**——`/analytics/traffic` 筛选 `mm/dd/yyyy`、`/booking/onsite` 预约日期 `06/08/2026`(下方有中文 helper 兜底)。受浏览器 locale 控制 |
| **B28** | 🔵 低 | `/traffic/parking` 停车场地图区永久显示"**地图加载中…**"(高德 key 未配时永不加载完、误导);对比 `/traffic/road` 用诚实占位"高德实时路况地图待阶段5接入后展示"。属 R6 占位文案 |

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

## B1 · 富文本编辑器（TipTap）经 VPN/dev 不挂载〔定性:dev 专属,生产正常〕
- **严重度** 🟠 高→🔵 低（仅 dev/HMR）　**状态** ✅ 生产已复测正常（dev-only）　**页面** `/content/*/new`、`*/edit`（四类内容共用同一 RichTextEditor）
- **2026-06-04 prod 容器复测结论**：在 **docker 生产构建**(`next start`, NODE_ENV=production)经同一 VPN 访问 `/content/activities/new`，编辑器**挂载正常**——工具栏 12 按钮、`contenteditable=true`、`.ProseMirror` 已挂载、无 `aria-busy` 占位。**证实 B1 是 dev/HMR(StrictMode 双挂载/HMR WS 经 VPN 断)专属，生产构建不复现**，非业务代码 bug。证据 `/tmp/editor-prod.jpg`。
- （以下为 dev 现象留存）
- **现象**：页面整体渲染正常（标题/摘要/正文/封面字段、保存按钮都在），但正文区永远停在占位框 `<div aria-busy="true">`，等到 +8s 仍 `contenteditable=false`、无工具栏，无法输入。
- **关键线索**：控制台刷屏 `WebSocket connection to 'ws://10.7.0.1:3000/_next/webpack-hmr' failed`——dev 模式 HMR 热更 WS 经 VPN 连不上浏览器。
- **对比**：同代码在服务器**本地** headless Chrome（localhost，HMR WS 正常）下编辑器**能挂载+输入+加粗+保存**（已实测）。
- **初步判断**（已收窄）：**仪表盘的客户端实时卡片 + SSE 在同环境(VPN/dev)下正常渲染**（见 B3），故**排除"客户端组件普遍挂不上"**，问题**收窄为 TipTap `useEditor` 专属**——疑 React 19 dev StrictMode 双挂载 / TipTap v3 SSR(`immediatelyRender:false`) 初始化竞态致 editor 恒为 null。**未必是业务代码 bug**。**待复核**：生产构建是否正常；或调整 useEditor 初始化时机。
- **证据**：`/tmp/shot-5-editor.jpg`、`/tmp/shot-editor-diag.jpg`；容器 DOM = `<div class="min-h-[260px] ..." aria-busy="true"></div>`。

## B2 · 登录表单提交失效——点「登录」按钮也不跳转〔升级:确认真 bug〕
- **严重度** 🔴 高（UI 登录走不通）　**状态** 🔍 待 QA 复测定性（b-98 C9：判定大概率为 B21 secure-cookie-over-http 环境问题，非代码；须 docker 生产构建 + https/或临时 secure=false 复测点登录是否跳转）　**页面** `/login`
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
- **严重度** 🟠 高（触红线 4）　**状态** 🧪 机制就绪待数值（b-98 C6/D1：大屏改用 `getInstantCapacity` 瞬时承载量口径 + 90% 整屏闪红机制；阈值待 PRD 给具体数值才算完全闭合）　**页面** `/`（仪表盘 OccupancyCard）
- **现象/根因**：`(admin)/page.tsx` 把 `todayCapacity = 各时段容量之和`（200+200+250+250+150=**1050**）当作分母传给 OccupancyCard；卡片用 `在园/1050` 算占比与 `pct>=90` 闪红 + 「在园达 90%，预约已自动暂停」。
- **问题**：PRD 红线 4 是「在园人数达**瞬时承载量** 90% 闪红」。瞬时承载量 ≠ 当日各时段容量累加。后果：① 大屏占比被稀释（在园 17 显示 2%）；② **90% 大屏闪红/熔断几乎永不触发**（需在园达 945），红线 4 的大屏告警形同虚设；③ 与真实熔断口径（按**单时段** checkedInCount/该时段容量）不一致，卡片"已自动暂停"提示与实际暂停逻辑不同源。
- **证据**：`page.tsx:28` todayCapacity 求和、`:48` 传入；`_occupancy-card.tsx:28-29` pct/isRed。

## B5 · 大屏「checkin_event 实时」绿点写死，不反映 SSE 真实连接
- **严重度** 🟡 中　**状态** ✅ 已修（b-98 C3：LiveDot 改由 OccupancyCard 的 EventSource onopen/onerror 上报真实连接态）　**页面** `/`（仪表盘 Header）
- **现象**：`page.tsx:39` `<LiveDot alive />` —— alive 恒为 true。SSE 断开/未连时绿点仍亮、仍显示"实时"，有误导（运维以为实时在线）。OccupancyCard 内的 EventSource 才是真连接，但其状态没回传给这个指示点。
- **证据**：`page.tsx:39`；对比 `_occupancy-card.tsx` 的 EventSource 无 onerror/连接态上报。

## B6 · 告警(ALERT)设备在大屏显示成"离线"灰点，且在线率把告警算作不在线
- **严重度** 🟡 中　**状态** ✅ 已修（b-98 C3：仪表盘设备点改三态 在线/告警/离线，告警不再与离线同灰）　**页面** `/`（设备在线状态）+ 设备在线率卡
- **现象**：设备列表 `page.tsx:102` `<LiveDot alive={d.status === "ONLINE"} />` —— ALERT(告警)设备 alive=false，显示灰点，**与 OFFLINE(离线)视觉完全一样**，运维分不清"告警 vs 掉线"。在线率 `onlineDevices = 仅 ONLINE` → 把告警设备计为不在线（5 台里观景台摄像头 ALERT，算出 60% 而非含告警的口径）。
- **证据**：`page.tsx:102`（列表）、`:onlineDevices`（在线率）；截图 `/tmp/shot-dash.jpg` 观景台摄像头-01 灰点。

## B7 · UI 直接露出 SSE 频道英文名（违反 PRD 红线 6：100% 中文）〔用户发现〕
- **严重度** 🟠 高（触红线 6）　**状态** ✅ 已修（b-98 C3/C7：4 页频道名英文文案全部中文化为「数据定时刷新」等）　**页面** 多页通病（4 页 6 处）
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
- **严重度** 🟠 高　**状态** ✅ 已修（b-98 C1：StatusChip 加内容域键 草稿/已发布/已下线 + 切换动词统一发布/下线）　**页面** `/content/news`（及 intro/knowledge/activities 全部内容列表，同款映射）
- **现象**：内容状态(`DRAFT`/`PUBLISHED`/`ARCHIVED`)被硬塞进 StatusChip 的 `ACTIVE`/`PAUSED`：`status={item.status === "PUBLISHED" ? "ACTIVE" : "PAUSED"}`。
  - 草稿 `DRAFT` → "已暂停"（错，应"草稿"）；
  - 已归档 `ARCHIVED` → 也 "已暂停"（错，应"已下线"）；**草稿与归档视觉无法区分**；
  - 已发布 `PUBLISHED` → "启用"（措辞不当，应"已发布"）。
- **根因**：`status-chip.tsx` 的 STATUS_CONFIG 没有内容域的 `草稿/已发布/已下线` 标签，被复用成预约/设备的 启用/已暂停。
- **建议**：给 StatusChip 加内容状态键（DRAFT="草稿"灰、PUBLISHED="已发布"绿、ARCHIVED="已下线"灰），各内容列表按真实 status 渲染。
- **证据**：`/content/news/page.tsx:38`；截图 `/tmp/shot-btn-tw.jpg`（"园区步道临时维护通知（草稿）"显示"已暂停"）。
- **附:跨模块动词不一致**：内容状态切换按钮，intro/activities 用 **发布/下线**（发布语义），knowledge 用 **启用/停用**（`StatusToggle variant="toggle"`，启停语义）——同是 DRAFT/PUBLISHED 切换却两套措辞。knowledge 内部自洽（chip 启用/已暂停 + 按钮 停用），但与其它内容模块不统一。建议随 B10 一并定一套内容状态措辞。

## B11 · 仪表盘「在园人数」SSE 实时更新失效（payload 契约不一致）〔实测确认〕
- **严重度** 🔴 高（红线4 实时大屏核心）　**状态** 🧪 代码已修待实测（b-98 C3：改「脏信号+回拉」收到 checkin_event 后回拉最新在园数，绕开 payload 形状；service 核销路径留待 docker QA 实测确认）　**页面** `/`（OccupancyCard）
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
- **严重度** 🟠 高　**状态** ✅ 已修（b-98 C2：sidebar logo 包 `<Link href="/" aria-label="返回仪表盘首页">`）　**页面** 全局壳
- **现象**：菜单(`MENU_GROUPS`)无"首页/仪表盘"项；侧边栏 logo+名称、topbar logo+名称**都不是链接**，点了无反应。唯一入口是 B12 新加的面包屑"首页"（仅子页有）。
- **建议**：侧边栏顶部 logo+名称包成 `<Link href="/">`（最通用习惯）；可选再给菜单加"首页/仪表盘"项。

## B14 · 左侧菜单拥挤,分组应可折叠〔用户反馈〕
- **严重度** 🟡 中　**状态** 🆕 新登记　**页面** 侧边栏 `sidebar.tsx`
- **现象**：5 个分组(基础宣传管理/预约管理中心/出行服务/数据可视化与分析/物联网设备监控)全部常驻展开,菜单项多时拥挤、需滚动(底部"物联网/系统管理"被挤出视口)。
- **建议**：分组标题做成可点击折叠/展开(accordion);记住展开态(localStorage);当前页所在分组默认展开。需把 sidebar 由纯展示改为带状态的客户端交互。

## B15 · 登录页回车不触发登录〔用户反馈〕
- **严重度** 🟡 中　**状态** 🔍 待 QA 复测定性（b-98 C9：与 B2 同源，疑 B21 cookie 环境问题；可选给密码框 onKeyDown Enter→requestSubmit 兜底，待 docker prod 复测后定）　**页面** `/login`
- **现象**：在手机号/密码框按回车不提交，必须手点「登 录」。（与 B2"CDP 提交不跳转"可能同源:表单提交链路有问题。）
- **疑点**：`<form action={formAction}>` + 自定义 `Input` 组件;正常单/多输入框+submit 按钮按回车应触发原生提交。需查 Input 是否吞了 Enter,或 React 19 action form 的提交未走原生 submit。
- **建议**：确保按 Enter 走表单 submit（必要时给密码框加 `onKeyDown` Enter→requestSubmit）。

## B16 · Session 1 小时硬过期、非滑动、无刷新〔用户反馈〕
- **严重度** 🟡 中（联调/体验）　**状态** 🛠️ 部分（b-98 C9：cookie `maxAge` 已对齐 `GOTRUE_JWT_EXP`，消除"7天JWT/1h cookie"不一致——即清单③；生产短时效 + 滑动续期仍待下迭代）　**页面** 认证
- **现象**：登录后满 1 小时被踢回登录页,中途操作不续期。原 `GOTRUE_JWT_EXP=3600` + cookie `maxAge:3600`,无 refresh 逻辑。
- **已处理(联调)**：`GOTRUE_JWT_EXP` 调到 **604800(7 天)**(compose),已重建 gotrue 生效,免得测试中频繁被踢。
- **仍待做(生产)**：① 生产改回短时效(如 3600);② **滑动续期**:存 GoTrue 的 `refresh_token`,access token 临期用 `grant_type=refresh_token` 静默续期(或 middleware 检测临期重签);③ 登录页 cookie `maxAge:3600` 硬编码(`login/page.tsx`)未随之调整——真实表单登录时 cookie 仍 1h 过期(当前靠注入绕过,叠加 B21)。

## B17 · 密码错误无提示〔用户反馈〕
- **严重度** 🟡 中　**状态** 🔍 待 QA 复测定性（b-98 C9：回显逻辑代码本就在，疑与 B2/B15 同源；docker prod 点登录输错密码复测是否出红字）　**页面** `/login`
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
- **严重度** 🟡 中（QA 环境 + 上线前须知）　**状态** ✅ 已修（b-98 C9：cookie `secure` 改 `COOKIE_SECURE` env 开关，默认回退 NODE_ENV，内网 http QA 置 false；compose 已设 `COOKIE_SECURE:${COOKIE_SECURE:-false}`）　**页面** 认证（`(auth)/login/page.tsx`）
- **现象/根因**：登录成功时写 cookie `sb-access-token` 设 `secure: process.env.NODE_ENV === "production"`。容器化 QA（`NODE_ENV=production`）经 **http**(VPN 10.7.0.1) 访问时，浏览器**不会回传 secure cookie** → 即便表单提交链路修好(B2/B15)，真人也登不进；middleware 读不到 cookie → 永远 307 回 /login。
- **影响**：① 当前容器 QA 真人表单登录走不通（叠加 B2），需继续用 **CDP 注入非 secure cookie**（http 下能回传、middleware 照验，已实测放行）；② 上线必须走 **https**，否则生产用户全部无法登录。
- **建议**：① 正式部署在反代/网关层做 TLS（cookie secure 才成立）；② 若需 http 内网部署，给 cookie secure 加可配开关（如 `COOKIE_SECURE` env），勿仅绑死 `NODE_ENV`。
- **证据**：`(auth)/login/page.tsx` 的 `cookieStore.set(... secure: NODE_ENV==="production")`；容器实测 `curl 带注入token→200 / 无token→307`。

## B22 · 面包屑中间层级不可点,子页无法经面包屑返回列表〔用户反馈·B12 缺陷〕
- **严重度** 🟡 中（导航）　**状态** ✅ 已修（b-98 C2：子页时 page 段渲染 `<Link>` 可返回列表 + 末段子页 span + `aria-current`）　**页面** 所有内容新建/编辑等子页（如 `/content/activities/new`、`*/edit`）；组件 `src/lib/ui/breadcrumb.tsx`
- **现象（实测）**：在"新建活动"页，面包屑 `首页 / 基础宣传管理 / 活动运营管理`，但点"活动运营管理"**纹丝不动**（`/content/activities/new` 原地）。DOM 核实：仅"首页"是 `<a href="/">`，**分组与页面段都是 `<span>`**。→ 子页（new/edit）下用户**无法靠面包屑回到列表页**，只能浏览器后退或左侧菜单。
- **根因**：`breadcrumb.tsx` 的 `resolveCrumb` 把 group 和 page 一律渲染成 `<span>`；未区分"当前正在列表页"(page=当前,span 合理) vs "当前在其子页"(page=父级,应为返回列表的 `<Link>`)。
- **建议**：当 `pathname` 深于 `item.href`（即 `pathname.startsWith(item.href + "/")`）时，page 段渲染为 `<Link href={item.href}>` 可点返回列表，并把子页名（新建/编辑）作为末段 span；`pathname === item.href` 时 page 仍为当前 span。分组段无独立落地页，保持 span 可接受。
- **关联**：B12（面包屑由我新增,本条是其缺陷）、B13（返回首页入口）。
- **证据**：CDP 实测点击无跳转；`breadcrumb.tsx` group/page 均 `<span>`。

## B23 · 现场补录当天无时段可选——系统缺"每日时段生成"机制（P3 升级·prod 确认）
- **严重度** 🔴 高（当天预约/补录链路瘫痪）　**状态** 🛠️ 部分（b-98 C4：slots 页加手动建时段入口止血 + C5 修默认日期偏移诱因；结构性"每日滚动生成 cron"根治排下迭代）　**页面** `/booking/onsite`（亦影响真实预约）
- **现象（prod 实测）**：现场补录 step1 时段下拉恒"当日暂无可预约时段"，无法进入后续步骤。
- **真根因**：`booking_slot` 表**最新时段只到 2026-06-03，当天(06-04)0 个时段**；`listSlotsByDate` 精确匹配 `where:{date}` → 当天查不到 → 下拉空。**即系统没有"为当天/未来日生成时段"的机制**，seed 数据一过期，**当天就无任何可预约时段**。
- **放大效应**：叠加 R-cfg（配额配置页只读、UI 建不了时段）→ 运营**当天无时段时既不能预约、也无法在后台补建**，自救无门。不只补录，**真实在线预约同样会因当天无 slot 而瘫痪**。
- **次要**：① 页面 `date` 默认用 `new Date().toISOString()`（**UTC** 日期），与 slots 页特意用的 CST 本地日期不一致，跨时区临界会再偏一天；② 预约日期用**原生 date 控件、英文格式 `06/04/2026`**（违红线6，U1）。
- **建议**：① 加**时段排期/每日自动生成**（按规则滚动生成未来 N 天 slot；配 R-cfg 的"按日期类型建规则"一起做）；② 配额配置页提供手动建时段入口（R-cfg）；③ 日期统一走 CST 本地日期；④ 原生 date 控件换中文格式或自定义日期选择器。
- **证据**：`/tmp/onsite-now.jpg`；DB `booking_slot` max(date)=2026-06-03、`date='2026-06-04'` count=0；`onsite/actions.ts getOnsiteSlots`、`page.tsx` 的 `toISOString()`。

## B24 · 侧边栏底部留白——内容超屏时深绿背景不满高〔用户发现·UI〕
- **严重度** 🟡 中（观感）　**状态** 🆕 新登记　**页面** 全站（`src/lib/ui/sidebar.tsx` + `(admin)/layout.tsx`）
- **现象**：当主内容比视口高、页面出现滚动时，侧边栏深绿背景**不到底**，底部露出一段**白色**（body 底 #F9FAFB）。
- **根因（实测）**：`aside` 用 `flex h-full … overflow-y-auto bg-sidebar`；内容把外层 `flex h-full min-h-screen` 容器撑到 1053px，但 `aside` 的 `h-full`(height:100%) 只解析到 ≈999px（≈视口高），**没拉满容器** → 矮 ~54px 露白。
- **建议**：侧边栏改 **`sticky top-0 h-screen`**（钉住、恰为视口高、内部滚动，永不露白），或外层 flex 去掉 aside 的 `h-full`、靠 `items-stretch` 拉满容器高。
- **附带**：`(admin)/layout.tsx` 还有内联 `style={{backgroundColor:"#F9FAFB"}}`、`style={{padding:24}}`（B9 内联 style 实例，可转 Tailwind）。
- **证据**：CDP 量得 layout=1053px / aside=999px / viewport=825px；`/tmp/sidebar-full.jpg`。

## B25 · 富文本编辑器未达"经典版"要求——传图仅 URL、无视频、无封面选择器〔2026-06-08 用户发现·功能缺口〕
- **严重度** 🟠 高（内容生产核心能力缺失，违 PRD 覆盖 A 档·经典版）　**状态** 🆕 新登记（线上实测确认）　**页面** `/content/{news,activities,intro,knowledge}/{new,[id]/edit}`（四类内容共用 `src/lib/ui/editor/RichTextEditor.tsx` + `_content-form.tsx`）
- **要求**（`docs/B端PRD需求覆盖对照.md` L106/117/118，A 档·经典版）：TipTap **接传图/传视频**（预签名直传对象存储）、**封面图选择器**（从素材库挑/上传）、输出受限 HTML 白名单 + 存盘消毒，支持 图片**/视频**/链接。
- **线上实况**（四类内容一致，CDP 实测）：工具栏 12 按钮=加粗/斜体/删除线/H2/H3/无序/有序/引用/链接/**插图(仅 URL)**/撤销/重做。
  1. **插图仅能粘 URL**（按钮 label「插入图片(URL)」），**不能本地上传、不能从素材库挑**；
  2. **完全无视频**支持（工具栏无视频按钮、`page=0` file input）；
  3. **封面为纯 URL 文本框**（`_content-form.tsx` 三处 `coverImage` 均 `kind:"url"`，label「封面图地址(URL,选填)」），**无选择器**；knowledge 无封面字段；
  4. **素材库 `/content/assets` 已独立可用**（预签名直传/网格/复制链接/删，`input[type=file]`×1），副标题自称"封面选择器可引用"，但**根本没接进编辑器与封面字段**。
- **根因**：`待办清单.md` 已知推迟项——R-素材「**封面选择器深集成(活动表单内挑选)留后续**」+ R-storage 工作量表「编辑器**接传图/传视频**」从未接线。非回归 bug，是**实现欠账**：上传基建(B6/R-存储)与素材库做完了，编辑器侧集成没做。
- **关联**：纠正 06-06 那轮 **B1「✅ 关闭」只覆盖"editor 挂载正常"，不代表功能达标**——挂载 OK 与 满足经典版要求 是两件事。
- **证据**：`/tmp/editor-news-new.jpg`（编辑器）、`/tmp/assets.jpg`（素材库）；四类 new 页工具栏 label 全一致、`fileInputs=0`、`hasVideo=false`。
- **建议**（待用户定，本轮只记录）：① 插图按钮接素材库预签名直传 + 加视频扩展；② 封面字段换素材选择器（复用 `/content/assets`）；③ 落输出白名单消毒（R-mp 护栏，产真内容前必须）。最小起步可先只补封面选择器。

## B26 · 线上今日无可用时段 + 零时段模板——B23 滚动生成在 Vercel 未生效〔2026-06-08 prod 实测·链路瘫痪〕
- **严重度** 🔴 高（当天补录/在线预约链路再次瘫痪）　**状态** 🆕 新登记（B23 结构性修复线上失效，升级登记）　**页面** `/`、`/booking/slots`、`/booking/quota-rules`、`/booking/onsite`
- **现象**（线上 2026-06-08 实测）：
  - 仪表盘「今日预约时段」=「**今日暂无时段数据**」；今日预约 0 人次、在园 0；
  - `/booking/slots`「**当日暂无时段数据**」（有手动"为本日补建时段"入口=C4 止血，但需先有模板/手录）；
  - `/booking/quota-rules`「**暂无模板,点击「新建模板」开始配置**」——**零时段模板**；
  - `/booking/onsite` step1 时段下拉「**当日暂无可预约时段**」，无法进入后续步骤。
- **根因**：B23 的根治方案=SysSlotTemplate(按日期类型) + 节假日日历 + `rollGenerateSlots` 每日滚动生成 + 双触发(pg-boss 18:00 / Vercel Cron)。线上两处断点:① **零时段模板** → 即便"立即生成"也生不出 slot;② Vercel serverless **pg-boss 18:00 常驻 job 不会跑**,Vercel Cron 是否配置/触发存疑 → 没有任何机制为当天产 slot。seed slot 过期(库 max date 早于今日)后,当天彻底无时段。
- **影响**:演示态下**当天既不能现场补录、也不能在线预约**(真实在线下单同样因当天无 slot 失败);仪表盘/大屏当日客流全 0。
- **🚩〔口径升级 2026-06-09·用户设计决策〕根因不是"配置/cron 欠账",是"时段生成策略错了"**：`listSlotsByDate` 纯 `where:{date}` 查询、**读时不兜底生成**;时段靠 cron 预先物化未来 N 天 → **cron 漏跑一次=当天静默无时段=全园预约瘫=事故**(单点脆弱)。正确设计=**基准(常规日)+ 节假日/特殊日特例叠加,查询时即时解析(无特例落基准、闭园=0),`booking_slot` 行仅首单惰性物化用于计数,废弃 cron 预生成**。详见 `B端PRD需求覆盖对照.md` R-cfg + `B端技术架构.md` 设计要点·时段生成。
- **建议**(止血 vs 根治分开):① **止血**(演示):配一套时段模板 + 手动补建当天时段;② **根治**:按上述"规则派生 + 首单惰性物化"重构生成层(去 cron 单点),才是真修。
- **证据**:`/tmp/dash.jpg`(今日暂无时段数据)、`/tmp/onsite.jpg`(当日暂无可预约时段);quota-rules「暂无模板」;`repository.ts:40 listSlotsByDate`(无惰性生成)。

## B27 · 原生日期控件显示英文格式 mm/dd/yyyy〔2026-06-08 实测·红线6〕
- **严重度** 🟡 中（违 PRD 红线 6：日期禁 ISO/英文，用「2026 年 6 月 8 日」）　**状态** 🆕 新登记（U1/B23-④ 同源未尽）　**页面** `/analytics/traffic`（开始/结束日期筛选）、`/booking/onsite`（预约日期），及其它用原生 `<input type=date>` 处
- **现象**（CDP 实测）：`/analytics/traffic` 筛选框 placeholder「**mm/dd/yyyy**」「未选择」；`/booking/onsite` 预约日期控件显示「**06/08/2026**」（其下另有中文 helper「2026 年 6 月 8 日」兜底）；**`/booking/quota-rules` 特例日历日期控件「mm/dd/yyyy」**（2026-06-09 新增,无中文兜底）。表格/图表内的日期均已中文（达标），**仅原生日期输入控件**露英文。
- **根因**：原生 `<input type=date>` 的显示格式由**浏览器 locale**决定，应用层无法纯 CSS/属性改。
- **建议**（待用户定）：① 换自定义中文日期选择器（如已在栈的组件库 DatePicker）统一中文化；② 或保留原生但补可见中文 helper（onsite 已这么做，analytics 筛选未做）。属"统一 theme/组件 pass"可一并处理。
- **证据**：`/tmp/an-traffic.jpg`（筛选 mm/dd/yyyy）、`/tmp/onsite.jpg`（06/08/2026 + 中文 helper）。

## B28 · 停车场分布地图永久"地图加载中…"占位文案误导〔2026-06-08 实测·R6 占位〕
- **严重度** 🔵 低（观感/文案）　**状态** 🆕 新登记　**页面** `/traffic/parking`
- **现象**：高德 key 未配（R6 阻塞）下，停车场分布地图区永久显示「**地图加载中…**」——暗示稍后会加载完，实则永不加载。对比 `/traffic/road` 用**诚实占位**「高德实时路况地图待阶段5地图组件接入后展示」，体验更清楚。
- **建议**：停车场地图占位文案与路况页对齐，改诚实占位（如"地图待高德组件接入后展示"），勿用"加载中…"。随 R6 一并。
- **证据**：`/tmp/an-...` 不适用；`/traffic/parking` body「停车场分布地图 地图加载中…」。

## B29 · docker-compose app 服务缺全部 S3_* env → 预签名直传永远失败〔2026-06-08 实测·配置缺失·已修〕
- **严重度** 🟠 高(媒体直传链路在 docker 全不可用)　**状态** ✅ 已修(补 env,无需重打包)　**页面** `/content/assets`(媒体素材库)+ 内容编辑封面/编辑器插图(B25 接入后)
- **现象**:CDP 实测封面上传报「直传失败,请检查存储服务可达性」。排查:`docker exec changqiushan-app env` 无任何 `S3_*` 变量。
- **根因**:`integration.ts` 默认 `endpoint/publicEndpoint=http://localhost:9000`、`accessKey/secretKey=""`;而 `docker-compose.yml` app 服务 `environment` **从未配置 S3_***。后果:① 预签名 URL 用 `localhost:9000`(浏览器=Windows 本机,非服务器 MinIO)→ 浏览器 PUT 直传连不上;② 空凭据签名 MinIO 也会拒。**媒体素材库上传同样从未在 docker 跑通**(对应 R-storage「待 QA」一直没做)。
- **修复**:`docker-compose.yml` app 服务补(均可被宿主 env 覆盖):`S3_ENDPOINT=http://minio:9000`(服务端内网)、`S3_PUBLIC_ENDPOINT=http://10.7.0.1:9000`(浏览器经 VPN 可达)、`S3_ACCESS_KEY/SECRET=MinIO root`、`S3_BUCKET=changqiushan-media`、`S3_FORCE_PATH_STYLE=true`。`docker compose up -d` 重建容器即生效(env 改动无需重打包)。
- **实测**:补后 CDP 注入图片→封面预览成功载入 `http://10.7.0.1:9000/changqiushan-media/public/assets/<uuid>.png`(presign→PUT→commit→public 读全通)。
- **附**:`S3_PUBLIC_ENDPOINT` 硬指 VPN `10.7.0.1`,仅适配当前 QA 网络;上线换公网/COS/OSS 域名。

## B30 · 内容编辑仍为表单模式、非"文档/Word"式〔2026-06-08 用户反馈〕
- **严重度** 🟡 中(体验,用户明确要求)　**状态** ✅ 首版 docker 实测通过(b-101 P2-③;CDP 实测 news/activity 文档画布+banner封面+内联标题+正文输入+属性侧栏均正常,证据 `/tmp/docmode-news.jpg`、`/tmp/docmode-activity.jpg`)　**页面** 四类内容 `*/new`、`*/edit`(共用 `_content-form.tsx`)
- **现象**:用户反馈"没有做成类似 word 的效果""看来没有文档化"。P1 只做了图片,文档范式(P2-③)此前按"先做图片"推迟,故仍是 标题/摘要/封面/正文 分字段表单。
- **首版改造(已落,待 docker 实测)**:`_content-form` 改**文档画布 + 属性侧栏**——封面 banner → 内联大号标题 → 内联摘要 → 全宽正文(`RichTextEditor variant="document"`:无框/工具栏吸顶/正文加高);结构化字段(活动日期/名额/报名费、知识分类、排序)收进右侧「文档属性」侧栏;日期带中文 helper(搭车解 B27)。
- **仍待**:① 正文白名单消毒护栏(R-mp,装 sanitize-html);② 气泡工具栏(TipTap v3 BubbleMenu);③ 列表拖拽排序(P1-②)。见 `.claude/plan/b-101-内容编辑文档化改造方案.md`。

## B31 · 配额规则页:日历视图未落地 + 规则层缺总库存/单证单日上限 + 仍是 cron 物化〔2026-06-09 线上实测〕
- **严重度** 🟠 高（PRD 1.2 核心规则层 + 已拍板 UX 未落地）　**状态** 🆕 新登记　**页面** `/booking/quota-rules`（配额规则与日历）
- **① 日历视图决策未实现**:页名/菜单带"日历",实为**两张表 + 一行特例表单**——时段模板表(按 工作日/周末/节假日 + 各渠道名额) + 特例日历表单(日期/类型/备注/闭园勾选)。**无月/周日历、无 日历⇄表格 切换键**。违背 **〔用户决策·UX 2026-06-04〕日历视图优先 + 可切表格**(见 `B端PRD需求覆盖对照.md` R-cfg)。
- **② PRD 1.2 规则层仍缺两项**:❌ **每日最大预约总库存**(独立总闸,PRD"如 10000 人");❌ **单身份证/手机号单日预约上限**(PRD 红线"预约公平性"防黄牛占位)。两项在 slots 页、本页都没有 → 全缺。
- **③ 整页仍是已废弃的 cron 物化模型**:副标题"每日滚动生成据此展开" + 按钮"立即生成未来时段"。按 **〔设计决策 2026-06-09〕规则派生 + 首单惰性物化、去 cron**(R-cfg/技术架构),"生成"语义应废弃;数据模型(模板 by 日期类型 + 特例日历)可复用。
- **④ 红线6**:特例日历日期控件原生 **`mm/dd/yyyy` 英文格式**(并入 B27)。
- **要落三件**:① 日历视图(2026-06-04) ② 派生+惰性物化(2026-06-09) ③ 补 总库存 + 单证单日上限。数据建模方向正确(工作日≈基准/节假日≈特例/各渠道名额/闭园/调休手录)。
- **证据**:`/tmp/qa-3-quota.jpg`。

## B32 · 预约单查询无分页、全量渲染——真实数据将卡死〔2026-06-09 线上实测·性能/可用性〕
- **严重度** 🟠 高（高频运营页,真实量级下不可用）　**状态** 🆕 新登记　**页面** `/booking/bookings`（预约单查询）
- **现象**:seed 200 条预约单**一次性全量渲染**到单页(页高实测 11665px,需狂滚)。**无分页、无虚拟滚动、无服务端分页**。真实景区日预约上千、累计上万 → 一次拉全量 + DOM 全渲染 = 首屏慢/内存高/浏览器卡死。
- **影响**:预约单查询是对账/核销/排查高频页,数据越多越不可用,与运营场景背道而驰。
- **建议**(待修):服务端分页(limit/offset 或游标)+ 前端分页器;配合现有 状态筛选(全部/已预约/已核销/已取消)+ 搜索 一起做。
- **附·导出缺口** 🟡:本页**无 Excel 导出**。严格说 PRD 红线5 针对客流/画像/偏好"报表",预约单不算报表;但运营对账常需导出预约单,建议补(非红线、属运营体验缺口)。
- **✅ 合规**:红线2(身份证脱敏 `5101***1236` + 车牌 川A99999/粤BF54321 + 无车辆)、红线1(无门票/票价/购票/退款用语)、核销按钮、状态筛选/搜索/清空 均在。
- **证据**:`/tmp/qa-4-bookings.jpg`(200 行铺满)。

## B33 · 自主回归批次发现(页5–15)〔2026-06-09 CDP 线上逐页·只记录不改〕
> 用户外出期间自跑一轮回归 + 产品/QA 探查。逐页结论:

### A. 回归——已修/合规仍成立 ✅
- 红线1 用语:除 seed 资讯一处(见 D)外,各页无 门票/票价/购票/退款/票务。
- 红线2 双要素:预约单查询出 身份证脱敏+车牌+无车辆;现场补录有"车辆信息"步。
- **红线3 支付隔离 ✅**:活动报名费 ¥200/¥50/免费 走微信支付(二消),活动/预约链路无 门票/购票/入园支付。
- 红线5 导出 ✅:客流/热力/来源/画像 四页均有"导出 Excel"。
- B6 设备三态 ✅(在线3/离线1/告警1);blacklist **申诉管理 Tab 存在**(PRD 申诉通道达标)+ 自动(累计爽约3次)/人工 拉黑;system 三 Tab(账号/角色权限/操作审计)齐;B28 parking"加载中…"复现;B26 onsite 当天空复现。

### B. 🟠 PRD 1.4 数据分析:两页名实不符 / 本体缺失
- **热力图分析 ≠ 热力图**:`/analytics/heatmap` 实为**各时段游客密度条形图 + 时段峰值表**(9时/10时…峰值人数),**无 2D 热力网格、无地理热力**。PRD 1.4 要"到访热力分布 / 客源热力分布"(地理)——**本体未做、页名误导**。
- **来源分析 ≠ 行政图下钻**:`/analytics/source` 实为**渠道分布占比**(小程序/第三方/现场/后台),**无 省/市/区县行政图下钻**。PRD 1.4 要"来源分布行政图,可下钻省/市/区县"——未做(确认 R-来源 线上属实)。

### C. 🟡 R-只读 确认(管理页无 CRUD,线上复现)
- `/booking/channels` 渠道接入:**纯只读**展示 4 渠道,无 启用/停用/配置入口(配额切分甩给 slots 页)。
- `/iot/devices` 设备列表:**无 录入/新建/编辑设备** 入口(R-只读,PRD 1.5 资产管理缺)。
- (叠加已记的 slots 部分改善、parking 只读。)

### D. 🔵 内容用语 红线1 细节
- seed 资讯《2026 年春季开园公告》正文含「**免费不售票**」——语义对(强调免费),但仍出现"售票"字样。建议改写为"全园免费、仅需预约"等,彻底避开票务词。属内容文案审,非代码。

### E. 🟡 地图 UX 决策未落地(确认)
- `/traffic/road`、`/traffic/parking` 仍是"小占位图/加载中 + KPI + 表格",非 **〔2026-06-04 决策〕高德地图整页背景 + 数据浮层**。前置 R6 高德 key。
- **证据**:`/tmp/r-{channels,blacklist,heatmap,system,road,parking}.jpg`。

## B34 · B26 读路径迁移不完整——仪表盘 + slots 配置页仍用旧 listSlotsByDate〔2026-06-09 docker QA·b-102 收尾发现〕
- **严重度** 🟡 中(下单链路已自愈,但管理视图误显"无时段",运营会误判)　**状态** ✅ 已修+docker 实测通过(2026-06-09)　**页面** `/`(仪表盘)、`/booking/slots`、**`/api/c/slots`(排查时新发现的更严重偏差)**
- **〔2026-06-09 修复〕** 3 处旧 `listSlotsByDate` → `bookingService.listSlotsForDate`:① 仪表盘 `(admin)/page.tsx`、② slots 配置页、③ **`api/c/slots/route.ts`(C 端游客查时段——游客当天无物化行就看不到时段、无法下单,破 B26 端到端,比管理视图更严重)**;`publicSlot` 入参收窄 Pick 使 SlotView 可传。`_dashboard-actions` 在园回拉**保持** listSlotsByDate(派生 checkedIn 恒 0,物化-only 正确且更省)。**大屏 `screen/*`** 同模式但属 b-102 排除范围、指标多为物化聚合,**未动、单独评估**。实测:仪表盘/slots 显示 5 派生时段、`/api/c/slots?date=2026-06-12` 返回可约时段;tsc/lint/lint-cn/60 测全绿。
- **现象**(修前 docker 实测):同一天(06-09 周二,WEEKDAY 有 5 模板)——
  - ✅ `/booking/onsite` 时段下拉**正确派生出 5 个时段**(上午场1/2、下午场1/2、傍晚场,带"现场余"额);
  - ✅ `/booking/quota-rules` 日历**正确显示派生时段**(4 号起"派生"虚线、占0%);
  - ❌ 但 **仪表盘"今日预约时段" + slots 配置页仍"今日暂无时段数据"**。
- **根因**:B26 读路径只改了**下单/C端/onsite/日历**(走 `bookingService.listSlotsForDate` 派生合并),**漏改两个管理视图**:`src/app/(admin)/page.tsx:22` 与 `src/app/(admin)/booking/slots/page.tsx:24` 仍直调 `bookingRepository.listSlotsByDate`(仅返回已物化行,今日 0 行 → 空)。
- **影响**:核心预约链路 B26 自愈**已生效**(onsite/在线能下单);但运营看仪表盘/配额页会**误以为今天没时段**,与实际可约不一致。非阻断,属迁移收尾遗漏。
- **建议**:把 `(admin)/page.tsx:22` 和 `slots/page.tsx:24` 改用 `bookingService.listSlotsForDate(dateStr)`(派生+已物化合并),与 onsite/日历口径统一。
- **证据**:`/tmp/b102-slots.jpg`、onsite 下拉 5 时段、`/tmp/b102-calendar.jpg`(派生显示正常)。
