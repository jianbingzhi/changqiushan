# 长秋山智慧景区 · B 端技术架构设计

> 适用范围：景区管理后台（B 端 Web）。技术栈已定：**Postgres 18 + Next.js 16（App Router）+ Prisma 7 + TypeScript**。
> 本文是在现有 `app/` 后端骨架（commit「后端骨架」）之上的**体系化延展规约**，不是另起炉灶——既有约定（模块化单体、eslint 边界、pg LISTEN/NOTIFY 实时链路）全部保留并贯彻。

---

## 0. 设计原则与现状基线

### 0.1 核心原则
1. **模块化单体（Modular Monolith）**：单一 Next.js 进程 + 单一 Postgres，按业务域切模块；模块间只能经 `index.ts` 公共面通信，由 `eslint-plugin-boundaries` 在 lint 期硬约束，杜绝大泥球。
2. **PRD 红线即架构约束**：免费预约（无票务/支付入园流）、预约双要素强校验（身份证+车牌）、承载力 90% 熔断、报表必须 Excel 导出——这些不是页面文案，而是落到 **domain 层纯函数 + DB 约束 + 校验 schema** 的硬规则。
3. **服务端优先**：列表/详情/报表默认 React Server Component 直读 repository；写操作走 Server Actions / Route Handler + zod 校验；实时数据走 SSE。
4. **数据驱动实时**：DB 变更经 Postgres trigger → `pg_notify` → pg-listen → 进程内 bus → SSE，已打通且有验证脚本，新模块按同一范式接入。

### 0.2 现状基线（已存在，复用，勿重建）
```
app/
├── src/
│   ├── app/
│   │   ├── (admin)/booking/slots/page.tsx   # 参考：RSC 直读 repository
│   │   ├── (dashboard)/realtime/page.tsx    # 参考：EventSource 消费 SSE
│   │   └── api/sse/[topic]/route.ts         # 参考：SSE 网关(topic 白名单+心跳)
│   ├── infrastructure/
│   │   ├── db/client.ts                     # Prisma 单例 + PrismaPg adapter
│   │   ├── realtime/{bus.ts,listener.ts}    # EventEmitter + pg-listen
│   │   └── logger.ts                        # pino
│   ├── modules/                             # booking(参考实现) + 6 空壳模块
│   ├── shared/ (空) · lib/ui/ (空)
│   └── (无 src/generated)
├── prisma/
│   ├── schema.prisma                        # 仅 generator + datasource
│   ├── models/booking.prisma                # 参考模型(snake_case 表名前缀)
│   └── migrations/                          # init + realtime_triggers
└── eslint.config.mjs                        # boundaries 边界规则(架构宪法)
```
**已装未用**：`pg-boss`（任务队列）、`zod`（校验）。本架构将启用二者。
**关键缺口**：无认证/RBAC/审计模块、无 shared 工具层内容、无第三方适配层（高德）、无统一 API 响应/错误约定。本架构补齐。

---

## 1. 分层架构

```
┌──────────────────────────────────────────────────────────────┐
│  app/  (路由层 · RSC/Client/Route Handler/Server Action)        │
│    只能 import: module-public · infrastructure · shared · lib   │
└───────────────┬──────────────────────────────────────────────┘
                │ 仅经 @/modules/<m> 公共面
┌───────────────▼──────────────────────────────────────────────┐
│  modules/<m>/index.ts   (module-public 公共面)                  │
│    └─ service/   用例编排(事务、跨 repo、发事件)                  │
│       ├─ domain/   纯业务规则(校验、状态机、熔断判定;不碰 db)     │
│       └─ repository.ts  Prisma 查询封装                          │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│  infrastructure/  (db · realtime bus/listener · logger ·        │
│                    queue · auth-session · 第三方 client)         │
└───────────────┬──────────────────────────────────────────────┘
                │
┌───────────────▼──────────────────────────────────────────────┐
│  shared/ (纯工具:日期格式化、身份证/车牌正则、Result 类型)        │
│  lib/    (可复用库:ui 组件、excel 导出、amap 封装)               │
│  generated/ (Prisma client, 不参与 lint)                        │
└──────────────────────────────────────────────────────────────┘
```

