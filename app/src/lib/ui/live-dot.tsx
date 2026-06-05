// 状态圆点。tone 显式指定语义色 + 中文标签(不靠颜色,a11y);
// 兼容旧用法 alive(true→online / false→offline)。
type Tone = "online" | "offline" | "alert" | "connected" | "disconnected";

interface LiveDotProps {
  alive?: boolean;
  tone?: Tone;
  /** 覆盖默认中文标签(用于 aria-label / title) */
  label?: string;
}

const TONE_CONFIG: Record<Tone, { cls: string; label: string }> = {
  online:       { cls: "animate-pulse bg-green-500", label: "在线" },
  connected:    { cls: "animate-pulse bg-green-500", label: "实时连接正常" },
  alert:        { cls: "animate-pulse bg-red-500",   label: "告警" },
  offline:      { cls: "bg-gray-400",                label: "离线" },
  disconnected: { cls: "bg-gray-400",                label: "实时连接断开" },
};

export function LiveDot({ alive = true, tone, label }: LiveDotProps) {
  const t: Tone = tone ?? (alive ? "online" : "offline");
  const cfg = TONE_CONFIG[t];
  const text = label ?? cfg.label;
  return (
    <span
      role="img"
      aria-label={text}
      title={text}
      className={`inline-block w-2 h-2 rounded-full ${cfg.cls}`}
    />
  );
}
