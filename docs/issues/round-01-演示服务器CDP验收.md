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
| 状态 | ✔️ **pass**（r9 真机复验，浅 / 深两主题，2026 年 7 月 29 日）|
| 页面 | `/analytics/heatmap` 「时段 × 星期预约热力」 |
| 复现 | 稳定，**浅色 / 深色两种主题下均复现** |

**现象**：热力矩阵底部的 `visualMap` 色阶条（横向渐变条 + 两端「0」「62」端点标签）被放在绘图区正下方，**与 X 轴的时间刻度重叠**，把「10时」「12时」两个标签压住看不清；端点数字「0」「62」也与轴文字挤在一起。

**不是本轮修复引入的** —— r5 同时截了浅色基线与深色两张图，**两张里都存在**，属既有布局问题，只是 r1 当时聚焦深色配色没注意到。

**期望**：色阶条移到绘图区之外（如右侧竖排，或下移留出轴标签空间），端点标签不与轴刻度重叠。

**证据**：`docs/issues/assets/round-01-N10-色阶条压住X轴刻度.png`（浅色态，问题同样存在于深色）

**r6 修复（修复方，2026 年 7 月 29 日）**：色阶条**改为竖排在绘图区右侧的留白里**，与 X 轴刻度彻底分处不同区域。

- 改动只有布局两处（`app/src/lib/ui/screen/charts/Heatmap724.tsx`，位置常量抽到 `charts/heatmap-layout.ts`）：
  `grid` 由 `{right:16, bottom:64}` 改为 `{right:64, bottom:32}`；`visualMap` 由 `horizontal / left:center / bottom:8` 改为 `vertical / right:12 / top:middle`。配色、tooltip、数据、`useMounted` 占位逻辑均未动。
- **同一处布局也在大屏三块热力图上**（`/screen/heatmap`、`/screen/poster`、`/screen/command` 复用同一组件），几何缺陷同样存在（见下表实测），故一次改在组件里，大屏一并修好。
- **验证方式**：缺陷是纯几何、读源码看不出来，故用 **echarts 的 SSR 模式在 node 里把图真渲染成 SVG，解析 `<text>` 坐标做碰撞检测**（各调用点真实画布尺寸 + 两个极端容器共 6 组），新增守卫单测 `app/src/lib/ui/screen/charts/heatmap-layout.test.ts`（7 条）。判据取「**留白** ≥ 6px」而非「不相交」——r1 那张截图里端点数值与「10时」严格算并未相交、只差几像素，肉眼已经糊成一团。
- **回归自证**：把布局常量临时退回旧值，该守卫在后台画布上报出的正是本条现象 —— `10时 × 0`、`12时 × 62`；大屏三块与窄容器另报 3 组重叠。改回新值后 6 组画布全部 0 重叠、0 越界。

| 画布 | 尺寸 | 旧布局 | 新布局 |
|---|---|---|---|
| 后台 `/analytics/heatmap` | 1150×340 | `10时 × 0`、`12时 × 62` 重叠 | 0 重叠 |
| 大屏 `/screen/heatmap` | 1600×620 | `10时 × 0`、`12时 × 62` 重叠 | 0 重叠 |
| 大屏 `/screen/poster` | 760×280 | `8时 × 0`、`14时 × 62` 重叠 | 0 重叠 |
| 大屏 `/screen/command` | 900×270 | 无重叠（该宽度下恰好错开） | 0 重叠 |
| 窄容器 | 520×300 | `6时 × 0`、`14时 × 62` 重叠 | 0 重叠 |
| 矮容器 | 900×200 | 无重叠 | 0 重叠 |

自检：`pnpm test` **95 passed**（原 88 + 新增 7）、`pnpm lint` 0 error（3 条既有 warning）、`pnpm exec tsc --noEmit` 通过、`pnpm build` 通过。**未跑真机 CDP**（真机验收归测试方），像素级观感请测试方在浅/深两主题下各截一张复核。

---

**r9 真机复验（测试，2026 年 7 月 29 日）：通过 ✔️ → `pass`**

后台 `/analytics/heatmap`，浅 / 深两主题各截一张：色阶条已改为**绘图区右侧竖排**（「62」在上、「0」在下），与 X 轴时间刻度**彻底分离**；`0时`–`22时` 全部清晰可读，原先被压住的「10时」「12时」恢复正常。两主题表现一致。

同页 console **0 异常**（本次专门抓了，见 N13 的对照）。

**证据**：`docs/issues/assets/round-01-N10-r9-色阶条右侧竖排深色.png`、`round-01-N10-r9-色阶条右侧竖排浅色.png`

> ⚠️ 修复方提示「同组件也驱动大屏三块热力图，请顺带复看」—— 已复看，**大屏侧另有一个独立且更严重的问题（整块空白 + 抛异常），但与本条无关、也不是 N10 引入的**，已单独立 **N13**。本条的几何缺陷在大屏侧同样已修好（就大屏而言无从对比，因为图根本没画出来）。


---

### N11 🟡 中 · 停车场 4 个全部「未配置坐标，未上图」，`/traffic/parking` 的地图上一个点都没有（人工报，r5 核实）

| 字段 | 内容 |
|---|---|
| 状态 | ✔️ **pass**（r9 真机复验，2026 年 7 月 29 日）|
| 页面 | `/traffic/parking` 「停车场动静态上图」 |
| 来源 | 人工在真机上发现并报出（2026 年 7 月 29 日），本验收方核实并定位根因 |
| 复现 | 稳定，**开箱即复现** |

**现象**：概览卡片上 4 个停车场**每一个**都标着「未配置坐标，未上图」，地图区域没有任何标点。人工最先注意到的是「西门停车场 已满 余位 0 / 200 未配置坐标，未上图」。

**核实结论 —— 拆成两件事，一件不是缺陷、一件是**：

| 观察 | 判定 |
|---|---|
| 「西门停车场 已满 余位 0 / 200」 | **不是缺陷**。种子数据里西门就是 `capacity=200 / occupied=200 / status=FULL`，页面如实渲染。 |
| 「未配置坐标，未上图」 | **是缺陷，且范围是全部 4 个**，不止西门。 |

数据库实测：

```
       name       | capacity | occupied | 余位 | status | 坐标
------------------+----------+----------+------+--------+------
 东门生态停车场   |      300 |      180 |  120 | OPEN   | NULL
 主峰临时停车场   |      120 |       45 |   75 | OPEN   | NULL
 游客中心地下车库 |      150 |        0 |  150 | CLOSED | NULL
 西门停车场       |      200 |      200 |    0 | FULL   | NULL
```

页面服务端输出中「未配置坐标」出现 **4 次**。

**功能本身没坏** —— `_parking-form.tsx` 有经纬度输入项，`_parking-map.tsx` 只画有合法坐标的、其余老实标注降级文案，这套「无坐标不上图 + 明示」的设计是对的。**坏在数据**。

