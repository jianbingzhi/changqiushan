import { PageHeader } from "@/lib/ui/page-header";
import { EmptyState } from "@/lib/ui/empty-state";
import { ChartContainer } from "@/lib/ui/charts/ChartContainer";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { FileDown } from "lucide-react";

// TODO: import { analyticsRepository } from "@/modules/analytics";
export const dynamic = "force-dynamic";
export const metadata = { title: "来源分析 · 长秋山管理后台" };

export default async function AnalyticsSourcePage() {
  const rows: never[] = [];

  return (
    <>
      <PageHeader title="来源分析" description="游客来源渠道分布"
        actions={
          <a href="/api/export/source" download className="inline-flex items-center gap-1.5 rounded-md border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-medium text-[#1F2937] hover:bg-[#F9FAFB]">
            <FileDown className="h-4 w-4 text-[#6B7280]" />导出 Excel
          </a>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
          <p className="mb-3 text-[13px] font-medium text-[#1F2937]">渠道分布</p>
          <ChartContainer height={300} label="图表加载中…" />
        </div>
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
          <p className="mb-3 text-[13px] font-medium text-[#1F2937]">渠道说明</p>
          <ul className="space-y-2 text-[13px] text-[#6B7280]">
            {[["小程序预约", "经微信小程序入口发起"], ["现场补录", "工作人员现场补录"], ["OTA 渠道", "第三方 OTA 平台推送"], ["后台代录", "管理员 B 端后台代录"]].map(([name, desc]) => (
              <li key={name as string} className="flex gap-2">
                <span className="font-medium text-[#1F2937] shrink-0">{name}</span>
                <span>— {desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <div className="border-b border-[#E5E7EB] px-4 py-3"><p className="text-[13px] font-medium text-[#1F2937]">渠道明细</p></div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["渠道", "游客数量", "占比(%)"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="p-0"><EmptyState message="暂无渠道来源数据" /></TableCell></TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
