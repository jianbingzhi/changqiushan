import Link from "next/link";

export const metadata = { title: "数字大屏导航 · 长秋山森林公园智慧景区" };

// 大屏导航中枢:7 块大屏的入口(值守可挑屏上墙)。本身即无登录可访问的大屏壳。
const SCREENS = [
  { slug: "situation", code: "C1", title: "综合态势主屏", desc: "数字孪生指挥中心 · 四象限综合态势" },
  { slug: "operation", code: "C2", title: "运营态势面板", desc: "漏斗 · 雷达 · 双轴趋势" },
  { slug: "trend", code: "C3", title: "客流与预约趋势", desc: "多曲线 · 时段堆叠 · 地域占比" },
  { slug: "heatmap", code: "C4", title: "预约分时热力", desc: "7×24 热力矩阵 · POI 阈值" },
  { slug: "overview", code: "C5", title: "数据概览首屏", desc: "8 卡矩阵 · 画像快照 · 同期对比" },
  { slug: "twin", code: "C6", title: "数字孪生导览图", desc: "三维导览 · 设备运维孪生面板" },
  { slug: "poster", code: "C7", title: "运营宣传一张图", desc: "运营 KPI · 设施调度 · 多维分析" },
];

export default function ScreenIndexPage() {
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 p-12">
      <header className="text-center">
        <h1
          className="text-4xl font-bold tracking-wide"
          style={{ color: "var(--screen-highlight)", textShadow: "var(--screen-glow-shadow)" }}
        >
          长秋山森林公园智慧景区 · 数字大屏
        </h1>
        <p className="mt-3 text-base" style={{ color: "var(--screen-text-dim)" }}>
          挂墙展示大屏导航 · 共 {SCREENS.length} 块
        </p>
      </header>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {SCREENS.map((s) => (
          <Link
            key={s.slug}
            href={`/screen/${s.slug}`}
            className="group rounded-lg border p-6 transition hover:-translate-y-0.5"
            style={{
              backgroundColor: "var(--screen-card-bg)",
              borderColor: "var(--screen-card-border)",
            }}
          >
            <div
              className="mb-2 inline-block rounded px-2 py-0.5 text-sm font-semibold"
              style={{ backgroundColor: "var(--screen-primary)", color: "var(--screen-highlight)" }}
            >
              {s.code}
            </div>
            <h2 className="text-xl font-bold" style={{ color: "var(--screen-text)" }}>
              {s.title}
            </h2>
            <p className="mt-2 text-sm" style={{ color: "var(--screen-text-dim)" }}>
              {s.desc}
            </p>
          </Link>
        ))}
      </div>
    </main>
  );
}