**根因**：`prisma/seed.ts:334` 的停车场 INSERT **列清单里根本没有 `coordinates`**：

```sql
INSERT INTO traffic_parking_lot (id,name,capacity,occupied,status,location,updated_at,created_at)
```

lot 对象也只有 `{name, capacity, occupied, status}`，从未提供 lng/lat。

**为什么评到 🟡 中而不是低**：这个页面的立身之本就是「上图」，而 **0/4 上图 = 该功能从来没有被任何人看见过，也无法验收**。对着空地图的观感等同于「功能坏了」，且属于测试盲区（我至今无法验证标点、聚合、状态配色等上图行为是否正确）。修起来很轻（补坐标），但不补就一直是黑箱。

**顺带发现的不一致（需要有人定夺，非本条修复范围）**：同一个 `prisma/seed.ts` 里，**POI 表却有两个带真实坐标的停车场**：

| 表 | 名称 | 坐标 |
|---|---|---|
| `content_poi` | 1号停车场 | 103.607693, 30.240227 |
| `content_poi` | 2号停车场 | 103.612197, 30.237231 |
| `traffic_parking_lot` | 东门生态 / 西门 / 主峰临时 / 游客中心地下 | 全部 NULL |

两套停车场数据**连名字都对不上**（1号/2号 vs 东门/西门/主峰/游客中心）。到底景区有几个停车场、叫什么、哪套是正本，**这是产品事实，不该由修复方拍脑袋统一**。建议人工定夺；若属长期约束，宜进 PRD 一行。

**期望**：① 给 4 个停车场补上真实坐标（或明确改用 POI 那套命名）；② 顺带确认上图后的标点、状态配色、`余位/总数` 标签是否正确 —— 这部分我在有坐标之后才能验。

**r6 修复（修复方，2026 年 7 月 29 日）**：按测试方指示**沿用现有 4 个名字补坐标**（不与 POI 那套合并，命名正本待人工定夺），改动只在 `app/prisma/seed.ts` 的停车场段：

| 停车场 | 坐标（GCJ-02，同 POI 一套坐标系） | 摆位依据 |
|---|---|---|
| 西门停车场 | 103.606091, 30.241226 | 西北山脚主入口（景区大门 103.608694,30.239728）西侧，与 POI「1号停车场」错开 |
| 游客中心地下车库 | 103.610700, 30.238230 | 与 POI「游客中心」（103.610495,30.238529）同址 |
| 主峰临时停车场 | 103.616100, 30.230100 | 主峰观景台（103.614699,30.228734）东北侧半山服务道 |
| 东门生态停车场 | 103.623500, 30.233200 | 园区东侧山脚，半山休憩亭（103.620705,30.230741）以东 |

⚠️ 这四个是**按既有 POI 园区骨架推的演示级坐标，不是实测点位**——种子数据本就是演示数据，真实点位需景区提供；若人工定下 POI 那套命名为正本，这批要一并重来。

- 同时把 `location` 由「= 停车场名字」改为真实位置描述（原先 `location` 传的是 `lot.name`，页面「位置」一栏等于重复了一遍名称）。**这是本条之外的顺手改动，请评审/测试注意这一处观感变化。**
- **`ON CONFLICT` 一并覆盖 `coordinates`/`location`**：否则已建库里那 4 行坐标仍是 NULL，改了 seed 也补不上。

**真实数据库验证**（另起一次性 `postgres:18` 容器，**未碰测试方在跑的栈**，验完即删）：

| 路径 | 做法 | 结果 |
|---|---|---|
| 全新库 | `prisma migrate deploy` → `pnpm db:seed` | 4 行 `coordinates` 全部写入，如 `{"lat": 30.241226, "lng": 103.606091}` ✔️ |
| 已有库（模拟本轮现场：坐标置 NULL） | 重跑 seed 的停车场段 | 4 行**全部被 `ON CONFLICT DO UPDATE` 回填** ✔️ |

⚠️ **给复验的一条提醒（与本修复无关的既有性质）**：`prisma/seed.ts` **整体不可重复执行** —— 在已 seed 过的库上重跑，会先在 `booking_slot` 撞唯一键 `(date,start_time)` 失败（`seed.ts:80` 的 INSERT 无 `ON CONFLICT`），**根本走不到停车场那段**。所以现有 QA 栈**不能靠重跑 `pnpm db:seed` 拿到坐标**，二选一：

1. 用全新库（或 `TRUNCATE booking_slot CASCADE` 后再 seed —— 实测这样可跑通，坐标即回填）；
2. 或直接执行一条 SQL：

```sql
UPDATE traffic_parking_lot SET coordinates = c.coord::jsonb, location = c.loc FROM (VALUES
  ('西门停车场',       '{"lng":103.606091,"lat":30.241226}', '西北山脚主入口西侧,进山公路旁'),
  ('游客中心地下车库', '{"lng":103.6107,"lat":30.23823}',    '游客中心地下一层'),
  ('主峰临时停车场',   '{"lng":103.6161,"lat":30.2301}',     '主峰观景台东北侧半山服务道'),
  ('东门生态停车场',   '{"lng":103.6235,"lat":30.2332}',     '园区东侧山脚东门外')
) AS c(name, coord, loc) WHERE traffic_parking_lot.name = c.name;
```

**守卫单测**：`app/src/modules/traffic/domain/parking-seed.test.ts`（7 条）——读 `seed.ts` 里的停车场清单，用**页面/表单实际走的那个 `createParkingLotSchema`** 校验坐标，并核对经纬度落在园区范围内（中心 103.6147,30.2317 ±0.05°，经纬写反或少写一位都会掉出去）、四点不重合、SQL 列清单含 `coordinates` 且 `ON CONFLICT` 覆盖它。

自检：`pnpm test` **102 passed**、`pnpm lint` 0 error、`tsc --noEmit`、`pnpm build` 全过。**未跑真机 CDP**——上图后的标点位置、状态配色、「余位/总数」标签仍需测试方在真机上验（这正是本条一直没法验的那部分）。

---

**r9 真机复验（测试，2026 年 7 月 29 日）：通过 ✔️ → `pass`**

复验路径：镜像按 `main` @ `2d68067` 重建 + 重启栈；因本栈已 seed 过（`seed.ts` 整体不可重复执行，见修复方提醒），走修复方给的那条 `UPDATE` SQL，4 行全部命中。

