import { analyticsRepository } from "@/modules/analytics";
import { ScreenShell } from "@/lib/ui/screen/ScreenShell";
import { ScreenHeader } from "@/lib/ui/screen/ScreenHeader";
import { ScreenCard } from "@/lib/ui/screen/ScreenCard";
import { PlaceholderTag } from "@/lib/ui/screen/PlaceholderTag";
import { LineTrend } from "@/lib/ui/screen/charts/LineTrend";
import { StackedBar } from "@/lib/ui/screen/charts/StackedBar";
import { DonutChart } from "@/lib/ui/screen/charts/DonutChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "客流与预约趋势 · 长秋山森林公园智慧景区" };

const N = (v: bigint | number) => Number(v);
function cnDate(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)}月${Number(d)}日`;
}

// 24h → 6 时段桶
const PERIODS: { label: string; from: number; to: number }[] = [
  { label: "清晨", from: 5, to: 8 },
  { label: "上午", from: 8, to: 12 },
  { label: "午间", from: 12, to: 14 },
  { label: "下午", from: 14, to: 17 },
  { label: "傍晚", from: 17, to: 19 },
  { label: "夜场", from: 19, to: 23 },
];

export default async function TrendScreenPage() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);

  const [daily, hourly] = await Promise.all([
    analyticsRepository.getDailyTraffic(start, end).catch(() => []),
    analyticsRepository.getHourlyPeak().catch(() => []),
  ]);

  const categories = daily.map((r) => cnDate(r.date));
  const lineSeries = [
    { name: "预约总数", data: daily.map((r) => N(r.total_visitors)), area: true },
    { name: "入园核销", data: daily.map((r) => N(r.checked_in_count)) },
    { name: "取消", data: daily.map((r) => N(r.cancelled_count)) },
    { name: "爽约", data: daily.map((r) => N(r.noshow_count)) },
  ];

  // 时段桶(按小时均值聚合)
  const hourMap = new Map(hourly.map((h) => [h.hour, h.avg_visitors]));
  const periodData = PERIODS.map((p) => {
    let sum = 0;
    for (let h = p.from; h < p.to; h++) sum += hourMap.get(h) ?? 0;
    return Math.round(sum);
  });

  // 周末 vs 工作日(按日期 dow 聚合预约总数)
  let weekend = 0;
  let weekday = 0;
  daily.forEach((r) => {
    const dow = new Date(`${r.date}T00:00:00Z`).getUTCDay();
    const v = N(r.total_visitors);
    if (dow === 0 || dow === 6) weekend += v;
    else weekday += v;
  });

  // 底部统计表(近 10 日,倒序)
  const tableRows = [...daily]
    .slice(-10)
    .reverse()
    .map((r) => {
      const total = N(r.total_visitors);
      const checked = N(r.checked_in_count);
      return {
        date: cnDate(r.date),
        total,
        checked,
        cancelled: N(r.cancelled_count),
        noshow: N(r.noshow_count),
        rate: total > 0 ? `${Math.round((checked / total) * 1000) / 10}%` : "—",
      };
    });
  const peakTotal = Math.max(0, ...tableRows.map((r) => r.total));

  return (
    <ScreenShell>
      <div className="flex h-full flex-col">
        <ScreenHeader title="长秋山森林公园 · 客流与预约趋势大屏" />

        <div className="flex flex-1 flex-col gap-3 p-6">
          {/* 范围条(挂墙只读;高级下钻待接入) */}
          <div
            className="flex items-center justify-between rounded-lg px-4 py-2.5 text-[14px]"
            style={{ backgroundColor: "var(--screen-card-bg)", border: "1px solid var(--screen-card-border)", color: "var(--screen-text-dim)" }}
          >
            <span>统计范围：近 30 天 · 全部区域 · 全部客群 · 按天粒度</span>
            <PlaceholderTag text="区域/客群多维下钻待接入" />
          </div>

          {/* 主图表双列 */}
          <div className="grid grid-cols-[65fr_35fr] gap-4" style={{ height: 480 }}>
            <ScreenCard title="近 30 天客流趋势">
              <LineTrend height={400} categories={categories} series={lineSeries} />
            </ScreenCard>
            <ScreenCard title="时段维度对比（日均人次）">
              <StackedBar height={400} categories={PERIODS.map((p) => p.label)} series={[{ name: "日均人次", data: periodData }]} />
            </ScreenCard>
          </div>

          {/* 多维切片:3 区域饼占位 + 周末/工作日真实 */}
          <div className="grid grid-cols-4 gap-4" style={{ height: 220 }}>
            <ScreenCard title="本/外区县占比">
              <div className="flex h-full flex-col items-center justify-center gap-2 text-[14px]" style={{ color: "var(--screen-text-faint)" }}>
                需行政区划码表
                <PlaceholderTag text="地域画像待接入" />
              </div>
            </ScreenCard>
            <ScreenCard title="本/外市占比">
              <div className="flex h-full flex-col items-center justify-center gap-2 text-[14px]" style={{ color: "var(--screen-text-faint)" }}>
                需行政区划码表
                <PlaceholderTag text="地域画像待接入" />
              </div>
            </ScreenCard>
            <ScreenCard title="本/外省占比">
              <div className="flex h-full flex-col items-center justify-center gap-2 text-[14px]" style={{ color: "var(--screen-text-faint)" }}>
                需行政区划码表
                <PlaceholderTag text="地域画像待接入" />
              </div>
            </ScreenCard>
            <ScreenCard title="周末 / 工作日占比">
              <DonutChart
                height={170}
                data={[
                  { name: "周末", value: weekend },
                  { name: "工作日", value: weekday },
                ]}
                showLegend
              />
            </ScreenCard>
          </div>

          {/* 底部统计表 + Excel */}
          <ScreenCard
            title="每日客流明细"
            className="flex-1"
            extra={
              // 文件下载(非页面导航),用原生 a + download;Link 不适用于二进制附件下载
              <a
                href="/api/screen/export/trend"
                download
                className="rounded px-3 py-1 text-[13px] font-medium"
                style={{ backgroundColor: "var(--screen-primary)", color: "var(--screen-highlight)" }}
              >
                下载 Excel
              </a>
            }
          >
            <div className="h-full overflow-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr style={{ color: "var(--screen-text-dim)", borderBottom: "1px solid var(--screen-card-border)" }}>
                    <th className="px-3 py-2 text-left font-medium">日期</th>
                    <th className="px-3 py-2 text-right font-medium">预约总数</th>
                    <th className="px-3 py-2 text-right font-medium">入园核销</th>
                    <th className="px-3 py-2 text-right font-medium">取消</th>
                    <th className="px-3 py-2 text-right font-medium">爽约</th>
                    <th className="px-3 py-2 text-right font-medium">履约率</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center" style={{ color: "var(--screen-text-faint)" }}>
                        暂无客流数据
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((r) => (
                      <tr key={r.date} style={{ borderBottom: "1px solid rgba(232,245,233,0.06)" }}>
                        <td className="px-3 py-1.5" style={{ color: "var(--screen-text)" }}>
                          {r.date}
                          {r.total === peakTotal && peakTotal > 0 && (
                            <span className="ml-2 text-[12px]" style={{ color: "var(--screen-glow)" }}>峰值</span>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: "var(--screen-highlight)" }}>{r.total.toLocaleString("zh-CN")}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: "var(--screen-text)" }}>{r.checked.toLocaleString("zh-CN")}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: "var(--screen-text-dim)" }}>{r.cancelled}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: "var(--screen-text-dim)" }}>{r.noshow}</td>
                        <td className="px-3 py-1.5 text-right tabular-nums" style={{ color: "var(--screen-glow)" }}>{r.rate}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ScreenCard>
        </div>
      </div>
    </ScreenShell>
  );
}
