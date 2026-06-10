# syntax=docker/dockerfile:1
# 长秋山 B 端后台 — 生产镜像(QA/联调用,目标:完全容器化跑全栈)
# ⚠️ next build 是重活。构镜像前务必按 CLAUDE.md「编译/打包纪律」先 `docker compose down`
#    释放内存,再 `docker compose build app`,最后 `docker compose up -d`。

FROM node:24-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH
RUN npm install -g pnpm@11.4.0
WORKDIR /app

# ---- 依赖 + 构建 ----
FROM base AS build
ENV NEXT_TELEMETRY_DISABLED=1
# pnpm-workspace.yaml 带 dangerouslyAllowAllBuilds:true(放行 prisma/sharp/esbuild 等 build 脚本),
# .npmrc 带 verify-deps-before-run=false;二者必须在 install 前就位,否则 pnpm11 报 ERR_PNPM_IGNORED_BUILDS。
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
# 根 package.json 的 postinstall=`prisma generate` 在 install 阶段触发,需要 schema 在场;
# 多阶段构建里 install 早于 `COPY . .`,故先把 prisma 配置/schema 拷进来,否则 postinstall 找不到 schema 而失败。
# (本地/Vercel 安装时整仓已在场,无此问题;此拷贝仅修 Docker 多阶段顺序。)
COPY prisma.config.ts ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile
COPY . .
# Prisma 7 客户端(走 @prisma/adapter-pg,无原生引擎二进制,默认输出到 node_modules)
RUN pnpm exec prisma generate
# next build「收集页面数据」会 import 路由模块,触发 db/client.ts 顶层 createPrismaClient();
# 缺 DATABASE_URL 即 throw。给一个构建期占位串(driver adapter 懒连接,build 不真连);
# 运行期由 compose 注入真实 DATABASE_URL 覆盖,占位值不进运行镜像的 env。
ENV DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build?schema=public"
# NEXT_PUBLIC_* 是构建期内联进客户端 bundle 的,必须经 build args 传入(.env 被 dockerignore)。
# 不传(默认空)= 地图显「Key 未配置」诚实态;传了 = docker QA 可测真地图。仅演示级 key 可这样用。
ARG NEXT_PUBLIC_AMAP_KEY=""
ARG NEXT_PUBLIC_AMAP_SECURITY=""
ENV NEXT_PUBLIC_AMAP_KEY=$NEXT_PUBLIC_AMAP_KEY NEXT_PUBLIC_AMAP_SECURITY=$NEXT_PUBLIC_AMAP_SECURITY
# 限速构建:NEXT_BUILD_LIMIT=1 → next.config 启用 cpus:2 + workerThreads:false,主动让出 CPU
RUN NEXT_BUILD_LIMIT=1 pnpm build

# ---- 运行期 ----
FROM base AS runner
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
# 直接搬构建好的 node_modules(含已生成的 prisma client),运行期不再 install / generate。
# 不做 prune:next.config.ts 为 TS、next start 需完整依赖,保稳优先于镜像体积(QA 环境磁盘够用)。
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/next.config.ts ./next.config.ts
EXPOSE 3000
# 直接用 next 二进制启动,避开 pnpm 运行期 verify-deps;默认绑 0.0.0.0:3000(PORT 可覆盖)
# 实时层 pg-listen 在 instrumentation 内随启
CMD ["node_modules/.bin/next", "start"]