| 检查 | 实测 |
|---|---|
| 「未配置坐标，未上图」出现次数 | **0**（原为 4）✔️ |
| 地图标点 | **4 个全部上图**，标签「名称 余位/总数」正确 ✔️ |
| 状态配色 | 主峰临时 = **绿**（OPEN）、游客中心地下 = **橙**（CLOSED）、西门 = **红**（FULL），与图例「开放 / 已满 / 关闭」一致 ✔️ |
| ~~标签深色适配~~ | ⚠️ **此项当时判错，见 N14** —— 我量的是标签内层 `<span>`（透明底），**没量 AMap 的外层容器 `.amap-marker-label`**（白底 + 蓝边）。外层才是肉眼看到的那个白盒子。本条其余各项不受影响。 |
| 「位置」栏 | 已由「= 停车场名字」改为真实位置描述（如「西北山脚主入口西侧,进山公路旁」），不再重复名称 ✔️ |
| 右侧列表 / 汇总 | 总车位 770、当前占用 425、剩余 345、满场 1，与 DB 一致 ✔️ |

**「上图」这个立身功能至此第一次被真正验证过。** 顺带发现两个标点在窄视口下被浮层遮挡，**另立 N12**，不影响本条判定。

**证据**：`docs/issues/assets/round-01-N11-r9-停车场上图通过.png`

---

### N12 🔵 低 · 停车场地图有两个标点被页面自己的浮层卡片压住（≤1440 宽复现，r9 撞见）

| 字段 | 内容 |
|---|---|
| 状态 | 🛠️ `fix` —— **r13 复验:≥1440 已修好，但 1324×804 仍复现，不予 `pass`** |
| 页面 | `/traffic/parking` |
| 复现 | **与视口宽度相关**：≤1440 宽必现，≥1920 宽不现 |

**现象**：N11 补上坐标后 4 个标点都已上图，但默认视野下 **2 个标点被页面自身的浮层卡片遮住**，肉眼只看得见 2 个。

**客观判定**（对每个标点中心点调 `document.elementFromPoint`，看最上层是谁，不靠目视）：

| 标点 | 位置 | 最上层元素 |
|---|---|---|
| 西门停车场 0/200 | (309, 89) | **左上「停车场动静态上图」信息卡**（256,80 起，360×101，z-index 20） |
| 东门生态停车场 120/300 | (1128, 536) | **右侧「停车场数据」面板**（933,80 起，360×708，z-index 20） |
| 主峰临时停车场 75/120 | — | 未被遮挡 |
| 游客中心地下车库 150/150 | — | 未被遮挡 |

**分辨率扫描**：

| 视口 | 结果 |
|---|---|
| 1324×804 | ❌ 2/4 被遮挡 |
| **1440×900** | ❌ 2/4 被遮挡 |
| 1920×1080 | ✅ 4 个全露出 |
| 2560×1440 | ✅ 4 个全露出 |

**为什么只评 🔵 低**：信息没有丢失 —— 右侧列表完整列出 4 个停车场的全部数据；用户也可以拖动地图把标点拖出来。只是默认视野下地图少露一半，且**用户未必意识到还有标点藏在卡片下面**。

**期望**：地图自适应视野（fitView）时按浮层区域做 padding 内缩，让标点落在未被遮挡的可视区内。

**修复方结论（r10，2026 年 7 月 29 日）**：按期望做 fitView 内缩，但**内缩量不写死** —— 浮层高度随内容变（KPI 换行、图例条数、面板收起成小浮钮），写死一组常数必漂。

- 浮层占位**就地量**：`map-overlay` 的三张卡（KPI / 图例 / 侧栏，含收起态浮钮）统一挂 `data-map-overlay`，`AmapContainer` 在 fitView 时 `getBoundingClientRect` 量出实际矩形，算成高德 `setFitView` 的第三参 `avoid`（`[上, 下, 左, 右]` 内缩）。新增浮层只要带上这个属性就自动被避开。
- 几何抽成纯函数 `lib/ui/map/fit-view-avoid.ts`：每张浮层只往**离它最近的那条边**让 —— 左上角那张 360×101 的卡从上边让 117px 就够，从左边让要丢 376px，同样避开却白丢三倍视野。无浮层时返回 `undefined`，交回高德默认避让，**大屏各图取景不变**。
- 守卫 `fit-view-avoid.test.ts`（11 条）：判据取「**fitView 安全区与任何一张浮层都不相交**」，比断言某个内缩数值稳（卡片一改数值就得跟着改，守不住东西）。覆盖 tester 实测的 1324×804 / 1440×900 / 1920×1080 / 2560×1440 四档 × 面板展开/收起两态；并含一条**自证**：同一判据加在缺陷版（高德默认 `[60,60,60,60]`）上必须是红的。
- 高德类型声明 `lib/amap/loader.ts` 的 `setFitView` 补齐 `immediately/avoid/maxZoom` 三参（原声明只有一参，传 avoid 过不了 tsc）。

⚠️ **本方未跑真机 CDP**：内缩量是否真把 4 个标点都露出来、地图缩放后的观感，需测试方在真机上逐点复验（`document.elementFromPoint` 那套口径）。

---

**r13 真机复验（测试，2026 年 7 月 29 日）：部分修好，暂不 `pass`**

按修复方要求，用 r9 同一套口径（对 4 个标点中心逐点 `document.elementFromPoint`）扫四档分辨率，并补测面板收起态：

| 视口 | 展开态 | 收起态 | 判定 |
|---|---|---|---|
| **1324×804** | ❌ **2/4 遮挡** | ❌ **1/4 遮挡** | **仍复现** |
| 1440×900 | ✅ 0/4 | ✅ 0/4 | 已修好 |
| 1920×1080 | ✅ 0/4 | — | 已修好 |
| 2560×1440 | ✅ 0/4 | — | 已修好 |

**1324×804 下仍被遮挡的两个**：

| 标点 | 被谁遮挡 |
|---|---|
| 东门生态停车场 120/300 | 右侧「停车场数据」面板（收起后该条恢复 ✔️） |
| 西门停车场 0/200 | **左侧导航栏「活动运营管理」** —— 注意这不是浮层，是**地图容器之外**的侧边栏；即标签向左溢出了地图可视区边缘，收起数据面板也救不回来 |

**为什么坚持不 pass**：`1324×804` 正是**真实 1440×900 笔记本减去浏览器边框后的可视区**，是很常见的实际使用宽度（我这台真机就是这个尺寸）。fitView 的内缩现在只考虑了地图内部的浮层，**没有考虑标签向容器左侧溢出**。

**给修复方的补充信息**：收起态确实会重算（1324 从 2/4 降到 1/4），说明「仅在标记变化时重算」这点在收起场景下**已经生效**，你原先担心的「收起当下不会自动重新取景」实测不成立，这块不用改。要处理的是**窄视口下标签溢出容器左边缘**。


---

### N13 🔴 高 · 三块大屏的热力矩阵**完全空白**并抛未捕获异常 —— 由 `6d27afa` 引入的回归

| 字段 | 内容 |
|---|---|
| 状态 | ✔️ **pass**（r13 真机复验，2026 年 7 月 29 日）|
| 页面 | `/screen/heatmap`（整屏主面板）、`/screen/poster`、`/screen/command`（「预约分时热力」面板） |
| 复现 | 稳定，100% |
| 引入 | **`6d27afa`**（round-01 N01–N07 修复批次里的 N03 echarts 色板重构），**非 N10 的 `2d68067`** |

