# 长秋山后台管理 UI v3 — 修正状态(2026-05-27)

> Stitch 在 prompt 去重 / 排队上限制较多,batch fix 第二轮多数页面被忽略。
> 本目录是当前可交付状态截图;已完成 5 张完整修正,7 张部分修正,9 张原样。

## 路径

- 当前最终截图:`UI_final_v3/02_后台管理/B01..B21_*.png`
- 修正前的基线对照:`UI_baseline_v2/02_后台管理/B01..B21_*.png`
- 设计规范源文件:`prompts/B-design-system.md`

## 每页修正状态

| 编号 | 页面 | 修正状态 | 备注 |
|------|------|---------|------|
| B01 | 后台管理系统登录页 | ✓ 无需改 | 登录前页面,无侧边/顶栏 |
| B02 | 主框架与仪表盘 | △ 部分 | 副标题 "SMART FOREST STEWARDSHIP" 是英文,未触发再生 |
| B03 | 景区介绍维护-列表 | ✓ 完成 | 用新 fork `bd7b99d8d…`,顶栏/侧栏统一,移除概览/设置/资源 tabs |
| B04 | 景区介绍维护-新建/编辑 | ✗ Stitch 忽略 prompt | 侧栏仍为"管理中心"+"事项目维护",菜单未对齐 |
| B05 | 活动运营管理-列表 | △ 部分 | Stitch 把 Material 图标 ligature 当文字显示(dashboard/campaign 等) |
| B06 | AI 问答知识库 | ✗ Stitch 忽略 prompt | 侧栏仍为"长秋山智慧管理后台" |
| B07 | 资讯模块 | ✓ 完成 | 用新 fork `433c76de…`,去除 "Evergreen Admin" |
| B08 | 分时预约配额配置-详情 | ✗ Stitch 忽略 prompt | 侧栏仍为"长秋山智慧"截断,顶栏 tabs 未删 |
| B09 | 渠道预约接入管理 | △ 部分 | 顶栏 logo 文案已对齐,菜单分组仍多了"指挥中心"标头 |
| B10 | 现场补录面板 | △ 部分 | 顶栏标题已是"长秋山森林公园智慧管理系统"但与规范差一字 |
| B11 | 爽约风控与黑名单 | ✓ 完成 | "常秋"错字已修,侧栏完整 |
| B12 | 实时路况查询 | △ 部分 | 侧栏菜单已扩展但出现"道路实时路况"额外子项 |
| B13 | 停车场动静态上图 | △ 部分 | 顶栏与规范接近,主区数据完整 |
| B14 | 客流分析 | ✗ Stitch 忽略 prompt | 侧栏仍含"个人中心/退出登录"独立项 |
| B15 | 热力图分析 | ✓ 完成 | 用新 fork `00c771114…`,去除英文/Material 图标名 |
| B16 | 来源分析 | △ 部分 | 顶栏/侧栏基本对齐 |
| B17 | 用户画像总览 | ✓ 完成 | 用新 fork `715e176a4…`,英文菜单已替换 |
| B18 | 用户画像-旅游出行 | ✗ Stitch 忽略 prompt | 侧栏仍为"长秋山管理后台" |
| B19 | 用户画像-APP | ✗ Stitch 忽略 prompt | 侧栏头衔仍是"长秋山智慧景区管理系统" |
| B20 | 物联网设备实时列表 | ✗ Stitch 忽略 prompt | 侧栏仍为"长秋山智慧景区"+"运营后台" |
| B21 | 设备详情与心跳监测 | △ 部分 | 顶栏文案已对齐,菜单仍少子项 |

## 已知 Stitch 局限

1. **画稿宽度**:全部停留在 1280px,Stitch 不会扩到 1440px(超出生成器默认 frame size)。需要手工在 export 后调整 CSS 设计稿。
2. **Prompt 去重**:同一 session 内若 prompt 框架雷同,Stitch 大概率忽略后续。Workaround:每页改一句话或换措辞。
3. **Material 图标 ligature**:Stitch 偶尔把 "dashboard"/"campaign" 等图标名作为文本显示,需后续单独窄修正。
4. **Fork vs in-place**:Stitch 行为不可预测,可能在原节点改,也可能 fork 新节点;`scripts/wait-fork.js` 只能捕获 fork 模式。

## 后续建议(留给下一轮)

1. **第二轮窄修正**:对状态为 ✗ 的 9 页 (B04/B06/B08/B14/B18/B19/B20) + ✓ 之外的页面,逐一改写为 unique 表述(强调每页独有元素),避开 Stitch 去重。
2. **CRUD 完整性**:目前缺少
   - 活动运营管理 · 新建/编辑表单
   - 分时预约配额配置 · 列表 (只有详情)
   - 渠道预约接入 · 新建/编辑表单
   - AI 问答知识库 · 新建/编辑表单
   - 资讯模块 · 文章新建/编辑表单
   - 爽约风控 · 解除申诉详情
3. **1440px 适配**:导出 HTML/CSS 后,在 layout container 上加 `max-width: 1440px; margin: 0 auto;`,主区宽度算 1440 - 240(侧边) = 1200。
4. **滚动条**:Stitch 默认会让卡片群在小屏换行,需要后续手动加 `overflow-x: auto; white-space: nowrap; flex-wrap: nowrap;` 类的 CSS。

## 复用脚本

- `scripts/batch-shot.js <list.json> <outDir>` — 批量节点截图
- `scripts/pick-best.js` — 列出每个 B 端页面所有同名 fork 的尺寸,辅助挑最佳
- `scripts/fix-batch.js <queue.json>` — 用 narrow chrome-fix 模板批量发 prompt
- `scripts/wait-fork.js <label> [maxSec]` — 监听新 fork 出现
- `scripts/zoom-shot.js` / `zoom-tall.js` — 单节点高清截图
- `scripts/send-prompt.js <promptFile>` — 单次发送 prompt

## 涉及节点 ID(canonical)

| 编号 | dataId |
|------|--------|
| B01 | 6c7fe1084bb246c6aff002c7f1e98f27 |
| B02 | 7e3000108add41a5bd1928d7c9a1b019 |
| B03 | bd7b99d8d0b24134a647b660062101f1 |
| B04 | 8380ba793f994bf1a69ed3f954e20853 |
| B05 | c407a6e3745f4b99aaa0491bf01cc988 |
| B06 | 3aa9715e7cea46878e9152aeb81d77a5 |
| B07 | 433c76de77d54148bac2560ec51a03f9 |
| B08 | bf729b72443540b9b3fdebc24a44399d |
| B09 | fa833464234e466c94468a1da59e55d8 |
| B10 | 79e408b4f00f440fb392f77afb43b82e |
| B11 | 141fbd5bb24e42a1aaba9ffecdfdb78e |
| B12 | 52201c2bf6fc4ae18f9793f43dac9218 |
| B13 | e40d7f5f46ae4064ba7e384c3517df61 |
| B14 | aaaed96d971f4c6db7cbaeb76910cc5a |
| B15 | 00c7711144324b8685965277e84424ff |
| B16 | fc834b50ea944d8bbac89f8848348364 |
| B17 | 715e176a4ca146cab4276e076eb26d33 |
| B18 | 0df4402ac2b94c5fbecb3f3112a3c2a5 |
| B19 | 3fb21fe9b8be4bc2ac7fbca3d266d616 |
| B20 | f630bd67784348b5ac0df5893c6af0c6 |
| B21 | 39ddf367c118471bac7dcb0230ff48e3 |
