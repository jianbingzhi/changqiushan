# Round 01 · 演示服务器线上 CDP 真机验收

| 项 | 内容 |
|---|---|
| 轮次 | round-01 |
| 日期 | 2026 年 7 月 28 日 |
| 验收方 | 测试（独立验收方，ai-mesh 角色 `测试`） |
| 环境 | **演示服务器 `http://156.229.22.155`（自托管 docker 全栈，Caddy:80 统一入口）** |
| 容器 | `changqiushan-app` / `caddy` / `gotrue` / `postgres:18` / `minio`，均 `Up 5 weeks (healthy)`，启动于 2026-06-22 |
| 部署代码 | 分支 `deploy-demo` @ `9befd9c`（**不是 `main`**，见 N06） |
| 方法 | 全局 CDP skill 驱动 Windows Chrome 150（经 WireGuard `10.7.0.2:9222`）真机浏览器；超管 `13900000000` 真登录 |
| 范围 | 20 个 `(admin)` 路由 + 8 块 `/screen` 大屏 + 22 个 `/api/c` C 端端点抽验 + 红线 1/5/6 全量扫描 + 深浅主题切换 |
| 结论 | **8 条 issue（1 高 / 1 中偏高 / 2 中 / 4 低）**，1 条需人工验证；红线 1/5/6 与鉴权边界全部通过 |

> 状态：🆕 未修 · 🛠️ 部分 · ✅ fix（实现方自检通过）· ✔️ pass（**仅本验收方**可标）
>
> 修复进度（r2，2026 年 7 月 28 日）：**N01 / N02 / N03 / N04 / N05 / N07 = `fix`**；**N08 阻塞于 N06 未修**（在 `main` 上不成立，见该条「修复方结论」）；**N06 归人工裁决**。
>
> ⚠️ 本轮验收对象是 **`deploy-demo` 分支的产物**。`main` 落后 9 个提交（N06），因此本轮的「通过」结论**不能直接迁移到 `main`**。

---

## 一、问题清单

### N01 🔴 高 · `/booking/onsite` 服务端渲染内容陈旧 6 天，hydration 失败连带打掉深色主题

| 字段 | 内容 |
|---|---|
| 状态 | ✔️ **pass**（r5 真机 CDP 复验，2026 年 7 月 29 日）|
| 页面 | 现场补录面板 `/booking/onsite` |
| 复现 | 3/3（禁 JS + 禁 HTTP 缓存下同样复现，排除浏览器缓存） |

**现象**（今日真实日期 = 2026 年 7 月 28 日）：

1. 服务端下发的 HTML 里，「预约日期」写的是 **2026 年 7 月 22 日**（陈旧 6 天），时段下拉写的是 **「当日暂无可预约时段」**。
2. 页面 hydration 完成后才跳成 **2026 年 7 月 28 日** + 5 个真实派生时段（上午场 1/2、下午场 1/2、傍晚场）。
3. 控制台稳定抛 `Minified React error #418`（`args[]=text`，即「文本内容与服务端渲染不一致」）。
4. **连带副作用**：该路由的 `<html>` class 被 React 按 SSR 版本回写，`dark` 被抹掉 —— 这是全站**唯一**一个不跟随深色主题的页面（`localStorage.cqs-theme=dark` 仍在，其余 6 个路由全部正常）。

**复现步骤**：

```
1. 真登录后台 → 切到深色主题
2. 访问 /booking/onsite
3. 观察首屏日期 / 时段下拉 / 页面配色
4. 或用 CDP：Emulation.setScriptExecutionDisabled=true + Network.setCacheDisabled=true 后导航，
   读 document.querySelector('main').innerText
```

**实测取证**：

| 路由 | SSR 里的日期 | 实际今日 |
|---|---|---|
| `/booking/onsite` | **2026 年 7 月 22 日** | 2026 年 7 月 28 日 |
| `/`（首页） | 2026 年 7 月 28 日 ✅ | 同 |
| `/booking/slots` | 2026 年 7 月 28 日 ✅ | 同 |
| `/traffic/road` | 2026 年 7 月 28 日 ✅ | 同 |

主题跟随实测（同一会话内连续导航，`localStorage.cqs-theme=dark`）：

```
/booking/onsite    → h-full            ← 丢 dark
/analytics/traffic → h-full dark
/booking/onsite    → h-full            ← 丢 dark
/content/news/new  → h-full dark
/booking/onsite    → h-full            ← 丢 dark
/                  → h-full dark
/booking/slots     → h-full dark
```

**期望**：首屏即渲染当日日期与当日可约时段；无 hydration 报错；深色主题与其余页面一致。

**影响**：现场补录面板是 **PRD 红线 2（预约双要素强校验）** 的三路收口之一。首屏出现「当日暂无可预约时段」会让现场操作员误判当天不能补录；日期错 6 天若在 hydration 完成前被提交或被肉眼采信，属数据正确性风险。

**根因线索**（供修复方参考，未验证）：`app/src/app/(admin)/booking/onsite/page.tsx:26`
```ts
const INITIAL: FormState = { date: chinaToday(), ... };   // ← 模块作用域求值
```
该常量在模块加载时求值一次即冻结；配合该路由被 Next 全路由缓存/静态化，日期被钉死在渲染产物生成的那一刻。可考虑改 `useState(() => chinaToday())` 或对该路由声明 `export const dynamic = "force-dynamic"`。**根因判断归修复方，本条以现象与复现为准。**

**证据**：`docs/issues/assets/round-01-N01-onsite-ssr陈旧日期.png`（禁 JS + 禁缓存下的服务端原样输出）

