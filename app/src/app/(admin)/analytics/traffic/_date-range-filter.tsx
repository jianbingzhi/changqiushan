"use client";

import { useState } from "react";
import { DatePicker } from "@/lib/ui/date-picker";

// 中文日期选择器(DatePicker)替换原生 type=date;trigger 直接显示「2026 年 6 月 3 日」,
// 隐藏 input 保持 GET 表单契约(value 仍为 YYYY-MM-DD)。
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
          <DatePicker id={f.name} name={f.name} value={f.value} onChange={f.set} />
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
