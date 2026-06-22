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
// 中心取考证点(103.6147,30.2317,蒲江长秋山脊);对角线约 8.4km,符合高德 <10km 限制。
const SCENIC_RECTANGLE = "103.585,30.205;103.645,30.260";

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

// ── 实时天气(大屏顶栏)──────────────────────────────────────────────────────
// 高德 weatherInfo 仅含天气现象/气温/风/湿度,**不含 AQI/空气质量**(那需另接环境监测源)。
// 与路况共用 AMAP_KEY(Web 服务 key)。城市默认蒲江县 510131(长秋山所在地),可经 env 覆盖。

/** 实时天气(高德 lives[0] 的 PII-free 子集) */
export interface WeatherLive {
  city:          string;
  weather:       string;  // 天气现象,如「阴」「多云」
  temperature:   number;  // 摄氏度
  windDirection: string;  // 风向
  windPower:     string;  // 风力等级,如「≤3」「4」
  humidity:      number;  // 相对湿度 %
  reportTime:    string;  // 高德数据发布时间(原样透传)
}

/** 诚实三态:key 未配置 / 服务异常 / 高德真实数据。严禁回落硬编码假天气。 */
export type WeatherResult = {
  source: "amap" | "unconfigured" | "error";
  live:   WeatherLive | null;
};

const AMAP_WEATHER_URL = "https://restapi.amap.com/v3/weather/weatherInfo";
// 蒲江县 adcode;运维可经 AMAP_WEATHER_CITY 覆盖(如换成成都市 510100)。
const WEATHER_CITY = process.env.AMAP_WEATHER_CITY || "510131";

interface AmapWeatherLive {
  city?:          string;
  weather?:       string;
  temperature?:   string;
  winddirection?: string;
  windpower?:     string;
  humidity?:      string;
  reporttime?:    string;
}

interface AmapWeatherResponse {
  status?:   string;
  infocode?: string;
  lives?:    AmapWeatherLive[];
}

/**
 * 查询景区所在地实时天气(extensions=base)。
 * - AMAP_KEY 未配置:source="unconfigured"
 * - HTTP 失败 / infocode!=="10000" / 无 lives / 网络异常:source="error"
 * - 成功:source="amap"
 * 高德实时天气约每小时更新一次,fetch 走 Data Cache 600 秒再验证,保护配额。
 */
export async function fetchWeather(): Promise<WeatherResult> {
  const key = process.env.AMAP_KEY;
  if (!key) return { source: "unconfigured", live: null };

  try {
    const params = new URLSearchParams({ key, city: WEATHER_CITY, extensions: "base" });
    const res = await fetch(`${AMAP_WEATHER_URL}?${params.toString()}`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return { source: "error", live: null };

    const data = (await res.json()) as AmapWeatherResponse;
    const live = data.lives?.[0];
    if (data.infocode !== "10000" || !live || !live.weather) {
      return { source: "error", live: null };
    }

    return {
      source: "amap",
      live: {
        city:          live.city ?? "",
        weather:       live.weather,
        temperature:   Number(live.temperature ?? 0),
        windDirection: live.winddirection ?? "",
        windPower:     live.windpower ?? "",
        humidity:      Number(live.humidity ?? 0),
        reportTime:    live.reporttime ?? "",
      },
    };
  } catch {
    return { source: "error", live: null };
  }
}
