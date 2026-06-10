import { trafficService } from "@/modules/traffic";
import { RoadMap } from "./_road-map";

export const dynamic = "force-dynamic";
export const metadata = { title: "实时路况查询 · 长秋山管理后台" };

// T1d(2026-06-04 用户决策):整页高德地图铺底 + 数据浮层。RSC 只负责取数,布局/浮层全在 _road-map.tsx。
export default async function TrafficRoadPage() {
  const { source, conditions } = await trafficService.getRoadConditions();
  return <RoadMap source={source} conditions={conditions} />;
}
