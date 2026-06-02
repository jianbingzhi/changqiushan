import { PageHeader } from "@/lib/ui/page-header";
import { StatCard, KpiRow } from "@/lib/ui/stat-card";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { fetchTrafficConditions } from "@/lib/amap";
import { formatCnDateTime } from "@/shared/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "实时路况查询 · 长秋山管理后台" };

export default async function TrafficRoadPage() {
  const conditions = await fetchTrafficConditions("长秋山").catch(() => []);

  const free = conditions.filter((c) => c.congestion === "畅通").length;
  const slow = conditions.filter((c) => c.congestion === "缓行").length;
  const jam  = conditions.filter((c) => c.congestion === "拥堵").length;
  const updatedAt = conditions[0]?.updatedAt ? formatCnDateTime(new Date(conditions[0].updatedAt)) : "—";

  return (
    <>
      <PageHeader title="实时路况查询" description="景区周边路况与分流建议" />
      <div className="mb-6">
        <KpiRow>
          <StatCard label="畅通路段" value={free} unit="条" />
          <StatCard label="缓行路段" value={slow} unit="条" />
          <StatCard label="拥堵路段" value={jam} unit="条" />
          <StatCard label="最后更新" value={updatedAt} />
        </KpiRow>
      </div>

      {/* 地图占位 */}
      <div className="mb-4 rounded-lg border border-[#E5E7EB] bg-[#F3F4F6] flex items-center justify-center" style={{ height: 300 }}>
        <p className="text-[#6B7280] text-sm">高德实时路况地图待阶段5地图组件接入后展示</p>
      </div>

      {/* a11y 数据表 */}
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["路段名", "拥堵等级", "描述", "更新时间"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {conditions.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="p-0"><EmptyState message="暂无路况数据" /></TableCell></TableRow>
            ) : conditions.map((c, i) => (
              <TableRow key={i} className="hover:bg-[#F9FAFB]">
                <TableCell className="font-medium text-[#1F2937]">{c.name}</TableCell>
                <TableCell>
                  <StatusChip status={c.congestion === "畅通" ? "ACTIVE" : c.congestion === "缓行" ? "PAUSED" : "BLACKLISTED"} />
                </TableCell>
                <TableCell className="text-[13px] text-[#6B7280]">{c.description}</TableCell>
                <TableCell className="text-[13px] text-[#6B7280]">{c.updatedAt ? formatCnDateTime(new Date(c.updatedAt)) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
