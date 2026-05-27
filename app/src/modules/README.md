# 业务模块层

每个模块约定:
- `index.ts` — **仅此文件**对外暴露 named exports
- `domain/` — 实体、值对象、业务规则(纯函数,不依赖 db)
- `service/` — 用例编排,调用 repository 与 domain
- `repository.ts` — Prisma 查询封装
- `events.ts`(可选)— 模块内事件总线名

跨模块只允许 `import { x } from "@/modules/<m>"`,直接 import 内部子目录会被 ESLint 拒绝。
