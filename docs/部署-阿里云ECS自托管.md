# 长秋山 · 阿里云 ECS 自托管部署 Runbook

> 目标机器:`8.137.184.228`(阿里云,root)。这是 `.claude/plan/b-deploy-vercel-supabase.md` §C2 规划的**最终生产环境**——
> Vercel+Supabase 只是海外临时演示(无 ICP 备案 → 微信支付回调收不到、对外不合规)。本机走**自托管 Docker 全栈**。
>
> **好消息**:`app/docker-compose.yml` 已是完整自托管全栈(app + postgres + gotrue + minio),自托管下
> 实时 SSE / pg-listen / pg-boss **原生可用**,不像 Vercel 要门控关掉。部署 = 把这套 compose 在服务器上跑起来。
> B 端后台与 C 端 BFF(`/api/c/*`)在**同一个 app** 里一并上线;小程序前端另走微信工具上传(见 §10)。
>
> 编译/迁移须遵 `CLAUDE.md`「编译纪律」与记忆「Prisma 迁移工作流」(用 `migrate deploy`,不用 `migrate dev`)。

---

## 0 · 上线前必须先确认(写代码改不了,得你/运维给)

| 项 | 说明 | 阻塞什么 |
|---|---|---|
| **服务器规格** | CPU 核数 / 内存 / 磁盘。`next build` 极吃内存,**< 4GB 内存必须先加 swap 或换镜像离线构建**(§4.4) | 内存不足 → build 假死 |
| **ICP 备案域名** | 生产对外必须备案 https 域名(微信小程序白名单、微信支付回调、`COOKIE_SECURE=true` 都依赖它) | 无域名 → 小程序连不上、支付回调收不到 |
| **是否启用 IPv6** | compose 的 `networks` 段要求宿主内核开 IPv6,否则**建网络即失败、整栈起不来**(§4.3) | 整栈起不来 |
| **各类生产密钥** | 微信 AppID/Secret、微信支付 5 件套、AI 模型 key、高德 key(§6 清单) | 对应功能不可用 |

---

## 1 · 网络放行(先打通访问)

当前从外部 SSH 22 / 80 / 443 全部 timeout(安全组没放行)。

1. 阿里云控制台 → ECS → 该实例 → **安全组** → 配置规则 → 入方向,放行:
   - `22/tcp`(SSH,建议仅放行运维固定 IP)
   - `80/tcp` + `443/tcp`(Nginx,放行 `0.0.0.0/0`)
   - **不要**对公网放行 `3000`(app)、`5433`(PG)、`9000/9001`(MinIO);这些只走容器内网或本机,公网一律经 Nginx 443 反代。
2. 若还连不上,查机器内防火墙:`systemctl status firewalld`(CentOS/Alinux)或 `ufw status`(Ubuntu/Debian),放行对应端口。

> 注:本次 AI 助手沙箱出口 IP 不固定,**不依赖白名单 AI 直连**;部署由运维 SSH 执行,或本机 `! <命令>` 回灌输出由助手指挥。

---

## 2 · 服务器初始化

```bash
# 2.1 时区(全栈都按 Asia/Shanghai)
timedatectl set-timezone Asia/Shanghai

# 2.2 装 Docker + compose 插件(官方脚本,适配多数发行版)
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker
docker version && docker compose version   # 确认 compose v2 插件就位

# 2.3 国内拉镜像慢/失败 → 配镜像加速(阿里云控制台「容器镜像服务→镜像加速器」给专属地址)
#     写入 /etc/docker/daemon.json 后 systemctl restart docker
```

---

## 3 · 代码上服务器

仓库私有(`origin = d2xstudio.github.com:d2xstudio/changqiushan.git`,自定义 SSH host 别名)。二选一:

- **A. git clone(推荐,便于后续 `git pull` 升级)**
  在服务器生成部署密钥 `ssh-keygen -t ed25519`,公钥加到 GitHub repo 的 **Deploy Keys**(只读即可),然后 `git clone` 到 `/opt/changqiushan`。
- **B. 不想给服务器 git 权限**:本地 `git archive` 或 `rsync -avz --exclude node_modules --exclude .next ./ root@<ip>:/opt/changqiushan/` 推上去。

