# 子计划 06 · 活动报名 + 微信支付（隔离，二期可选）

> 上游：[`c-miniprogram.md`](./c-miniprogram.md)。**支付链路隔离红线**：仅活动报名费二消，入园主流程零支付。

## Task Type
- [x] Backend（content.createSignup + 新 `modules/payment`）  - [x] Frontend（A8/A9，分包 `subpkg-activity`）

## 分期
- **阶段一（随主线）**：免费活动报名闭环。付费活动报名按钮先置灰"敬请期待"。
- **阶段二（可选）**：接入微信支付。

## Key Files
| File | Operation | Description |
|---|---|---|
| `app/src/modules/content/service/content.ts` | Modify | 新增 `createSignup(input)`、`markSignupPaid(signupId)` |
| `app/src/modules/content/domain/schema.ts` | Modify | `createSignupSchema`（复用身份证/手机校验） |
| `app/src/app/api/c/activities/[id]/signup/route.ts` | Create | `POST` 免费报名建单 |
| `app/prisma/models/content.prisma` | Modify | `ContentActivitySignup` 补 `wxOrderId/wxTransactionId/paidAt`（或 payment 独立表） |
| `app/src/modules/payment/**` | Create（二期） | `createWxOrder`(JSAPI)、`handleCallback`(验签+解密+幂等+金额校验) |
| `app/src/lib/wxpay/*` | Create（二期） | 微信支付 APIv3 client（mch 证书/密钥来自配置中心，不下发） |
| `app/src/app/api/c/activities/signups/[id]/pay/route.ts` | Create（二期） | `POST` JSAPI 下单（金额取 `registrationFee`） |
| `app/src/app/api/c/payment/wechat/callback/route.ts` | Create（二期） | **无游客鉴权**，靠微信签名验签 → `content.markSignupPaid` |
| `../Changqiushan-mobile/src/subpkg-activity/{list,detail}/*` | Create | A8 列表 / A9 详情 |
| `../Changqiushan-mobile/src/components/ActivityCard.tsx`、`MpHtml` | Create/复用 | 活动卡（报名费/免费 chip + 进度条）、详情富文本 |

## 红线（务必）
- `api/c/booking`（入园）**不 import** payment；payment 仅出现在 signup/pay。
- 回调写 `paymentStatus` 经 `content.markSignupPaid` 公共面，payment **不跨写** content 表（守边界）。
- 回调幂等（`wxTransactionId` 唯一约束/`ON CONFLICT DO NOTHING`）+ 金额二次校验 = `registrationFee` + 边缘 IP ACL。

## 前端要点（A8/A9）
- A8：状态 Tab（全部/报名中/即将开放/已结束）+ 类型/时间 chip 筛选；`ActivityCard` 免费用成功绿、金额用主色"元"。
- A9：沉浸式封面 + 核心信息卡进度条 + 正文 `MpHtml`(图来自 public/ 公网 URL) + 报名通道；底部"立即报名"。
- 支付（二期）：`Taro.requestPayment`；**入园主流程零支付不变**。

## Risks & Mitigation
| 风险 | 缓解 |
|---|---|
| 支付渗入入园链路 | eslint 边界 + code review：booking 不依赖 payment |
| 回调无鉴权入口 | APIv3 验签+解密+幂等+金额校验+IP ACL |
| 审核误判票务 | 入园零支付；类目景区服务/政务；付费仅活动报名费 |

## Checkpoint
| Sub-step | Done |
|---|---|
| content.createSignup + schema + 免费报名端点 | [ ] |
| A8 列表(筛选) + A9 详情(mp-html + 报名通道，付费置灰) | [ ] |
| （二期）payment 模块 JSAPI + 回调验签幂等 | [ ] |
| （二期）A9 requestPayment 接通；入园零支付回归 | [ ] |
