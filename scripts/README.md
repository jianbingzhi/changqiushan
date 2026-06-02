# 自动化脚本

控制 Stitch AI 完成 UI 设计交付的核心脚本。所有脚本都通过 CDP 操作真实 Chrome 浏览器,不使用 headless。

> **本目录是自包含 npm 工程**(`package.json` + `node_modules`,依赖 `ws` + `cheerio`)。
> 首次使用:`cd scripts && npm install`。
> 脚本仍从**仓库根目录**调用(cwd=根),命令里的 `prompts/`、`UI/`、`logs/` 等相对路径以根为基准;npm 依赖经 `scripts/node_modules` 解析。

## 核心库

| 文件 | 用途 |
|------|------|
| `lib.js` | CDP 基础函数:`getCompanionId` / `getMainPageId` / `rpc` / `sendPrompt` / `sleep` |
| `session.js` | 节点快照 + JSONL 日志(`logs/session-YYYY-MM-DD.jsonl`) |

## 端到端流水线

### 单页生成

```bash
node scripts/run-page.js <pageId> <label> <promptFile> <outPng>
# 例:
node scripts/run-page.js A1 "登录授权页" prompts/A1-login.txt UI/01_C端小程序/登录授权页.png
```

内部步骤:
1. 快照当前节点数(检测 fork)
2. 发送 prompt(最多 3 次重试)
3. 等待节点签名稳定(`wait-stable.js`)
4. 定位新生成的页面节点(`find-page.js`)
5. 截图(`verify.js#captureNode`)
6. 三点验证(中文 / 红线词 / 视觉)
7. 记录日志

### 高分辨率截图

```bash
node scripts/zoom-shot.js <data-id> <out.png>      # 通用 fit-to-pane
node scripts/zoom-tall.js <data-id> <out.png>      # 高节点(>2000px)用,顶端对齐避开 Stitch overlay
node scripts/zoom-batch.js <list.json>             # 批量
```

原理:覆写 react-flow viewport CSS transform 把节点居中放大,主页面 captureScreenshot 加 clip 取出。对内容多的页面需要强制 reload iframe srcdoc。

### Stitch 原生导出

```bash
node scripts/download-batch.js
```

通过钩 `URL.createObjectURL` 截获 Stitch 生成的 zip blob,base64 传过 CDP WebSocket,纯 JS zlib 解压取 PNG。对 FIFE 缓存失效的页面会回退到 zoom-shot。

### 提示词发送

```bash
node scripts/send-prompt.js <promptFile>
```

通过 ProseMirror 接口注入文本,模拟点击发送按钮。

### 画布整理

```bash
node scripts/sort-canvas.js                # 按 大屏/后台/C端 分行,功能分组
node scripts/reorg-cold.js                 # 整理冷宫(fork+asset 分类)
```

依赖 `file-map.json`(从交付文件倒推 dataId)和 `node-classification.json`(分类元数据)。

## CDP 关键发现

| 发现 | 影响 |
|------|------|
| Stitch 的每个设计页是 `srcdoc` iframe,且每个 iframe 都是独立 CDP target | 验证文字内容必须连接到 iframe target,不能从父页面读 contentDocument |
| react-flow 用 zustand store,可通过 fiber 找 `onNodesChange` callback | 直接 dispatch `{type:'position', position}` 可批量移动节点 |
| Stitch 修改 prompt 经常分叉出新节点,不就地编辑 | 必须对比 before/after 节点列表识别 fork |
| Stitch chat overlay 占底部 ~200px,会遮住放大后的节点底部 | `zoom-tall.js` 用顶端对齐而非垂直居中 |
| 大节点(>2000px 高)react-flow 会丢 paint layer | 截图前强制重设 iframe srcdoc 触发重绘 |

## 环境变量

- `CDP_HOST` — 默认 `localhost:9222`,跨机用 WireGuard 隧道时设 `10.7.0.2:9222`

## 状态文件

- `file-map.json` — 交付文件 → dataId 映射表(给排序脚本用)
- `node-classification.json` — 节点分类(A/B/C/fork/asset)
