// 高德地图服务端 REST 客户端(路况查询,需 env.AMAP_KEY)。
// 浏览器端 JS API 加载器在 src/lib/amap/loader.ts,与此无关。

/** 路段路况条目(B 端实时路况页消费) */
export interface TrafficCondition {
  name:        string;
  congestion:  "畅通" | "缓行" | "拥堵";
  description: string;
  /**
   * 取数时刻 ISO 字符串。高德 rectangle 接口的响应体不带时间戳,故取响应头 `Date`
   * (= 上游生成这份数据的时刻);命中 Next Data Cache 时响应头一并被缓存,
   * 所以这个值**不随本次渲染时刻走**,能如实反映数据可旧至 60 秒(round-01 N07)。
   */
  updatedAt:   string;
}

/** 诚实三态:key 未配置 / 服务异常 / 高德真实数据。严禁回落硬编码假数据。 */
export type RoadConditionsResult = {
  source: "amap" | "unconfigured" | "error";
  conditions: TrafficCondition[];
};

// 长秋山景区外接矩形(成都蒲江,GCJ-02):左下角经,纬;右上角经,纬。
// 中心取考证点(103.6147,30.2317,蒲江长秋山脊);对角线约 8.4km,符合高德 <10km 限制。
const SCENIC_RECTANGLE = "103.585,30.205;103.645,30.260";

const AMAP_TRAFFIC_URL = "https://restapi.amap.com/v3/traffic/status/rectangle";

/** 路况数据在 Next Data Cache 里的再验证窗口(秒)。UI 用它说明"最多旧多久"。 */
export const ROAD_CACHE_SECONDS = 60;

/**
 * 真实取数时刻 = 上游响应头 `Date`。
 * round-01 N07:原先直接取 `new Date()`,而 fetch 命中缓存时函数体仍会重跑,
 * 于是"最后更新"恒等于当前时刻,把最旧 60 秒的数据说成刚取的。
 * 响应头缺失/不可解析时才回落到当前时刻(不编造,退化为旧口径)。
 */
export function resolveFetchedAt(dateHeader: string | null | undefined, now: Date = new Date()): string {
  if (dateHeader) {
    const t = new Date(dateHeader);
    if (!Number.isNaN(t.getTime())) return t.toISOString();
  }
  return now.toISOString();
}

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
 * fetch 走 Next.js Data Cache 60 秒再验证(Vercel/docker 双生效),保护高德配额;
 * 因此 `updatedAt` 必须取响应头时刻,不能取当前时刻(见 resolveFetchedAt)。
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
      next: { revalidate: ROAD_CACHE_SECONDS },
    });
    if (!res.ok) return { source: "error", conditions: [] };

    const data = (await res.json()) as AmapTrafficResponse;
    if (data.infocode !== "10000") return { source: "error", conditions: [] };

    const updatedAt = resolveFetchedAt(res.headers.get("date"));
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