**边界规则（已在 `eslint.config.mjs`，保持不变）**：
| from | allow |
|---|---|
| `app` | module-public, infrastructure, shared, lib |
| `module-public` | module-internal, infrastructure, shared, generated |
| `module-internal` | module-internal, infrastructure, shared, generated |
| `infrastructure` | shared, generated, infrastructure |
| `shared` | shared |
| `lib` | lib, shared |

> 注意：模块**不能**直接 import 另一模块。需要跨模块协作时，要么在 `app/` 路由层组合两个公共面，要么经 realtime bus 事件解耦（见 §5）。

---

## 2. 模块划分（对齐 PRD B 端 5 大分组 + 系统域）

每个 PRD 侧边栏分组映射到一个**业务模块**；现有 7 空壳 + 新增 1 系统模块 = 8 模块。

| 模块 | PRD 分组 | 覆盖页面(B 编号) | 关键 domain 规则 | 实时 channel |
|---|---|---|---|---|
| **content** | 基础宣传管理 | B03/B04 景区介绍、B05 活动、B06 AI知识库、B07 资讯 | 富文本/媒体校验、发布状态机、活动报名费走微信支付(唯一二消) | — |
| **booking** ✅ | 预约管理中心 | B08 配额配置、B09 渠道接入、B10 现场补录 | **双要素强校验**、配额库存扣减(并发安全)、单证件单日上限、**承载力 90% 熔断** | `slot_changed` |
| **checkin** | 预约管理中心(核销) | (闸机联动)、B10 现场队列 | 当前时段有效性判定、核销幂等、车牌预扣车位 | `checkin_event` |
| **riskcontrol** ⭐新 | 预约管理中心 | B11 爽约风控与黑名单 | 爽约累计计数、熔断拉黑(姓名/证件/手机)、申诉解锁工作流 | — |
| **traffic** | 出行服务 | B12 实时路况、B13 停车上图 | 高德 API 适配、拥堵分流计算、停车满闲 | `parking_state` |
| **analytics** | 数据可视化与分析 | B14 客流、B15 热力、B16 来源、B17-19 画像/偏好 | 多维聚合、下钻(省市县)、**Excel 导出**、快照表读取 | — |
| **iot** | 物联网设备监控 | B20 设备列表、B21 详情心跳 | 在线率/延时/丢包计算、心跳超时判定、告警分级 | `iot_event` |
| **system** ⭐新 | 系统域(全局) | B01 登录、B02 仪表盘聚合、RBAC、操作审计 | 会话、密码哈希、菜单权限、审计写入 | — |

> **拆分说明**：
> - `riskcontrol` 从 booking 独立——爽约/黑名单是独立生命周期与申诉工作流，与预约下单解耦，避免 booking 模块膨胀。
> - `checkin` 已是独立空壳，保留——核销由闸机高频调用，读写路径与后台预约管理不同。
> - `profile` 空壳**并入 system**（管理员账户即 system 域），不单列 C 端游客 profile（C 端不在本架构范围）。
> - B02 仪表盘是跨模块只读聚合，放在 `app/(admin)/page.tsx`，分别调各模块公共面，不新建模块。

---

## 3. 标准模块骨架（以新增模块为模板）

```
src/modules/<m>/
├── index.ts          # 唯一对外面:re-export service 函数 + Prisma 类型
├── service/
│   └── index.ts      # 用例:校验→事务→repo→发事件;返回 Result<T>
├── domain/
│   ├── rules.ts      # 纯函数:双要素校验、熔断判定、状态机迁移
│   └── schema.ts     # zod 输入 schema(与 domain 规则一致)
├── repository.ts     # Prisma 查询封装(仅此处碰 db)
└── events.ts         # (可选) 本模块 channel 常量
```

**`index.ts` 范式**（沿用 booking 现有写法）：
```ts
// <m> 模块对外公共 API — 跨模块只允许 import 这里
export { <m>Service } from "./service";
export { <m>Repository } from "./repository";
export type { ... } from "@prisma/client";
```

**service 范式**（编排 + 事务 + 校验）：
```ts
import { db } from "@/infrastructure/db/client";
import { ok, err } from "@/shared/result";
import { createBookingSchema } from "./domain/schema";
import { assertDualElements, canBook } from "./domain/rules";

export const bookingService = {
  async createBooking(input: unknown) {
    const parsed = createBookingSchema.safeParse(input);
    if (!parsed.success) return err("INVALID_INPUT", parsed.error);
    assertDualElements(parsed.data);           // 身份证+车牌红线
    return db.$transaction(async (tx) => {
      const slot = await tx.bookingSlot.findUnique({ where: { id: parsed.data.slotId } });
      if (!canBook(slot)) return err("SLOT_FULL");   // 含 90% 熔断判定
      // ... 扣减库存 + 落单(行锁/乐观锁见 §6)
    });
  },
};
```

