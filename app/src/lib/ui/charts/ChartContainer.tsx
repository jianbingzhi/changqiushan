interface ChartContainerProps {
  height?: number;
  label?:  string;
}

export function ChartContainer({ height = 300, label = "图表加载中…" }: ChartContainerProps) {
  return (
    <div
      className="flex items-center justify-center w-full rounded-lg bg-muted border border-border"
      style={{ height }}
      role="img"
      aria-label={label}
    >
      <span className="text-[14px] text-text-muted">{label}</span>
    </div>
  );
}
