# 长秋山森林公园智慧景区 · UI 设计交付

通过 Claude Code + Chrome DevTools Protocol 驱动 Stitch AI,从 PRD 文档自动化生成 39 个页面的完整 UI 设计稿。

## 交付物

- **38+ 张 UI 截图** 按模块归档于 `UI/`
  - `01_C端小程序/` — 11 页(登录/首页/预约流程/AI 问答/活动/导览/我的)
  - `02_后台管理/` — 21 页(系统/内容/预约/数据分析/用户画像/物联网)
  - `03_数据大屏/` — 7 页(数字大屏/综合运营/趋势对比/数字孪生/宣传)
- 每张截图配套 `DESIGN.md` 设计说明(色彩/字体/布局/组件)
- PRD 原文位于 `docs/PRD.md`

## 三大红线

1. **免费景区** — 严禁出现"门票/票价/购票/退款",仅"预约/名额/核销"
2. **100% 中文** — 不接受 Lorem Ipsum 或孤立英文
3. **强校验** — 入园需身份证 + 车牌(若启用车辆)

## 项目流程

```
PRD → 拆页 → 写提示词 → 驱动 Stitch 设计 → 三点验证 → 截图 → 归档
                              ↑
                  (中文校验 / 红线词检查 / 视觉差异)
```

详细脚本说明见 `scripts/README.md`。

## 环境要求

- Node.js 18+
- Chrome 启动参数 `--remote-debugging-port=9222`
- 通过 CDP 远程控制(默认 `localhost:9222`,可用 `CDP_HOST` 环境变量覆盖)
- `cd scripts && npm install` 安装 ws + cheerio(工具链已收进 scripts/,自包含 npm 工程)

## 目录结构

```
.
├── docs/
│   └── PRD.md                  # 需求规格说明书
├── prompts/                    # 每页 Stitch 提示词(40+ 文件)
├── scripts/                    # Stitch 工具链(自包含 npm:含 package.json + node_modules)
│   ├── *.js                    # CDP 控制 + 验证 + 截图脚本
│   └── package.json            # ws + cheerio
├── UI/                         # 交付截图 + DESIGN.md
└── app/                        # B 端管理后台(Next.js,独立 pnpm 工程)
```

## 已知约束

- Stitch 在收到修改提示词时**有概率分叉出新页面**(非就地编辑)。脚本通过对比 prompt 前后节点数检测 fork,并保留最新版本。
- Stitch CDN 对修改过的页面可能无 FIFE 缓存,导致 Export → zip 链路失败。回退方案:`zoom-shot.js` 通过 react-flow viewport transform 重新截图。
- 各设计页是独立 sandboxed `srcdoc` iframe,每个 iframe 有独立 CDP target(targetId === frameId),不能用 contentDocument 跨域读取。
