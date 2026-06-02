import { PageHeader } from "@/lib/ui/page-header";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { FileDown } from "lucide-react";

// TODO: import { analyticsRepository } from "@/modules/analytics";
export const dynamic = "force-dynamic";
export const metadata = { title: "热力图分析 · 长秋山管理后台" };

export default async function AnalyticsHeatmapPage() {
  const rows: never[] = [];

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
        <p className="mb-3 text-[13px] font-medium text-[#1F2937]">游客密度热力分布</p>
        <div className="flex items-center justify-center w-full rounded-lg bg-[#F9FAFB] border border-[#E5E7EB]" style={{ height: 400 }} role="img" aria-label="热力图加载中">
          <span className="text-[14px] text-[#9CA3AF]">热力图加载中…</span>
        </div>
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
            ) : null}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
