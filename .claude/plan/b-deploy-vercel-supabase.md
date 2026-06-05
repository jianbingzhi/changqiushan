# B 端 · Vercel + Supabase 临时部署方案

> 临时演示/预览部署。决策(2026-06-05):**① 实时暂时关闭(进入即查一次 + 手动刷新);② 媒体接 Supabase Storage;③ 定位临时演示**(种子/示例数据、少量手建管理员;滑动续期、连接池精调等生产项后置)。
> Vercel 是 serverless,无常驻进程 → 现有 **pg-listen 实时 / pg-boss 定时 / SSE 长连接** 全部失效,必须改;DB/Auth/Storage 切 Supabase 多为配置层。

## 范围:代码层(我改) vs 控制台(你做)

---

## A · 控制台准备(你做,给我连接串/密钥后我填代码)

1. **建 Supabase 项目**,记下:
   - `DATABASE_URL` = Connection Pooling → **Transaction 模式(端口 6543)**,串尾加 `?pgbouncer=true&connection_limit=1`
   - `DIRECT_URL` = Direct connection(端口 5432)——仅迁移/seed 用
   - `GOTRUE_JWT_SECRET` = Settings→API→JWT Secret
   - `SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY`
   - project ref(`https://<ref>.supabase.co`)
2. **建库结构**:本地用 `DIRECT_URL` 跑 `prisma migrate deploy`(含 8 模块表 + auth schema + 实时 trigger + 物化视图)。trigger 留着无害(只是没人 LISTEN)。
3. **建管理员账号**:用 Supabase Admin API/SQL 建 phone+password 用户,且 `app_metadata.role` 设为 `SUPER_ADMIN`/`ADMIN`(R3 RBAC 读它)。phone+password 走 password grant,免短信。
4. **建 Storage bucket**:如 `changqiushan-media`,**Public 读**。
5. **Vercel**:导入 repo → 设环境变量(见 §C)→ Region 选靠近 Supabase 的区 → 部署。
6. **seed 示例数据**(演示用):`tsx prisma/seed.ts` 指向 `DIRECT_URL`;时段数据注意用当日(配合 b-98 C4/C5)。

---

## B · 代码改动(我做)

### B1 · 数据库适配 pooler
- `prisma/schema.prisma` datasource 加 `directUrl = env("DIRECT_URL")`(migrate 用直连,运行时用 pooler)。
- `src/infrastructure/db/client.ts`:`PrismaPg` 传入小连接池(`max: 1~3`),避免 serverless 多实例打爆;Transaction pooler 下禁 prepared statement(串里 `pgbouncer=true` + pg Pool 配置)。

### B2 · 认证切 Supabase 云 GoTrue
- env:`GOTRUE_URL=https://<ref>.supabase.co/auth/v1`、`GOTRUE_JWT_ISSUER` 同址、`GOTRUE_JWT_SECRET`=项目密钥。
- `src/app/(auth)/login/page.tsx`:登录 `fetch` **加 `apikey: <SUPABASE_ANON_KEY>` 头**(Supabase Auth 网关要求);GOTRUE_URL 已是 env,无需改逻辑。
- `session.ts` issuer 已 env 驱动,设对即可。`COOKIE_SECURE=true`(Vercel https)。

### B3 · 关闭实时(决策①)
- 前端 4 个订阅点 **不再建 EventSource**:`(admin)/_dashboard-live.tsx`、`_occupancy-card.tsx`、`(dashboard)/realtime/_big-screen.tsx`、`(admin)/page.tsx`。
- 改法:`src/lib/realtime-flag.ts` 导出 `REALTIME_ENABLED = process.env.NEXT_PUBLIC_REALTIME_ENABLED !== "false"`(**默认开**,本地不设=保持实时;**Vercel 上设 `NEXT_PUBLIC_REALTIME_ENABLED=false` 关闭**)。关时不建 EventSource,只用 SSR 首屏值 + 「刷新」按钮(回拉快照)。
- LiveDot 关态显示「数据快照(手动刷新)」,不再误导为"连接断开"。
- SSE route 代码保留(自托管仍用),前端关态不连即可。

### B4 · 定时任务 → Vercel Cron + 熔断内联
- **物化视图刷新**:新增 `src/app/api/cron/refresh-mv/route.ts`(校验 `CRON_SECRET`,内做 3 条 `REFRESH MATERIALIZED VIEW`);`vercel.json` 配 `crons` 每 15min 打它。
- **熔断(红线4)**:从 `instrumentation-node.ts` 的 `bus.on("checkin_event")` 监听,**移到 checkin service 写路径内联**调用 `pauseSlotsForCircuitBreak`(`checkin/service/checkin.ts` 算出 circuitBroken 处)。这样无实时也能停当日预约。