**r3 复验（测试，2026 年 7 月 28 日）：服务端部分已通过，深色/水合部分待真机**

本机 docker 全栈（`main` @ `6d27afa` 构建的镜像）+ GoTrue 真登录态，直接取服务端 HTML：

| 检查 | 结果 |
|---|---|
| SSR 里的预约日期 | **2026 年 7 月 28 日** = 当日 ✔️（原为陈旧 6 天的 7 月 22 日） |
| 时段下拉首帧文案 | **「加载时段中」** ✔️；「当日暂无可预约时段」**已不出现** |
| 该路由是否仍被静态预渲染 | `prerender-manifest.json` 中**无 `onsite`**；响应头 `Cache-Control: private, no-cache, no-store, must-revalidate` ✔️ |

**产生 6 天陈旧的那套「静态化 + 模块作用域求值」冻结机制已被结构性移除**（源码改为 `useState(createOnsiteForm)` 渲染时求值，另有 `form-state.test.ts` 守卫）。

⚠️ **本条尚不能定 `pass`**，两点未验：

1. **无 `Minified React error #418`** —— 需读浏览器 console。
2. **该页深色主题跟随**（原为全站唯一丢 `dark` 的页）—— 需真机切主题观察 `<html>` class。

⚠️ 另注：镜像构建于当日，**「日期显示为今天」本身不足以证明冻结解除**（被冻结的值恰好也是今天）。上表第三行「路由不再静态预渲染」才是当时的实质证据。**真正的终验需跨天复查一次**（隔日再看首屏日期是否跟着走）。

**r4 跨天复验（测试，2026 年 7 月 29 日 11:03 北京）：冻结确已解除 ✔️**

r3 的 docker 栈**原样保留未动**，跨过北京日历日边界后重取同一页面：

| 检查项 | 实测 |
|---|---|
| app 容器存活 | `Up 18 hours`，**`RestartCount = 0`**，启动于 `2026-07-28T09:16:15Z` |
| 即：Node 进程 | **未重启，跨越了 7-28 → 7-29 的日历日边界** |
| SSR 里的预约日期 | **2026 年 7 月 29 日** = 当日 ✔️ |
| 时段下拉首帧 | 「加载时段中」；「当日暂无可预约时段」未出现 ✔️ |

**这是本条的决定性证据**：原 bug 是 `const INITIAL = { date: chinaToday() }` 在**模块作用域**求值、一个进程只算一次。若冻结仍在，同一进程此刻必然仍渲染 7 月 28 日。实测跟着日历日走到了 29 日，**说明日期确已改为渲染时求值，与进程存活时长无关**。

至此 N01 的**服务端行为全部通过**。浏览器侧两项见下。

**r5 真机 CDP 复验（测试，2026 年 7 月 29 日）：通过 ✔️ → `pass`**

Windows Chrome 150（经 WireGuard `10.7.0.2:9222`）真机、走 UI 真登录（`13900000000`）、深色态：

| 检查 | 实测 |
|---|---|
| `<html>` class | `h-full dark` ✔️ —— **深色主题已跟随**（原为全站唯一丢 `dark` 的页） |
| body 背景 | `rgb(15, 23, 19)` ✔️ |
| 页面日期 | 2026 年 7 月 29 日 = 当日 ✔️ |
| console 错误/警告 | **0 条**；含 `418`/`hydrat`/`mismatch` 的 **0 条** ✔️ |
| 原生 `<select>`（N04 联动项） | `background: rgb(22,32,26)`、`color-scheme: dark`、6 个选项（占位 + 5 个派生时段）✔️ |

**证据**：`docs/issues/assets/round-01-N01-r5-深色通过.png`

---

### N02 🟡 中 · 富文本编辑器工具栏深色主题下是整条白条（B36 线上复现）

| 字段 | 内容 |
|---|---|
| 状态 | ✔️ **pass**（r5 真机 CDP 复验，2026 年 7 月 29 日）|
| 页面 | `/content/news/new`（以及所有挂 `RichTextEditor` 的编辑页） |
| 复现 | 稳定复现 |

**现象**：切到深色主题后，编辑器工具栏（B / I / S / H2 / H3 / 列表 / 引用 / 链接 / 插图 / 视频 / 撤销 / 重做）整条是亮白色，在深色画布上极刺眼。

**实测**：深色主题下扫描全页 computed style，命中的浅色块只有这一个 —
```
DIV  class="flex flex-wrap items-center gap-0.5 border-b border-border bg-[#FAFAFA] px-2 py-1.5"
     backgroundColor = rgb(250, 250, 250)   639×45 px
```
即硬编码的 `bg-[#FAFAFA]` 未走 token。待办清单记录的另两处（激活态 `#E8F0E6`、错误条 `#FEF2F2`）本轮未触发到，未确认。

**期望**：工具栏走 `bg-muted` / `bg-card` 语义 token，激活态走 `bg-primary/10`。

**证据**：`docs/issues/assets/round-01-N02-富文本工具栏深色白条.png`

**r3 复验（测试，2026 年 7 月 28 日）：结构已证，视觉待真机**

从运行中容器取真实下发的样式表，逐个数原硬编码浅色值的出现次数：

| 值 | 原用途 | 复验结果 |
|---|---|---|
| `#FAFAFA` | 工具栏底 | **0 次** ✔️ |
| `#E8F0E6` | 激活态 | **0 次** ✔️ |
| `#FEF2F2` | 错误条 | **0 次** ✔️ |

