// 高德地图 REST API 客户端
// 地图 JS API 通过 <script> 标签注入（非 npm 包）
// 此文件封装路况 + 停车 REST API 查询（需 env.AMAP_KEY）

export interface TrafficCondition {
  name:        string;
  congestion:  "畅通" | "缓行" | "拥堵";
  description: string;
  updatedAt:   string;
}

export interface ParkingInfo {
  lotId:     string;
  name:      string;
  available: number;
  total:     number;
}

export async function fetchTrafficConditions(_area: string): Promise<TrafficCondition[]> {
  // TODO: 替换为真实高德路况 REST API (需 AMAP_KEY)
  // GET https://restapi.amap.com/v3/traffic/status/road?key=${AMAP_KEY}&...
  return [
    { name: "景区主入口道路", congestion: "畅通", description: "车流正常", updatedAt: new Date().toISOString() },
    { name: "停车场入口匝道", congestion: "缓行", description: "车辆较多，预计等候 5 分钟", updatedAt: new Date().toISOString() },
    { name: "景区连接主干道", congestion: "畅通", description: "路况良好", updatedAt: new Date().toISOString() },
  ];
}

export async function fetchParkingInfo(_lotIds: string[]): Promise<ParkingInfo[]> {
  // TODO: 替换为真实高德停车 REST API (需 AMAP_KEY)
  return [];
}
