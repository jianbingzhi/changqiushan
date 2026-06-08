// 大屏深色横向条形(派生自 lib/ui/charts/BarList):RSC 安全,省 echarts 实例。
// 用于简单 TOP5 / 占比条(C1 客源地、C3 周末占比)。

export interface DarkBarDatum {
  label: string;
  value: number;
  hint?: string;
}

interface Props {
  data: DarkBarDatum[];
  emptyText?: string;
  /** 进度条颜色,默认辉光绿 */
  color?: string;
  className?: string;
}

export function DarkBarList({ data, emptyText = "暂无数据", color = "var(--screen-glow)", className = "" }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[14px]" style={{ color: "var(--screen-text-faint)" }}>
        {emptyText}
      </div>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={`flex flex-col justify-between gap-2.5 ${className}`} role="img" aria-label="数据条形图">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-24 shrink-0 truncate text-[14px]" style={{ color: "var(--screen-text-dim)" }} title={d.label}>
            {d.label}
          </span>
          <div className="relative h-4 flex-1 overflow-hidden rounded" style={{ backgroundColor: "rgba(232,245,233,0.08)" }}>
            <div
              className="absolute inset-y-0 left-0 rounded"
              style={{
                width: `${Math.round((d.value / max) * 100)}%`,
                minWidth: d.value > 0 ? 2 : 0,
                backgroundColor: color,
                boxShadow: "0 0 8px rgba(74,142,63,0.5)",
              }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-[14px] font-semibold tabular-nums" style={{ color: "var(--screen-text)" }}>
            {d.hint ?? d.value.toLocaleString("zh-CN")}
          </span>
        </div>
      ))}
    </div>
  );
}