三处全部从产物中消失（原 issue 只锁定了工具栏一处，另两处修复方一并收口）。

**r5 真机 CDP 复验（2026 年 7 月 29 日）：通过 ✔️ → `pass`**

深色态打开 `/content/news/new`，用**与 r1 完全相同的全页扫描口径**（遍历所有元素，取可见、不透明、亮度 > 200 的背景块）：

- r1：命中 **1 个** —— 即那条 `bg-[#FAFAFA]` 工具栏，639×45px；
- r5：命中 **0 个** ✔️

目视确认工具栏已完全融入深色画布，白条消失。**证据**：`docs/issues/assets/round-01-N02-r5-工具栏深色通过.png`

> 顺带核查：CSS 中仍存在 `.text-[#374151]` 工具类，但全仓 grep 显示**只有 `theme-tokens.test.ts` 的守卫注释**引用该字面量（Tailwind 扫到测试文件即生成），**无任何组件在用**，不构成残留缺陷。
> 另有 7 处同族硬编码（`system/page.tsx:82` 等）修复方已如实登记进 `docs/待办清单.md` 并标为超本轮范围的 🔵 低余项 —— 属公开留痕，非隐藏回归。

---

### N03 🟡 中 · echarts 热力矩阵深色下底色恒为白，**刷新也不恢复**

| 字段 | 内容 |
|---|---|
| 状态 | ✔️ **pass**（r5 真机 CDP 复验，2026 年 7 月 29 日，两项均过）|
| 页面 | `/analytics/heatmap` 「时段 × 星期预约热力」 |
| 复现 | 稳定复现 |

**现象**：深色主题下，热力矩阵的绘图区底色是白色/极浅色，嵌在深色卡片里割裂明显。

**与既有文档不符**：待办清单 §二 theme-QA 把这条记作「echarts 主题切换瞬间不重绘（**结构性，切完刷新即正常**）」。本轮实测 —— **切换后不重绘属实，但刷新后依然是白底**，与「刷新即正常」不符。两张截图（切换未刷新 / 刷新后）像素级一致。

**复现步骤**：
```
1. /analytics/heatmap 浅色下打开 → 2. 点 topbar 主题开关切深色 → 观察（白底）
3. F5 硬刷新 → 再观察（仍白底）
```

**期望**：深色主题下图表底色/网格/坐标轴文字跟随 token。

**证据**：`docs/issues/assets/round-01-N03-热力图深色白底.png`（**刷新之后**拍的）

**r5 真机 CDP 复验（2026 年 7 月 29 日）：两项均通过 ✔️ → `pass`**

对 echarts canvas 直接做**像素采样**（取绘图区中段 25%–75%，逐点读 `getImageData`，算平均亮度），不靠肉眼估色：

| 场景 | `<html>` class | 图表图层亮度 | 判读 |
|---|---|---|---|
| 浅色基线 | `h-full` | **197**（浅） | 基线 |
| **真点主题开关，不刷新** | `h-full dark` | **77**（深） | ✔️ **切换即重绘**，无需刷新 |
| 深色下硬刷新（`Page.reload` 忽略缓存） | `h-full dark` | **75**（深） | ✔️ 刷新后仍深，原「刷新也不恢复」已消除 |

**首帧闪浅色（code review r3 ② 提出的隐患）也一并实测**——硬刷新后每 160ms 采一次样：

```
 320ms  cls="h-full dark"  body bg=rgb(15,23,19)  canvas=0
 480ms  cls="h-full dark"  body bg=rgb(15,23,19)  canvas=0
 640ms  cls="h-full dark"  body bg=rgb(15,23,19)  canvas=3   ← 图表此刻才出现
 …此后稳定
```

`dark` 类与深色底从第一帧就在，而 **echarts canvas 到 640ms 才被创建** —— 即「挂载前只渲染占位、挂载后按真实主题一次画成」的做法确实从源头消除了浅色首帧，**未观察到任何可感知闪动**。

> 附注：深色下另有一个 canvas 图层采样亮度为 255，但其 **alpha 仅 17（≈7% 不透明）**，是 echarts 的浮层，肉眼不可见，不构成缺陷。

**证据**：`docs/issues/assets/round-01-N03-r5-切换即重绘.png`

> **修复附注（r4）**：code review r3 ② 指出「深色用户硬刷新时图表会先按浅色画一帧再翻深」（`useDarkMode()` 的服务端快照只能是浅色）。该项**未按「记为已知残留」处理，而是直接消除**：后台图表在客户端挂载前只渲染等高占位、不初始化 echarts，挂载后按真实主题一次画成（`lib/ui/use-dark-mode.ts` 的 `useMounted()`）。真机是否还有可感知的闪动，仍以测试验收为准。

---

### N04 🔵 低 · 深色主题未声明 `color-scheme`，原生表单控件白底

| 字段 | 内容 |
|---|---|
| 状态 | ✔️ **pass**（r3 复验，2026 年 7 月 28 日，实测真实下发的 CSS 产物）|
| 复现 | 稳定 |

**现象**：深色主题下 `document.documentElement` 与 `body` 的 computed `color-scheme` 均为 `normal`（未声明 `dark`），原生控件保持浅色渲染。

**实测**：全站扫描原生 `select` / `input[type=date|checkbox|time]`，**只有 `/booking/onsite` 的时段下拉是原生 `<select>`**（computed `background-color: rgb(255,255,255)`），其余页面都用了 shadcn 组件，因此当前可见影响面很小。**但与 N01 联动** —— onsite 目前根本进不了深色主题，等 N01 修好后这个白控件才会暴露出来。