部署工作目录统一 `app/` 子目录:`cd /opt/changqiushan/app`。

---

## 4 · 关键生产化改动(相对 dev compose)

> dev compose 是为「内网 VPN QA」调的,直接上生产有几处必须改。**改这几处即可,不必动业务代码。**

### 4.1 端口绑定收紧(只让 Nginx 对外)
`app` 与 `minio` 在 dev 里绑了 `0.0.0.0`。生产应只让 Nginx 反代,改 `docker-compose.yml`:
- `app.ports`: `"127.0.0.1:3000:3000"`(只本机,Nginx 反代)
- `minio.ports`: S3 API `"127.0.0.1:9000:9000"`(媒体也经 Nginx 子域名/路径反代到 443);控制台 9001 保持仅本机。

### 4.2 GoTrue 库密码必须与引导 SQL 一致 ⚠️
`docker/auth-bootstrap.sql` 里 `CREATE ROLE supabase_auth_admin ... PASSWORD 'auth_dev_pwd'` 是**硬编码**。
若 `.env` 把 `GOTRUE_DB_PASSWORD` 改成强随机值,**必须同步**:把 bootstrap.sql 里这行密码改成同值(或引导后手动 `ALTER ROLE supabase_auth_admin PASSWORD '<新值>'`),否则 GoTrue 连库失败、登录全挂。

### 4.3 IPv6 网络段(整栈能否起的前提)⚠️
compose 末尾 `networks.default.enable_ipv6: true` 要求**宿主内核启用 IPv6**,否则 `docker compose up` 建网络即失败。两条路:
- 宿主开 IPv6(`sysctl net.ipv6.conf.all.disable_ipv6=0`)并确认 Docker ≥27;**或**
- 阿里云机器无 v6 时:**删掉 compose 末尾整个 `networks:` 段**回退默认网络(代价:容器内高德直连可能复发原 bug,但服务端高德走 `AMAP_KEY` REST,多数场景无碍)。

### 4.4 构建内存(低配机必做)⚠️
`next build` 是最吃内存的动作。**< 4GB 内存**:
```bash
# 加 4G swap 兜底(构建期防 OOM)
fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```
或**离线构建**:在配置好的机器/CI 上 `docker build` 出 `changqiushan-app:latest`,`docker save | gzip` 传到服务器 `docker load`,服务器只 run 不 build。

### 4.5 其他生产值(在 §6 的 .env 里设)
- `COOKIE_SECURE=true`(经 https 反代)
- `GOTRUE_JWT_EXP=3600`(1 小时,靠已落地的 middleware 滑动续期;**别照抄演示的 604800/7 天**)。compose 里 app 与 gotrue 两处 `GOTRUE_JWT_EXP` 同步改。
- `S3_PUBLIC_ENDPOINT` / `S3_PUBLIC_BASE_URL` 指向**公网可达的备案域名**(如 `https://media.<域名>`),不能再是 `10.7.0.1`/`localhost`。
- `minio` 镜像 dev 用 `:latest`,生产**钉死 RELEASE 版本**(对齐 pg/gotrue 钉版约定)。

---

## 5 · 起栈顺序(关键:分阶段,不能一把 `up` 完事)

迁移有依赖链:**先有 auth schema → GoTrue 自动迁出 `auth.users` → 再跑 Prisma 迁移**(`auth_user_view` 视图依赖 `auth.users` 存在)。所以分阶段:

```bash
cd /opt/changqiushan/app
# 5.1 先起底座(不起 app)
docker compose up -d postgres gotrue minio minio-init

# 5.2 等 postgres healthy 后,跑 GoTrue 引导 SQL(建角色/auth schema,幂等)
#     注意:用的密码须与 4.2 对齐
docker exec -i changqiushan-postgres psql -U changqiushan -d changqiushan < docker/auth-bootstrap.sql
#     GoTrue 容器会自动迁出 auth.users(看日志确认)
docker logs changqiushan-gotrue --tail 30

# 5.3 跑 Prisma 业务迁移(用 migrate deploy,不用 migrate dev——见记忆「Prisma 迁移工作流」)
#     借 app 镜像跑一次性命令(镜像内含 prisma client + migrations + 占位 DATABASE_URL 被 compose 覆盖)
docker compose run --rm app node_modules/.bin/prisma migrate deploy

# 5.4 造数据:种子(时段/角色) + 引导超管
docker compose run --rm app node_modules/.bin/tsx prisma/seed.ts        # 角色/示例(生产可裁剪)
docker compose run --rm app node_modules/.bin/tsx scripts/seed-admin.ts # 超管:手机号 13900000000 / 密码 Admin@12345
#     ⚠️ 上线后立即用后台改超管密码 / 或改 scripts/seed-admin.ts 的默认值再跑

# 5.5 起 app
docker compose up -d app
docker compose ps   # 确认全部 healthy
```

