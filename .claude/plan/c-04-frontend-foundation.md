# 子计划 04 · Taro 小程序工程地基 + 预约/内容/我的页

> 上游：[`c-miniprogram.md`](./c-miniprogram.md)。落 `../Changqiushan-mobile`（worktree，`mobile` 分支，独立 pnpm 工程）。

## Task Type
- [x] Frontend

## 范围
Taro 4.x（React+TS）脚手架 + 设计令牌 + API 层 + 状态管理 + 共享组件，并实现非流式/非地图页：A2 首页、A3 预约日历、A4 双要素填写、A6 我的预约、A11 个人中心 + A1 入口（登录详见 [`c-02`](./c-02-wechat-auth.md)，核销码 A5 详见 [`c-03`](./c-03-checkin-otp.md)）。

## 工程结构
```
Changqiushan-mobile/
├── project.config.json / project.private.config.json(gitignore) / app.config.ts
├── tsconfig.json(strict, paths @/* @shared/*) / config/{index,dev,prod}.ts
├── shared-schema/booking.ts            # ★ 同源 zod（与 app/.../booking/domain/schema.ts 哈希一致）
├── src/
│   ├── app.{tsx,scss,config.ts}        # Provider(store/theme/query) + tokens + pages/subPackages/tabBar
│   ├── pages/{login,home,booking-calendar,booking-form,booking-success,my-bookings,profile}
│   ├── components/{VerifyCodeCard,StatusBadge,SlotCard,ActivityCard,MpHtml,EmptyState,NoticeCard,CountdownPill,CalendarMonth}
│   ├── api/{client,booking,activity,ai,map,auth,realtime}.ts
│   ├── store/{authStore,bookingDraftStore,themeStore}.ts   # zustand
│   ├── hooks/{useCountdown,useVerifyCode,usePolling}.ts
│   ├── styles/{tokens.scss,mixins.scss}
│   └── utils/{date,format}.ts          # 2026年6月15日 格式化、禁词
└── assets/                             # tabBar 图标（业务图走 public/ 公网 URL）
```

## 设计令牌（tokens.scss，同源 B 端，不像素克隆）
- 主色 `#2D5A27` / 深绿 `#1F3F1A` / 橙 `#D97706` / 红 `#DC2626` / 绿 `#059669` / 灰 `#9CA3AF` / 提示卡 `#FFFBEB`。
- 圆角 16；**字号锁 px 最小 12px**（不用 rpx 缩字）；行高 1.6；西文优先中文字体栈。
- 双主题：`page` 挂 `data-theme` + `Taro.getSystemInfo().theme`/`onThemeChange`，store 存手动覆盖。
- B 端桌面构件（侧边栏/Topbar/1440 画布）不移植，共识仅在 token 层。

## API 层（client.ts）
- 请求拦截注入 `Authorization: Bearer`（authStore）；统一 baseURL/超时。
- 响应→判别联合 `{ok:true,data}|{ok:false,code,message}`；401 静默重登（重走 `Taro.login`）。
- 提交前端内校验：`createBookingSchema.safeParse(form)`（同源 shared-schema），zod 中文报错映射字段。

## 页面要点
| 页 | 路由 | Tab | 关键 |
|---|---|---|---|
| A2 首页 | `pages/home` | ✅ | 轮播/5 快捷入口/景区掠影 2×2/今日活动横滑；数据 `GET /api/c/intro|activities` |
| A3 预约日历 | `pages/booking-calendar` | | `CalendarMonth`(节假日角标/满约置灰/禁过去) + `SlotCard`(实时剩余) + `usePolling(slots,5s)` |
| A4 信息填写 | `pages/booking-form` | | 双要素表单(车牌/无车互斥)、入园人数 ±、5min 占位倒计时(以 `holdExpiresAt` 服务端时间为准, `useDidShow` 重算) |
| A6 我的预约 | `pages/my-bookings` | ✅ | 状态 Tab(全部/待履约/已核销/已取消/已爽约) + 取消(≥2h) |
| A11 个人中心 | `pages/profile` | ✅ | 用户卡 + 统计(`me/stats`) + 实名认证入口 + 申诉入口(`POST /api/c/appeals`) + 设置 |

## TabBar / 分包
- **TabBar 4 项**：首页(A2)·预约(进 A3)·我的预约(A6)·我的(A11)。
- AI/活动/地图作首页快捷入口进**分包**（见 c-05/06/07）+ `preloadRule` 预下载。

## Risks & Mitigation
| 风险 | 缓解 |
|---|---|
| 字号 rpx 缩到不可读 | 字号一律 px 锁最小 12px |
| 占位倒计时切后台漂移 | 以服务端 `holdExpiresAt` 算 remaining，`useDidShow` 重算 |
| 双要素 schema 跨端漂移 | 单一源 `shared-schema/booking.ts`，CI 校验哈希；zod `^4.4.3` + TS strict 对齐 |
| 包体积 | 主包仅高频页；图片不进包；tree-shake |

## Checkpoint
| Sub-step | Done |
|---|---|
| 脚手架 + tokens + app.config + client + zustand | [ ] |
| shared-schema/booking.ts + CI 哈希校验 | [ ] |
| 共享组件 (StatusBadge/SlotCard/CalendarMonth/NoticeCard/EmptyState/CountdownPill) | [ ] |
| A3 日历+时段+轮询 → A4 双要素+占位倒计时 | [ ] |
| A6 列表/取消 + A2 首页 + A11 个人中心+申诉 | [ ] |
| `taro build --type weapp` 真机验 | [ ] |