**期望**：深色主题下声明 `color-scheme: dark`（`html.dark { color-scheme: dark }`）。

**r3 复验（测试，2026 年 7 月 28 日）：通过 ✔️**

不看源码、直接取运行中容器**真实下发**的样式表（`/_next/static/chunks/0rufqegiu2-w0.css`，56,075 字节），两条声明都在：

```
:root{ … color-scheme:light; --bg:#f9fafb; … }
.dark { … color-scheme:dark;  --bg:#0f1713; … }
```

本条的验收契约就是「深色下声明 `color-scheme: dark`」，已在真实构建产物中确证，故定 `pass`。原生 `<select>` 随之变深是浏览器对该声明的标准行为，届时与 N01 的真机复验一并顺带目视确认。

---

### N05 🔵 低 · 来源分析行政图深色下为白色地块

| 字段 | 内容 |
|---|---|
| 状态 | ✔️ **pass**（r5 真机 CDP 复验，2026 年 7 月 29 日，含 tooltip）|
| 页面 | `/analytics/source` 「来源地区分布(行政区划下钻)」 |

**现象**：深色主题下中国行政图地块为白/浅灰，在深色卡片上是一大块亮面。与待办清单 §二「`analytics/source` 行政图 `theme={null}` + 硬编码色为已知必中点」一致。数据本身正确（四川省 688 / 广东省 370 / 重庆市 351 / 浙江省 293，与右侧表格一致）。

**证据**：`docs/issues/assets/round-01-N05-行政图深色白地块.png`

**r5 真机 CDP 复验（2026 年 7 月 29 日）：通过 ✔️ → `pass`，并连带解决「待人工验证」的 tooltip 项**

- **地块**：canvas 像素采样平均亮度 **15**（深），原来那一大块亮面已消失，目视确认地块跟随深色、数据高亮为绿色系。
- **tooltip**：本轮**真实鼠标一次命中**（`Input.dispatchMouseEvent` 第 4 个采样点触发），读到实际浮层：

  | 属性 | 值 | 判读 |
  |---|---|---|
  | 内容 | 「云南省 到访游客 0 人」 | 正常 |
  | 背景 | `rgb(22, 32, 26)` | ✔️ 深色卡片色 |
  | 文字 | `rgb(232, 239, 227)` | ✔️ 浅色前景 |
  | 边框 | `rgb(42, 58, 48)` | ✔️ 深色描边 |

  → **r1 中「CDP 悬停未能触发、不下结论」的那项，本轮实测拿下，深色样式正确。**

**证据**：`docs/issues/assets/round-01-N05-r5-行政图深色通过.png`

---

### N06 🟠 中偏高 · `deploy-demo` 分支 9 个提交从未合回 `main`，其中含一条真 bug 修复

| 字段 | 内容 |
|---|---|
| 状态 | 🛠️ **部分解决** —— compose IPv4-only 修复经人工指示已 cherry-pick 进 `main`（`6e67f18`，源自 `434b73f`）；**其余 8 个提交仍只在 `deploy-demo`，分支策略待人工裁决** |
| 类型 | 工程/集成（非页面缺陷） |

**现象**：`git log main..origin/deploy-demo` 有 9 个提交，`origin/deploy-demo..main` **为空** —— 即 `main` 完全落后，缺失以下全部内容：

| commit | 内容 | 缺在 main 的后果 |
|---|---|---|
| `434b73f` | **compose 网络改 IPv4-only** —— 修复演示机容器到高德 ETIMEDOUT（路况/静态图全 502） | **`main` 的 `docker-compose.yml` 仍是 IPv6 黑洞版**，任何人按 main 起栈，高德路况/staticmap 必 502 |
| `6c21562` `9befd9c` | B104 超宽融合指挥总屏（3840×1080） | main 无此页；`/screen` 导航「共 8 块」在 main 上只有 7 块 |
| `c846702` | 大屏补 天气 / 画像雷达 / 调度策略 三个只读 metric | 见 N08 |
| `2047b91` | 演示部署加 Caddy 统一入口（80/443）反代 app + MinIO | main 无部署入口 |
| `d7099af` | CI：推 `deploy-demo` 即全自动部署 | main 无部署流水线 |
| `c07afa6` `dc29b0d` `149360c` | b-104 / b-104b 计划文档与导出 | 计划体系断档 |

**附带**：`PLAN.md` / `docs/待办清单.md` 均**未登记 B104 超宽融合指挥总屏**，`docs/待办清单.md` §五 仍写「大屏 C1–C7」共 7 块。

**期望**：由人工裁决 —— 是把 `deploy-demo` 合回 `main`，还是明确 `deploy-demo` 为长期部署分支并在 `AGENTS.md` / `PLAN.md` 写明分支策略。**这条建议交人工定方向，不宜由修复方自行合并。**

**处置进展（2026 年 7 月 28 日）**：

- ✅ **`434b73f` compose IPv4-only 已按人工指示 cherry-pick 进 `main`**（`6e67f18`，`cherry-pick -x` 保留来源溯源）。原 `networks:` 段整段移除，回到 Docker 默认 IPv4-only；原作者「迁回有公网 IPv6 + NAT66 主机时如何恢复」的注释一并带入。
  - 验证 ①：`docker compose config` 解析通过，渲染结果 `networks: default: name: app_default`，**无 `enable_ipv6`、无 `ipam`**。
  - 验证 ②（运行时）：以该 compose 建栈（临时项目 `cqsnettest`，仅 create 不启动，验完已连网络一并清除、无残留），`docker network inspect` → **`EnableIPv6=false`，`IPAM=172.27.0.0/16`**（纯 v4）。
  - 佐证 ③：演示服务器本就跑此修复版，本轮验收实测高德路况为真实数据、`staticmap` 稳定 200。