---

## 4. 数据层规约（Prisma 7 多文件 schema）

- **每模块一个** `prisma/models/<m>.prisma`，Prisma 7 自动合并。
- **表名约定**：`@@map("<模块>_<实体>")` snake_case 前缀做命名空间隔离（如 `booking_slot`、`iot_device`、`risk_blacklist`）。
- **字段约定**（沿用 booking）：主键 `String @id @default(uuid()) @db.Uuid`；时间 `@db.Timestamptz(3)`；扩展字段 `Json? @db.JsonB`；枚举用 Prisma enum。
- **迁移**：`prisma migrate dev`；实时 trigger 用**手写 SQL migration**（参考 `20260527160000_realtime_triggers`），不在 schema 里表达。
- **分析模块特殊**：`analytics` 不建业务写表，读 **物化视图/快照表**（由定时任务刷新，见 §7），避免在线大表聚合拖垮库。

**新增模型清单（建表方向，非逐字段）**：
| 模块 | 主要表 |
|---|---|
| content | `content_attraction`, `content_activity`, `content_kb_entry`, `content_news` |
| booking | `booking_slot`✅, `booking`✅, `booking_channel`(渠道库存切分) |
| checkin | (复用 booking 表 + ) `checkin_log` |
| riskcontrol | `risk_noshow_counter`, `risk_blacklist`, `risk_appeal` |
| traffic | `traffic_parking_lot`, `traffic_snapshot`(可选) |
| analytics | `analytics_*_snapshot` 系列(物化视图/快照) |
| iot | `iot_device`, `iot_heartbeat`(时序，可按月分区) |
| system | `sys_admin`, `sys_role`, `sys_permission`, `sys_audit_log` |

---

## 5. 实时链路（SSE，沿用既有范式）

**新增 channel 接入三步**（已在参考实现验证）：
1. 写 trigger SQL migration：`pg_notify('<channel>', json_build_object(...)::text)`。
2. 在 `infrastructure/realtime/listener.ts` 的 `CHANNELS` 数组加 channel 名。
3. 在 `app/api/sse/[topic]/route.ts` 的 `ALLOWED_TOPICS` 加白名单。
4. 前端 Client Component `new EventSource("/api/sse/<channel>")` 消费。

**本架构 channel 全集**：`slot_changed`(配额变动)、`checkin_event`(核销，驱动 B02/大屏在园人数)、`iot_event`(设备告警/离线)、`parking_state`(车位)。承载力熔断由 checkin_event 累加触发，service 层判断达 90% 后更新 slot 状态 → 再经 slot_changed 广播停约。

---

## 6. 关键红线的技术落点

| PRD 红线 | 技术实现 |
|---|---|
| **双要素强校验** | `booking/domain/schema.ts` zod：身份证(含校验位)、车牌(含新能源)正则；`无车辆`声明位互斥;三渠道(小程序/外部/补录)共用同一 schema |
| **库存并发安全** | 配额扣减用 `db.$transaction` + `SELECT ... FOR UPDATE`(行锁)或 `booked_count` 乐观锁 `WHERE booked_count < capacity`，防超约 |
| **承载力 90% 熔断** | checkin_event 累计在园人数 → service 判定达阈值 → 置 slot `PAUSED` + `pg_notify` → 后台停当日预约入口 + 大屏闪红 |
| **支付隔离** | 微信支付 client 仅注入 `content`(活动报名费)模块；booking/checkin 模块**不依赖**支付 infrastructure，边界由 eslint 兜底 |
| **报表 Excel 导出** | `lib/excel`(基于 exceljs)统一封装；analytics service 产出二维数据 → Route Handler 返回 xlsx 流 |
| **日期中文格式** | `shared/format.ts` 统一 `2026 年 5 月 31 日`，禁 ISO；服务端渲染时格式化 |

---

## 7. 横切关注点（infrastructure 延展）