**现象**：三块大屏上由 `Heatmap724` 驱动的热力矩阵**一格都没画出来**，是整片空白；控制台稳定抛：

```
TypeError: Cannot read properties of null (reading 'length')
    at Object.splitArea (…/chunks/12eleds~l~hgd.js)
    at e.render …
```

canvas 像素采样：**非透明像素占比 0%**（同页其它图表正常）。`/screen/command` 上除「预约分时热力」面板空白外，趋势线、环形、地图、仪表、条形图均正常渲染。

**为什么是高**：大屏是挂墙指挥屏，整块面板空白且无任何降级提示（不是「待接入」占位，就是纯空），观感等同于系统故障；且波及 3 块屏。

**根因定位**：`Heatmap724.tsx:76`

```ts
const splitArea = { show: true, areaStyle: pal.splitArea ? { color: pal.splitArea } : undefined };
```

- **大屏变体** `SCREEN_PALETTE.splitArea = undefined`（`Heatmap724.tsx:31`）→ 传出 `areaStyle: undefined`，把注册主题（`screen/echarts-theme.ts:49`）里本来配好的 `splitArea.areaStyle.color` 显式覆盖成空 → echarts 读 `color.length` 崩。
- **后台变体** `backstagePalette` 给的是真数组 → 不崩。这正好解释了「同一组件，后台好好的、大屏全崩」。

**归属证据（两路独立印证，排除 N10）**：

1. **git 溯源**：`git log -S` 显示 `areaStyle: pal.splitArea ? … : undefined` 与 `SCREEN_PALETTE.splitArea = undefined` **两处都由 `6d27afa` 引入**；`2d68067`（N10）对该文件的 diff 里这两行是**未改动的上下文行**，只动了 `grid` 与 `visualMap`。
2. **A/B 实证**：用 `git archive` 取 **N10 的父提交 `8352dcb`** 源码另建镜像，接同一个数据库并排跑（3300 vs 3200）——

   | 实例 | canvas 绘制 | 异常 |
   |---|---|---|
   | 父提交 `8352dcb`（N10 **之前**） | 非透明像素 **0%** | **2 条**，同一个 `splitArea` TypeError |
   | 当前 `main` `2d68067`（N10 **之后**） | 非透明像素 **0%** | **2 条**，同上 |

   → **N10 之前就已经坏了，N10 不是元凶。**（A/B 用的临时容器与镜像验完即删，未碰测试栈。）

**本验收方的漏检自述**：`6d27afa` 是我在 r5 判 `pass` 的那一批。当时我复验了后台 `/analytics/heatmap`（同一组件、后台变体，**确实不崩**），**但没有回头复验 `/screen/*`** —— r5 的深色回归扫描跑到 4/10 个路由时 CDP 掉线，大屏一块都没扫到。**这条是我放过去的，不是修复方隐瞒。** r5 给 N01–N05 的 `pass` 判定本身仍然成立（那些结论都在后台页上独立复核过），但**「共享组件改动要连大屏一起复验」这一条，我漏了**。

**期望**：让大屏变体不要用 `undefined` 去覆盖注册主题的 `splitArea.areaStyle`（例如 `pal.splitArea` 为空时整个不传 `areaStyle` 键，而不是传 `undefined`），并补一条守卫：`Heatmap724` 的**两个变体**都要能在真实渲染下画出非空 canvas。

**证据**：`docs/issues/assets/round-01-N13-大屏热力矩阵空白.png`、`docs/issues/assets/round-01-N13-指挥总屏热力面板空白.png`

**修复方结论（r10，2026 年 7 月 29 日）**：根因与归属**逐条复核后完全采信** —— 未去 N10 方向找。本方在 node 里用 echarts SSR 独立复现了同一条崩溃，栈与 tester 抓到的一致：

```
TypeError: Cannot read properties of null (reading 'length')
  at rectCoordAxisBuildSplitArea (echarts/lib/component/axis/axisSplitHelper.js:67)
  at Object.splitArea (echarts/lib/component/axis/CartesianAxisView.js:196)
```

对照实验(同一份 option 只换 `splitArea`)：`{show:true, areaStyle: undefined}` → **抛异常、零图元**；`{show:true, areaStyle:{color:[…]}}` → 正常；`{show:true}`（不带 `areaStyle` 键，即 `6d27afa` 之前的写法）→ 正常。**证实 `areaStyle: undefined` 会把默认值覆盖成空,而不是"什么都不做"**。

改法（比期望多做一步,理由见下）：

1. **option 与配色从组件里抽出成纯模块** `screen/charts/heatmap-option.ts`。这一步是为了让守卫**测得到线上那份 option** —— 旧守卫 `heatmap-layout.test.ts` 是自己手搓一份 option 去渲染的,和组件真正下发的是两码事,组件里写错了它照样绿。**这正是 N13 能溜过去的第二重原因**(第一重是 tester 自述的没扫大屏)。`Heatmap724.tsx` 只剩选变体 + 主题订阅。
2. **大屏变体给出真实的 `splitArea` 色值**(`rgba(232,245,233,0.02/0.05)`,同族于主题文字色),并把 `HeatmapPalette.splitArea` 类型**改成必填**,让"忘了配色"在 tsc 阶段就过不去。
3. **运行期再兜一道**:色值为空时**整个 `areaStyle` 键不下发**(按期望的写法),绝不再出现 `areaStyle: undefined`。
4. 顺手修一处同源隐患:原代码 x/y 两轴**共用同一个 `splitArea` 对象引用**,而 echarts 会就地 merge —— 改成各持一份。

守卫 `heatmap-option.test.ts`(17 条)：**三个变体(大屏注册主题 / 后台浅 / 后台深) × 四个真实画布尺寸(大屏三块 + 后台卡片)** 全部用 echarts SSR 真渲染,断言① 不抛异常 ② 画出的图元数 ≥ 7×24 格(SVG 侧的「非空 canvas」等价物) ③ 两条轴的 `splitArea.areaStyle.color` 都是非空数组。**自证有效**:把配色改回缺陷版(`splitArea: undefined` + 下发 `areaStyle: undefined`)重跑,**6 条转红**（大屏四个画布的渲染断言 + 大屏根因断言 + 引用共享断言),恢复后 17 条全绿 —— 守卫捉得住原缺陷,不是恒绿。

**采纳评审 r11 的两条非阻塞建议（r12）**：① 大屏交替带色值改为**与注册主题的雷达 `splitArea` 共用同一常量** `SCREEN_SPLIT_AREA`（`screen/echarts-theme.ts`），两处各写一份必漂，收成单一来源；② 旧守卫 `heatmap-layout.test.ts` 改为**消费 `buildHeatmapOption` 的产物**，不再手搓一份平行 option —— 换掉后退回旧布局常量仍复现出 N10 原现象（`10时 × 0`、`12时 × 62`），守卫有效性不因换源而失效。

