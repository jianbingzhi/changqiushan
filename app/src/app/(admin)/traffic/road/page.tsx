import { PageHeader } from "@/lib/ui/page-header";
import { StatCard, KpiRow } from "@/lib/ui/stat-card";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { trafficService } from "@/modules/traffic";
import { formatCnDateTime } from "@/shared/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "实时路况查询 · 长秋山管理后台" };

export default async function TrafficRoadPage() {
  const { source, conditions } = await trafficService.getRoadConditions();

  const free = conditions.filter((c) => c.congestion === "畅通").length;
  const slow = conditions.filter((c) => c.congestion === "缓行").length;
  const jam  = conditions.filter((c) => c.congestion === "拥堵").length;
  const updatedAt = conditions[0]?.updatedAt ? formatCnDateTime(new Date(conditions[0].updatedAt)) : "—";

  // 诚实三态空态文案:未配置 / 服务异常 / 已接通但矩形内无路况
  const emptyMessage =
    source === "unconfigured"
      ? "高德地图 Key 未配置,暂无路况数据"
      : source === "error"
        ? "高德路况服务暂不可用(请检查 Key 或网络)"
        : "暂无路况数据";

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
      <div className="mb-4 flex h-[300px] items-center justify-center rounded-lg border border-border bg-muted">
        <p className="text-muted-foreground text-sm">高德实时路况地图待阶段5地图组件接入后展示</p>
      </div>

      {/* a11y 数据表 */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {["路段名", "拥堵等级", "描述", "更新时间"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {conditions.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="p-0"><EmptyState message={emptyMessage} /></TableCell></TableRow>
            ) : conditions.map((c, i) => (
              <TableRow key={i} className="hover:bg-muted/50">
                <TableCell className="font-medium text-foreground">{c.name}</TableCell>
                <TableCell>
                  <StatusChip status={c.congestion === "畅通" ? "ROAD_SMOOTH" : c.congestion === "缓行" ? "ROAD_SLOW" : "ROAD_JAM"} />
                </TableCell>
                <TableCell className="text-[13px] text-muted-foreground">{c.description}</TableCell>
                <TableCell className="text-[13px] text-muted-foreground">{c.updatedAt ? formatCnDateTime(new Date(c.updatedAt)) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
