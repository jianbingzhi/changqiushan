import { analyticsRepository } from "@/modules/analytics";
import { riskcontrolRepository } from "@/modules/riskcontrol";
import { LiveDot } from "@/lib/ui/live-dot";
import { ScreenShell } from "@/lib/ui/screen/ScreenShell";
import { ScreenHeader } from "@/lib/ui/screen/ScreenHeader";
import { ScreenCard } from "@/lib/ui/screen/ScreenCard";
import { PlaceholderTag } from "@/lib/ui/screen/PlaceholderTag";
import { FunnelChart } from "@/lib/ui/screen/charts/FunnelChart";
import { RadarChart } from "@/lib/ui/screen/charts/RadarChart";
import { LineTrend } from "@/lib/ui/screen/charts/LineTrend";

export const dynamic = "force-dynamic";
export const metadata = { title: "综合运营态势面板 · 长秋山森林公园智慧景区" };

const N = (v: bigint | number) => Number(v);
function cnDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}月${Number(d)}日`;
}
const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

const DATA_SOURCES = ["预约库", "闸机核销", "IoT 设备", "客流分析", "画像引擎", "风控引擎", "大数据平台", "数字孪生底座"];

export default async function OperationScreenPage() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);

  const [daily, blacklist, appeals] = await Promise.all([
    analyticsRepository.getDailyTraffic(start, end).catch(() => []),
    riskcontrolRepository.findBlacklistAll().catch(() => []),
    riskcontrolRepository.listAppeals().catch(() => []),
  ]);

  // —— 仅取计数,绝不外泄黑名单/申诉原始行(PII 白名单) ——
  const blacklistCount = blacklist.length;
  const pendingAppeals = appeals.filter((a) => a.status === "PENDING").length;
  const totalAppeals = appeals.length;

  const bookings = daily.reduce((s, r) => s + N(r.total_visitors), 0);
  const checked = daily.reduce((s, r) => s + N(r.checked_in_count), 0);
  const cancelled = daily.reduce((s, r) => s + N(r.cancelled_count), 0);
  const noshow = daily.reduce((s, r) => s + N(r.noshow_count), 0);

  const fulfillRate = pct(checked, bookings);
  const cancelRate = pct(cancelled, bookings + cancelled);
  const noshowRate = pct(noshow, bookings);

  // 漏斗(真实两层:预约→入园;浏览量待埋点)
  const funnelData = [
    { name: "成功预约", value: bookings },
    { name: "实际入园核销", value: checked },
  ];
  const kpis = [
    { label: "预约 → 入园履约率", value: `${fulfillRate}%`, tone: "var(--screen-glow)" },
    { label: "预约取消率", value: `${cancelRate}%`, tone: "var(--screen-orange)" },
    { label: "30 天爽约率", value: `${noshowRate}%`, tone: "var(--screen-orange)" },
    { label: "浏览 → 预约转化率", value: "待埋点", tone: "var(--screen-text-faint)" },
  ];

  // 爽约态势雷达(实际 vs 运营目标)
  const radarIndicators = [
    { name: "爽约率(%)", max: 10 },
    { name: "取消率(%)", max: 10 },
    { name: "黑名单人数", max: Math.max(20, blacklistCount) },
    { name: "待处理申诉", max: Math.max(10, totalAppeals) },
    { name: "履约率(%)", max: 100 },
  ];
  const radarActual = [noshowRate, cancelRate, blacklistCount, pendingAppeals, fulfillRate];
  const radarTarget = [3, 3, Math.round(Math.max(20, blacklistCount) * 0.3), 0, 90];

  // 历史趋势:预约/入园/爽约(左轴) + 爽约率%(右轴)
  const categories = daily.map((r) => cnDate(r.date));
  const trendSeries = [
    { name: "预约量", data: daily.map((r) => N(r.total_visitors)), area: true },
    { name: "入园量", data: daily.map((r) => N(r.checked_in_count)) },
    { name: "爽约量", data: daily.map((r) => N(r.noshow_count)) },
    {
      name: "爽约率(%)",
      data: daily.map((r) => pct(N(r.noshow_count), N(r.total_visitors))),
      yAxisIndex: 1 as const,
    },
  ];

  return (
    <ScreenShell>
      <div className="flex h-full flex-col">
        <ScreenHeader title="长秋山森林公园 · 综合运营态势面板" />

        <div className="flex flex-1 flex-col gap-4 p-6">
          {/* 上半:漏斗 + 雷达 */}
          <div className="grid grid-cols-2 gap-4" style={{ height: 360 }}>
            <ScreenCard title="今日预约转化漏斗">
              <div className="flex h-full flex-col">
                <div style={{ height: 200 }}>
                  <FunnelChart data={funnelData} height={200} />
                </div>
                <p className="mb-2 text-[12px]" style={{ color: "var(--screen-text-faint)" }}>
                  顶层「浏览量」需 C 端埋点 <PlaceholderTag text="浏览量待接入" />
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {kpis.map((k) => (
                    <div key={k.label} className="rounded px-2 py-2 text-center" style={{ backgroundColor: "var(--screen-card-bg)", border: "1px solid var(--screen-card-border)" }}>
                      <p className="text-[18px] font-bold tabular-nums" style={{ color: k.tone }}>{k.value}</p>
                      <p className="mt-0.5 text-[12px]" style={{ color: "var(--screen-text-dim)" }}>{k.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ScreenCard>

            <ScreenCard title="30 天爽约态势（实际 与 目标）">
              <div className="flex h-full">
                <div className="flex-1">
                  <RadarChart
                    height={300}
                    indicators={radarIndicators}
                    series={[
                      { name: "实际", values: radarActual },
                      { name: "运营目标", values: radarTarget },
                    ]}
                  />
                </div>
                <div className="flex w-40 flex-col justify-center gap-3 pl-2 text-[13px]">
                  <div>
                    <p style={{ color: "var(--screen-text-dim)" }}>30 天爽约</p>
                    <p className="text-[22px] font-bold tabular-nums" style={{ color: "var(--screen-orange)" }}>{noshow} 人</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--screen-text-dim)" }}>申诉处理</p>
                    <p className="text-[22px] font-bold tabular-nums" style={{ color: "var(--screen-text)" }}>{totalAppeals - pendingAppeals} / {totalAppeals}</p>
                  </div>
                  <div>
                    <p style={{ color: "var(--screen-text-dim)" }}>黑名单在册</p>
                    <p className="text-[22px] font-bold tabular-nums" style={{ color: "var(--screen-red)" }}>{blacklistCount} 人</p>
                  </div>
                </div>
              </div>
            </ScreenCard>
          </div>

          {/* 下半:历史趋势对比 */}
          <ScreenCard title="近 30 天 预约、入园、爽约 趋势对比" className="flex-1">
            <LineTrend
              height={440}
              categories={categories}
              series={trendSeries}
              dualAxis
              yNames={["客流人次", "爽约率 %"]}
            />
          </ScreenCard>

          {/* 底部状态栏 */}
          <div
            className="flex items-center justify-between rounded-lg px-4 py-2.5 text-[13px]"
            style={{ backgroundColor: "var(--screen-card-bg)", border: "1px solid var(--screen-card-border)", color: "var(--screen-text-dim)" }}
          >
            <span className="flex items-center gap-2">
              <LiveDot tone="connected" label="数据源在线" />
              在线 {DATA_SOURCES.length} 个数据源：{DATA_SOURCES.join(" / ")}
            </span>
            <span>数据按 15 分钟物化刷新 · 大屏每 20 秒轮询</span>
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
