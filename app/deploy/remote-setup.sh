#!/usr/bin/env bash
# =============================================================================
# 长秋山 · 演示服务器全自动部署(服务器端幂等脚本)
# 由 GitHub Actions(.github/workflows/deploy-demo-server.yml)rsync 代码后经 SSH 调用,
# 也可运维手动执行:  sudo PUBLIC_HOST=<公网IP> bash /opt/changqiushan/app/deploy/remote-setup.sh
#
# 幂等:可反复跑。.env 已存在则保留(不轮换密钥踢登录);示例数据只灌一次(marker 守卫);
# migrate 每次都跑(只应用新增迁移);seed-admin 每次都跑(自身幂等,保证超管存在)。
# 设计依据:demo 走 IP+http(COOKIE_SECURE=false);登录浏览器只碰 app,GoTrue 走容器内网,无需域名。
# =============================================================================
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/changqiushan/app}"
PUBLIC_HOST="${PUBLIC_HOST:?需传入 PUBLIC_HOST(服务器公网 IP 或域名)}"
APP_PORT="${APP_PORT:-3000}"
PROJECT="changqiushan"          # compose -p,固定网络名=changqiushan_default
SEED_MARKER="/opt/changqiushan/.seeded"
NETWORK="${PROJECT}_default"
# 数据库连接(容器内网名);与 docker-compose.yml 内 postgres 默认口令对齐
DB_URL="postgresql://changqiushan:changqiushan_dev@postgres:5432/changqiushan?schema=public"

cd "$APP_DIR"
log(){ printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }
die(){ printf '\n\033[1;31m!! %s\033[0m\n' "$*" >&2; exit 1; }

# ---------------------------------------------------------------------------
# 1) 基础软件:docker / git / curl / openssl
# ---------------------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
  log "安装 Docker"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
fi
docker compose version >/dev/null 2>&1 || die "缺 docker compose v2 插件(请升级 Docker)"
command -v openssl >/dev/null 2>&1 || die "缺 openssl(生成密钥用)"

# ---------------------------------------------------------------------------
# 2) 时区 + 低内存 swap(next build 极吃内存,<4G 必须兜底,否则 OOM 假死)
# ---------------------------------------------------------------------------
timedatectl set-timezone Asia/Shanghai 2>/dev/null || true
mem_kb="$(awk '/MemTotal/{print $2}' /proc/meminfo)"
if [ "${mem_kb:-0}" -lt 4000000 ] && ! swapon --show 2>/dev/null | grep -q .; then
  log "内存 < 4G,创建 4G swap 防 build OOM"
  fallocate -l 4G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# ---------------------------------------------------------------------------
# 3) 启用 IPv6(compose 的 networks 段需要;否则建网络即失败、整栈起不来)
# ---------------------------------------------------------------------------
sysctl -w net.ipv6.conf.all.disable_ipv6=0     >/dev/null 2>&1 || true
sysctl -w net.ipv6.conf.default.disable_ipv6=0 >/dev/null 2>&1 || true

# ---------------------------------------------------------------------------
# 4) 生成 .env(幂等:已存在则保留)。GOTRUE_DB_PASSWORD 必须 = auth-bootstrap.sql 的 auth_dev_pwd
# ---------------------------------------------------------------------------
if [ ! -f .env ]; then
  log "生成 .env(随机密钥;PUBLIC_HOST=$PUBLIC_HOST)"
  cat > .env <<EOF
# 自动生成 by remote-setup.sh — 演示服务器。勿提交。改后重跑会保留本文件。
DATABASE_URL="${DB_URL}"
# —— 认证 GoTrue(app 与 gotrue 共用同一 JWT 密钥)——
GOTRUE_DB_PASSWORD="auth_dev_pwd"
GOTRUE_JWT_SECRET="$(openssl rand -hex 32)"
GOTRUE_JWT_EXP=604800
COOKIE_SECURE=false
# —— C 端游客鉴权(与 GoTrue 密钥不同)——
VISITOR_JWT_SECRET="$(openssl rand -hex 32)"
# —— 媒体 S3(本机 MinIO;浏览器经公网 IP:9000 取图)——
MINIO_ROOT_USER="changqiushan"
MINIO_ROOT_PASSWORD="$(openssl rand -hex 16)"
S3_ENDPOINT="http://minio:9000"
S3_PUBLIC_ENDPOINT="http://${PUBLIC_HOST}:9000"
S3_BUCKET="changqiushan-media"
S3_FORCE_PATH_STYLE="true"
# —— 红线4 承载力(占位,待 PRD 正式值)——
PARK_INSTANT_CAPACITY=5000
# —— 可选业务密钥(由 CI secrets 注入;留空则对应功能不可用,主栈照常起)——
AMAP_KEY="${AMAP_KEY:-}"
NEXT_PUBLIC_AMAP_KEY="${NEXT_PUBLIC_AMAP_KEY:-}"
NEXT_PUBLIC_AMAP_SECURITY="${NEXT_PUBLIC_AMAP_SECURITY:-}"
WECHAT_APPID="${WECHAT_APPID:-}"
WECHAT_SECRET="${WECHAT_SECRET:-}"
AI_BASE_URL="${AI_BASE_URL:-}"
AI_MODEL="${AI_MODEL:-}"
AI_API_KEY="${AI_API_KEY:-}"
EOF
else
  log ".env 已存在 — 保留(不轮换密钥)"