⚠️ **本方未跑真机 CDP**：大屏三块的实际观感(交替带在深底上是否合适、色阶是否如期)需测试方在真机上复看。

---

### N14 🟡 中 · 停车场地图标点标签是**白底白字**，几乎读不出来（r10 撞见，含本验收方 r9 的一处错判更正）

| 字段 | 内容 |
|---|---|
| 状态 | 🆕 |
| 页面 | `/traffic/parking` 「停车场动静态上图」深色主题 |
| 复现 | 稳定，4 个标点全中 |

**现象**：地图上 4 个停车场标点的文字标签，是**白色方块 + 蓝色边框**，里面的文字是近白色 —— 白底白字，实际几乎不可读；且在深色地图上是 4 块刺眼亮斑。

**实测**（`.amap-marker-label` 外层容器的 computed style，4 个标点完全一致）：

```
background-color : rgb(255, 255, 255)          ← 纯白底
color            : rgb(232, 239, 227)          ← 近白色字 → 白底白字
border           : 0.666667px solid rgb(0,0,255)  ← AMap 默认蓝边，未被样式接管
size             : 101×27 ~ 150×27
```

内层 `<span>` 则是 `background: rgba(0,0,0,0)` / `color: rgb(232,239,227)` —— **内层已按深色适配过，外层容器漏了**。

**⚠️ 本验收方的错判更正**：r9 复验 N11 时，我在「标签深色适配」一项写的是「文字 `rgb(232,239,227)`、背景透明，深色地图上可读 ✔️」—— **那是量错了元素**：我的选择器命中的是内层 `<span>`，而肉眼看到的白盒子是外层 `.amap-marker-label`。r9 的第一张截图里其实已经能看出白盒子，我当时以测得的数值为准、没有以图为准，判成了通过。**这是我的判断失误，不是修复方的问题。** N11 本身（补坐标 → 上图 → 状态配色）仍然成立，`pass` 不撤；标签样式作为独立缺陷另立本条。

**期望**：`.amap-marker-label` 走深色语义 token（深底 + 浅字 + 深色描边或无边），或直接改用自定义 marker content 接管样式，去掉 AMap 默认的白底蓝边。

**证据**：`docs/issues/assets/round-01-N14-停车场标签白底白字.png`

---

**r13 真机复验（测试，2026 年 7 月 29 日）：通过 ✔️ → `pass`**

镜像按 `main` @ `47f3293` 重建 + 重启栈，真机 CDP 逐屏采样（canvas 非透明像素占比）：

| 页面 | 修复前 | 修复后 | 异常 |
|---|---|---|---|
| `/screen/heatmap` | **0%** | **85% / 85%** | **0 条** ✔️ |
| `/screen/poster` | **0%** | **74% / 74%** | **0 条** ✔️ |
| `/screen/command` | **0%** | **74% / 73%**（同页另 8 个 canvas 63%/7%/4%/8%/9%/2%/21%/webgl 均正常） | **0 条** ✔️ |
| `/analytics/heatmap`（后台同组件，回归对照） | 正常 | **59% / 80%**，未被改坏 | **0 条** ✔️ |

`splitArea` 的 `TypeError` **全部消失**，7×24 格真实画出。

**关于修复方点名要我判的「交替带改用雷达同款绿值」**：实测在深底上**不显脏、不偏色**，与大屏整体绿色调一致，热力格铺满后基本感知不到。**我认为可以，无需回改。**

**证据**：`docs/issues/assets/round-01-N13-r13-大屏热力已恢复.png`

> ⚠️ 但同一次复验中，在这块恢复出来的图上发现了**另一个独立缺陷**：大屏变体**没有周次（Y 轴）标签**，7 行分不清哪行是哪天 —— 之前被本条的崩溃完全遮住（图根本不画），现在图恢复了才露出来。已另立 **N15**。**不影响本条判定。**


---

### N15 🟡 中 · 大屏热力矩阵**没有周次（Y 轴）标签**，7 行分不清哪行是哪天（r13 撞见，长期存在）

| 字段 | 内容 |
|---|---|
| 状态 | 🆕 |
| 页面 | `/screen/heatmap`（整屏主面板）、`/screen/poster`、`/screen/command` |
| 复现 | 稳定 |
| 引入 | **`04b5b6b`（B33 主题参数化）—— 长期存在，比本轮所有修复都早**；此前一直被 N13 的崩溃遮住（图根本不画），N13 修好后才显形 |

**现象**：大屏的 7×24 热力矩阵，X 轴 `0时`–`22时` 刻度正常，但**左侧完全没有「周一…周日」标签**，7 行无从分辨是哪一天。

**A/B 对照**（同一份数据、同一个组件、同一次复验，全幅 canvas 原分辨率截图）：

| 变体 | Y 轴标签 |
|---|---|
| 后台 `/analytics/heatmap` | ✔️ `周日 / 周六 / 周五 / 周四 / 周三 / 周二 / 周一` 七行齐全 |
| 大屏 `/screen/heatmap` | ❌ **一个都没有**，左侧留白区域空空如也 |

**根因（与 N13 是同一类反模式，就在同一个文件里）**：`app/src/lib/ui/screen/charts/heatmap-option.ts:95`

```ts
const axisLabelStyle = pal.axisText ? { color: pal.axisText } : undefined;
…
xAxis: { …, axisLabel: { interval: 1, ...axisLabelStyle } },   // 展开成 {interval:1} → 是对象 → 主题的 axisLabel 生效 → X 轴标签正常
yAxis: { …, axisLabel: axisLabelStyle },                        // 大屏下 = undefined → 覆盖掉主题默认 → Y 轴标签消失
```

大屏 `SCREEN_PALETTE.axisText = undefined`（注释写的是「由注册主题托管文字/轴」），于是 `axisLabelStyle` 为 `undefined`，`yAxis.axisLabel` 被显式赋成 `undefined`。**这正是 N13 那个「显式传 `undefined` 覆盖主题默认值」的同款写法** —— 巧的是 N13 的修复注释就写在同一段上方（「绝不能下发 `areaStyle: undefined`」），而两行之下的 `axisLabel: axisLabelStyle` 沿用了旧写法。

**归属**：`git log -S` 显示该写法出自 **`04b5b6b`**（B33 时段×星期热力，主题参数化那次），**不是** `6d27afa` 也不是 `47f3293` 引入的；新文件 `heatmap-option.ts` 只是把它原样搬了过来。**属长期缺陷，非本轮回归。**