### B5 · instrumentation 守卫
- `src/instrumentation-node.ts`:`if (process.env.VERCEL || process.env.NEXT_RUNTIME!=="nodejs") return;` **跳过 pg-listen + pg-boss**(避免冷启动开无用 LISTEN/报错)。本地 docker 不受影响。

### B6 · 媒体接存储 — 用 S3 兼容协议(决策②,避免锁定)
- ⚠️ **不用 `@supabase/supabase-js` 的 storage SDK**(会绑定 Supabase),改用 **S3 兼容 driver(`@aws-sdk/client-s3`)**——只换 `endpoint + key`,三套环境同代码:本地 MinIO / Vercel 演示 Supabase Storage(有 S3 端点)/ **最终阿里云 OSS(S3 兼容)**。这正好落地文档早规划的 `R-storage` 抽象。
- 新建 `src/infrastructure/storage/s3.ts`(读 `S3_ENDPOINT/S3_REGION/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET`,`forcePathStyle:true`),`putObject` 返回 public URL。
- 新增上传 server action/route(内容封面等);现有封面字段接上传。⚠️ 现状无上传 UI(封面/插图多为 URL 输入),故含**新建上传入口**,工作量中等——**本轮可与 B1–B5 分开做**。

---

## C · Vercel 环境变量清单
`DATABASE_URL`(6543 pooler)、`DIRECT_URL`(5432)、`GOTRUE_URL`、`GOTRUE_JWT_ISSUER`、**`GOTRUE_JWKS_URL`**(Supabase ES256 验签必需:`https://<ref>.supabase.co/auth/v1/.well-known/jwks.json`)、`GOTRUE_JWT_SECRET`、`SUPABASE_ANON_KEY`、`S3_ENDPOINT/S3_REGION/S3_ACCESS_KEY/S3_SECRET_KEY/S3_BUCKET`(指向 Supabase Storage S3 端点)、`COOKIE_SECURE=true`、`GOTRUE_JWT_EXP`、`PARK_INSTANT_CAPACITY`、`CRON_SECRET`、**`NEXT_PUBLIC_REALTIME_ENABLED=false`**(关实时;本地不设=保持开),加 AI/微信/支付那批。

## C2 · 可逆性 / 最终迁阿里云(国内生产)
> 全程"env 门控 + 只加不删,自托管路径保留",切回基本是换 env + 部署到阿里云。
- **DB**:标准 PG → 指向阿里云 RDS PG/自建 PG18;`pg_dump` 搬数据,Prisma 迁移可移植。
- **Auth**:GoTrue 自托管版仍在 docker-compose;换回 `GOTRUE_URL` + 起 gotrue 容器;`auth.users` 可 `pg_dump` 移植;多发的 `apikey` 头自托管忽略。
- **实时**:SSE/pg-listen 代码没删,阿里云上 `NEXT_PUBLIC_REALTIME_ENABLED` 不设(=开)即全活。
- **定时**:pg-boss 给自托管保留(instrumentation 仅在 `VERCEL` 跳过);Vercel Cron 路由在自托管是闲置路由。熔断改内联两边都更稳。
- **存储**:S3 兼容 → 改 `S3_ENDPOINT/KEY` 指向 OSS 即可,零代码改。
- **国内现实**:Vercel/Supabase 均海外(Supabase 选 Singapore 仅够演示);**Vercel 域名无 ICP 备案 → 生产对外不合规、微信支付回调收不到**。故 Vercel+Supabase=临时演示,**最终阿里云(ECS/容器 + RDS + OSS)+ 备案域名**才是生产。