fi
JWT_SECRET="$(grep '^GOTRUE_JWT_SECRET=' .env | cut -d'"' -f2)"
[ -n "$JWT_SECRET" ] || die ".env 缺 GOTRUE_JWT_SECRET"

# ---------------------------------------------------------------------------
# 5) 构建镜像。runner 镜像跑 app;build 阶段镜像(含 src/tsconfig/prisma.config.ts)
#    专供 migrate/seed(runner 不含 src,tsx @/ 别名解析不了)。多阶段缓存共享,tools 近乎免费。
# ---------------------------------------------------------------------------
log "构建 app 镜像(next build,较慢)"
docker compose -p "$PROJECT" build app
log "标记 build 阶段为 tools 镜像(供 migrate/seed)"
docker build --target build -t changqiushan-tools .

# ---------------------------------------------------------------------------
# 6) 起底座(不含 app):postgres / gotrue / minio
# ---------------------------------------------------------------------------
log "启动底座 postgres/gotrue/minio"
docker compose -p "$PROJECT" up -d postgres gotrue minio minio-init

log "等 Postgres healthy"
for i in $(seq 1 60); do
  docker exec changqiushan-postgres pg_isready -U changqiushan -d changqiushan >/dev/null 2>&1 && break
  sleep 2; [ "$i" = 60 ] && die "Postgres 起不来"
done

# ---------------------------------------------------------------------------
# 7) GoTrue 引导 SQL(建 auth schema/角色,幂等)→ 等 GoTrue 迁出 auth.users
#    (Prisma 的 auth_user_view 迁移依赖 auth.users 存在)
# ---------------------------------------------------------------------------
log "GoTrue 引导 SQL"
docker exec -i changqiushan-postgres psql -U changqiushan -d changqiushan < docker/auth-bootstrap.sql
log "等 GoTrue 自动迁出 auth.users"
for i in $(seq 1 60); do
  [ "$(docker exec changqiushan-postgres psql -U changqiushan -d changqiushan -tAc "select to_regclass('auth.users') is not null" 2>/dev/null)" = "t" ] && break
  sleep 2; [ "$i" = 60 ] && die "GoTrue 未能迁出 auth.users(查 docker logs changqiushan-gotrue)"
done

# ---------------------------------------------------------------------------
# 8) Prisma 业务迁移(migrate deploy,不用 migrate dev)+ 首次灌示例数据 + 引导超管
#    全部经 tools 镜像、挂 compose 网络执行
# ---------------------------------------------------------------------------
run_tool(){ docker run --rm --network "$NETWORK" -e DATABASE_URL="$DB_URL" "$@"; }

log "Prisma migrate deploy"
run_tool changqiushan-tools node_modules/.bin/prisma migrate deploy

if [ ! -f "$SEED_MARKER" ]; then
  log "首次部署 — 灌示例数据(seed.ts)"
  run_tool changqiushan-tools node_modules/.bin/tsx prisma/seed.ts
  touch "$SEED_MARKER"
else
  log "示例数据已灌过 — 跳过(删除 $SEED_MARKER 可重灌)"
fi

log "引导/确保超管账号(seed-admin.ts,幂等)"
docker run --rm --network "$NETWORK" \
  -e DATABASE_URL="$DB_URL" \
  -e GOTRUE_URL="http://gotrue:9999" \
  -e GOTRUE_JWT_SECRET="$JWT_SECRET" \
  changqiushan-tools node_modules/.bin/tsx scripts/seed-admin.ts

# ---------------------------------------------------------------------------
# 9) 起/更新 app + 冒烟
# ---------------------------------------------------------------------------
log "启动 app"
docker compose -p "$PROJECT" up -d app

log "等 app 健康"
ok=""
for i in $(seq 1 40); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/login" 2>/dev/null || true)"
  [ "$code" = "200" ] && { ok=1; break; }
  sleep 3
done

docker compose -p "$PROJECT" ps
if [ -n "$ok" ]; then
  printf '\n\033[1;32m========================================================\n'
  printf '✅ 部署成功\n'
  printf '   后台:  http://%s:%s/login\n' "$PUBLIC_HOST" "$APP_PORT"
  printf '   大屏:  http://%s:%s/screen\n' "$PUBLIC_HOST" "$APP_PORT"
  printf '   超管:  手机号 13900000000 / 密码 Admin@12345 (登录后请改密)\n'
  printf '   媒体:  http://%s:9000 (需安全组放行 9000 才能看图)\n' "$PUBLIC_HOST"
  printf '========================================================\033[0m\n'
else
  die "app 未在预期时间内返回 200,查 docker logs changqiushan-app"
fi