**期望**：与 `splitArea` 同款处理 —— 色值为空时**整个不下发 `axisLabel` 键**（或下发 `{}`），让注册主题生效；并把守卫扩到「两个变体的 X / Y 轴标签都必须真实渲染出来」。

**证据**：`docs/issues/assets/round-01-N15-大屏缺周次标签.png`（大屏，全幅原分辨率）、`round-01-N15-后台周次标签正常对照.png`（后台对照）

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
| r12 | 2026-07-29 | 修复 | 采纳 r11 的两条非阻塞建议 | 两条**全部采纳**（评审已说明不用再过审） | ① 大屏交替带色值改为与注册主题的雷达 `splitArea` **共用同一常量** `SCREEN_SPLIT_AREA`（`screen/echarts-theme.ts` 导出，雷达与热力矩阵各写一份必漂，收成单一来源）—— 实际观感仍留真机复看；② 旧守卫 `heatmap-layout.test.ts` 改为**消费 `buildHeatmapOption` 的产物**，不再手搓一份平行 option（手搓版盖不住组件内改动，正是 N13 溜过去的第二重原因）。⚠️ 换源后**复核了 N10 守卫仍然有效**：退回旧布局常量照样复现出原现象 `10时 × 0` / `12时 × 62`，不是换完就恒绿。`pnpm test` 132 passed / lint 0 error / tsc / build 全过 |
| r11 | 2026-07-29 | 评审 | code review（N13+N12 修复） | **clean（可合并，附 2 条非阻塞建议）**——`main-fixer_A` @ `c79c45c`。**N13 核实**:评审独立三向对照复现(node SSR,大屏注册主题下)与修复方结论逐字吻合——`areaStyle:undefined` 抛同一条 `Cannot read properties of null (reading 'length')`,修复版/原始版均正常出图 192 图元;`splitArea` 类型必填 + 运行期整键不下发 + 两轴各持引用,三层防线成立;「option 抽纯模块让守卫测线上那份」定位准确(旧守卫手搓 option 正是 N13 溜过的第二重原因)。**N12 核实**:`data-map-overlay` 同层约定在 `_parking-map.tsx` 成立(浮层与 AmapContainer 同为 MapPageShell 直接子元素);大屏三处 fitView 调用点(command/situation/twin)无该属性→返回 undefined 走默认避让,「大屏取景不变」属实;`/traffic/road` 不用 fitView 不受波及;最近边内缩 + 0.4 封顶几何正确。`pnpm test` 132 passed 复跑属实;r8 收尾要求(seed 不可重跑登记待办清单)已兑现(待办清单:97);N13/N12 只标 fix 合规。**非阻塞建议**:① 大屏交替带新色值 `rgba(232,245,233,0.02/0.05)` 与回归前注册主题的 `rgba(74,142,63,0.04/0.08)` 不同——非精确还原,已如实留真机复看;若测试觉得偏,最小改动是两处共用同一常量(单一来源,顺带防再漂移);② 旧守卫 `heatmap-layout.test.ts` 仍手搓 option(几何经共享常量锚定,风险低),建议日后改为消费 `buildHeatmapOption` 产物,与 N13 守卫同源 | 独立复现脚本存 scratchpad;结论以本行+守卫单测为准 |
| r10 | 2026-07-29 | 修复 | 据 r9 新立 N13 + N12 修改 | **N13 / N12 → `fix`**（待测试真机复验） | **N13**：tester 的根因与归属逐条复核后完全采信，未往 N10 方向找；本方在 node 里用 echarts SSR 独立复现同一条崩溃（`rectCoordAxisBuildSplitArea` 读 `color.length`），并做三向对照证实 `areaStyle: undefined` 是**覆盖**默认值而非"什么都不做"。改法：① option 与配色抽出成纯模块 `screen/charts/heatmap-option.ts`——**这是为了让守卫测得到线上那份 option**（旧守卫 `heatmap-layout.test.ts` 手搓了另一份，组件写错它照样绿，是 N13 溜过去的第二重原因）；② 大屏变体给出真实 `splitArea` 色值，并把 `HeatmapPalette.splitArea` 类型改为**必填**，"忘了配色"在 tsc 阶段就过不去；③ 运行期再兜一道：色值为空则整个 `areaStyle` 键不下发；④ 顺手修 x/y 两轴共用同一 `splitArea` 对象引用（echarts 就地 merge）。守卫 `heatmap-option.test.ts`（17 条）：**3 变体 × 4 真实画布**全部 SSR 真渲染，断言不抛异常 + 图元数 ≥ 7×24 + 两轴 `areaStyle.color` 非空；**自证**：退回缺陷版 6 条转红。**N12**：fitView 内缩量**不写死**——`map-overlay` 三张卡（含收起态浮钮）挂 `data-map-overlay`，`AmapContainer` 就地量 `getBoundingClientRect` 算成高德 `setFitView` 的 `avoid`；几何抽纯函数 `lib/ui/map/fit-view-avoid.ts`，每张卡只往**最近的那条边**让（左上 360×101 的卡从上让 117px 即可，从左让要丢 376px）；无浮层时返回 `undefined`，**大屏各图取景不变**。守卫 `fit-view-avoid.test.ts`（11 条）判据取「安全区与任何浮层都不相交」，覆盖 tester 实测四档分辨率 × 面板展开/收起，含缺陷版（高德默认 `[60,60,60,60]`）必红的自证。另补 `lib/amap/loader.ts` 的 `setFitView` 类型声明（原只有一参）。合计 `pnpm test` **132 passed** / `lint` 0 error / `tsc --noEmit` / `pnpm build` 全过；**真机 CDP 未跑（归测试方）** |
| r8 | 2026-07-29 | 评审 | code review（N11 修复） | **clean（可合并，附 1 条收尾要求）**——`main-fixer_A` @ `96d31b4`。核实:`createParkingLotSchema` 坐标形状与页面 `toCoord`/表单/actions 三处 `{lng,lat}` 一致;`traffic.prisma` `name @unique` 支撑 `ON CONFLICT (name)`;四个坐标与 seed 内 POI 骨架数值逐一对得上、均落园区中心 ±0.01° 内、两两不重合;`booking_slot` 段(seed.ts:80 附近)确无 `ON CONFLICT`,「seed 不可重复执行、走不到停车场段」说法属实;`pnpm test` 102 passed 复跑属实;N10/N11 只标 `fix` 合规。**两处请示的裁定**:① `location` 由「=名字」改位置描述**该带**——同一批种子行、修的正是被复验页面的显示冗余、给老库的 UPDATE SQL 同步覆盖了它、issue/commit 均已透明留痕,不构成夹带;② seed 不可重复执行**本轮不修正确**(动 slot 播种会牵动已验收数据),但该性质只活在 N11 条目里会随本轮关单而失踪——**收尾要求:在 `docs/待办清单.md` 登记独立一行**(如「seed.ts 不可重复执行,booking_slot 无 ON CONFLICT」,指回 N11),与 squash 合并同批带出。演示级坐标非实测点位、命名正本待人工,均已如实声明 | 核查:schema/唯一约束/POI 数值/复跑单测/文档纪律 |
| r7 | 2026-07-29 | 评审 | code review（N10 修复） | **clean（可合并）**——`main-fixer_A` @ `66ad7d2`。核实:布局改动仅两处常量（`heatmap-layout.ts`,组件内配色/tooltip/`useMounted` 确未动）;`pnpm test` 95 passed 复跑属实;**守卫有效性独立自证**——评审在 node 里用**旧布局常量**重跑同口径 SSR 碰撞检测,报出结果与修复方 r6 表逐格一致（后台 `10时×0`/`12时×62`、poster `8时×0`/`14时×62`、command/矮容器无重叠、窄容器 `6时×0`/`14时×62`）,证明该守卫捉得住原缺陷而非恒绿;`HEATMAP_GRID.right(64) ≥ visualMap.right(12)+24` 余量断言合理。**范围扩到大屏三块判断成立**:同一组件同一几何,poster/heatmap 画布实测同样重叠,组件内一次修好优于给后台开特例;大屏竖排色阶条的观感变化按 r6 所注留待测试真机复看。状态回填合规（N10 标 `fix` 未越权 `pass`）。可按流程收尾:squash 合并 + push 后通知测试复验 | 抽验脚本存 scratchpad(session 级,结论以本行与守卫单测为准) |
| r6 | 2026-07-29 | 修复 | 据 r5 新立 N10 + 人工报 N11 修改 | **N10 / N11 → `fix`**（待测试真机复验） | 色阶条改竖排右侧：`Heatmap724.tsx` 的 `grid` `{right:16,bottom:64}`→`{right:64,bottom:32}`、`visualMap` `horizontal/bottom:8`→`vertical/right:12/top:middle`，位置常量抽到 `charts/heatmap-layout.ts`；同组件驱动的大屏三块热力图（heatmap/poster/command）几何缺陷同源，一并修好。新增守卫单测 `heatmap-layout.test.ts`(7 条)：用 echarts SSR 真渲染 SVG + 解析 `<text>` 坐标做碰撞检测，判据取「留白 ≥ 6px」；退回旧布局可复现出本条现象本身(`10时 × 0`/`12时 × 62`)。**N11**：`prisma/seed.ts` 停车场段补 4 个 GCJ-02 坐标（按既有 POI 园区骨架推的演示级坐标，命名沿用现有 4 个、未与 POI 合并，正本待人工定）+ `location` 由「=名字」改为位置描述；`ON CONFLICT` 一并覆盖 `coordinates`/`location`，否则老库补不上。**另起一次性 postgres:18 容器真跑了迁移+seed 验证**（未碰测试方在跑的栈）：全新库 4 行坐标全写入、坐标置 NULL 后重跑全部回填；并发现既有性质 —— seed 整体不可重复执行（`booking_slot` 唯一键，走不到停车场段），已在 N11 条给出两条复验路径。守卫单测 `parking-seed.test.ts`(7 条) 用生产 zod schema 校验种子坐标。合计 `pnpm test` 102 passed / lint 0 error / tsc / build 全过；真机 CDP 未跑（归测试方） |
| r5 | 2026-07-28 | 评审 | code review 复审 | **clean（可合并）**——`main-fixer_A` @ `7fd54f9`,r3 四项全部核实已改:① `_content-form.tsx` 硬编码清零（`placeholder:text-text-muted` / `text-foreground`,token 均存在）;② 图表浅色首帧未按「记残留」而是直接消除:`useMounted()`（`useSyncExternalStore(subscribeNever,()=>true,()=>false)`）挂载前只渲染等高占位、不初始化 echarts——语义核实:水合首帧服务端/客户端快照同为 false 无 mismatch,水合后补一次渲染按真实主题一次画成;客户端路由跳转时 `getSnapshot()=true` 即刻出图无占位闪动;大屏 `variant="dark"` 早退分支不受影响,`variant="light"` 已无调用方;③ `splitLine` 已删;④ `mapBorder` 注释已更正。超范围 7 处已登记待办清单（`--info` token 存在,建议可行）。`pnpm test` 88 passed 复跑属实、新增 3 条守卫单测;lint/tsc/build 未复跑,以修复方自检为准。唯一遗留:r4 修订行笔误「87 passed」应为 88,请合并收尾时顺手更正 | 深审同 r3 口径:逐项核 diff + 复跑单测 + token/调用方核查 |
| r4 | 2026-07-28 | 修复 | 据 r3 复审修改 | 4 项全改（含 ② 直接消除，未按"记为残留"处理） | ① `_content-form.tsx` 同族硬编码清零：`placeholder:text-[#C0C4CC]`→`placeholder:text-text-muted`、`text-[#374151]`→`text-foreground`；② 不只记残留——新增 `useMounted()`，后台图表（`Heatmap724` auto 变体 / 行政图）**挂载前只占位、不初始化 echarts**，挂载后按真实主题一次画成，浅色首帧从源头消除（大屏 `variant="dark"` 路径不受影响）；③ 删无消费者的 `splitLine`；④ 更正 `mapBorder` 注释（浅色为白缝，非 `--border`）。另按建议把 `(admin)` 下 7 处超范围同族硬编码登记进 `docs/待办清单.md`。新增 2 条守卫单测（`_content-form` 硬编码清零 / 后台图表挂载前不初始化），`pnpm test` 88 passed、lint / tsc / build 全过 |
| r3 | 2026-07-28 | 评审 | code review | **issues（需小改后复审）**——修复方 `main-fixer_A` @ `0ecc045`（6 条修复 + 15 条单测）。核心修法全部核实成立：N01 路由为 ƒ Dynamic（`(admin)/layout.tsx:12` 用 `cookies()`）+ `createOnsiteForm()` 渲染时求值正确；N02/N04/N07 正确;N03/N05 `EChart` 带 `notMerge`，option 驱动全量重绘成立；N08「main 上 weather 0 命中」独立复核属实；`pnpm test` 85 passed 复跑属实；文档回填合规（只标 fix 未越权 pass）。**发现 2 中 2 低**：① 🟡 `content/_content-form.tsx:132,142` 残留 `placeholder:text-[#C0C4CC]`、`:165` `text-[#374151]`——本提交已改此文件却漏了同族硬编码，`text-[#374151]` 深色下深字压深底，就落在 N02 同一张编辑页；② 🟡 `use-dark-mode.ts` `getServerSnapshot` 恒 false → 深色用户硬刷新时后台图表首帧按浅色 palette 画一帧再翻深（passive effect 后才纠正），属 N03/N05 同类的一帧残留，需在 issue 文档记为已知残留并由测试真机确认是否可感知；③ 🔵 `admin-chart-palette.ts` `splitLine` 字段无任何消费者（应删或接线）；④ 🔵 `mapBorder` 注释称 `= --border` 但 LIGHT 值实为 `#FFFFFF`（沿旧设计），注释失实。另:`(admin)` 下 `system/page.tsx:82`、`riskcontrol/blacklist/_action-buttons.tsx:32`、`content/activities/*` 等 7 处同族硬编码 hex 超出本轮 issue 范围,建议登记待办不必本轮修 | 深审:code-reviewer 独立过一遍 + 评审逐项核 diff/token/EChart/时区/文档 |
| r2b | 2026-07-28 | 修复 | 逐条修复 | 6 条 `fix`，N08 阻塞挂起，N06 归人工 | 分支 `main-fixer_A`。N01 模块作用域日期改渲染时求值；N02 编辑器三处硬编码改 token；N03/N05 新建 `admin-chart-palette` 收口后台图表双主题取色；N04 补 `color-scheme`；N07 取数时刻改读上游响应头 `Date`。新增 15 条单测（`form-state.test.ts` / `fetched-at.test.ts` / `theme-tokens.test.ts`），`pnpm test` 85 passed、`lint` / `tsc --noEmit` / `build` 全过 |
| r13 | 2026-07-29 | 测试 | 复验（`main` @ `47f3293`） | **N13 → `pass`**（三块大屏 0%→74~85%、异常归零，交替带配色判可用）；**N12 不予 pass**（≥1440 已修，1324×804 仍 2/4 遮挡）；**新立 N15**（大屏缺 Y 轴周次标签，长期缺陷，被 N13 遮住至今） | 镜像重建 + 四档分辨率 + 收起态 |
| r10 | 2026-07-29 | 测试 | 完整回归扫描 | **补跑 r5 未竟部分:24 后台路由 + 9 大屏全量**。核心结论「**没有第二个 N13**」;N13 影响面确定为 3 块屏、其余 6 块 clean;**新立 N14**(含本方 r9 一处错判更正);6 条误报 + 1 条已登记项已甄别 | 见「六、r10 完整回归扫描」 |
| r9 | 2026-07-29 | 测试 | 真机复验（`main` @ `2d68067`） | **N10 / N11 → `pass`**；**新立 N12 🔵 / N13 🔴**；N13 经 git -S + 父提交 A/B 双向印证为 `6d27afa` 引入的回归，并附本方 r5 漏检自述 | 镜像重建 + 老库走 UPDATE 补坐标 |
| r5 | 2026-07-29 | 测试 | 真机 CDP 复验 | **N01/N02/N03/N05 全部 → `pass`**；tooltip 待人工项一并解决；**新立 N10 / N11**（N11 为人工报出后本方核实定位）；回归扫描 4/10 路由后 CDP 掉线未竟 | Windows Chrome 150 经 WireGuard，走 UI 真登录 |
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

