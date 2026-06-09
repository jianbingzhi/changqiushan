import { PageHeader } from "@/lib/ui/page-header";
import { StatCard, KpiRow } from "@/lib/ui/stat-card";
import { StatusChip } from "@/lib/ui/status-chip";
import { LiveDot } from "@/lib/ui/live-dot";
import { bookingService } from "@/modules/booking";
import { iotRepository } from "@/modules/iot";
import { configService } from "@/modules/system";
import { formatCnDate } from "@/shared/format";
import { chinaToday } from "@/shared/lib/time";
import { resolveInstantCapacity } from "@/shared/lib/capacity";
import Link from "next/link";
import { OccupancyCard } from "./_occupancy-card";
import { DashboardLiveProvider, HeaderLive } from "./_dashboard-live";

export const dynamic = "force-dynamic";
export const metadata = { title: "仪表盘 · 长秋山森林公园智慧景区管理后台" };

export default async function DashboardPage() {
  // B34: 用派生读路径(listSlotsForDate)而非裸 listSlotsByDate——否则当天无物化行时误显"暂无时段",
  // 与 onsite/日历口径不一致。listSlotsForDate 合并「派生虚拟行 + 已物化行(真实已用量)」。
  const [slots, devices, instantCapacity] = await Promise.all([
    bookingService.listSlotsForDate(chinaToday()).catch(() => []),
    iotRepository.listDevices().catch(() => []),
    configService.getInstantCapacity().catch(() => resolveInstantCapacity()),
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
        description={`${formatCnDate(chinaToday())} · 运营概览`}
        actions={<HeaderLive />}
      />

      {/* 在园人数卡：脏信号 + 回拉实时更新；分母为瞬时承载量(D1) */}
      <div className="mb-5">
        <KpiRow>
          <OccupancyCard capacity={instantCapacity} />
          <StatCard label="今日预约" value={todayBookings} unit="人次" />
          <StatCard label="时段状态"
            value={pausedCount > 0 ? `${pausedCount} 个暂停` : "正常"}
            trend={pausedCount > 0 ? -pausedCount : undefined}
          />
          <StatCard label="设备在线率" value={`${deviceOnlineRate}%`} />
        </KpiRow>
      </div>

      {/* 今日时段状态 */}
      <div className="mb-5 rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-[13px] font-semibold text-foreground">今日预约时段</p>
          <Link href="/booking/slots" className="text-[13px] text-primary hover:underline">查看全部 →</Link>
        </div>
        {slots.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">今日暂无时段数据</div>
        ) : (
          <div className="divide-y divide-muted">
            {slots.map((s) => {
              const pct = s.capacity > 0 ? Math.round(s.checkedInCount / s.capacity * 100) : 0;
              const warn = pct >= 90;
              return (
                <div key={s.id} className={`flex items-center justify-between px-4 py-3 ${warn ? "bg-danger/10" : ""}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{s.name}</span>
                    <span className="text-[13px] text-muted-foreground">{s.startTime}–{s.endTime}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[13px] ${warn ? "text-danger" : "text-muted-foreground"}`}>
                      在园 {s.checkedInCount}/{s.capacity}（{pct}%）
                    </span>
                    <StatusChip status={s.status === "ACTIVE" ? "ACTIVE" : s.status === "PAUSED" ? "PAUSED" : s.status === "CLOSED" ? "CLOSED" : "CANCELLED"} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 设备状态摘要 */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-[13px] font-semibold text-foreground">设备在线状态</p>
          <Link href="/iot/devices" className="text-[13px] text-primary hover:underline">查看全部 →</Link>
        </div>
        {devices.length === 0 ? (
          <div className="py-8 text-center text-[13px] text-muted-foreground">暂无设备数据</div>
        ) : (
          <div className="grid grid-cols-2 gap-0 divide-y divide-muted md:grid-cols-3">
            {devices.slice(0, 6).map((d) => (
              <div key={d.id} className="flex items-center gap-2 px-4 py-3">
                <LiveDot tone={d.status === "ONLINE" ? "online" : d.status === "ALERT" ? "alert" : "offline"} />
                <span className="text-[13px] font-medium text-foreground truncate">{d.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">{d.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLiveProvider>
  );
}
