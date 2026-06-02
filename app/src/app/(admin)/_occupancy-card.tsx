"use client";

import { useEffect, useState } from "react";

interface OccupancyCardProps {
  initialCount: number;
  capacity:     number;
}

export function OccupancyCard({ initialCount, capacity }: OccupancyCardProps) {
  const [count, setCount] = useState(initialCount);

  useEffect(() => {
    const es = new EventSource("/api/sse/checkin_event");
    es.onmessage = (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data as string) as { checkedInCount?: number };
        if (typeof payload.checkedInCount === "number") {
          setCount(payload.checkedInCount);
        }
      } catch {
        // ignore malformed events
      }
    };
    return () => es.close();
  }, []);

  const pct = capacity > 0 ? Math.round(count / capacity * 100) : 0;
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
