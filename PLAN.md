# 长秋山 · 计划索引

> 每份实施计划放 `docs/plan/<slug>.md`，本文件登记一行。**新增计划必须同轮登记此表**，
> 否则不得进入评审、也不得标「可开工 / 冻结 / 完成」。计划状态变更同步回填此表。
>
> 状态：`📝 起草` · `🔍 评审中` · `⏳ 待人工审批` · `🚧 执行中` · `🛠️ fix`（实现方自检通过）
> · `✅ pass`（**仅独立验收方**真机验收通过后可标）
>
> 相关索引：需求与决策 `docs/PRD.md` · 问题 `ISSUES.md` · 长期遗留事项 `docs/待办清单.md`

## 当前计划（`docs/plan/`）

| 计划 | 标题 | 状态 | 备注 |
|---|---|---|---|
| [b-104](docs/plan/b-104-超宽融合指挥总屏实施计划.md) | 超宽融合指挥总屏（3840×1080 · `/screen/command`） | 🛠️ fix | 定稿 5 列版已随 b-105 合入 `main`；换版后 N13/N15 待真机复验 |
| [b-104b](docs/plan/b-104b-融合大屏-剩余执行清单.md) | 融合大屏 · 剩余执行清单（b-104 未做部分） | 📝 起草 | 随 b-105 合并进入 `main`，本轮补登记；执行另开任务 |
| [b-105](docs/plan/b-105-单主干合并与收口.md) | `deploy-demo` 全量合回 `main` 与单主干收口 | 🛠️ fix | 承接 ISSUES 的 N06 人工裁决（单主干）；含 N08、CI 触发分支、分支退役。T6.4 删 `deploy-demo` 分支⏸ 待人工确认 worktree 占用 |

## 历史计划（暂存 `.claude/plan/`，⏳ 待迁移 `docs/plan/`）

> ⚠️ 以下 20 份计划放在 `.claude/plan/`，不符合「工程文档统一放 `docs/`」的规范。
> 迁移（`git mv` + 全仓更新引用，`docs/待办清单.md` 等处仍引着旧路径）**另开任务**，
> 不并入 b-105——分支集成本身已有冲突面，不宜再叠加 20 个文件的搬迁。

| 计划 | 说明 |
|---|---|
| `.claude/plan/b-00-执行汇总.md` | B 端总执行汇总 |
| `.claude/plan/b端后台分模块实施.md` | B 端分模块实施 |
| `.claude/plan/b-98-POC问题修复计划.md` | POC 问题修复 |
| `.claude/plan/b-99-收尾计划.md` | B 端收尾 |
| `.claude/plan/b-100-待办清单执行计划.md` | 待办清单执行（含安全审计） |
| `.claude/plan/b-101-内容编辑文档化改造方案.md` | 内容编辑文档化改造 |
| `.claude/plan/b-102-待办执行计划.md` | 待办执行 |
| `.claude/plan/b-103-待办执行计划.md` | 待办执行 |
| `.claude/plan/screen-数字大屏执行计划.md` | 数字大屏 C1–C7（`docs/待办清单.md` §五 引用此文件） |
| `.claude/plan/b-deploy-vercel-supabase.md` | Vercel + Supabase 部署路线 |
| `.claude/plan/c-00-执行汇总.md` | C 端小程序总执行汇总 |
| `.claude/plan/c-miniprogram.md` | C 端小程序总体方案 |
| `.claude/plan/c-01-backend-bff.md` | C 端 BFF |
| `.claude/plan/c-02-wechat-auth.md` | 微信登录 |
| `.claude/plan/c-03-checkin-otp.md` | 核销 OTP |
| `.claude/plan/c-04-frontend-foundation.md` | C 端前端地基 |
| `.claude/plan/c-05-ai-chat.md` | C 端 AI 问答 |
| `.claude/plan/c-06-activity-payment.md` | 活动报名与支付 |
| `.claude/plan/c-07-guide-map.md` | 导览地图 |
| `.claude/plan/c-99-评审发现.md` | C 端评审发现 |
