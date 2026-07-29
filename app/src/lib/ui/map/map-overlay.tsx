"use client";

// 整页地图(2026-06-04 决策)的共用浮层骨架:road/parking 两页此前各持一份逐字拷贝,
// 断点/a11y/样式改一处漏一处已现漂移——收口到此(b-103 评审 #10)。
// 布局约定:页面根用 MapPageShell 逃逸 admin shell 的 p-6 内边距(main flex-1 overflow-y-auto
// p-6、topbar h-16),地图组件自带 absolute inset-0 铺底,浮层卡叠 z-20。
//
// ⚠️ 每张浮层卡都要带 `data-map-overlay`:AmapContainer 的 fitView 靠它就地量出浮层占位、
// 把标点让出这些区域(round-01 N12——停车场 4 个标点上了图,却有 2 个被自家浮层压住)。
// 新增浮层忘了这个属性,标点又会被压回去。

import { useEffect, useState } from "react";
import { PanelRightClose, PanelRightOpen } from "lucide-react";

/** 整页地图根容器:抵消 admin shell 内边距,占满除顶栏外全高。 */
export function MapPageShell({ children }: { children: React.ReactNode }) {
  return <div className="relative -m-6 h-[calc(100vh-4rem)] overflow-hidden">{children}</div>;
}

/**
 * 面板开合 state + 窄视口自动收起(审计 P2-7):视口 <1280px 时面板会盖住左上 KPI 卡,
 * 水合后下一帧收起——SSR 始终渲染展开态避免水合不一致,rAF 延迟避开 effect 内同步 setState。
 */
export function useMapPanelOpen() {
  const [panelOpen, setPanelOpen] = useState(true);
  useEffect(() => {
    if (window.innerWidth >= 1280) return;
    const id = requestAnimationFrame(() => setPanelOpen(false));
    return () => cancelAnimationFrame(id);
  }, []);
  return [panelOpen, setPanelOpen] as const;
}

/** 左上玻璃 KPI 卡:整页地图模式下页标题融入此卡。 */
export function MapKpiCard({
  title, subtitle, footnote, children,
}: {
  title: string;
  subtitle: string;
  footnote?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section data-map-overlay className="absolute left-4 top-4 z-20 max-w-[calc(100%-2rem)] rounded-lg border border-border bg-card/85 px-4 py-3 shadow-sm backdrop-blur">
      <h1 className="text-[16px] font-bold leading-tight text-foreground">{title}</h1>
      <p className="mt-0.5 text-[12px] text-muted-foreground">{subtitle}</p>
      <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">{children}</div>
      {footnote && <p className="mt-1.5 text-[12px] text-muted-foreground">{footnote}</p>}
    </section>
  );
}

/** 左下图例卡。dotClass 控制色点形态(路况横条/停车圆点),色值用语义 token 随主题切换。 */
export function MapLegend({
  ariaLabel, items, dotClass,
}: {
  ariaLabel: string;
  items: ReadonlyArray<readonly [string, string]>;
  dotClass: string;
}) {
  return (
    <div data-map-overlay className="absolute bottom-4 left-4 z-20 flex items-center gap-3 rounded-lg border border-border bg-card/85 px-3 py-2 backdrop-blur" aria-label={ariaLabel}>
      {items.map(([label, cls]) => (
        <span key={label} className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <span className={`${dotClass} ${cls}`} aria-hidden />
          {label}
        </span>
      ))}
    </div>
  );
}

/**
 * 右侧可折叠数据面板(360px):header 含标题 + tab 切换 + 收起按钮;收起态渲染「展开数据面板」浮钮。
 * children 即当前 tab 的内容(tabpanel),滚动由本组件负责。
 */
export function MapSidePanel<K extends string>({
  open, onOpenChange, title, tablistLabel, tabs, activeTab, onTabChange, contentClassName = "", children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  tablistLabel: string;
  tabs: ReadonlyArray<{ key: K; label: string }>;
  activeTab: K;
  onTabChange: (key: K) => void;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  if (!open) {
    return (
      <button
        type="button"
        data-map-overlay
        aria-expanded={false}
        onClick={() => onOpenChange(true)}
        className="absolute right-4 top-4 z-20 flex items-center gap-1.5 rounded-lg border border-border bg-card/85 px-3 py-2 text-[13px] font-medium text-foreground shadow-sm backdrop-blur hover:bg-muted"
      >
        <PanelRightOpen className="h-4 w-4" aria-hidden />
        展开数据面板
      </button>
    );
  }

  const tabBtn = (active: boolean) =>
    `rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
      active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
    }`;

  return (
    <section data-map-overlay className="absolute bottom-4 right-4 top-4 z-20 flex w-[360px] max-w-[calc(100%-2rem)] flex-col overflow-hidden rounded-lg border border-border bg-card/85 shadow-sm backdrop-blur">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
        <div className="flex items-center gap-1" role="tablist" aria-label={tablistLabel}>
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={activeTab === t.key}
              className={tabBtn(activeTab === t.key)}
              onClick={() => onTabChange(t.key)}
            >
              {t.label}
            </button>
          ))}
          <button
            type="button"
            aria-label="收起数据面板"
            aria-expanded={true}
            className="ml-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            <PanelRightClose className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </header>
      <div className={`flex-1 overflow-y-auto ${contentClassName}`} role="tabpanel">
        {children}
      </div>
    </section>
  );
}