## C3 · 真机验证记录(2026-06-05,项目 ref `whnjddztiikeavegwsbi`,Singapore,PG17.6)
用 PAT 直连 Supabase 真机验证,**全链路通过**:
- ✅ `prisma migrate deploy` 17 个迁移全部应用(**27 表 / 3 物化视图 / 13 触发器**)。迁移前经 SQL `CREATE ROLE changqiushan`(NOLOGIN)兜住 `auth_user_view` 的 GRANT;**未改迁移文件、不影响本地**。
- ✅ 直连 5432 + pooler 6543 均连通。
- ✅ 建管理员(service_role admin API)+ 手机号密码登录 200 + JWKS(ES256)验签通过,`app_metadata.role=SUPER_ADMIN`(R3 RBAC 可读)。
- **踩到并已解决的 Supabase 坑**:
  1. **DB 密码**:GitHub 登录用户常忘;此项目旧密码恰为 `changqiushan`。PAT 无法读/改 postgres 密码(superuser 限制)→ 忘了就 Dashboard 重置。
  2. **手机号登录默认关闭**(`phone_provider_disabled`)→ 已用 PAT `PATCH config/auth {external_phone_enabled:true}` 打开;password grant 不发短信,无需 SMS provider。
  3. **用户 token 用 ES256 非对称签发**(非 legacy HS256)→ 新增 `GOTRUE_JWKS_URL`,`session.ts`+`middleware.ts` 经 `shared/auth/jwt-verify` 支持 JWKS;不设则走 HS256(自托管不变)。
- **登录页改手机/邮箱二合一**:输入含 `@` 走邮箱登录、否则手机号。**邮箱登录免短信、最省事**(GoTrue 手机验证码链路繁琐),Supabase/自托管都默认开邮箱。已真机验证邮箱登录 200 + JWKS 验签 ✓。
- **测试管理员**(演示用,可改):
  - 邮箱(推荐):`admin@changqiushan.demo` / `Cqs-demo-2026` / SUPER_ADMIN
  - 手机:`+8613800138000` / `Cqs-demo-2026` / SUPER_ADMIN(需 external_phone_enabled,已开)
- ⚠️ 验完请:撤销 PAT、按需 rotate DB 密码/key。

## D · 不影响本地 docker
所有改动用 env 门控(`VERCEL` / `NEXT_PUBLIC_REALTIME_ENABLED` / pooler 串),**本地 docker 全栈照常**(pg-listen/pg-boss/SSE 仍跑)。一套代码两套部署。

## E · 临时演示的已知取舍(不在本轮)
- 会话仍长时效无滑动续期(b-98 C9 生产项);连接池仅基本配置;熔断改内联后多实例一致但无跨实例广播(演示足够)。
- 实时关闭 → 大屏/仪表盘非自动刷新;需自动态势时再按"Supabase Realtime"方案升级。

## F · CI/CD(GitHub Actions + Vercel CLI,源库 origin=d2xstudio)
工作流:`.github/workflows/ci-deploy.yml`。
- **ci job**(PR + push main):`pnpm install` → `prisma generate` → `tsc --noEmit` → `pnpm lint`(eslint 边界 + lint-cn 红线)→ `pnpm test`。不连库、无需 secret。
- **deploy job**(仅 push main,需 ci 通过):`prisma migrate deploy`(用 `DIRECT_URL` secret,失败则不部署)→ `vercel pull/build/deploy --prod`。
- **需在 GitHub repo(d2xstudio/changqiushan)→ Settings → Secrets → Actions 配置**:
  `VERCEL_TOKEN`、`VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`、`DIRECT_URL`(Supabase 直连 5432)。
- **应用运行时变量**(`DATABASE_URL` pooler / `GOTRUE_*` / `SUPABASE_ANON_KEY` / `S3_*` / `NEXT_PUBLIC_REALTIME_ENABLED=false` / `COOKIE_SECURE=true` / `CRON_SECRET` 等)在 **Vercel 项目 env** 配置,由 `vercel pull/build` 注入,不放 GitHub Secrets。
- **Vercel 项目前置**:Root Directory 设 `app`(monorepo 子目录);`vercel link` 后从 `.vercel/project.json` 取 ORG_ID/PROJECT_ID。
- **双库**:workflow 文件随双推也在 jianbingzhi,但 deploy 前有 `guard` job 检测部署密钥——未配齐(jianbingzhi)→ deploy **自动跳过(skipped,非失败)**,ci 照常。故只在 d2xstudio 配 secrets 即只在 origin 真部署,无需在 jianbingzhi 关 Actions。

## 执行顺序
1.(你)建 Supabase 项目 + Vercel 项目(Root=app)→ 把上面 4 个 GitHub Secrets 加到 d2xstudio repo、应用变量加到 Vercel env。
2.(我,已完成)B1–B5 代码 + CI/CD workflow + 本地回归绿。
3.(你)Supabase 建带 `app_metadata.role` 的管理员 + public bucket(S3 key)。
4.(我)B6 S3 兼容存储 driver + 上传入口。
5. push main → CI 自动 migrate + 部署 → 联调冒烟。
6.(可选)给我**临时**连接串/anon key,我从本地跑一次 migrate/连接/登录冒烟定性后你 rotate。
