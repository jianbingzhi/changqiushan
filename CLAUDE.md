# CLAUDE.md

长秋山森林公园智慧景区项目。仓库根目录是工作区（文档 + 提示词 + UI 归档），两套**互相独立**的子工程各自自包含，动手前先认清你在哪个：

| 位置 | 是什么 | 包管理 | 依赖清单 |
|---|---|---|---|
| **`scripts/`** | Stitch AI UI 设计稿生成工具链（CDP 驱动 Chrome 跑 Stitch，截图归档到 `UI*/`） | **npm** | `scripts/package.json`（`ws` + `cheerio`） |
| **`app/`** | B 端管理后台正式应用（Next.js 16 + Prisma 7 + Postgres 18） | **pnpm** | `app/package.json` |

> 根目录**不再是 npm 项目**，没有 `package.json` / `node_modules`——Stitch 工具链的工程定义已全部收进 `scripts/`。
> - 跑 Stitch 脚本：先 `cd scripts && npm install`，脚本仍按惯例从**仓库根目录**调用（如 `node scripts/run-page.js ... prompts/... UI/...`），cwd=根，相对路径 `prompts/`、`UI/`、`logs/` 才正确。
> - 跑后端：`cd app && pnpm ...`。两套包管理器别混。
> - 根目录 `pnpm-lock.yaml` 是误生成的、已 gitignore，可忽略。

权威文档：需求 `docs/PRD.md`、架构 `docs/B端技术架构.md`、UI 全局规范 `prompts/B-design-system.md`。

---

## 一、PRD 红线（贯穿所有代码，违反即返工）

1. **免费景区**：全园不设门票、不收费、仅预约。严禁出现「门票/票价/购票/退款/票务」，一律用「预约/名额/核销」。
2. **预约双要素强校验**：每张预约单必须同时带**身份证号 + 车牌号**（无车需勾「无车辆」声明）；线上/外部渠道/现场补录三路共用同一校验，缺项或非法直接拒收。
3. **支付链路隔离**：微信支付仅用于活动报名费等二消场景，**入园主流程不调起任何支付**。
4. **承载力熔断**：在园人数达瞬时承载量 90% 时大屏闪红 + 自动停当日预约入口。
5. **报表必须 Excel 导出**：所有客流/画像/偏好类报表。
6. **100% 中文**：UI 无孤立英文/Lorem；日期用「2026 年 5 月 31 日」，禁 ISO 格式。

---

## 二、`app/` —— B 端后台开发约定

### 跑起来
```bash
cd app
pnpm dev              # ⚠️ 必须 webpack 模式(package.json 已配 --webpack);内存有限,勿用 turbopack
pnpm build            # 已用 NEXT_BUILD_LIMIT=1 + nice -n19 + ionice -c3 限速,勿改回 build:fast
pnpm db:migrate       # prisma migrate dev
pnpm db:seed          # 造今日时段数据
pnpm lint             # eslint-boundaries 是架构卡口,报错=架构违例
```
- **Postgres**：`docker compose up -d`(在 `app/`)，PG18，映射到 **localhost:5433**。
- 连接串在 `app/.env`（`DATABASE_URL`，gitignore），模板见 `app/.env.example`。
- **媒体存储 MinIO**(S3 兼容)：compose 内 `minio` 服务，S3 API `:9000`、控制台 `127.0.0.1:9001`，桶 `changqiushan-media`(公共读，`minio-init` 自动建)。抽象成 S3 driver，上线可切**腾讯 COS/阿里 OSS**(改 endpoint+key 即可)。详见 `docs/B端PRD需求覆盖对照.md` R-storage。

### ⚠️ 编译/打包纪律（服务器资源紧张，违反会假死）
本机内存/CPU 有限，`next build` 是最吃资源的动作，**与 dev / docker 同时跑会把服务器拖到假死**。打包按固定顺序来：

1. **先停 dev**：`pkill -f 'next dev'`（释放 3000 端口与常驻内存）。
2. **再停 docker 释放资源**：`cd app && docker compose down`（PG/GoTrue 占内存，打包期间用不到）。
3. **限速打包**：只用 `pnpm build`（已带 `NEXT_BUILD_LIMIT=1 nice -n 19 ionice -c 3`，最低 CPU 优先级 + IO idle 类）。**严禁** `pnpm build:fast` / 裸 `next build` —— 不限速必假死。
4. **打包完成后再起依赖**：`docker compose up -d`，确认 PG/GoTrue healthy 再继续。

> QA/联调检查时用户**完全用 docker 跑**全栈（含应用容器），不是本地 dev。dev 模式专属现象（HMR WebSocket 噪声、StrictMode 双挂载、未压缩首屏慢）**不计入 bug**，疑似 dev 专属的缺陷（如富文本不挂载、表单提交）须在 docker/生产构建下复测才能定性。

