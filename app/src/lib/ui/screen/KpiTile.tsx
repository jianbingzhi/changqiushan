// 大屏 KPI 大字瓦片(派生自 realtime/_big-screen 的 KpiTile,远观可读放大字号)。
// tone 控制大数字颜色:primary 辉光绿(默认)/ highlight 白 / warn 橙 / danger 红。

type Tone = "primary" | "highlight" | "warn" | "danger";

const TONE_COLOR: Record<Tone, string> = {
  primary: "var(--screen-glow)",
  highlight: "var(--screen-highlight)",
  warn: "var(--screen-orange)",
  danger: "var(--screen-red)",
};

export function KpiTile({
  title,
  value,
  unit,
  sub,
  tone = "primary",
  danger = false,
  /** 大数字字号(px),默认 48 */
  valueSize = 48,
  children,
}: {
  title: string;
  value: string;
  unit?: string;
  sub?: React.ReactNode;
  tone?: Tone;
  danger?: boolean;
  valueSize?: number;
  /** 副区(如迷你柱/折线) */
  children?: React.ReactNode;
}) {
  const valueColor = danger ? TONE_COLOR.danger : TONE_COLOR[tone];
  return (
    <div
      className={`flex flex-col justify-between rounded-lg px-5 py-4 ${danger ? "screen-flash" : ""}`}
      style={{
        backgroundColor: danger ? "rgba(220,38,38,0.18)" : "var(--screen-card-bg)",
        border: `1px solid ${danger ? "rgba(220,38,38,0.6)" : "var(--screen-card-border)"}`,
      }}
    >
      <p className="text-[14px]" style={{ color: "var(--screen-text-dim)" }}>
        {title}
      </p>
      <p className="mt-1 flex items-baseline gap-1.5">
        <span
          className="font-bold tabular-nums leading-none"
          style={{ fontSize: valueSize, color: valueColor, textShadow: "var(--screen-glow-shadow)" }}
        >
          {value}
        </span>
        {unit && <span className="text-[16px]" style={{ color: "var(--screen-text-dim)" }}>{unit}</span>}
      </p>
      {sub && <p className="mt-1 text-[13px]" style={{ color: "var(--screen-text-dim)" }}>{sub}</p>}
      {children}
    </div>
  );
}
