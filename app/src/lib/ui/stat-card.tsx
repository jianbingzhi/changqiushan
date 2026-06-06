import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendLabel?: string;
}

export function StatCard({ label, value, unit, trend, trendLabel }: StatCardProps) {
  const trendSign = trend !== undefined && trend > 0 ? "+" : "";

  return (
    <div className="rounded-lg shadow-sm p-6 bg-card border border-border">
      <p className="text-[13px] text-muted-foreground">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[32px] font-bold leading-none text-foreground">{value}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {trend !== undefined && (
        <p className={`mt-2 text-[13px] ${trend >= 0 ? "text-success" : "text-danger"}`}>
          {trendSign}{trend}
          {trendLabel && <span className="ml-1 text-muted-foreground">{trendLabel}</span>}
        </p>
      )}
    </div>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 gap-4">{children}</div>;
}
