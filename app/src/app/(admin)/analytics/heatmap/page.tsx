import { analyticsRepository } from "@/modules/analytics";
import { PageHeader } from "@/lib/ui/page-header";
import { EmptyState } from "@/lib/ui/empty-state";
import { BarList } from "@/lib/ui/charts/BarList";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { FileDown } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "热力图分析 · 长秋山管理后台" };

export default async function AnalyticsHeatmapPage() {
  const raw = await analyticsRepository.getHourlyPeak();
  const rows = raw.map((r) => ({ hour: r.hour, avg: r.avg_visitors, max: Number(r.max_visitors) }));

  return (
    <>
      <PageHeader title="热力图分析" description="景区内游客密度热力分布"
        actions={
          <a href="/api/export/heatmap" download className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#1F2937] hover:bg-[#F9FAFB]">
            <FileDown className="h-4 w-4 text-[#6B7280]" />导出 Excel
          </a>
        }
      />
      <div className="mb-5 rounded-lg border border-[#E5E7EB] bg-white p-4">
        <p className="mb-3 text-[13px] font-medium text-[#1F2937]">各时段游客密度（峰值人数）</p>
        <BarList height={400} emptyText="暂无时段密度数据" data={rows.map((r) => ({ label: `${r.hour} 时`, value: r.max, hint: `峰值 ${r.max}` }))} />
      </div>
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-4 py-3"><p className="text-[13px] font-medium text-[#1F2937]">各时段游客峰值</p></div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["时段", "平均游客数", "峰值游客数"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="p-0"><EmptyState message="暂无时段峰值数据" /></TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.hour} className="hover:bg-[#F9FAFB]">
                <TableCell className="text-[13px] text-[#1F2937]">{r.hour} 时</TableCell>
                <TableCell className="text-[13px]">{r.avg}</TableCell>
                <TableCell className="text-[13px] font-medium">{r.max}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
