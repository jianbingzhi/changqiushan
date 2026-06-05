# 子计划 07 · 园区导览地图（POI + 停车实时 + A10）

> 上游：[`c-miniprogram.md`](./c-miniprogram.md)。

## Task Type
- [x] Backend（`ContentPoi` + 复用 traffic）  - [x] Frontend（A10，分包 `subpkg-map`）

## 范围
导览底图 + POI 标注/筛选 + 停车场实时余量（30s 轮询，联动高德/traffic）+ 2D/3D 切换。当前无 POI 表（traffic 仅 parking lots 带坐标）→ 新建 `ContentPoi`。

## Key Files
| File | Operation | Description |
|---|---|---|
| `app/prisma/models/content.prisma` | Modify | 新增 `ContentPoi`(name/category/经纬度 Decimal(10,7)/description/coverImage/sortOrder/status) |
| `app/src/modules/content/{service,repository,index}.ts` | Modify | `listPois()`（公开读已发布） |
| `app/src/app/api/c/poi/route.ts` | Create | `GET ?category=` → `contentRepository.listPois` |
| `app/src/app/api/c/parking/route.ts` | Reuse(c-01) | `trafficRepository.listParkingLots` |
| `../Changqiushan-mobile/src/subpkg-map/index/*` | Create | A10 地图页 |
| `../Changqiushan-mobile/src/api/map.ts`、`hooks/usePolling.ts` | Create/复用 | POI 拉取 + 停车 30s 轮询 |

## 前端要点（A10）
- 搜索栏 + chip 筛选（景点/餐饮/停车场/卫生间/补给站/观景台/应急医疗/售卖点）。
- 手绘风格底图 + 差异化 POI 图标（图来自 public/ 公网 URL）；浮动控件（定位/图层/±）。
- 底部停车场抽屉：余量绿/橙/红圆点 + "导航前往"；**抽屉打开时 30s 轮询**（`usePolling(parking,30s)`，关闭即停，`onHide` 停）。
- "切换 2D/3D"按钮；距离单位"公里"。
- 需 `scope.userLocation`（app.config permission + 用途说明）。

## Risks & Mitigation
| 风险 | 缓解 |
|---|---|
| 手绘大图 + POI 卡顿 | 图懒加载 + 合理分辨率；POI 适度聚合 |
| 定位权限拒绝 | 降级仅展示底图+POI，停车按固定锚点排序 |
| 停车数据时效 | 30s 轮询，UI 标注"每30秒更新"，与设计稿一致 |

## Checkpoint
| Sub-step | Done |
|---|---|
| ContentPoi + migrate + listPois | [ ] |
| `GET /api/c/poi` + 复用 parking | [ ] |
| A10 底图 + POI 筛选 + 停车抽屉 30s 轮询 + 2D/3D | [ ] |
| 真机定位权限 + 性能验 | [ ] |
