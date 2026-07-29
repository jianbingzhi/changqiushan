// 实时天气的展示口径正本(N08 收口)。
//
// 类型与格式化落在 shared/ 而非 infrastructure/,是因为 eslint-boundaries 规定
// `lib → {lib, shared}`——大屏 UI 组件(src/lib/ui/screen)不能 import infrastructure,
// 且 boundaries/ignore 只豁免 *.test.ts(x),没有 type-only 例外(见 b-105 计划 D4)。
//
// 顶栏与 KPI 卡共用这三个纯函数,保证同一份数据在两块屏上不出现两个口径。

/** 实时天气(高德 lives[0] 的 PII-free 子集) */
export interface WeatherLive {
  city: string;
  weather: string; // 天气现象,如「阴」「多云」
  temperature: number; // 摄氏度
  windDirection: string; // 风向
  windPower: string; // 风力等级,如「≤3」「4」
  humidity: number; // 相对湿度 %
  reportTime: string; // 高德数据发布时间(原样透传)
}

/** 诚实三态:key 未配置 / 服务异常 / 高德真实数据。严禁回落硬编码假天气。 */
export type WeatherResult = {
  source: "amap" | "unconfigured" | "error";
  live: WeatherLive | null;
};

/** 景区所在地;高德未回传城市名时的兜底展示值。 */
const DEFAULT_CITY = "蒲江县";

// 高德 weatherInfo 结构性不返回空气质量,不是「还没接」而是「这个源永远给不了」,
// 故降级为一句小标注,不再让一张已有真实数据的卡整体显示占位(见 b-105 计划 D6)。
const AIR_QUALITY_NOTE = "空气质量待接入";

/**
 * 「有数据可展示」的唯一判据。
 * source 为 amap 只说明调用路径走通,live 仍可能为 null(调用方 catch 分支能造出),
 * 数值字段也可能因上游给非数字而成 NaN——两者都必须挡在渲染之前。
 */
function displayable(r: WeatherResult): WeatherLive | null {
  const live = r.live;
  if (r.source !== "amap" || !live) return null;
  if (!Number.isFinite(live.temperature)) return null;
  // 天气现象缺失会渲染出「蒲江县 ·  12℃」(双空格、没有现象词)。
  // infrastructure 侧虽已挡一道,但本模块是展示口径正本、对任意调用方开放,不变量不能只活在上游。
  if (!live.weather.trim()) return null;
  return live;
}

function humiditySegment(live: WeatherLive): string {
  return Number.isFinite(live.humidity) ? ` · 湿度 ${live.humidity}%` : "";
}

/** 顶栏一行文案。有数据态返回字符串,其余返回 null(由调用方渲染 PlaceholderTag)。 */
export function formatWeatherHeader(r: WeatherResult): string | null {
  const live = displayable(r);
  if (!live) return null;
  const city = live.city || DEFAULT_CITY;
  return `${city} · ${live.weather} ${live.temperature}℃${humiditySegment(live)}`;
}

/** KPI 卡。value 与 unit 必须分离;不可用态 value="—" 且 unit 为 undefined。 */
export function formatWeatherTile(r: WeatherResult): { value: string; unit?: string; sub: string | null } {
  const live = displayable(r);
  // KpiTile 对 value 施加 tabular-nums + 放大 + 辉光,单位混进去排版必歪。
  if (!live) return { value: "—", sub: weatherFallbackText(r) };

  // sub 只留空气质量小标注:城市/现象/湿度同屏顶栏已完整呈现一遍,
  // 卡片再抄一遍既重复又是这一行 KPI 里最长的 sub(计划 T5.4 的验收口径亦是「只剩小标注」)。
  return { value: String(live.temperature), unit: "℃", sub: AIR_QUALITY_NOTE };
}

/**
 * 三态诚实文案:unconfigured 与 error 必须不同句。
 * ⚠️ 措辞刻意不点破原因(如「未配置密钥」)——大屏挂墙无登录、会被拍照转播,
 * 不该向房间里任何人播报部署内部状态。两句只需可区分,不需自曝成因。
 */
export function weatherFallbackText(r: WeatherResult): string {
  return r.source === "unconfigured" ? "天气服务暂未配置" : "天气服务暂不可用";
}