---

## 六、r10 完整回归扫描（2026 年 7 月 29 日）—— 补跑 r5 未竟部分

r5 的深色回归扫描只跑到 4/10 路由就因 CDP 掉线中断，**N13 正是那次漏扫漏掉的**。本轮把范围扩到**全量**：从代码枚举出的 **24 个后台静态路由 + 9 块大屏**，逐个检查「未捕获异常 / console error / 空白 canvas / 深色下浅色块 / 滞留加载中 / 错误文案 / 内容异常」。

### 核心结论：**没有第二个 N13**

24 个后台路由 **0 条未捕获异常、0 条 console error**；唯一成规模的 canvas 空白问题就是已立的 N13，且**边界清晰**。

### 大屏 9 块（免登录，结果直接有效）

| 屏 | 结果 |
|---|---|
| `/screen/command` | ❌ 空白 canvas ×1 + 异常 ×1（= **N13**）；同页另 7 个 canvas 绘制率 60%/7%/4%/10%/10%/22% 正常 |
| `/screen/heatmap` | ❌ 空白 canvas ×1 + 异常 ×1（= **N13**，整屏主面板） |
| `/screen/poster` | ❌ 空白 canvas ×1 + 异常 ×1（= **N13**）；同页另一 canvas 8% 正常 |
| `/screen` · `/screen/operation` · `/screen/overview` · `/screen/situation` · `/screen/trend` · `/screen/twin` | ✅ **6 块全 clean**，无异常、无空白 canvas |

