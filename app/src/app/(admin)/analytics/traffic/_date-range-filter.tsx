"use client";

import { useState } from "react";
import { formatCnDate } from "@/shared/lib/time";

// C10:原生 type="date" 浏览器渲染为 06/03/2026,控件旁同步中文回显「2026 年 6 月 3 日」。
// 仍走 GET 表单提交(value 保持 YYYY-MM-DD 不破契约),只增加可见的中文日期。
export function DateRangeFilter({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const [start, setStart] = useState(startDate);
  const [end, setEnd] = useState(endDate);

  const fields = [
    { name: "startDate", label: "开始日期", value: start, set: setStart },
    { name: "endDate", label: "结束日期", value: end, set: setEnd },
  ];

  return (
    <form method="GET" className="flex items-end gap-3 flex-wrap">
      {fields.map((f) => (
        <div key={f.name} className="flex flex-col gap-1">
          <label className="text-[13px] text-[#6B7280]" htmlFor={f.name}>
            {f.label}
          </label>
          <input
            id={f.name}
            name={f.name}
            type="date"
            value={f.value}
            onChange={(e) => f.set(e.target.value)}
            className="h-9 rounded-md border border-[#E5E7EB] px-3 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/30"
          />
          <span className="text-[12px] text-[#9CA3AF]">
            {f.value ? formatCnDate(f.value) : "未选择"}
          </span>
        </div>
      ))}
      <button
        type="submit"
        className="h-9 rounded-md bg-[#2D5A27] px-4 text-sm font-medium text-white hover:opacity-90"
      >
        查询
      </button>
    </form>
  );
}