- ⏳ **仍未解决**：其余 8 个提交（B104 超宽总屏、大屏三 metric、Caddy 入口、部署 CI、b-104 计划文档）仍只在 `deploy-demo`；`PLAN.md` / `docs/待办清单.md` 仍未登记 B104（§五 仍写「大屏 C1–C7」共 7 块）。**分支策略仍待人工裁决。**

---

### N07 🔵 低 · 路况「最后更新」时间戳恒等于当前时刻

| 字段 | 内容 |
|---|---|
| 状态 | ✔️ **pass**（r3 复验，2026 年 7 月 28 日，docker 真实环境 + 高德真实数据）|
| 页面 | `/traffic/road` |

**现象**：页面「最后更新」与右侧拥堵摘要每条的时间戳，均随请求时刻走（连续两次访问分别显示 10:41 / 10:44），而数据本身有 60s 缓存，实际可旧至 60 秒。

**期望**：展示语义改为「约 1 分钟内」，或透出真实取数时刻。

**r3 复验（测试，2026 年 7 月 28 日）：通过 ✔️**

本机 docker 全栈 + 高德**真实数据**（`infocode=10000`，京昆高速畅通 2 条），同一登录态连续三次取页面：

| 采样时刻（北京） | 页面「最后更新」 | 判读 |
|---|---|---|
| 17:17:30 | 17:16 | **不等于当前时刻** —— 是真实取数时间 |
| 17:18:05（+35s，仍在 60s 缓存窗口内） | **17:16，未变** | 旧 bug 是每次都跟当前时刻跳，已消除 |
| 17:18:45（超过 60s 缓存） | 17:18，已刷新 | 缓存过期后如实更新，未被钉死 |

三点同时成立才算通过：①不跟请求时刻走 ②缓存窗口内稳定 ③缓存过期后会更新。本条纯服务端渲染文本，**不依赖浏览器**，故 r3 即可定 `pass`。

---

### N08 🔵 低 · 天气已接入，但一块大屏仍标「⚠ 天气/AQI 待接入」，两屏口径不一致

| 字段 | 内容 |
|---|---|
| 状态 | 🆕 **阻塞于 N06，未修**（见下方「修复方结论」）|
| 页面 | `/screen/command`（已接） vs `/screen/overview`（仍标待接入） |

**现象**：

- `/screen/command` 右上角显示 **蒲江县 · 晴 26℃ · 湿度 63%**；实测后端 `/api/screen/weather` 返回 `{"source":"amap","live":{"city":"蒲江县","weather":"阴","temperature":24,...}}` —— **是高德真实数据**。
- `/screen/overview` 页面上仍渲染 **「⚠ 天气/AQI 待接入」** 占位标注。
- `docs/待办清单.md` §五 也仍写「🆕 天气 / AQI（C5）—— 外部气象 API；现占位标注」。

**期望**：口径统一 —— overview 接上同一个 metric（AQI 若确实没有，占位文案收窄为「AQI 待接入」），并回填待办清单 §五。

**修复方结论（2026 年 7 月 28 日）：本条在 `main` 上不成立，阻塞于 N06，未修。**

天气 metric 的后端（`/api/screen/weather` 及 `infrastructure/amap` 的 `fetchWeather`）来自 `deploy-demo` 的 `c846702`，**`main` 上根本不存在**——在 `main` 上 `grep -rn weather app/src/` 为 0 命中，`/api/screen/[metric]` 白名单里也没有 `weather`。

因此在 `main` 上：

| 页面 | `main` 现状 |
|---|---|
| `/screen/command` | `page.tsx:112` = `<PlaceholderTag text="天气/空气质量待接入" />` |
| `/screen/overview` | `page.tsx:103` = `<PlaceholderTag text="天气/AQI 待接入" />` |

两屏**都是占位、口径本就一致**，`docs/待办清单.md` §五 写「待接入」对 `main` 也属实。本条描述的不一致只存在于**演示服务器跑的 `deploy-demo` 产物**上。

在 `main` 上"修"这条只有两条路，都不该由修复方自行决定：① 把 `deploy-demo` 合回 `main`（= N06，已交人工定分支策略，明确不由修复方合并）；② 在 `main` 上另写一份天气 metric（与 `deploy-demo` 的实现重复，日后合并必冲突）。**故本条挂起，随 N06 的分支裁决一并处置。**

---

### N09 🟡 中 · compose 的 IPv6 开关与宿主出网能力强绑定，**怎么设都有一边坏**（r3 复验期间实测发现）

| 字段 | 内容 |
|---|---|
| 状态 | 🆕（本轮复验搭环境时撞出，非页面缺陷，属工程/部署） |
| 类型 | 工程/部署 |
| 发现方式 | 在验收机上按 `main` 起 docker 全栈，路况页报「高德路况服务暂不可用」，逐层排查得出 |

**现象**：`app/docker-compose.yml` 的默认网络是否开 IPv6，**没有一个静态值对所有宿主都正确**——两种设法各会在一类主机上打断高德：

