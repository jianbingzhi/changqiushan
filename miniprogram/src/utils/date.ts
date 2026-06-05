// 中文日期格式化(红线#6:禁 ISO 格式,统一 2026年6月15日)

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Date 或 ISO 字符串 → 2026年6月15日 */
export function formatCnDate(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

/** Date 或 ISO 字符串 → 2026年6月15日 14:30 */
export function formatCnDateTime(input: string | Date): string {
  const d = typeof input === "string" ? new Date(input) : input;
  if (Number.isNaN(d.getTime())) return "";
  return `${formatCnDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Date → 2026-06-15(仅用于 API 入参/key,不用于展示) */
export function toDateParam(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 解析 2026-06-15 为当日 0 点本地 Date */
export function parseDateParam(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, day ?? 1);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function isPastDay(d: Date, today = new Date()): boolean {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return a.getTime() < t.getTime();
}
