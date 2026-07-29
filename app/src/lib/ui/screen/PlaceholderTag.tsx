// 占位/示例数据视觉标注(风险缓解:防 mock 被误当真)。
// 用于空气质量、地域、漏斗浏览量、历史回放、地图等未接入区块。
export function PlaceholderTag({ text = "示例数据 · 待接入" }: { text?: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[12px] font-medium"
      style={{
        color: "var(--screen-orange)",
        backgroundColor: "rgba(217,119,6,0.14)",
        border: "1px solid rgba(217,119,6,0.4)",
      }}
    >
      ⚠ {text}
    </span>
  );
}
