// 大屏玻璃辉光面板(GlowPanel):半透明深绿底 + 辉光边框 + 圆角。
// RSC 安全(无客户端状态),可在 server / client 组件中复用。
export function ScreenCard({
  title,
  extra,
  children,
  className = "",
  bodyClassName = "",
}: {
  title?: string;
  /** 标题右侧操作(如「查看全部 >」) */
  extra?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-lg ${className}`}
      style={{
        backgroundColor: "var(--screen-card-bg)",
        border: "1px solid var(--screen-card-border)",
        boxShadow: "inset 0 0 24px rgba(74,142,63,0.06)",
      }}
    >
      {title && (
        <header className="flex items-center justify-between px-4 pt-3 pb-2">
          <h2 className="text-[18px] font-semibold" style={{ color: "var(--screen-text)" }}>
            {title}
          </h2>
          {extra && <div className="text-[13px]" style={{ color: "var(--screen-text-dim)" }}>{extra}</div>}
        </header>
      )}
      <div className={`min-h-0 flex-1 px-4 pb-4 ${title ? "" : "pt-4"} ${bodyClassName}`}>{children}</div>
    </section>
  );
}
