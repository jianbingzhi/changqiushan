import { PageHeader } from "@/lib/ui/page-header";
import { StatCard, KpiRow } from "@/lib/ui/stat-card";
import { EmptyState } from "@/lib/ui/empty-state";
import { ChartContainer } from "@/lib/ui/charts/ChartContainer";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { FileDown } from "lucide-react";

// TODO: import { analyticsRepository } from "@/modules/analytics";
export const dynamic = "force-dynamic";
export const metadata = { title: "客流分析 · 长秋山管理后台" };

type Props = { searchParams: Promise<{ startDate?: string; endDate?: string }> };

export default async function AnalyticsTrafficPage({ searchParams }: Props) {
  const params = await searchParams;
  const startDate = params.startDate ?? "";
  const endDate   = params.endDate ?? "";

  // TODO: const result = await analyticsService.getTrafficReport(new Date(startDate), new Date(endDate));
  const rows: never[] = [];

  return (
    <>
      <PageHeader title="客流分析" description="景区客流量趋势与数据导出"
        actions={
          <a href="/api/export/traffic" download className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#1F2937] hover:bg-[#F9FAFB]">
            <FileDown className="h-4 w-4 text-[#6B7280]" />导出 Excel
          </a>
        }
      />
      <div className="mb-5">
        <KpiRow>
          <StatCard label="本周游客总数" value={0} unit="人次" />
          <StatCard label="本月游客总数" value={0} unit="人次" />
          <StatCard label="平均日客流"   value={0} unit="人次" />
          <StatCard label="同比增长"     value="0%" />
        </KpiRow>
      </div>
      <div className="mb-5 flex items-end gap-3 rounded-lg border border-[#E5E7EB] bg-white p-4">
        <form method="GET" className="flex items-end gap-3 flex-wrap">
          {[["startDate", "开始日期", startDate], ["endDate", "结束日期", endDate]].map(([name, label, val]) => (
            <div key={name as string} className="flex flex-col gap-1">
              <label className="text-[13px] text-[#6B7280]" htmlFor={name as string}>{label}</label>
              <input id={name as string} name={name as string} type="date" defaultValue={val as string}
                className="h-9 rounded-md border border-[#E5E7EB] px-3 text-sm text-[#1F2937] focus:outline-none focus:ring-2 focus:ring-[#2D5A27]/30" />
            </div>
          ))}
          <button type="submit" className="h-9 rounded-md bg-[#2D5A27] px-4 text-sm font-medium text-white hover:opacity-90">查询</button>
        </form>
      </div>
      <div className="mb-5 rounded-lg border border-[#E5E7EB] bg-white p-4">
        <p className="mb-3 text-[13px] font-medium text-[#1F2937]">客流趋势</p>
        <ChartContainer height={300} label="图表加载中…" />
      </div>
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-4 py-3"><p className="text-[13px] font-medium text-[#1F2937]">客流明细</p></div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["日期", "游客总数", "已入园", "已取消", "爽约"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="p-0"><EmptyState message="暂无客流数据，请选择日期范围后查询" /></TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