> 升级流程:`git pull` →(低配机先 `docker compose down` 释放内存)→ `docker compose build app` → `docker compose run --rm app ...prisma migrate deploy` → `docker compose up -d`。

---

## 6 · 生产 `.env`(放 `app/.env`,gitignore)

逐项生成强随机密钥(`openssl rand -hex 32`),按需填业务密钥:

```bash
# —— 数据库(容器内网名 postgres:5432;此串给 app 容器用)——
DATABASE_URL="postgresql://changqiushan:<强密码>@postgres:5432/changqiushan?schema=public"
# ⚠️ 改了 DB 密码,compose 里 postgres.POSTGRES_PASSWORD 与各处连接串都要同步

# —— 认证 GoTrue ——
GOTRUE_DB_PASSWORD="<强随机>"        # 必须与 auth-bootstrap.sql 的 supabase_auth_admin 密码一致(§4.2)
GOTRUE_JWT_SECRET="<openssl rand -hex 32>"   # app 与 gotrue 两边必须同值
GOTRUE_JWT_EXP=3600
COOKIE_SECURE=true

# —— C 端游客鉴权(小程序),与 GOTRUE_JWT_SECRET 必须不同 ——
VISITOR_JWT_SECRET="<openssl rand -hex 32>"

# —— 媒体 S3(本机 MinIO;公网读经备案域名)——
MINIO_ROOT_USER="<改掉默认>"
MINIO_ROOT_PASSWORD="<强随机>"
S3_ENDPOINT="http://minio:9000"                 # 服务端容器内网自用
S3_PUBLIC_ENDPOINT="https://media.<已备案域名>" # 浏览器/小程序可达的公网端点
S3_BUCKET="changqiushan-media"
S3_FORCE_PATH_STYLE="true"
# S3_PUBLIC_BASE_URL=""   # 若用 CDN/桶域名读图

# —— cron / 大屏软门 ——
CRON_SECRET="<openssl rand -hex 32>"   # 必填,否则 refresh-mv 路由 fail-closed
# SCREEN_TOKEN="<openssl rand -hex 32>" # 大屏访问辅助门(生产以 Nginx IP 白名单为主)

# —— 承载力熔断(红线4)——
PARK_INSTANT_CAPACITY=5000             # ⚠️ 占位,待 PRD 给正式瞬时承载量

# —— 微信小程序 ——
WECHAT_APPID="<wx-appid>"
WECHAT_SECRET="<wx-app-secret>"

# —— AI 问答(OpenAI 兼容,直连不做 RAG)——
AI_BASE_URL="https://<...>/v1"
AI_MODEL="<model>"
AI_API_KEY="<key>"

# —— 微信支付 APIv3(仅活动报名二消;入园主流程零支付)——
WXPAY_MCH_ID="<mch-id>"
WXPAY_SERIAL_NO="<cert-serial>"
WXPAY_PRIVATE_KEY="<商户私钥 PEM, \n 转义>"
WXPAY_API_V3_KEY="<apiv3-key>"
WXPAY_PLATFORM_PUBLIC_KEY="<平台公钥 PEM, \n 转义>"
WXPAY_NOTIFY_URL="https://<已备案域名>/api/c/payment/wechat/callback"

# —— 高德 ——
AMAP_KEY="<Web服务key>"   # 服务端 REST 路况/静态图;严禁加 NEXT_PUBLIC 前缀
# NEXT_PUBLIC_AMAP_KEY / NEXT_PUBLIC_AMAP_SECURITY 是构建期内联,要在 build 时经 compose build.args 传入
```

