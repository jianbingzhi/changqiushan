import { analyticsRepository } from "@/modules/analytics";
import { PageHeader } from "@/lib/ui/page-header";
import { EmptyState } from "@/lib/ui/empty-state";
import { BarList } from "@/lib/ui/charts/BarList";
import { Heatmap724 } from "@/lib/ui/screen/charts/Heatmap724";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { FileDown } from "lucide-react";

export const dynamic = "force-dynamic";
export const metadata = { title: "热力图分析 · 长秋山管理后台" };

export default async function AnalyticsHeatmapPage() {
  const raw = await analyticsRepository.getHourlyPeak();
  const rows = raw.map((r) => ({ hour: r.hour, avg: r.avg_visitors, max: Number(r.max_visitors) }));

  // 时段 × 星期 预约热力(复用 C4 MV analytics_weekly_hourly_heat,dow 0=周一..6=周日)
  const heat = await analyticsRepository.getWeeklyHourlyHeat();
  const weekMatrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const r of heat) {
    const inBounds = r.dow >= 0 && r.dow <= 6 && r.hour >= 0 && r.hour <= 23;
    if (inBounds) weekMatrix[r.dow][r.hour] = Number(r.bookings);
  }
  const hasHeat = heat.length > 0;

  return (
    <>
      <PageHeader title="热力图分析" description="景区内游客密度热力分布"
        actions={
          <a href="/api/export/heatmap" download className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-foreground hover:bg-muted">
            <FileDown className="h-4 w-4 text-muted-foreground" />导出 Excel
          </a>
        }
      />
      <div className="mb-5 rounded-lg border border-border bg-card p-4">
        <p className="mb-1 text-[13px] font-medium text-foreground">时段 × 星期预约热力</p>
        <p className="mb-3 text-[12px] text-text-muted">按星期与小时聚合的预约分布，颜色越深预约越集中</p>
        {hasHeat ? (
          <Heatmap724 matrix={weekMatrix} variant="light" metricLabel="预约" height={340} />
        ) : (
          <EmptyState message="暂无时段×星期热力数据" />
        )}
      </div>
      <div className="mb-5 rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-[13px] font-medium text-foreground">各时段游客密度（峰值人数）</p>
        <BarList height={400} emptyText="暂无时段密度数据" data={rows.map((r) => ({ label: `${r.hour} 时`, value: r.max, hint: `峰值 ${r.max}` }))} />
      </div>
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3"><p className="text-[13px] font-medium text-foreground">各时段游客峰值</p></div>
        <Table>
          <TableHeader>
            <TableRow className="bg-muted">
              {["时段", "平均游客数", "峰值游客数"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="p-0"><EmptyState message="暂无时段峰值数据" /></TableCell></TableRow>
            ) : rows.map((r) => (
              <TableRow key={r.hour} className="hover:bg-muted">
                <TableCell className="text-[13px] text-foreground">{r.hour} 时</TableCell>
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