| compose 设置 | 无公网 IPv6 的主机（演示服务器 `156.229.22.155`） | 有公网 IPv6 的主机（本验收机，Linode） |
|---|---|---|
| `enable_ipv6: true` + ULA 子网 | ❌ 容器拿到指向黑洞的 v6 默认路由 → 高德 `ETIMEDOUT` → 路况/staticmap 全 502（即 `434b73f` 修的 bug） | ✅ 经 NAT66 走宿主 v6 出网，正常 |
| **IPv4-only**（不声明 `networks` 段，= `main` 现状） | ✅ 正常（本轮已验证） | ❌ **容器连不上高德**（见下方实测） |

**本机实测数据**（验收机，2026 年 7 月 28 日）：

```
宿主 curl -4 restapi.amap.com  → 超时失败
宿主 curl -6 restapi.amap.com  → 200，0.70s
宿主公网 v6 地址               → 2600:3c01::2000:28ff:fee2:9270/64
容器（IPv4-only）DNS 解析      → 106.11.43.113(v4) + 2408:4001:f00::173(v6)
容器（IPv4-only）fetch 高德    → FAIL，10.6s（走 v4 打不通）
容器（IPv4-only）fetch 百度    → 200（证明出网本身是通的，仅高德 v4 不可达）
容器（改回开 v6）fetch 高德    → OK，1.2s，infocode=10000
```

即**高德在本机只有 v6 可达**，这正是当初写 `enable_ipv6: true` 想解决的原始问题；而演示机上恰好相反。`main` 上原注释其实已经预告过这个代价（「迁到无 v6 的主机时删掉本 networks 段即可回退（代价：容器内高德直连可能复发原 bug）」），本轮把它变成了实测事实。

**影响**：`main` 现在这份 compose 只对「无公网 IPv6」的主机成立。任何在有公网 v6 的机器上按 `main` 起栈的人（本验收机就是一例），会看到路况页与 staticmap 直接不可用，且报错文案指向「请检查 Key 或网络」——**会把人误导到 key 上去查**，与 `434b73f` 修复前的误导方向如出一辙，只是换了一类主机。

**期望**（方案由开发方定，这里只提约束）：让该项**可按宿主配置，而不是在仓库里写死一个值**。可选路径举例——

1. 把 v6 开关做成 env 驱动的可选 override 文件（如 `docker-compose.ipv6.yml`），部署文档写明「宿主有公网 v6 就叠加这个」；
2. 或让应用侧对高德请求显式指定地址族 / 加超时快速回落，使网络层怎么配都能连通；
3. 或统一经反代出网，把出网路径收敛到一处。

**当前规避**：本验收环境用 `app/docker-compose.qa.yml`（测试专用 override）重新开启 v6 把栈跑通，文件内已写明缘由。**该 override 只作测试环境用，不改变 `main` 的部署语义。**

---

### N10 🔵 低 · 热力图色阶条压在 X 轴刻度上，遮住两个时间标签（r5 复验时撞见）

| 字段 | 内容 |
|---|---|
| 状态 | 🆕 |
| 页面 | `/analytics/heatmap` 「时段 × 星期预约热力」 |
| 复现 | 稳定，**浅色 / 深色两种主题下均复现** |

**现象**：热力矩阵底部的 `visualMap` 色阶条（横向渐变条 + 两端「0」「62」端点标签）被放在绘图区正下方，**与 X 轴的时间刻度重叠**，把「10时」「12时」两个标签压住看不清；端点数字「0」「62」也与轴文字挤在一起。

**不是本轮修复引入的** —— r5 同时截了浅色基线与深色两张图，**两张里都存在**，属既有布局问题，只是 r1 当时聚焦深色配色没注意到。

**期望**：色阶条移到绘图区之外（如右侧竖排，或下移留出轴标签空间），端点标签不与轴刻度重叠。

**证据**：`docs/issues/assets/round-01-N10-色阶条压住X轴刻度.png`（浅色态，问题同样存在于深色）

---

## 二、需人工验证（本验收方不下结论）

| 项 | 原因 |
|---|---|
| ~~**行政图 tooltip 深色样式**~~ | ✔️ **r5 已解决** —— 真实鼠标一次命中，读到浮层 `bg rgb(22,32,26)` / `color rgb(232,239,227)` / `border rgb(42,58,48)`，深色样式正确。详见 N05 的 r5 复验。 |
| ~~**N01 / N02 / N03 / N05 的真机目视确认**~~（r3 阻塞，**r5 已全部完成并 `pass`**） | r3 复验期间 **CDP 真机浏览器不可达**：WireGuard 本端 `wg0`（10.7.0.1）正常，但对端 **10.7.0.2 ping 100% 丢包、`:9222` 无响应**，即 Windows 侧 Chrome 未在线。这 4 条的验收契约都是「深色下看颜色 / 读 console」，**按纪律不得用无头浏览器顶替，也不凭源码推定**，故一律停在 `fix`。**请人工把真机 Chrome（带 `--remote-debugging-port=9222`）拉起来，或指定其它真机方式**，我随即复验。 |

---

## 三、本轮通过项（留痕，不另立单）

