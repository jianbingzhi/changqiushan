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
> ⚠️ 本轮验收对象是 **`deploy-demo` 分支的产物**。`main` 落后 9 个提交（N06），因此本轮的「通过」结论**不能直接迁移到 `main`**。

---

## 一、问题清单

### N01 🔴 高 · `/booking/onsite` 服务端渲染内容陈旧 6 天，hydration 失败连带打掉深色主题

| 字段 | 内容 |
|---|---|
| 状态 | 🆕 |
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

---

### N02 🟡 中 · 富文本编辑器工具栏深色主题下是整条白条（B36 线上复现）

| 字段 | 内容 |
|---|---|
| 状态 | 🆕（待办清单 §二 已登记为 B36，本轮线上确认仍在） |
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

---

### N03 🟡 中 · echarts 热力矩阵深色下底色恒为白，**刷新也不恢复**

| 字段 | 内容 |
|---|---|
| 状态 | 🆕 |
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

---

### N04 🔵 低 · 深色主题未声明 `color-scheme`，原生表单控件白底

| 字段 | 内容 |
|---|---|
| 状态 | 🆕（对应待办清单 §二 theme-QA 复检项 ④，本轮确认） |
| 复现 | 稳定 |

**现象**：深色主题下 `document.documentElement` 与 `body` 的 computed `color-scheme` 均为 `normal`（未声明 `dark`），原生控件保持浅色渲染。

**实测**：全站扫描原生 `select` / `input[type=date|checkbox|time]`，**只有 `/booking/onsite` 的时段下拉是原生 `<select>`**（computed `background-color: rgb(255,255,255)`），其余页面都用了 shadcn 组件，因此当前可见影响面很小。**但与 N01 联动** —— onsite 目前根本进不了深色主题，等 N01 修好后这个白控件才会暴露出来。

**期望**：深色主题下声明 `color-scheme: dark`（`html.dark { color-scheme: dark }`）。

---

### N05 🔵 低 · 来源分析行政图深色下为白色地块

| 字段 | 内容 |
|---|---|
| 状态 | 🆕（已知设计取舍，登记留痕） |
| 页面 | `/analytics/source` 「来源地区分布(行政区划下钻)」 |

**现象**：深色主题下中国行政图地块为白/浅灰，在深色卡片上是一大块亮面。与待办清单 §二「`analytics/source` 行政图 `theme={null}` + 硬编码色为已知必中点」一致。数据本身正确（四川省 688 / 广东省 370 / 重庆市 351 / 浙江省 293，与右侧表格一致）。

**证据**：`docs/issues/assets/round-01-N05-行政图深色白地块.png`

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
| 状态 | 🆕（= 待办清单 §一 b-103 审计微项 ①，本轮线上确认） |
| 页面 | `/traffic/road` |

**现象**：页面「最后更新」与右侧拥堵摘要每条的时间戳，均随请求时刻走（连续两次访问分别显示 10:41 / 10:44），而数据本身有 60s 缓存，实际可旧至 60 秒。

**期望**：展示语义改为「约 1 分钟内」，或透出真实取数时刻。

---

### N08 🔵 低 · 天气已接入，但一块大屏仍标「⚠ 天气/AQI 待接入」，两屏口径不一致

| 字段 | 内容 |
|---|---|
| 状态 | 🆕 |
| 页面 | `/screen/command`（已接） vs `/screen/overview`（仍标待接入） |

**现象**：

- `/screen/command` 右上角显示 **蒲江县 · 晴 26℃ · 湿度 63%**；实测后端 `/api/screen/weather` 返回 `{"source":"amap","live":{"city":"蒲江县","weather":"阴","temperature":24,...}}` —— **是高德真实数据**。
- `/screen/overview` 页面上仍渲染 **「⚠ 天气/AQI 待接入」** 占位标注。
- `docs/待办清单.md` §五 也仍写「🆕 天气 / AQI（C5）—— 外部气象 API；现占位标注」。

**期望**：口径统一 —— overview 接上同一个 metric（AQI 若确实没有，占位文案收窄为「AQI 待接入」），并回填待办清单 §五。

---

## 二、需人工验证（本验收方不下结论）

| 项 | 原因 |
|---|---|
| **行政图 tooltip 深色样式**（待办清单 §二 theme-QA 复检项 ②） | CDP 在 echarts canvas 上派发 `mouseMoved` 扫了 6 个坐标点，均未触发 tooltip DOM。属 CDP 鼠标事件的已知易错场景（canvas 内部命中判定 / 时序），**不足以判定通过或失败**，请人工在真机浏览器上悬停确认。 |

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
| r2 | 2026-07-28 | 测试 | 派工 | N01–N05 / N07 / N08 共 7 条经人工批准，一次性交**修复方**（N06 除外，单独交人工定分支策略） | mesh note `6dc7e86f` |
| r1 | 2026-07-28 | 测试 | 线上 CDP 验收 | 8 条 issue + 1 条待人工 | 演示服务器 `156.229.22.155`（`deploy-demo` @ `9befd9c`） |