### 架构（模块化单体 + eslint 硬边界）
分层：`app/(路由) → modules/<m>/index.ts(公共面) → service → domain + repository → infrastructure → shared/lib`。

- **跨模块只能 `import { x } from "@/modules/<m>"`**（即 `index.ts`）；直接 import 别的模块内部 `service/repository/domain` 会被 `eslint-plugin-boundaries` 拒绝。这是架构宪法，见 `app/eslint.config.mjs`。
- 模块需要协作时：在 `app/` 路由层组合两个公共面，或经 realtime bus 事件解耦。**不要**让模块互相依赖。
- 8 个业务模块对齐 PRD：`content / booking / checkin / riskcontrol / traffic / analytics / iot / system`。当前只有 `booking` 是较完整的参考实现，其余为待填充。

### 标准模块骨架
```
src/modules/<m>/
├── index.ts        # 唯一对外面:re-export service + Prisma 类型
├── service/        # 用例编排:zod 校验→事务→repo→发事件
├── domain/         # 纯业务规则(rules.ts)+ zod schema(schema.ts),不碰 db
├── repository.ts   # 仅此处用 Prisma db
└── events.ts       # (可选) channel 常量
```
参考：`src/modules/booking/`、`src/app/(admin)/booking/slots/page.tsx`(RSC 直读 repo)。

### 数据层（Prisma 7 多文件 schema）
- **每模块一个** `prisma/models/<m>.prisma`，Prisma 7 自动合并（入口 `prisma/schema.prisma` 仅声明 generator + datasource）。
- generator 用 `prisma-client-js`（单文件版），**不要**换成 Prisma 7 默认的多文件 `prisma-client`——Turbopack 编译会吃满内存。
- 运行时经 `@prisma/adapter-pg` driver adapter 连接；client 单例在 `src/infrastructure/db/client.ts`（globalThis 防 HMR 泄漏），**业务代码一律用 `import { db } from "@/infrastructure/db/client"`**。
- 字段约定：主键 `String @id @default(uuid()) @db.Uuid`；时间 `@db.Timestamptz(3)`；表名 `@@map("<模块>_<实体>")` snake_case 前缀隔离。
- 实时 trigger 用**手写 SQL migration**（参考 `prisma/migrations/20260527160000_realtime_triggers`），不在 schema 表达。

### 实时数据（SSE，已打通）
链路：**Postgres trigger → `pg_notify` → pg-listen → 进程内 bus → SSE**。
- 新增 channel 三步：① 写 trigger SQL migration；② 加到 `src/infrastructure/realtime/listener.ts` 的 `CHANNELS`；③ 加到 `src/app/api/sse/[topic]/route.ts` 的 `ALLOWED_TOPICS`。前端 `new EventSource("/api/sse/<channel>")`。
- 现有 channel：`slot_changed` / `checkin_event` / `iot_event` / `parking_state`。
- 改完用 `tsx scripts/verify-realtime.ts` 端到端验证（不走 Next.js）。

### 待启用（已装依赖，按需引入）
- `zod`：各模块 `domain/schema.ts` 输入校验，Server Action / Route Handler 复用同一 schema。
- `pg-boss`：快照刷新、爽约扫描、心跳超时检测、Excel 大导出异步化。

### 验证
- 边界：`pnpm lint`　·　类型：`pnpm exec tsc --noEmit`　·　实时：`tsx scripts/verify-realtime.ts`　·　DB：`pnpm db:studio`。

---

## 三、`scripts/` —— Stitch UI 工具链（仅在做 UI 设计稿时）

- 自包含 npm 工程（`scripts/package.json` + `scripts/node_modules`）。首次用先 `cd scripts && npm install`。
- 脚本从**仓库根目录**调用（cwd=根），npm 依赖经 `scripts/node_modules` 解析，相对路径参数 `prompts/`、`UI/`、`logs/` 以根为基准。
- 通过 Chrome DevTools Protocol（`--remote-debugging-port=9222`）驱动 Stitch AI 从 PRD 生成 UI 设计稿，截图归档到 `UI/`、`UI_final_v3/` 等。
- 每页提示词在 `prompts/`（`A*`=C 端小程序，`B*`=后台，`C*`=数据大屏，`fix-*`=修订）。
- **已知坑**（已写入记忆）：
  - Stitch 收到模板化 batch prompt 只对前 2-3 个生效——要**串行 + 每个独特锚点**。
  - Stitch 改页面有概率**分叉新页**而非就地编辑；用节点数对比检测 fork，保留最新版。
  - 任务完成判定别信 Agent log 高亮——用 `wait-stitch.js` 看高度稳定 + fork 双信号。

---

## 四、Git

- 主分支 `main`。提交/推送仅在用户明确要求时。
- commit message 结尾加 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`。
