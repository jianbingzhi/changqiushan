# 演示服务器全自动部署

**推送 `deploy-demo` 分支 → GitHub Actions 自动部署到演示服务器**(自托管 Docker 全栈,IP 直连,demo 级)。

```
git push origin deploy-demo        # 触发部署(双推则同时 push jianbingzhi,但只在配了 secrets 的库真部署)
```

完成后访问:
- 后台 `http://<服务器IP>:3000/login` — 超管 `13900000000` / `Admin@12345`(登录后改密)
- 大屏 `http://<服务器IP>:3000/screen`
- 媒体 `http://<服务器IP>:9000`(需安全组放行 9000)

## 组成

| 文件 | 作用 |
|---|---|
| `.github/workflows/deploy-demo-server.yml` | runner checkout → tar 经 SSH 推代码 → 调 remote-setup.sh |
| `app/deploy/remote-setup.sh` | 服务器端幂等脚本:装 Docker→生成 .env→build→分阶段起栈→migrate/seed→起 app→冒烟 |

## 一次性配置:GitHub Secrets

repo → Settings → Secrets and variables → Actions:

| Secret | 必填 | 示例/说明 |
|---|---|---|
| `DEMO_SSH_HOST` | ✅ | `8.137.184.228` |
| `DEMO_SSH_USER` | ✅ | `root` |
| `DEMO_SSH_PASSWORD` | ✅ | SSH 密码(建议尽快换 SSH key,见下) |
| `DEMO_PUBLIC_HOST` | | 浏览器访问用的 IP/域名,默认=`DEMO_SSH_HOST` |
| `AMAP_KEY` / `NEXT_PUBLIC_AMAP_KEY` / `NEXT_PUBLIC_AMAP_SECURITY` | | 高德 key,不配=地图「未配置」诚实态 |
| `WECHAT_APPID` / `WECHAT_SECRET` | | 小程序登录;不配=C 端登录不可用 |
| `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY` | | AI 问答;不配=AI 不可用 |

> 可选密钥**首次部署写入服务器 `.env` 后即固化**;改值要先 `rm /opt/changqiushan/app/.env` 再重跑(会轮换全部随机密钥)。

## ⚠️ 阿里云安全组前置(否则 Actions 连不上)

- `22/tcp`:GitHub runner 出口 IP 不固定 → demo 阶段需对 `0.0.0.0/0` 开放(用密码登录有风险,见下「加固」)。
- `3000/tcp`:后台 + C 端 BFF。
- `9000/tcp`:媒体(MinIO),不开则图片加载不出,其余功能正常。

## 幂等与升级

- 反复推 `deploy-demo` 可安全重跑:`.env` 保留(不轮换密钥)、示例数据只灌一次(`/opt/changqiushan/.seeded` 守卫)、`migrate deploy` 每次只应用新增迁移、超管账号每次确保存在。
- 想重置示例数据:删 `/opt/changqiushan/.seeded` 再部署。
- 想整库重置:`cd /opt/changqiushan/app && docker compose -p changqiushan down -v`(⚠️ 删数据卷)再部署。

## 手动部署(不走 CI)

```bash
# 本地把 app/ 传到服务器(任选 scp/rsync/tar),然后:
ssh root@<IP> "sudo PUBLIC_HOST=<IP> bash /opt/changqiushan/app/deploy/remote-setup.sh"
```

## 安全加固(demo 跑通后建议)

1. 换 SSH key:服务器 `~/.ssh/authorized_keys` 加公钥,私钥存 `DEMO_SSH_KEY` secret;workflow 把 sshpass 改为 key(`echo "$KEY" > id && ssh -i id`)。
2. 安全组 22 限源为 GitHub Actions IP 段或跳板机。
3. 改默认口令:超管登录密码、PG/MinIO 口令(改 `.env` + compose 后 `down && up`)。

## 与 Vercel 工作流的关系

`ci-deploy.yml` 看 `main`(Vercel+Supabase 海外演示);本工作流看 `deploy-demo`(自托管)。两者独立,互不触发。最终生产仍应走「阿里云 ECS + 备案域名 + RDS/OSS」,见 `docs/部署-阿里云ECS自托管.md`。
