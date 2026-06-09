import { analyticsRepository, analyticsService } from "@/modules/analytics";
import { PageHeader } from "@/lib/ui/page-header";
import { EmptyState } from "@/lib/ui/empty-state";
import { BarList } from "@/lib/ui/charts/BarList";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { FileDown } from "lucide-react";
import { channelLabel } from "@/shared/labels";
import { RegionMap } from "./_region-map";

export const dynamic = "force-dynamic";
export const metadata = { title: "来源分析 · 长秋山管理后台" };

export default async function AnalyticsSourcePage() {
  const raw = await analyticsRepository.getVisitorSource();
  const rows = raw.map((r) => ({
    channel: channelLabel(r.source_channel),
    count: Number(r.visitor_count),
    percentage: r.percentage,
  }));

  const regionRes = await analyticsService.getVisitorRegions("province");
  const provinceData = regionRes.ok ? regionRes.value : [];

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
          <BarList height={300} emptyText="暂无渠道数据" data={rows.map((r) => ({ label: r.channel, value: r.count, hint: `${r.percentage}%` }))} />
        </div>
        <div className="rounded-lg border border-[#E5E7EB] bg-white p-4">
          <p className="mb-3 text-[13px] font-medium text-[#1F2937]">渠道说明</p>
          <ul className="space-y-2 text-[13px] text-[#6B7280]">
            {[["微信小程序", "经微信小程序入口发起"], ["现场补录", "工作人员现场补录"], ["第三方平台", "第三方平台（美团/携程等）推送"], ["后台代录", "管理员 B 端后台代录"]].map(([name, desc]) => (
              <li key={name as string} className="flex gap-2">
                <span className="font-medium text-[#1F2937] shrink-0">{name}</span>
                <span>— {desc}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      {/* B33 来源行政图(身份证签发地 → 省/市/区县下钻) */}
      <div className="mb-5">
        <p className="mb-2 text-[13px] font-medium text-[#1F2937]">来源地区分布(行政区划下钻)</p>
        <RegionMap provinceData={provinceData} />
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
            ) : rows.map((r) => (
              <TableRow key={r.channel} className="hover:bg-[#F9FAFB]">
                <TableCell className="text-[13px] text-[#1F2937]">{r.channel}</TableCell>
                <TableCell className="text-[13px]">{r.count}</TableCell>
                <TableCell className="text-[13px]">{r.percentage}%</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
