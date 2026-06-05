"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/lib/ui/tabs";
import { EmptyState } from "@/lib/ui/empty-state";

export interface ProfileRow {
  dimension: string;
  value: number;
  percentage: number;
}

function DimensionTable({ rows, emptyText }: { rows: ProfileRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return <EmptyState message={emptyText} />;
  }
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="divide-y divide-[#F3F4F6]">
      {rows.map((r) => (
        <div key={r.dimension} className="flex items-center gap-4 px-4 py-3">
          <span className="w-40 shrink-0 text-[13px] text-[#1F2937]">{r.dimension}</span>
          <div className="relative h-5 flex-1 rounded bg-[#F3F4F6]">
            <div className="absolute inset-y-0 left-0 rounded bg-[#2D5A27]" style={{ width: `${Math.round((r.value / max) * 100)}%`, minWidth: r.value > 0 ? 2 : 0 }} />
          </div>
          <span className="w-16 shrink-0 text-right text-[13px] font-medium text-[#1F2937]">{r.value}</span>
          <span className="w-16 shrink-0 text-right text-[12px] text-[#6B7280]">{r.percentage}%</span>
        </div>
      ))}
    </div>
  );
}

export function ProfileTabs({ overview, travel }: { overview: ProfileRow[]; travel: ProfileRow[] }) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="mb-4 bg-[#F3F4F6] border border-[#E5E7EB]">
        <TabsTrigger value="overview" className="data-[state=active]:bg-white data-[state=active]:text-[#2D5A27] data-[state=active]:shadow-sm">总览</TabsTrigger>
        <TabsTrigger value="travel"   className="data-[state=active]:bg-white data-[state=active]:text-[#2D5A27] data-[state=active]:shadow-sm">出行偏好</TabsTrigger>
        <TabsTrigger value="app"      className="data-[state=active]:bg-white data-[state=active]:text-[#2D5A27] data-[state=active]:shadow-sm">应用偏好</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <div className="rounded-lg border border-[#E5E7EB] bg-white">
          <div className="border-b border-[#E5E7EB] px-4 py-3"><p className="text-[13px] font-medium text-[#1F2937]">性别比例与年龄分布（按去重身份证）</p></div>
          <DimensionTable rows={overview} emptyText="暂无画像数据" />
        </div>
      </TabsContent>
      <TabsContent value="travel">
        <div className="rounded-lg border border-[#E5E7EB] bg-white">
          <div className="border-b border-[#E5E7EB] px-4 py-3"><p className="text-[13px] font-medium text-[#1F2937]">自驾比例与偏好入园时段</p></div>
          <DimensionTable rows={travel} emptyText="暂无出行偏好数据" />
        </div>
      </TabsContent>
      <TabsContent value="app">
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-6">
          <EmptyState message="应用行为偏好（功能使用频率/留存率）来自 C 端小程序埋点，待 C 端数据同步后接入。" />
        </div>
      </TabsContent>
    </Tabs>
  );
}
