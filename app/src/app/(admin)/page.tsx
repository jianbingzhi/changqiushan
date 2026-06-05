import { PageHeader } from "@/lib/ui/page-header";
import { StatCard, KpiRow } from "@/lib/ui/stat-card";
import { StatusChip } from "@/lib/ui/status-chip";
import { LiveDot } from "@/lib/ui/live-dot";
import { bookingRepository } from "@/modules/booking";
import { iotRepository } from "@/modules/iot";
import { formatCnDate } from "@/shared/format";
import { getInstantCapacity } from "@/shared/lib/capacity";
import Link from "next/link";
import { OccupancyCard } from "./_occupancy-card";
import { DashboardLiveProvider, HeaderLive } from "./_dashboard-live";

export const dynamic = "force-dynamic";
export const metadata = { title: "仪表盘 · 长秋山森林公园智慧景区管理后台" };

export default async function DashboardPage() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [slots, devices] = await Promise.all([
    bookingRepository.listSlotsByDate(today).catch(() => []),
    iotRepository.listDevices().catch(() => []),
  ]);

  const todayBookings   = slots.reduce((s, sl) => s + sl.bookedCount, 0);
  const checkedInCount  = slots.reduce((s, sl) => s + sl.checkedInCount, 0);
  const pausedCount     = slots.filter((s) => s.status === "PAUSED").length;
  const onlineDevices   = devices.filter((d) => d.status === "ONLINE").length;
  const deviceOnlineRate = devices.length > 0
    ? Math.round((onlineDevices / devices.length) * 100)
    : 0;

  return (
    <DashboardLiveProvider initialCount={checkedInCount}>
      <PageHeader
        description={`${formatCnDate(today)} · 运营概览`}
        actions={<HeaderLive />}
      />

      {/* 在园人数卡：脏信号 + 回拉实时更新；分母为瞬时承载量(D1) */}
      <div className="mb-5">
        <KpiRow>
          <OccupancyCard capacity={getInstantCapacity()} />
          <StatCard label="今日预约" value={todayBookings} unit="人次" />
          <StatCard label="时段状态"
            value={pausedCount > 0 ? `${pausedCount} 个暂停` : "正常"}
            trend={pausedCount > 0 ? -pausedCount : undefined}
          />
          <StatCard label="设备在线率" value={`${deviceOnlineRate}%`} />
        </KpiRow>
      </div>

      {/* 今日时段状态 */}
      <div className="mb-5 rounded-lg border border-[#E5E7EB] bg-white">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#1F2937]">今日预约时段</p>
          <Link href="/booking/slots" className="text-[13px] text-[#2D5A27] hover:underline">查看全部 →</Link>
        </div>
        {slots.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[#6B7280]">今日暂无时段数据</div>
        ) : (
          <div className="divide-y divide-[#F3F4F6]">
            {slots.map((s) => {
              const pct = s.capacity > 0 ? Math.round(s.checkedInCount / s.capacity * 100) : 0;
              const warn = pct >= 90;
              return (
                <div key={s.id} className={`flex items-center justify-between px-4 py-3 ${warn ? "bg-[#FEF2F2]" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-[#1F2937]">{s.name}</span>
                    <span className="text-[13px] text-[#6B7280]">{s.startTime}–{s.endTime}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[13px]" style={{ color: warn ? "#DC2626" : "#6B7280" }}>
                      在园 {s.checkedInCount}/{s.capacity}（{pct}%）
                    </span>
                    <StatusChip status={s.status === "ACTIVE" ? "ACTIVE" : s.status === "PAUSED" ? "PAUSED" : "CANCELLED"} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 设备状态摘要 */}
      <div className="rounded-lg border border-[#E5E7EB] bg-white">
        <div className="flex items-center justify-between border-b border-[#E5E7EB] px-4 py-3">
          <p className="text-[13px] font-semibold text-[#1F2937]">设备在线状态</p>
          <Link href="/iot/devices" className="text-[13px] text-[#2D5A27] hover:underline">查看全部 →</Link>
        </div>
        {devices.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-[#6B7280]">暂无设备数据</div>
        ) : (
          <div className="grid grid-cols-2 gap-0 divide-y divide-[#F3F4F6] md:grid-cols-3">
            {devices.slice(0, 6).map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-4 py-3">
                <LiveDot tone={d.status === "ONLINE" ? "online" : d.status === "ALERT" ? "alert" : "offline"} />
                <span className="text-[13px] font-medium text-[#1F2937] truncate">{d.name}</span>
                <span className="ml-auto text-xs text-[#6B7280]">{d.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLiveProvider>
  );
}
