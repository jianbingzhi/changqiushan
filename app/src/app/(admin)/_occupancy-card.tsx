"use client";

import { cn } from "@/lib/ui/utils";
import { useDashboardLive } from "./_dashboard-live";
import { CIRCUIT_BREAK_RATIO } from "@/shared/lib/capacity";

// 在园人数卡。在园数由 DashboardLiveProvider 的「脏信号 + 回拉」驱动;
// capacity 为瞬时承载量(D1,可配),达 90% 闪红落地红线 4 机制。
export function OccupancyCard({ capacity }: { capacity: number }) {
  const { count } = useDashboardLive();

  const pct = capacity > 0 ? Math.round((count / capacity) * 100) : 0;
  const isRed = pct >= CIRCUIT_BREAK_RATIO * 100;

  return (
    <div
      className={cn(
        "rounded-lg shadow-sm p-6 border",
        isRed ? "border-danger/30 bg-danger/10" : "border-border bg-card",
      )}
    >
      <p className={cn("text-[13px]", isRed ? "text-danger" : "text-muted-foreground")}>
        在园人数（实时）
      </p>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={cn(
            "text-[32px] font-bold leading-none",
            isRed ? "text-danger" : "text-foreground",
          )}
        >
          {count}
        </span>
        <span className={cn("text-sm", isRed ? "text-danger" : "text-muted-foreground")}>
          /{capacity} 人（{pct}%）
        </span>
      </div>
      {isRed && (
        <p className="mt-2 text-[12px] font-semibold text-danger">⚠ 在园达 90%，预约已自动暂停</p>
      )}
    </div>
  );
}
