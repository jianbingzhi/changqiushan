import Link from "next/link";
import { PageHeader } from "@/lib/ui/page-header";
import { StatCard, KpiRow } from "@/lib/ui/stat-card";
import { StatusChip } from "@/lib/ui/status-chip";
import { LiveDot } from "@/lib/ui/live-dot";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { iotRepository } from "@/modules/iot";
import { formatCnDateTime } from "@/shared/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "实时设备列表 · 长秋山管理后台" };

export default async function IotDevicesPage() {
  const devices = await iotRepository.listDevices().catch(() => []);

  const total   = devices.length;
  const online  = devices.filter((d) => d.status === "ONLINE").length;
  const offline = devices.filter((d) => d.status === "OFFLINE").length;
  const alert   = devices.filter((d) => d.status === "ALERT").length;

  return (
    <>
      <PageHeader title="实时设备列表" description="物联网设备在线状态监控"
        actions={<span className="text-[13px] text-text-muted">数据定时刷新</span>}
      />
      <div className="mb-5">
        <KpiRow>
          <StatCard label="设备总数" value={total}   unit="台" />
          <StatCard label="在线"     value={online}  unit="台" />
          <StatCard label="离线"     value={offline} unit="台" />
          <StatCard label="告警"     value={alert}   unit="台" />
        </KpiRow>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {["设备名称", "设备类型", "位置", "状态", "最后心跳时间", "延迟(ms)", "操作"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-muted-foreground">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="p-0"><EmptyState message="暂无设备数据（请先在数据库录入设备信息）" /></TableCell></TableRow>
            ) : devices.map((device) => {
              const isOffline = device.status === "OFFLINE";
              return (
                <TableRow key={device.id} className={`hover:bg-muted/50 ${isOffline ? "bg-danger/10" : ""}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <LiveDot tone={device.status === "ONLINE" ? "online" : device.status === "ALERT" ? "alert" : "offline"} />
                      <span className="font-medium text-foreground">{device.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{device.type}</TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">{device.location ?? "—"}</TableCell>
                  <TableCell>
                    <StatusChip status={device.status === "ONLINE" ? "DEVICE_ONLINE" : device.status === "ALERT" ? "DEVICE_ALERT" : "DEVICE_OFFLINE"} />
                  </TableCell>
                  <TableCell className="text-[13px] text-muted-foreground">
                    {device.lastSeen ? formatCnDateTime(device.lastSeen) : "—"}
                  </TableCell>
                  <TableCell className="text-[13px] font-medium tabular-nums text-text-muted">—</TableCell>
                  <TableCell>
                    <Link href={`/iot/${device.id}`} className="text-[13px] text-primary hover:underline">查看详情</Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
