export function formatCnDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${date.getFullYear()} 年 ${date.getMonth() + 1} 月 ${date.getDate()} 日`;
}

export function formatCnDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const h = date.getHours().toString().padStart(2, "0");
  const m = date.getMinutes().toString().padStart(2, "0");
  return `${formatCnDate(date)} ${h}:${m}`;
}
