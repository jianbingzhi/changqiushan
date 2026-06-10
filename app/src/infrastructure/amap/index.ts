// 高德地图服务端 REST 客户端(路况查询,需 env.AMAP_KEY)。
// 浏览器端 JS API 加载器在 src/lib/amap/loader.ts,与此无关。

/** 路段路况条目(B 端实时路况页消费) */
export interface TrafficCondition {
  name:        string;
  congestion:  "畅通" | "缓行" | "拥堵";
  description: string;
  /** 取数时刻 ISO 字符串(高德 rectangle 接口不返回时间戳) */
  updatedAt:   string;
}

/** 诚实三态:key 未配置 / 服务异常 / 高德真实数据。严禁回落硬编码假数据。 */
export type RoadConditionsResult = {
  source: "amap" | "unconfigured" | "error";
  conditions: TrafficCondition[];
};

// 长秋山景区外接矩形(成都蒲江,GCJ-02):左下角经,纬;右上角经,纬。
// 高德要求对角线 <10km,矩形以景区为中心收窄,联调若报参数错再调。
const SCENIC_RECTANGLE = "103.52,30.21;103.59,30.27";

const AMAP_TRAFFIC_URL = "https://restapi.amap.com/v3/traffic/status/rectangle";

// 高德 status → 三值拥堵等级:1 畅通 / 2 缓行 / 3 拥堵 / 4 严重拥堵(并入"拥堵")。
// 0(未知)不在表内 → 该路段丢弃,不编造等级。
const STATUS_MAP: Record<string, TrafficCondition["congestion"] | undefined> = {
  "1": "畅通",
  "2": "缓行",
  "3": "拥堵",
  "4": "拥堵",
};

interface AmapRoad {
  name?:      string;
  status?:    string;
  speed?:     string;
  direction?: string;
}

interface AmapTrafficResponse {
  status?:      string;
  infocode?:    string;
  info?:        string;
  trafficinfo?: { description?: string; roads?: AmapRoad[] };
}

// 仅拼接高德返回的真实字段(平均车速/方向),严禁编造等候时间等信息
function buildDescription(road: AmapRoad): string {
  const parts: string[] = [];
  if (road.speed)     parts.push(`平均车速 ${road.speed} 公里/小时`);
  if (road.direction) parts.push(`方向:${road.direction}`);
  return parts.length > 0 ? parts.join(" · ") : "暂无详情";
}

/**
 * 查询景区外接矩形内实时路况(extensions=all 返回逐路段明细)。
 * - AMAP_KEY 未配置:不发请求,source="unconfigured"
 * - HTTP 失败 / infocode!=="10000" / 网络异常:source="error"
 * - 成功:source="amap"
 * fetch 走 Next.js Data Cache 60 秒再验证(Vercel/docker 双生效),保护高德配额。
 */
export async function fetchRoadConditions(): Promise<RoadConditionsResult> {
  const key = process.env.AMAP_KEY;
  if (!key) return { source: "unconfigured", conditions: [] };

  try {
    const params = new URLSearchParams({
      key,
      rectangle:  SCENIC_RECTANGLE,
      extensions: "all",
    });
    const res = await fetch(`${AMAP_TRAFFIC_URL}?${params.toString()}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return { source: "error", conditions: [] };

    const data = (await res.json()) as AmapTrafficResponse;
    if (data.infocode !== "10000") return { source: "error", conditions: [] };

    const updatedAt = new Date().toISOString();
    const conditions = (data.trafficinfo?.roads ?? []).flatMap<TrafficCondition>((r) => {
      const congestion = STATUS_MAP[r.status ?? ""];
      if (!r.name || !congestion) return [];
      return [{ name: r.name, congestion, description: buildDescription(r), updatedAt }];
    });

    return { source: "amap", conditions };
  } catch {
    // 网络异常/JSON 解析失败一律归入 error,不抛给页面
    return { source: "error", conditions: [] };
  }
}