→ **N13 的影响面就是这 3 块，其余 6 块干净。**

### 后台 24 个路由

**16 个完全 clean**：`/` · `/analytics/heatmap`（canvas 57%/78%/1%）· `/analytics/profile` · `/analytics/source`（10%）· `/analytics/traffic` · `/booking/bookings` · `/booking/channels` · `/booking/onsite` · `/booking/quota-rules` · `/booking/slots` · `/content/knowledge` · `/content/news` · `/iot/devices` · `/riskcontrol/blacklist` · `/system` · `/traffic/road`

**8 个被标记，逐条甄别后：1 真、1 已登记、6 误报**

| 路由 | 标记 | 甄别结论 |
|---|---|---|
| `/traffic/parking` | 浅色块 ×4 | ✅ **真缺陷 → 已立 N14**（`.amap-marker-label` 白底白字） |
| `/content/activities` | 浅色块 ×1（`rgb(239,246,255)` = `#EFF6FF`） | 🟡 **已登记**，属 `docs/待办清单.md` 里那 7 处「B36 同族硬编码余项」之一（`content/activities/page.tsx:37`），非新增 |
| `/content/assets` | 内容过少(360) | ❌ **误报** —— 正常空态：「暂无素材，点击「上传图片素材」添加」，只是种子未造素材数据 |
| `/content/intro` | 内容过少(388) | ❌ **误报** —— 实有 3 行数据（公园概况 / 主要景点 / 游览路线建议），只是文本短 |
| `/content/news/new` · `/content/intro/new` · `/content/knowledge/new` · `/content/activities/new` | 内容过少(344–388) | ❌ **误报** —— 都是空表单页（`/content/news/new` 有 36 个表单控件），文本本来就少 |

> 误报根因：我把「文本 < 400 字符」当异常阈值，对**表单页与空态列表页**过于激进。阈值问题，不是缺陷。

### 一次测量事故（如实记录）

首次跑全量扫描时，24 个后台路由**全部**报「内容过少(70) + 浅色块 ×5」。核查发现是**浏览器会话丢失**——CDP 中途掉线过一次（Chrome 重启），会话 cookie 随之失效，所有后台路由被 307 到 `/login`，扫描实际测的是登录页（`rgb(249,250,251)` 正是登录页浅色底，70 字符正是其文本量）。

**这批结果已整体作废、未计入任何缺陷**。重新走 UI 真登录 + 恢复深色后重跑，才得到上表。脚本已加入「URL 落在 `/login` 即判会话丢失、该条作废」的自检，避免同类事故再次被误读成缺陷。
