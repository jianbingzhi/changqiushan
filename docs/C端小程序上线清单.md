# 长秋山 C 端小程序 · 上线准备清单（S7）

> 配合编排表 `.claude/plan/c-00-执行汇总.md` 第 9 行。上线前逐项核对。

## 一、域名与网络白名单（真机必需）
真机不同于开发者工具，未配白名单的请求会全部失败。上线前在 **微信公众平台 → 开发管理 → 开发设置 → 服务器域名** 配置：

| 类型 | 域名 | 用途 |
|---|---|---|
| request 合法域名 | `https://<已ICP备案域名>` | BFF `/api/c/*`、AI `enableChunked` 流式 |
| uploadFile（如启用直传） | MinIO/COS/OSS 公网域名 | 媒体上传（当前 C 端无直传，可暂略） |
| downloadFile | 同上 | 富文本/封面图加载 |

- 所有 BFF 域名必须先完成 **ICP 备案**。
- `src/api/client.ts` 的 `API_BASE` 上线改为备案域名（当前联调指向 `http://localhost:3000/api/c`）。
- 微信支付回调 `WXPAY_NOTIFY_URL` 必须是备案 https 域名。

## 二、urlCheck（提审前开启）
`project.config.json` 当前 `setting.urlCheck = false`（仅联调期，便于开发者工具调本地 BFF）。
**提审前务必改回 `true`**，并用真机全链路回归（登录→预约→核销码→活动→AI→地图）确认无越权域名。

## 三、中文/红线 CI 扫描
- `pnpm lint:cn`（`scripts/lint-cn.mjs`）：扫描 `src` 全部 `.tsx`，命中 门票/票价/购票/退款/售票/票务/Lorem/ISO 日期 即失败。
- 接入 CI：在 PR 流水线加 `pnpm lint:cn && pnpm build:weapp`。
- 当前状态：✔ 无红线违规。

## 四、分包与体积治理
- 主包：A1–A6/A11 高频页（登录/首页/预约/我的）。
- 分包：`subpkg-activity`（A8/A9）、`subpkg-ai`（A7）、`subpkg-map`（A10）。
- `app.config.ts` 已配 `preloadRule`：首页预下载 `subpkg-activity`。
- 业务图片走 public/ 公网 URL，不进包。

## 五、提审材料（类目与资质）
- 服务类目：建议「旅游 → 景区服务」或「政务民生」，**切勿选票务类**（本园免费预约入园）。
- 资质：景区/运营主体营业执照 + 相关授权。
- 审核说明强调：**全园免费预约入园，不收取门票/任何入园费用**；微信支付仅用于**活动报名费**等二消，入园主流程零支付。
- `scope.userLocation`：已在 `app.config.ts` 配 `permission` 用途说明（园区导览定位）。

## 六、体验版上传
- `pnpm add -D miniprogram-ci`（首次）。
- 从公众平台「开发设置」下载上传密钥（gitignore，勿入库）。
- `pnpm build:weapp && WX_APPID=<appid> WX_PRIVATE_KEY_PATH=./private.<appid>.key pnpm upload <版本号> "<描述>"`。

## 七、服务端环境变量（上线核对，均走集成配置中心/密钥管理，绝不下发前端）
见 `app/.env.example`：
- `VISITOR_JWT_SECRET`（与 GoTrue 密钥不同）
- `WECHAT_APPID` / `WECHAT_SECRET`
- `AI_BASE_URL` / `AI_MODEL` / `AI_API_KEY`
- `WXPAY_MCH_ID` / `WXPAY_SERIAL_NO` / `WXPAY_PRIVATE_KEY` / `WXPAY_API_V3_KEY` / `WXPAY_PLATFORM_PUBLIC_KEY` / `WXPAY_NOTIFY_URL`（+ 可选 `WXPAY_CALLBACK_IPS`）

## 八、数据库迁移（上线/联调前）
`cd app && pnpm db:migrate` 应用本期新增迁移：
- `wechat_visitor`（游客身份）
- `booking_qr_secret`（动态核销码）
- `ai_chat`（AI 会话/消息）
- `content_poi`（导览 POI）
- `signup_wxpay`（活动报名支付字段）

按 CLAUDE.md 打包/迁移纪律执行（先停 dev/docker 再操作）。
