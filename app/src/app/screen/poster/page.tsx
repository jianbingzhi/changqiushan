import { analyticsRepository } from "@/modules/analytics";
import { trafficRepository } from "@/modules/traffic";
import { bookingService } from "@/modules/booking";
import { configService } from "@/modules/system";
import { resolveInstantCapacity } from "@/shared/lib/capacity";
import { chinaToday } from "@/shared/lib/time";
import { ScreenShell } from "@/lib/ui/screen/ScreenShell";
import { StaticMapImage } from "./_static-map";
import { ScreenHeader } from "@/lib/ui/screen/ScreenHeader";
import { ScreenCard } from "@/lib/ui/screen/ScreenCard";
import { PlaceholderTag } from "@/lib/ui/screen/PlaceholderTag";
import { Heatmap724 } from "@/lib/ui/screen/charts/Heatmap724";
import { ScatterChart } from "@/lib/ui/screen/charts/ScatterChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "运营宣传一张图 · 长秋山森林公园智慧景区" };

const N = (v: bigint | number) => Number(v);
const PARK_STATUS_CN: Record<string, string> = { OPEN: "开放", FULL: "已满", CLOSED: "关闭" };
const PARK_TONE: Record<string, string> = { OPEN: "var(--screen-glow)", FULL: "var(--screen-red)", CLOSED: "var(--screen-orange)" };

