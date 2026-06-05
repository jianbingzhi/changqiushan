import Link from "next/link";
import { PageHeader } from "@/lib/ui/page-header";
import { StatusChip } from "@/lib/ui/status-chip";
import { LiveDot } from "@/lib/ui/live-dot";
import { EmptyState } from "@/lib/ui/empty-state";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/lib/ui/table";
import { iotRepository } from "@/modules/iot";
import { formatCnDateTime } from "@/shared/format";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ deviceId: string }> }) {
  const { deviceId } = await params;
  const device = await iotRepository.getDevice(deviceId).catch(() => null);
  return { title: `${device?.name ?? "设备详情"} · 长秋山管理后台` };
}

function latencyColor(ms: number) {
  if (ms < 100) return "#16A34A";
  if (ms < 300) return "#D97706";
  return "#DC2626";
}

type Props = { params: Promise<{ deviceId: string }> };

export default async function IotDeviceDetailPage({ params }: Props) {
  const { deviceId } = await params;
  const [device, heartbeats] = await Promise.all([
    iotRepository.getDevice(deviceId).catch(() => null),
    iotRepository.getRecentHeartbeats(deviceId, 50).catch(() => []),
  ]);

  return (
    <>
      <PageHeader
        title={device?.name ?? "设备详情"}
        description={`设备编号：${deviceId.slice(0, 8)}`}
        actions={
          <Link href="/iot/devices" className="text-[13px] text-[#6B7280] hover:text-[#1F2937]">
            ← 返回设备列表
          </Link>
        }
      />

      {/* 设备基本信息 */}
      <div className="mb-5 rounded-lg border border-[#E5E7EB] bg-white p-5">
        <h2 className="mb-4 text-[14px] font-semibold text-[#1F2937]">设备基本信息</h2>
        {device ? (
          <dl className="grid grid-cols-2 gap-x-8 gap-y-3">
            {([
              ["设备名称", device.name],
              ["设备类型", device.type],
              ["位置",     device.location ?? "—"],
              ["状态",     <StatusChip key="status" status={device.status === "ONLINE" ? "DEVICE_ONLINE" : device.status === "ALERT" ? "DEVICE_ALERT" : "DEVICE_OFFLINE"} />],
              ["最后在线时间", device.lastSeen ? formatCnDateTime(device.lastSeen) : "—"],
            ] as [string, React.ReactNode][]).map(([label, value]) => (
              <div key={label as string} className="flex flex-col gap-0.5">
                <dt className="text-[12px] text-[#6B7280]">{label as string}</dt>
                <dd className="text-[13px] text-[#1F2937]">{value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <EmptyState message="设备不存在或数据尚未接入" />
        )}
      </div>

      {/* 心跳数据 */}
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-5 py-3">
          <h2 className="text-[14px] font-semibold text-[#1F2937]">近 24 小时心跳数据</h2>
          <div className="flex items-center gap-2">
            <LiveDot tone={device?.status === "ONLINE" ? "online" : device?.status === "ALERT" ? "alert" : "offline"} />
            <span className="text-[12px] text-[#6B7280]">心跳数据定时刷新</span>
          </div>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="bg-[#F9FAFB]">
              {["记录时间", "延迟(ms)", "丢包率(%)", "信号强度(dBm)"].map((h) => (
                <TableHead key={h} className="text-xs font-semibold text-[#6B7280]">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {heartbeats.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="p-0"><EmptyState message="暂无心跳记录" /></TableCell></TableRow>
            ) : heartbeats.map((hb) => (
              <TableRow key={hb.id} className="hover:bg-[#F9FAFB]">
                <TableCell className="text-[13px] text-[#6B7280]">{formatCnDateTime(hb.recordedAt)}</TableCell>
                <TableCell className="text-[13px] font-medium tabular-nums" style={{ color: latencyColor(hb.latency) }}>{hb.latency}</TableCell>
                <TableCell className="text-[13px] tabular-nums">{Number(hb.packetLoss).toFixed(1)}</TableCell>
                <TableCell className="text-[13px] tabular-nums">{hb.signalStrength ?? "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
