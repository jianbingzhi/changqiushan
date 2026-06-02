import { analyticsRepository } from "@/modules/analytics";
import { formatCnDate } from "@/shared/format";
import { PageHeader } from "@/lib/ui/page-header";
import { StatCard, KpiRow } from "@/lib/ui/stat-card";
import { EmptyState } from "@/lib/ui/empty-state";
import { BarList } from "@/lib/ui/charts/BarList";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { FileDown } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "客流分析 · 长秋山管理后台" };

type Props = { searchParams: Promise<{ startDate?: string; endDate?: string }> };

export default async function AnalyticsTrafficPage({ searchParams }: Props) {
  const params = await searchParams;
  const startDate = params.startDate ?? "";
  const endDate   = params.endDate ?? "";

  // 默认近 30 天;日期为纯日期列,用 UTC 零点构造避免时区挪日
  const end = endDate ? new Date(endDate + "T00:00:00Z") : new Date();
  const start = startDate ? new Date(startDate + "T00:00:00Z") : (() => { const d = new Date(end); d.setDate(d.getDate() - 30); return d; })();
  const raw = await analyticsRepository.getDailyTraffic(start, end);
  const rows = raw.map((r) => ({
    date: r.date,
    total: Number(r.total_visitors),
    checkedIn: Number(r.checked_in_count),
    cancelled: Number(r.cancelled_count),
    noshow: Number(r.noshow_count),
  }));

  const totalAll = rows.reduce((s, r) => s + r.total, 0);
  const last7 = rows.slice(-7).reduce((s, r) => s + r.total, 0);
  const avgDaily = rows.length ? Math.round(totalAll / rows.length) : 0;

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
          <StatCard label="近 7 日游客总数" value={last7} unit="人次" />
          <StatCard label="区间游客总数" value={totalAll} unit="人次" />
          <StatCard label="平均日客流"   value={avgDaily} unit="人次" />
          <StatCard label="统计天数"     value={rows.length} unit="天" />
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
        <p className="mb-3 text-[13px] font-medium text-[#1F2937]">客流趋势（每日游客总数）</p>
        <BarList height={300} emptyText="所选区间暂无客流数据" data={rows.map((r) => ({ label: formatCnDate(r.date), value: r.total, hint: `${r.total} 人` }))} />
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
              <TableRow><TableCell colSpan={5} className="p-0"><EmptyState message="所选区间暂无客流数据" /></TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.date} className="hover:bg-[#F9FAFB]">
                <TableCell className="text-[13px] text-[#1F2937]">{formatCnDate(r.date)}</TableCell>
                <TableCell className="text-[13px]">{r.total}</TableCell>
                <TableCell className="text-[13px] text-[#2D5A27]">{r.checkedIn}</TableCell>
                <TableCell className="text-[13px] text-[#6B7280]">{r.cancelled}</TableCell>
                <TableCell className="text-[13px] text-[#DC2626]">{r.noshow}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
