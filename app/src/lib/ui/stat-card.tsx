import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  trend?: number;
  trendLabel?: string;
}

export function StatCard({ label, value, unit, trend, trendLabel }: StatCardProps) {
  const trendColor = trend === undefined ? undefined : trend >= 0 ? "#16A34A" : "#DC2626";
  const trendSign = trend !== undefined && trend > 0 ? "+" : "";

  return (
    <div className="rounded-lg shadow-sm p-6 bg-white border border-[#E5E7EB]">
      <p className="text-[13px] text-[#6B7280]">{label}</p>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-[32px] font-bold leading-none text-[#1F2937]">{value}</span>
        {unit && <span className="text-sm text-[#6B7280]">{unit}</span>}
      </div>
      {trend !== undefined && (
        <p className="mt-2 text-[13px]" style={{ color: trendColor }}>
          {trendSign}{trend}
          {trendLabel && <span className="ml-1 text-[#6B7280]">{trendLabel}</span>}
        </p>
      )}
    </div>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-4 gap-4">{children}</div>;
}