export default async function PosterScreenPage() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);

  const [heat, lots, slots, daily, capacity] = await Promise.all([
    analyticsRepository.getWeeklyHourlyHeat().catch(() => []),
    trafficRepository.listParkingLots().catch(() => []),
    bookingService.listSlotsForDate(chinaToday()).catch(() => []),
    analyticsRepository.getDailyTraffic(start, end).catch(() => []),
    configService.getInstantCapacity().catch(() => resolveInstantCapacity()),
  ]);

  const matrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  heat.forEach((r) => {
    const inRange = r.dow >= 0 && r.dow <= 6 && r.hour >= 0 && r.hour <= 23;
    if (inRange) matrix[r.dow][r.hour] = N(r.bookings);
  });

  const checkedIn = slots.reduce((s, sl) => s + sl.checkedInCount, 0);
  const pct = capacity > 0 ? Math.round((checkedIn / capacity) * 100) : 0;

  const scatterPoints: [number, number][] = daily.map((r) => [N(r.total_visitors), N(r.checked_in_count)]);

  // 调度建议(规则驱动,随承载率切换)
  const dispatch =
    pct >= 90
      ? ["⚠ 承载已达熔断阈值，当日预约入口已自动暂停", "启动主要景点分流广播", "联动接驳车疏导", "临时降低核销速率"]
      : pct >= 80
        ? ["承载率偏高（≥80%），密切监控", "预备分流广播与接驳车", "提示游客错峰入园"]
        : ["园区运行平稳，承载率处于安全区间", "按常规节奏运营"];

  return (
    <ScreenShell>
      <div className="flex h-full flex-col">
        <ScreenHeader title="长秋山森林公园 · 运营宣传一张图" />

        <div className="grid flex-1 grid-cols-2 gap-4 p-6">
          {/* 左列:专题一 GIS + 专题三 设施调度 + 专题四 多维分析 */}
          <div className="flex flex-col gap-4">
            <ScreenCard title="专题一 · 景区地图基础展示" className="flex-1">
              {process.env.AMAP_KEY ? (
                // 静态地图经服务端代理出图(/api/screen/staticmap 内拼 key,不泄进无登录大屏 HTML);
                // client 组件带 onError 兜底,代理 502 时回占位而非裂图(审计 P2-5)
                <StaticMapImage />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg" style={{ border: "1px dashed var(--screen-card-border)", backgroundColor: "rgba(45,90,39,0.08)" }}>
                  <p className="text-[15px]" style={{ color: "var(--screen-text-dim)" }}>GIS 基础底图 · 2D / 2.5D / 3D</p>
                  <PlaceholderTag text="高德地图 Key 未配置" />
                </div>
              )}
            </ScreenCard>

            <ScreenCard title="专题三 · 设施状态与资源调度">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="mb-1.5 text-[13px]" style={{ color: "var(--screen-text-dim)" }}>停车场状态</p>
                  <div className="flex flex-col gap-1">
                    {lots.length === 0 ? (
                      <p className="text-[13px]" style={{ color: "var(--screen-text-faint)" }}>暂无停车场</p>
                    ) : (
                      lots.slice(0, 5).map((l) => (
                        <div key={l.name} className="flex items-center justify-between text-[13px]">
                          <span className="truncate" style={{ color: "var(--screen-text)" }}>{l.name}</span>
                          <span style={{ color: PARK_TONE[l.status] ?? "var(--screen-text-dim)" }}>
                            {PARK_STATUS_CN[l.status] ?? l.status} {Math.max(0, l.capacity - l.occupied)}/{l.capacity}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                  <p className="mt-1.5 text-[12px]" style={{ color: "var(--screen-text-faint)" }}>
                    闸机吞吐 <PlaceholderTag text="闸机吞吐待接入" />
                  </p>
                </div>
                <div className="rounded-lg p-3" style={{ backgroundColor: "rgba(45,90,39,0.22)", border: "1px solid var(--screen-card-border)" }}>
                  <p className="mb-1.5 text-[13px] font-semibold" style={{ color: "var(--screen-glow)" }}>资源调度建议</p>
                  <ul className="flex flex-col gap-1 text-[13px]" style={{ color: "var(--screen-text)" }}>
                    {dispatch.map((d, i) => (
                      <li key={i}>· {d}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </ScreenCard>

            <ScreenCard title="专题四 · 多维度智能分析">
              <ScatterChart
                height={180}
                xName="预约量"
                yName="入园量"
                series={[{ name: "近 30 天每日（预约×入园）", points: scatterPoints }]}
              />
              <p className="mt-1 text-center text-[12px]" style={{ color: "var(--screen-text-faint)" }}>
                第三维（消费 / 客源）<PlaceholderTag text="消费与客源维度待接入" />
              </p>
            </ScreenCard>
          </div>

          {/* 右列:专题二 运营KPI热力 + 专题五 沉浸漫游 */}
          <div className="flex flex-col gap-4">
            <ScreenCard title="专题二 · 景区运营 KPI 热力图" className="flex-1">
              <div className="mb-2 grid grid-cols-3 gap-2">
                <div className="rounded px-3 py-2 text-center" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                  <p className="text-[22px] font-bold tabular-nums" style={{ color: "var(--screen-glow)" }}>{checkedIn.toLocaleString("zh-CN")}</p>
                  <p className="text-[12px]" style={{ color: "var(--screen-text-dim)" }}>今日客流</p>
                </div>
                <div className="rounded px-3 py-2 text-center" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                  <p className="text-[22px] font-bold tabular-nums" style={{ color: pct >= 80 ? "var(--screen-orange)" : "var(--screen-glow)" }}>{pct}%</p>
                  <p className="text-[12px]" style={{ color: "var(--screen-text-dim)" }}>承载率</p>
                </div>
                <div className="rounded px-3 py-2 text-center" style={{ backgroundColor: "var(--screen-card-bg)" }}>
                  <p className="text-[22px] font-bold tabular-nums" style={{ color: "var(--screen-glow)" }}>0 元</p>
                  <p className="text-[12px]" style={{ color: "var(--screen-text-dim)" }}>单日营运收入（免费景区）</p>
                </div>
              </div>
              <Heatmap724 matrix={matrix} height={280} />
            </ScreenCard>

            <ScreenCard title="专题五 · 沉浸式三维漫游" className="flex-1">
              <div className="flex h-full flex-col items-center justify-center gap-3 rounded-lg" style={{ border: "1px dashed var(--screen-card-border)", backgroundColor: "rgba(45,90,39,0.08)" }}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full" style={{ border: "2px solid var(--screen-glow)", color: "var(--screen-glow)", boxShadow: "var(--screen-glow-shadow)" }}>▶</div>
                <p className="text-[15px]" style={{ color: "var(--screen-text-dim)" }}>沉浸式三维漫游预览</p>
                <div className="flex gap-2 text-[12px]" style={{ color: "var(--screen-text-faint)" }}>
                  <span>主路 · 山门→观云台</span><span>古杉路</span><span>瀑布路</span><span>全景路</span>
                </div>
                <PlaceholderTag text="三维漫游渲染待接入（依赖地图）" />
              </div>
            </ScreenCard>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
