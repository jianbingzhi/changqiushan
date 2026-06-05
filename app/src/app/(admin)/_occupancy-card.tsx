"use client";

import { useDashboardLive } from "./_dashboard-live";

// 在园人数卡。在园数由 DashboardLiveProvider 的「脏信号 + 回拉」驱动;
// capacity 为瞬时承载量(D1,占位 env),达 90% 闪红落地红线 4 机制。
export function OccupancyCard({ capacity }: { capacity: number }) {
  const { count } = useDashboardLive();

  const pct = capacity > 0 ? Math.round((count / capacity) * 100) : 0;
  const isRed = pct >= 90;

  return (
    <div
      className="rounded-lg shadow-sm p-6 border"
      style={{
        backgroundColor: isRed ? "#FEF2F2" : "#FFFFFF",
        borderColor: isRed ? "#FECACA" : "#E5E7EB",
      }}
    >
      <p className="text-[13px]" style={{ color: isRed ? "#DC2626" : "#6B7280" }}>
        在园人数（实时）
      </p>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className="text-[32px] font-bold leading-none"
          style={{ color: isRed ? "#DC2626" : "#1F2937" }}
        >
          {count}
        </span>
        <span className="text-sm" style={{ color: isRed ? "#DC2626" : "#6B7280" }}>
          /{capacity} 人（{pct}%）
        </span>
      </div>
      {isRed && (
        <p className="mt-2 text-[12px] font-semibold text-[#DC2626]">⚠ 在园达 90%，预约已自动暂停</p>
      )}
    </div>
  );
}