| 关注点 | 方案 | 落点 |
|---|---|---|
| **认证** | 会话 cookie（Postgres 存 session 或 JWT+httpOnly）；中间件保护 `(admin)` 路由组 | `middleware.ts` + `infrastructure/auth/` |
| **RBAC** | 菜单/操作权限表(`sys_role`/`sys_permission`)；service 入口校验；侧边栏按权限渲染 | `system` 模块 + `middleware.ts` |
| **审计** | 写操作经 service 统一记 `sys_audit_log`(操作人/动作/前后值) | `system` 模块 |
| **输入校验** | `zod` 全量启用；每个 service 入口 `safeParse`；Server Action/Route 复用同一 schema | 各模块 `domain/schema.ts` |
| **任务队列** | 启用 `pg-boss`：快照刷新、爽约扫描、心跳超时检测、Excel 大导出异步化 | `infrastructure/queue/` |
| **统一响应/错误** | `Result<T>` 判别联合 + 错误码枚举；Route Handler 统一序列化 | `shared/result.ts` |
| **第三方适配** | 高德地图(路况/停车/分流) client 封装；AI 大模型 client；超时/重试/降级 | `lib/amap/`, `lib/ai/` |
| **日志** | 既有 pino；service 关键路径 + 第三方调用结构化打点 | `infrastructure/logger.ts`✅ |

---

## 8. 路由结构（App Router）

```
app/
├── (auth)/login/page.tsx                    # B01 登录(无侧边栏布局)
├── (admin)/
│   ├── layout.tsx                           # 全局壳:Sidebar+Topbar(按 B-design-system.md)
│   ├── page.tsx                             # B02 仪表盘(跨模块只读聚合)
│   ├── content/{attractions,activities,kb,news}/...   # 基础宣传管理
│   ├── booking/{slots,channels,onsite}/...  # 预约管理
│   ├── risk/page.tsx                        # B11 爽约风控与黑名单
│   ├── traffic/{realtime,parking}/...       # 出行服务
│   ├── analytics/{flow,heatmap,source,profile}/...    # 数据分析
│   └── iot/{devices,[id]}/...               # 物联网监控
├── api/
│   ├── sse/[topic]/route.ts                 # ✅ 实时网关
│   ├── export/[module]/route.ts             # Excel 导出
│   └── gate/checkin/route.ts                # 闸机核销(高频,独立 Route)
└── middleware.ts                            # 认证 + RBAC 路由守卫
```
侧边栏分组/命名/层级严格按 `prompts/B-design-system.md`（架构与 UI 规范同源，不得增减菜单项）。

---

## 9. 落地路线图（建议顺序）

1. **地基**：`shared/`(result/format/validators) + `lib/ui`(Sidebar/Topbar/Table/Card) + `(admin)/layout.tsx` 全局壳。
2. **system 模块**：认证 + middleware + RBAC + 审计 → 打通 B01 登录、保护后台。
3. **booking 补全**：service/domain/schema + 双要素 + 库存事务 + 熔断 → B08/B09/B10（核心业务，红线最密集）。
4. **riskcontrol + checkin**：爽约风控、黑名单、申诉、核销联动 → B11。
5. **content**：CRUD + 富文本/媒体 + 发布状态机 → B03-07。
6. **traffic**：高德适配层 + 停车/路况 → B12/B13。
7. **iot**：设备列表 + 心跳 SSE + 告警 → B20/B21。
8. **analytics**：快照表 + pg-boss 定时刷新 + 多维聚合 + Excel → B14-19。
9. **B02 仪表盘**：跨模块聚合收口。

> 每个模块按「prisma model → repository → domain/schema → service → index.ts 导出 → app 页面」自下而上，每步可 lint 验证边界、可独立跑通。

---

## 10. 验证方式

- **边界**：`pnpm lint`（eslint-boundaries 报错即架构违例）。
- **类型**：`tsc --noEmit`（CI 卡口）。
- **实时链路**：`tsx scripts/verify-realtime.ts`（已存在，每加一条 channel 复制一份验证）。
- **数据库**：`prisma migrate dev` + `prisma studio` 人工核对；`db:seed` 造数。
- **端到端**：dev（webpack 模式，内存约束见项目记忆）起站 → 各页面 RSC 直读 + SSE 实时刷新人工验收。
- **红线回归**：双要素拒收用例、超约并发用例、90% 熔断用例写成 service 单测（domain 纯函数易测）。
```