| 检查 | 结果 |
|---|---|
| **红线 1**（免费景区，禁票务词） | 27 个页面服务端全文扫描 `门票/票价/购票/退款/售票/票务` → **0 命中** ✔️ |
| **红线 6**（100% 中文 / 禁 ISO 日期） | 同批扫描 `\d{4}-\d{2}-\d{2}` 与 Lorem → **0 命中**；孤立英文仅 `GATE-012` / `ROOT-001` 两个账号编号（标识符，非文案） ✔️ |
| **红线 5**（报表 Excel 导出） | `/api/screen/export/heatmap`、`/export/trend` 均返回 200 + `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` ✔️ |
| **大屏免登录 + 后台鉴权边界** | 无 cookie：`/screen`、`/screen/command`、`/screen/situation`、`/api/screen/*` → 200；`/`、`/booking/bookings` → 307 至 `/login?redirect=…` ✔️ |
| **8 块大屏全渲染** | command / situation / operation / trend / heatmap / overview / twin / poster 全部渲染，**0 console error**；占位项均有 `⚠ …待接入` 明示 ✔️ |
| **20 个后台路由** | 除 N01 外 **0 console error / 0 错误边界 / 0 永久「加载中」** ✔️ |
| **T1 高德地图** | `/traffic/road` 整页地图渲染正常，路况为**真实数据**（京昆高速双向畅通、均速 90/95 km/h）；`/traffic/parking` 同；`/api/screen/staticmap` 返回 **200 image/png** ✔️（证据 `assets/round-01-PASS-路况整页地图.png`）<br>⚠️ 注：待办清单 §三记的「Vercel 域名白名单未加致瓦片偏白」是 **Vercel 侧**的事，**本演示服务器不受影响** |
| **B37 staticmap 502** | 本环境不复现，稳定 200 ✔️ |
| **B40 `VISITOR_JWT_SECRET`** | 容器内已配（64 字符）✔️ |
| **C 端 BFF** | `/api/c/slots?date=2026-07-28` 返回 5 个派生时段（含 `date` 字段，B35 修复在线）；`/api/c/intro`、`/poi`、`/parking`、`/news`、`/knowledge`、`/activities` 全 200；`/api/c/me/bookings`、`/api/c/booking` 无 token → **401 结构化错误**（非 500 崩溃）；`/api/c/auth/wechat-login` → 502「微信登录暂未配置」（演示机未配 `WECHAT_APPID/SECRET`，预期内） ✔️ |
| **B26 时段派生** | 今日（部署后第 36 天）`/booking/slots` 与 `/api/c/slots` 均正常派生 5 个时段，去 cron 方案在长时间运行下成立 ✔️ |
| **B38-1 熔断端点** | `/api/screen/occupancy` 返回含 `circuitBroken` / `paused` 字段 ✔️（完整熔断触发需操作 DB，未做） |
| **FOUC 首帧**（复检项 ③） | 硬刷新后 121ms 即 `class="h-full dark"` + `body bg rgb(15,23,19)`，**未观察到白屏闪烁** ✔️ |
| **深色主题切换** | 除 N01/N02/N03/N04/N05 外，侧边栏、表格、卡片、KPI、日历、按钮、地图浮层双主题均正常 ✔️ |

---

## 四、修订索引

