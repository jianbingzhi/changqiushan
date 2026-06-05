# 子计划 02 · 微信登录与游客鉴权

> 上游：[`c-miniprogram.md`](./c-miniprogram.md)。被 [`c-01-backend-bff.md`](./c-01-backend-bff.md) 等所有需鉴权端点依赖，**优先实施**。

## Task Type
- [x] Backend  - [x] Frontend（A1 登录授权页）

## 范围
新增 `modules/wechat` 处理 `wx.login` code → `code2session` → openid → upsert 游客 → 签发**自签游客 JWT**（独立密钥，与 admin GoTrue 隔离）。游客身份与预约经**绑定 idCard/phone** 关联，Booking 不加 FK。

## 流程
```
小程序 Taro.login → code → POST /api/c/auth/wechat-login {code}
  → wechatAuthService: jscode2session(AppID/Secret 来自集成配置中心, 不下发)
  → 得 openid(+unionid, session_key 仅服务端短时用于解密手机号)
  → upsert wechat_visitor → 签发 JWT{ sub:visitorId, openid } (VISITOR_JWT_SECRET)
  → 回 token；小程序存储, 后续 Authorization: Bearer
```

## Key Files
| File | Operation | Description |
|---|---|---|
| `app/prisma/models/wechat.prisma` | Create | `WechatVisitor`(openid 唯一/unionid/nickname/boundIdCard/phone/时间戳) |
| `app/src/modules/wechat/index.ts` | Create | 导出 `wechatAuthService` |
| `app/src/modules/wechat/service/auth.ts` | Create | `loginByCode(code)`、`bindIdentity(visitorId,{idCard,phone})` |
| `app/src/modules/wechat/repository.ts` | Create | 仅此处碰 `wechat_visitor` 表 |
| `app/src/modules/wechat/domain/{schema,rules}.ts` | Create | code 入参 schema、token 签发/校验规则 |
| `app/src/infrastructure/auth/visitor-session.ts` | Create | `getVisitorSession(req)`（对称 `session.ts`，校验游客 JWT） |
| `app/src/app/api/c/_lib/requireVisitor.ts` | Create | 包 `getVisitorSession`，401 时统一返回 |
| `app/src/app/api/c/auth/wechat-login/route.ts` | Create | `POST {code}` → 签发 token |
| `app/src/app/api/c/auth/bind/route.ts` | Create | `POST` 绑定实名（首次预约/`getPhoneNumber`） |
| `app/.env.example` | Modify | 增 `VISITOR_JWT_SECRET`、微信 AppID/Secret 占位（实际走配置中心） |
| `../Changqiushan-mobile/src/pages/login/*` | Create | A1 登录授权页 |
| `../Changqiushan-mobile/src/api/auth.ts`、`store/authStore.ts` | Create | 登录/静默重登/token 存储 |

## 伪码
```ts
// service/auth.ts
async loginByCode(code) {
  const { appId, secret } = await integrationConfig.wechat()      // 服务端读, 不下发
  const r = await fetch(`https://api.weixin.qq.com/sns/jscode2session?appid=${appId}&secret=${secret}&js_code=${code}&grant_type=authorization_code`)
  const { openid, unionid, session_key } = await r.json()         // session_key 不落库
  const visitor = await wechatRepository.upsertByOpenid({ openid, unionid })
  return signVisitorJwt({ sub: visitor.id, openid })              // jose HS256, VISITOR_JWT_SECRET
}
```
```ts
// visitor-session.ts
getVisitorSession(req) => verify(bearer, VISITOR_JWT_SECRET) → { visitorId, openid, boundIdCard }
```

## 决策依据
- **自签 JWT** 而非塞 GoTrue：游客无密码无 admin 角色；`jose` 已是 `session.ts` 现成依赖；游客/管理员体系彻底隔离。
- **不加 Booking FK**：保留"身份证为预约唯一主体"红线语义；`listBookings`/`isBlacklistedByIdCard` 均以 idCard 为主体复用。

## Risks & Mitigation
| 风险 | 缓解 |
|---|---|
| AppSecret 泄漏 | 仅服务端集成配置中心读取，绝不下发 |
| code 过期/并发 | 401 静默重登（重走 Taro.login）；session 7 天（对齐 B 端联调） |
| 伪造 admin | 游客 JWT 用独立密钥 `VISITOR_JWT_SECRET`，issuer 区分 |

## Checkpoint
| Sub-step | Done |
|---|---|
| wechat.prisma + migrate | [ ] |
| wechat 模块 service/repo/index + visitor-session + requireVisitor | [ ] |
| `POST /api/c/auth/wechat-login` + bind | [ ] |
| A1 页面 wx.login 打通 + token 存储 | [ ] |
| `pnpm lint` + `tsc --noEmit` | [ ] |
