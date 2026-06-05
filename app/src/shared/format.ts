export function formatCnDate(d: Date | string): string {
  // 纯日期串(YYYY-MM-DD)按日历日直接取值,不经 `new Date(string)`——后者按 UTC 解析,
  // 在 UTC 以西时区会回显前一天(与时区收口 time.ts 一致,避免 C10/onsite 中文回显偏移)。
  if (typeof d === "string") {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d);
    if (m) return `${Number(m[1])} 年 ${Number(m[2])} 月 ${Number(m[3])} 日`;
  }
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function formatCnDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${formatCnDate(date)} ${h}:${m}`;
}
