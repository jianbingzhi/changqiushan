import { analyticsRepository } from "@/modules/analytics";
import { contentRepository } from "@/modules/content";
import { bookingRepository } from "@/modules/booking";
import { chinaTodayDbDate } from "@/shared/lib/time";
import { ScreenShell } from "@/lib/ui/screen/ScreenShell";
import { ScreenHeader } from "@/lib/ui/screen/ScreenHeader";
import { ScreenCard } from "@/lib/ui/screen/ScreenCard";
import { PlaceholderTag } from "@/lib/ui/screen/PlaceholderTag";
import { Heatmap724 } from "@/lib/ui/screen/charts/Heatmap724";

export const dynamic = "force-dynamic";
export const metadata = { title: "预约分时热力 · 长秋山森林公园智慧景区" };

const N = (v: bigint | number) => Number(v);

export default async function HeatmapScreenPage() {
  const [heat, pois, slots] = await Promise.all([
    analyticsRepository.getWeeklyHourlyHeat().catch(() => []),
    contentRepository.listPois().catch(() => []),
    bookingRepository.listSlotsByDate(chinaTodayDbDate()).catch(() => []),
  ]);

  const matrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  heat.forEach((r) => {
    const inRange = r.dow >= 0 && r.dow <= 6 && r.hour >= 0 && r.hour <= 23;
    if (inRange) matrix[r.dow][r.hour] = N(r.bookings);
  });

  // 今日熔断状态(真实:被动反映 slot.status,大屏不触发任何写入)
  const pausedToday = slots.some((s) => s.status === "PAUSED");
  const totalBooked = slots.reduce((s, sl) => s + sl.bookedCount, 0);
  const totalCapacity = slots.reduce((s, sl) => s + sl.capacity, 0);

  // POI 列表(真实名称;阈值/当前在园为 POI 级数据,待接入)
  const topPois = pois.filter((p) => p.status === "PUBLISHED").slice(0, 5);

  return (
    <ScreenShell>
      <div className="flex h-full flex-col">
        <ScreenHeader title="长秋山森林公园 · 预约分时热力矩阵" />

        <div className="grid flex-1 grid-cols-[70fr_30fr] gap-4 p-6">
          {/* 左:7×24 热力矩阵 */}
          <ScreenCard
            title="近 7 天 × 24 小时 预约量热力矩阵"
            extra={
              // 文件下载(非页面导航),用原生 a + download
              <a
                href="/api/screen/export/heatmap"
                download
                className="rounded px-3 py-1 text-[13px] font-medium"
                style={{ backgroundColor: "var(--screen-primary)", color: "var(--screen-highlight)" }}
              >
                下载 Excel
              </a>
            }
          >
            <Heatmap724 matrix={matrix} height={620} />
          </ScreenCard>

          {/* 右:面板堆叠 */}
          <div className="flex flex-col gap-4">
            <ScreenCard title="POI 阈值预警">
              <div className="flex flex-col gap-2">
                {topPois.length === 0 ? (
                  <p className="text-[14px]" style={{ color: "var(--screen-text-faint)" }}>暂无 POI 数据</p>
                ) : (
                  topPois.map((p) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded px-3 py-2 text-[14px]"
                      style={{ backgroundColor: "var(--screen-card-bg)", border: "1px solid var(--screen-card-border)" }}
                    >
                      <span style={{ color: "var(--screen-text)" }}>{p.name}</span>
                      <span style={{ color: "var(--screen-text-faint)" }}>阈值待配置</span>
                    </div>
                  ))
                )}
                <p className="mt-1 text-[12px]" style={{ color: "var(--screen-text-faint)" }}>
                  POI 级阈值与实时在园计数 <PlaceholderTag text="POI 阈值/在园计数待接入" />
                </p>
              </div>
            </ScreenCard>

            <ScreenCard title="阈值动态档案">
              <div className="flex h-full flex-col items-center justify-center gap-2 text-[14px]" style={{ color: "var(--screen-text-faint)" }}>
                工作日 / 周末 / 节假日 多档配置
                <PlaceholderTag text="阈值档案管理待接入" />
              </div>
            </ScreenCard>

            <ScreenCard title="今日熔断状态" className="flex-1">
              <div className="flex h-full flex-col items-center justify-center">
                <p className="text-[40px] font-bold" style={{ color: pausedToday ? "var(--screen-red)" : "var(--screen-glow)" }}>
                  {pausedToday ? "已熔断" : "正常"}
                </p>
                <p className="mt-1 text-[13px]" style={{ color: "var(--screen-text-dim)" }}>
                  今日预约 {totalBooked.toLocaleString("zh-CN")} / 容量 {totalCapacity.toLocaleString("zh-CN")}
                </p>
                {pausedToday && (
                  <p className="mt-1 text-[13px]" style={{ color: "var(--screen-red)" }}>
                    ⚠ 已达承载阈值 · 当日预约入口已自动暂停
                  </p>
                )}
                <p className="mt-3 text-[12px]" style={{ color: "var(--screen-text-faint)" }}>
                  历史熔断回放需快照表 <PlaceholderTag text="历史回放待接入" />
                </p>
              </div>
            </ScreenCard>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