> `NEXT_PUBLIC_*` 是**构建期**内联进前端 bundle 的(`.env` 被 dockerignore)。要让浏览器端地图组件生效,得在 `docker compose build app` 时让宿主环境有 `NEXT_PUBLIC_AMAP_KEY`/`NEXT_PUBLIC_AMAP_SECURITY`(compose 的 `build.args` 已透传宿主同名 env)。生产更稳的做法是 Nginx 代理 `_AMapService` 不下发密钥(见 .env.example 注释)。

---

## 7 · 反向代理 + HTTPS(Nginx + 备案域名)

1. 装 Nginx + certbot,申请备案域名证书(`certbot --nginx -d <域名> -d media.<域名>`)。
2. 反代规则(要点):
   - `https://<域名>` → `http://127.0.0.1:3000`(app:B 端后台 + C 端 BFF `/api/c/*`)。
   - **SSE 长连接**(`/api/sse/*`):`proxy_buffering off; proxy_read_timeout 1h;`,否则大屏/仪表盘实时断流。
   - `https://media.<域名>` → `http://127.0.0.1:9000`(MinIO S3,媒体公网读)。
   - 大屏 `/screen/*`、`/api/screen/*`:配 **IP 白名单**(PRD 大屏无登录,以网络层为主门)。
3. 证书到期自动续(certbot timer)。

---

## 8 · 小程序前端侧(配合上线)

详见 `docs/C端小程序上线清单.md`。要点:
- `miniprogram/src/api/client.ts` 的 `API_BASE` 改为 `https://<备案域名>/api/c`。
- `miniprogram/project.config.json` 提审前 `setting.urlCheck` 改回 `true`。
- 微信公众平台「服务器域名」配:request 合法域名 = 备案域名;downloadFile = `media.<域名>`。
- 提审服务类目选「旅游→景区服务」,**切勿选票务类**;审核说明强调全园免费预约、入园零支付。
- 体验版上传走 `miniprogram-ci`(见上线清单 §六)。

---

## 9 · 冒烟验证清单(上线后逐项过)

- [ ] `docker compose ps` 全部 healthy。
- [ ] 后台登录:`https://<域名>/login`,超管 13900000000 / Admin@12345 → 200 + 渲染正常(随后改密码)。
- [ ] 受保护页面(预约/核销/风控/客流/分析/IoT/系统/内容)逐个 200,无客户端异常。
- [ ] **实时**:大屏/仪表盘 LiveDot 为「已连接」,改一条预约时段 → SSE 自动刷新(自托管实时应原生可用)。
- [ ] **写链路**:新建一条预约(身份证+车牌强校验)→ 成功;核销码生成/核销通过。
- [ ] **媒体**:内容封面/视频上传 → 落 MinIO,公网 `media.<域名>` 可读。
- [ ] **Excel 导出**:任一客流/画像报表导出 .xlsx 正常(红线5)。
- [ ] **C 端 BFF**:`/api/c/*` 游客登录、预约、AI、地图通(配合小程序或 curl 自签游客 JWT)。
- [ ] 微信支付回调 `https://<域名>/api/c/payment/wechat/callback` 可达(活动报名二消)。
- [ ] 承载力熔断阈值 `PARK_INSTANT_CAPACITY` 已替换为 PRD 正式值。

---

## 10 · 安全善后

- [ ] 改掉所有默认密码:超管登录密码、`MINIO_ROOT_*`、PG/GoTrue 库密码(且各处连接串同步)。
- [ ] 安全组若临时放行过 `0.0.0.0/0:22`,收紧为运维固定 IP。
- [ ] 确认 3000/5433/9000/9001 未对公网暴露(只 127.0.0.1 + Nginx)。
- [ ] 备份:PG `pg_dump` 定时任务 + MinIO 数据卷快照。
- [ ] 监控:`docker compose logs` 接日志收集;app healthcheck 已内置。

---

## 待你拍板/提供的关键输入

1. **服务器规格**(决定 §4.4 是否要 swap / 离线构建)。
2. **备案域名**(没有则生产无法对外、微信链路不通——是硬前置)。
3. **接入方式**:运维 SSH 执行,还是你本机 `! <命令>` 回灌让助手逐步指挥。
4. **各业务密钥**(微信/支付/AI/高德)齐了吗。
</content>
</invoke>
