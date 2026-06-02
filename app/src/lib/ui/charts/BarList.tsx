// 轻量横向条形图(服务端渲染,无需 ECharts/客户端):以真实数据驱动的可视化,
// 替代纯占位的 ChartContainer。每行一个标签 + 数值 + 按最大值归一的色条。

export interface BarDatum {
  label: string;
  value: number;
  hint?: string;
}

interface Props {
  data: BarDatum[];
  height?: number;
  emptyText?: string;
}

export function BarList({ data, height = 300, emptyText = "暂无数据" }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]" style={{ height }}>
        <span className="text-[14px] text-[#9CA3AF]">{emptyText}</span>
      </div>
    );
  }
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="space-y-2 overflow-auto pr-1" style={{ maxHeight: height }} role="img" aria-label="数据条形图">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-[12px] text-[#6B7280]" title={d.label}>{d.label}</span>
          <div className="relative h-5 flex-1 rounded bg-[#F3F4F6]">
            <div
              className="absolute inset-y-0 left-0 rounded bg-[#2D5A27]"
              style={{ width: `${Math.round((d.value / max) * 100)}%`, minWidth: d.value > 0 ? 2 : 0 }}
            />
          </div>
          <span className="w-20 shrink-0 text-right text-[12px] font-medium text-[#1F2937]">
            {d.hint ?? d.value.toLocaleString("zh-CN")}
          </span>
        </div>
      ))}
    </div>
  );
}
