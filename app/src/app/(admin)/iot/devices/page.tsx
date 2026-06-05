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
        actions={
          <div className="flex items-center gap-2">
            <LiveDot alive />
            <span className="text-[13px] text-[#6B7280]">iot_event 频道</span>
          </div>
        }
      />
      <div className="mb-5">
        <KpiRow>
          <StatCard label="设备总数" value={total}   unit="台" />
          <StatCard label="在线"     value={online}  unit="台" />
          <StatCard label="离线"     value={offline} unit="台" />
          <StatCard label="告警"     value={alert}   unit="台" />
        </KpiRow>
      </div>
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-[#BFDBFE] bg-[#EFF6FF] px-4 py-3">
        <LiveDot alive />
        <p className="text-[13px] text-[#2563EB]">已接入 iot_event SSE 频道，设备状态与心跳实时更新</p>
      </div>
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["设备名称", "设备类型", "位置", "状态", "最后心跳时间", "延迟(ms)", "操作"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {devices.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="p-0"><EmptyState message="暂无设备数据（请先在数据库录入设备信息）" /></TableCell></TableRow>
            ) : devices.map((device) => {
              const isOffline = device.status === "OFFLINE";
              return (
                <TableRow key={device.id} className="hover:bg-[#F9FAFB]" style={isOffline ? { backgroundColor: "#FEF2F2" } : undefined}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <LiveDot alive={device.status === "ONLINE"} />
                      <span className="font-medium text-[#1F2937]">{device.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-[13px] text-[#6B7280]">{device.type}</TableCell>
                  <TableCell className="text-[13px] text-[#6B7280]">{device.location ?? "—"}</TableCell>
                  <TableCell>
                    <StatusChip status={device.status === "ONLINE" ? "DEVICE_ONLINE" : device.status === "ALERT" ? "DEVICE_ALERT" : "DEVICE_OFFLINE"} />
                  </TableCell>
                  <TableCell className="text-[13px] text-[#6B7280]">
                    {device.lastSeen ? formatCnDateTime(device.lastSeen) : "—"}
                  </TableCell>
                  <TableCell className="text-[13px] font-medium tabular-nums" style={{ color: "#9CA3AF" }}>—</TableCell>
                  <TableCell>
                    <Link href={`/iot/${device.id}`} className="text-[13px] text-[#2D5A27] hover:underline">查看详情</Link>
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
