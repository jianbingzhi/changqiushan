import { PageHeader } from "@/lib/ui/page-header";
import { StatCard, KpiRow } from "@/lib/ui/stat-card";
import { StatusChip } from "@/lib/ui/status-chip";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { trafficRepository } from "@/modules/traffic";
import { formatCnDateTime } from "@/shared/format";
import { ParkingForm, type ParkingLotRow } from "./_parking-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "停车场动静态上图 · 长秋山管理后台" };

function toCoord(value: unknown): { lng: number | null; lat: number | null } {
  if (value && typeof value === "object" && "lng" in value && "lat" in value) {
    const v = value as { lng: unknown; lat: unknown };
    return {
      lng: typeof v.lng === "number" ? v.lng : null,
      lat: typeof v.lat === "number" ? v.lat : null,
    };
  }
  return { lng: null, lat: null };
}

export default async function TrafficParkingPage() {
  const lots = await trafficRepository.listParkingLots().catch(() => []);

  const totalSpaces   = lots.reduce((s, p) => s + p.capacity, 0);
  const totalOccupied = lots.reduce((s, p) => s + p.occupied, 0);
  const fullCount     = lots.filter((p) => p.status === "FULL").length;

  const lotRows: ParkingLotRow[] = lots.map((lot) => {
    const { lng, lat } = toCoord(lot.coordinates);
    return { id: lot.id, name: lot.name, capacity: lot.capacity, status: lot.status, location: lot.location, lng, lat };
  });

  return (
    <>
      <PageHeader title="停车场动静态上图" description="景区停车场状态监控"
        actions={<span className="text-[13px] text-text-muted">数据定时刷新</span>}
      />
      <div className="mb-5">
        <KpiRow>
          <StatCard label="停车位总数" value={totalSpaces} unit="个" />
          <StatCard label="当前占用" value={totalOccupied} unit="个" />
          <StatCard label="剩余车位" value={totalSpaces - totalOccupied} unit="个" />
          <StatCard label="满车场数量" value={fullCount} unit="个" />
        </KpiRow>
      </div>

      <ParkingForm lots={lotRows} />

      {/* 地图占位 */}
      <div className="mb-4 rounded-lg border border-border bg-card p-4">
        <p className="mb-3 text-[13px] font-medium text-muted-foreground">停车场分布地图</p>
        <div className="flex h-[300px] items-center justify-center rounded bg-muted" role="img" aria-label="地图加载中">
          <span className="text-[14px] text-text-muted">地图加载中…</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {["停车场名称", "总车位", "已占用", "剩余", "状态", "更新时间"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {lots.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="p-0"><EmptyState message="暂无停车场数据（请先在数据库录入停车场信息）" /></TableCell></TableRow>
            ) : lots.map((lot) => {
              const remaining = lot.capacity - lot.occupied;
              return (
                <TableRow key={lot.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{lot.name}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{lot.capacity}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{lot.occupied}</TableCell>
                  <TableCell className={`text-[13px] font-medium ${remaining === 0 ? "text-danger" : "text-foreground"}`}>{remaining}</TableCell>
                  <TableCell>
                    <StatusChip status={lot.status === "OPEN" ? "LOT_OPEN" : lot.status === "FULL" ? "LOT_FULL" : "LOT_CLOSED"} />
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{formatCnDateTime(lot.updatedAt)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