| 轮次 | 日期 | 角色 | 类型 | 结论 | 说明 |
|---|---|---|---|---|---|
| r5 | 2026-07-28 | 评审 | code review 复审 | **clean（可合并）**——`main-fixer_A` @ `7fd54f9`,r3 四项全部核实已改:① `_content-form.tsx` 硬编码清零（`placeholder:text-text-muted` / `text-foreground`,token 均存在）;② 图表浅色首帧未按「记残留」而是直接消除:`useMounted()`（`useSyncExternalStore(subscribeNever,()=>true,()=>false)`）挂载前只渲染等高占位、不初始化 echarts——语义核实:水合首帧服务端/客户端快照同为 false 无 mismatch,水合后补一次渲染按真实主题一次画成;客户端路由跳转时 `getSnapshot()=true` 即刻出图无占位闪动;大屏 `variant="dark"` 早退分支不受影响,`variant="light"` 已无调用方;③ `splitLine` 已删;④ `mapBorder` 注释已更正。超范围 7 处已登记待办清单（`--info` token 存在,建议可行）。`pnpm test` 88 passed 复跑属实、新增 3 条守卫单测;lint/tsc/build 未复跑,以修复方自检为准。唯一遗留:r4 修订行笔误「87 passed」应为 88,请合并收尾时顺手更正 | 深审同 r3 口径:逐项核 diff + 复跑单测 + token/调用方核查 |
| r4 | 2026-07-28 | 修复 | 据 r3 复审修改 | 4 项全改（含 ② 直接消除，未按"记为残留"处理） | ① `_content-form.tsx` 同族硬编码清零：`placeholder:text-[#C0C4CC]`→`placeholder:text-text-muted`、`text-[#374151]`→`text-foreground`；② 不只记残留——新增 `useMounted()`，后台图表（`Heatmap724` auto 变体 / 行政图）**挂载前只占位、不初始化 echarts**，挂载后按真实主题一次画成，浅色首帧从源头消除（大屏 `variant="dark"` 路径不受影响）；③ 删无消费者的 `splitLine`；④ 更正 `mapBorder` 注释（浅色为白缝，非 `--border`）。另按建议把 `(admin)` 下 7 处超范围同族硬编码登记进 `docs/待办清单.md`。新增 2 条守卫单测（`_content-form` 硬编码清零 / 后台图表挂载前不初始化），`pnpm test` 88 passed、lint / tsc / build 全过 |
| r3 | 2026-07-28 | 评审 | code review | **issues（需小改后复审）**——修复方 `main-fixer_A` @ `0ecc045`（6 条修复 + 15 条单测）。核心修法全部核实成立：N01 路由为 ƒ Dynamic（`(admin)/layout.tsx:12` 用 `cookies()`）+ `createOnsiteForm()` 渲染时求值正确；N02/N04/N07 正确;N03/N05 `EChart` 带 `notMerge`，option 驱动全量重绘成立；N08「main 上 weather 0 命中」独立复核属实；`pnpm test` 85 passed 复跑属实；文档回填合规（只标 fix 未越权 pass）。**发现 2 中 2 低**：① 🟡 `content/_content-form.tsx:132,142` 残留 `placeholder:text-[#C0C4CC]`、`:165` `text-[#374151]`——本提交已改此文件却漏了同族硬编码，`text-[#374151]` 深色下深字压深底，就落在 N02 同一张编辑页；② 🟡 `use-dark-mode.ts` `getServerSnapshot` 恒 false → 深色用户硬刷新时后台图表首帧按浅色 palette 画一帧再翻深（passive effect 后才纠正），属 N03/N05 同类的一帧残留，需在 issue 文档记为已知残留并由测试真机确认是否可感知；③ 🔵 `admin-chart-palette.ts` `splitLine` 字段无任何消费者（应删或接线）；④ 🔵 `mapBorder` 注释称 `= --border` 但 LIGHT 值实为 `#FFFFFF`（沿旧设计），注释失实。另:`(admin)` 下 `system/page.tsx:82`、`riskcontrol/blacklist/_action-buttons.tsx:32`、`content/activities/*` 等 7 处同族硬编码 hex 超出本轮 issue 范围,建议登记待办不必本轮修 | 深审:code-reviewer 独立过一遍 + 评审逐项核 diff/token/EChart/时区/文档 |
| r2b | 2026-07-28 | 修复 | 逐条修复 | 6 条 `fix`，N08 阻塞挂起，N06 归人工 | 分支 `main-fixer_A`。N01 模块作用域日期改渲染时求值；N02 编辑器三处硬编码改 token；N03/N05 新建 `admin-chart-palette` 收口后台图表双主题取色；N04 补 `color-scheme`；N07 取数时刻改读上游响应头 `Date`。新增 15 条单测（`form-state.test.ts` / `fetched-at.test.ts` / `theme-tokens.test.ts`），`pnpm test` 85 passed、`lint` / `tsc --noEmit` / `build` 全过 |
| r5 | 2026-07-29 | 测试 | 真机 CDP 复验 | **N01/N02/N03/N05 全部 → `pass`**；tooltip 待人工项一并解决；**新立 N10**；回归扫描 4/10 路由后 CDP 掉线未竟 | Windows Chrome 150 经 WireGuard，走 UI 真登录 |
| r4 | 2026-07-29 | 测试 | 跨天复验 | **N01 冻结确已解除**（同进程零重启跨日历日，SSR 日期跟到 7 月 29 日）；N01 服务端行为全部通过，仅剩浏览器侧两项 | 复用 r3 未动的 docker 栈 |
| r3 | 2026-07-28 | 测试 | 复验（`main` @ `6d27afa`） | **N04 / N07 → `pass`**；N01 服务端部分通过；N02 结构通过；**N01/N02/N03/N05 因 CDP 真机不可达停在 `fix`**；**新立 N09** | 环境见下方「r3 复验环境」 |
| r2 | 2026-07-28 | 测试 | 派工 | N01–N05 / N07 / N08 共 7 条经人工批准，一次性交**修复方**（N06 除外，单独交人工定分支策略） | mesh note `6dc7e86f` |
| r1 | 2026-07-28 | 测试 | 线上 CDP 验收 | 8 条 issue + 1 条待人工 | 演示服务器 `156.229.22.155`（`deploy-demo` @ `9befd9c`） |

---

## 五、r3 复验环境（2026 年 7 月 28 日，测试方自建）

⚠️ 本轮 **r1 验收对象是演示服务器上的 `deploy-demo` 产物**，而修复合并进的是 `main`。演示机上跑的代码**不含本批修复**，在那里复验只会看到旧行为。故 r3 另起一套 `main` 的真实 docker 环境：

| 项 | 内容 |
|---|---|
| 代码 | `main` @ `6d27afa`（修复方 squash 合并点） |
| 方式 | `docker compose -f docker-compose.yml -f docker-compose.qa.yml up -d`，**镜像本地重建**（`globals.css` 与多个 client 组件改动必须重建才生效，热更覆盖不到） |
| 容器 | `changqiushan-app` / `postgres:18` / `gotrue` / `minio`，app healthy |
| 数据 | `prisma migrate deploy` → `prisma/seed.ts`（35 个时段 / 1911 条预约 / 3 个物化视图）→ `scripts/seed-admin.ts`（超管 `13900000000`） |
| 登录 | 经 GoTrue 密码授权取真 token，以 `sb-access-token` cookie 访问，受保护路由 200、无 cookie 307 |
| 高德 | 容器内直连 `restapi.amap.com` 返回 `infocode=10000`，路况为**真实数据** |
| 端口 | 验收机 3000/5433/9000/9001/9999 均被同机其它项目占用，故经 `docker-compose.qa.yml` 重映射为 **3200 / 5443 / 9010 / 9011 / 9998**（`ports: !override`，仅改宿主侧，不动写进 JWT 的 `iss`） |

**测试环境配置文件**：`app/docker-compose.qa.yml`（测试专用 override，随本轮提交）。内含三件事：① 端口重映射；② 一次性 `seeder` 服务（复用 Dockerfile 的 `build` 阶段跑迁移/seed —— 运行镜像里没有 `scripts/` 也没有 prisma CLI 与 tsx，初始化做不了）；③ 为本机重新开启容器 IPv6（见 N09）。

**未能完成的部分**：CDP 真机浏览器不可达（10.7.0.2 无响应），N01 的水合/深色副作用与 N02/N03/N05 的深色目视全部挂起，等真机恢复后继续。
