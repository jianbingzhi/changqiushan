// 时区收口:全站「业务日历日」一律走此处,禁止再用 `new Date().toISOString().slice(0,10)`
// —— 后者恒按 UTC 取日,北京 0–8 点会偏到昨天(P10)。这里用 Asia/Shanghai 墙钟取日,
// 与进程 TZ 无关,SSR / 浏览器 / 任意服务器时区下结果一致。

const CST = "Asia/Shanghai";

// en-CA 的 locale 输出恰为 YYYY-MM-DD,直接当作 @db.Date 匹配用的日历日串
const CST_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: CST,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** 任意时刻在北京墙钟下的日历日 `YYYY-MM-DD`。 */
export function toCstDateStr(d: Date): string {
  return CST_DATE_FMT.format(d);
}

/** 今天(北京墙钟)的日历日 `YYYY-MM-DD`。用于表单默认日期 / 文件名 / 时段生成基准日。 */
export function chinaToday(): string {
  return toCstDateStr(new Date());
}

/**
 * 把日历日串还原成「该日北京 00:00」对应的 UTC 时刻。
 * 用于以瞬时戳(`@db.Timestamptz`)做范围比较时锚定北京当日零点。
 * 注意:与 `@db.Date` 列匹配应直接用日历日串(`chinaToday()`),无需本函数。
 */
export function cstStartOf(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+08:00`);
}

// 中文日期格式化收口(实现仍在 shared/format.ts,此处再导出,统一从 time.ts 取)
export { formatCnDate, formatCnDateTime } from "@/shared/format";
