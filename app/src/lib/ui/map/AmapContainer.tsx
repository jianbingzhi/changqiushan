"use client";

// 高德地图容器。四态状态机 idle→loading→ready|error:
// - 无 key → error 态,fallback 上叠「高德地图 Key 未配置」;
// - load reject / 10 秒超时 → error 态(严禁永久"加载中",历史 bug B28);
// - INVALID_USER_DOMAIN(域名白名单未过)不走 load reject → map.on("error") 兜底转 error;
// - mapStyle 未显式传时跟随 html.dark(MutationObserver),显式传则固定不跟随。

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ensureAMap, type AMapNamespace } from "@/lib/amap/loader";
import { estimateLabelExtent, fitViewAvoid, type MarkerExtent } from "./fit-view-avoid";
import { cn } from "@/lib/ui/utils";

export interface AmapMarkerInput {
  lng: number;
  lat: number;
  title: string;
  /** 语义色:default 主色 / success 绿 / warning 橙 / danger 红 */
  tone?: "default" | "success" | "warning" | "danger";
  /** 点位旁的文字标注 */
  label?: string;
}

export interface AmapContainerProps {
  /** 地图中心 [经度, 纬度](GCJ-02) */
  center?: [number, number];
  zoom?: number;
  markers?: AmapMarkerInput[];
  /**
   * true 时按标记自动调整视野。
   *
   * 取景会自动避开**同一层里带 `data-map-overlay` 的浮层**(整页地图的 KPI 卡/图例/侧栏,
   * 见 lib/ui/map/map-overlay):否则标点会被自家浮层压住(round-01 N12,1440×900 下 4 个标点
   * 只露得出 2 个)。没有这类浮层的调用点(大屏各图)行为不变,仍走高德默认避让。
   */
  fitView?: boolean;
  /** true 时叠加高德实时路况图层 */
  traffic?: boolean;
  /** 显式指定底图风格;不传则跟随系统深浅主题 */
  mapStyle?: "light" | "dark";
  /** false 时禁用拖拽/缩放/双击等全部交互(大屏只读场景,兼避 scale 容器坐标偏移) */
  interactive?: boolean;
  /** error/无 key 态渲染的兜底内容(必填) */
  fallback: React.ReactNode;
  onReady?: (map: AMap.Map) => void;
  className?: string;
}

type Status = "idle" | "loading" | "ready" | "error";

/** 长秋山森林公园(成都蒲江,GCJ-02 考证点)默认视野 */
const DEFAULT_CENTER: [number, number] = [103.6147, 30.2317];
const DEFAULT_ZOOM = 14;

const AMAP_STYLE: Record<"light" | "dark", string> = {
  light: "amap://styles/normal",
  dark: "amap://styles/dark",
};

/** tone → 项目语义 token(CSS 变量随 html.dark 自动切换) */
const TONE_COLOR: Record<NonNullable<AmapMarkerInput["tone"]>, string> = {
  default: "var(--primary)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

/** 标签相对标点上移的像素(setLabel offset,也是 fitView 算标签占位时要加回去的那一截) */
const LABEL_OFFSET_Y = 6;

const MSG_KEY_MISSING = "高德地图 Key 未配置";
const MSG_LOAD_FAILED = "地图加载失败(请检查网络或高德域名白名单配置)";

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isDarkTheme(): boolean {
  return document.documentElement.classList.contains("dark");
}

/**
 * 量出标点标签的实际占位(round-01 N12 r13):标签 direction=top,以标点为中心向上展开、
 * 向左右各溢出半个标签宽。取景只按"点"避让的话,边缘那个标点的标签就会溢出地图可视区
 * (1324×804 下西门那张标签直接跑到左侧导航栏底下去了)。
 *
 * 就地量 DOM 为准;首帧标签还没排版出来时按文字估一版兜底(估算刻意偏大,宁可少一点视野)。
 * 没有标签的调用点(大屏各图、路况页)返回 undefined,取景与本次改动前完全一致。
 */
function readMarkerExtent(container: HTMLElement | null, markers: AmapMarkerInput[]): MarkerExtent | undefined {
  const labels = markers.map((m) => m.label).filter((l): l is string => !!l);
  if (labels.length === 0) return undefined;

  let side = 0;
  let above = 0;
  for (const el of container?.querySelectorAll<HTMLElement>(".amap-marker-label") ?? []) {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) continue;
    side = Math.max(side, r.width / 2);
    above = Math.max(above, r.height + LABEL_OFFSET_Y);
  }
  // side===0 = 一个标签都没量到(首帧还没排版 / jsdom),整份回落到估算,绝不返回 0——那等于回到 N12 缺陷态
  if (side === 0) return estimateLabelExtent(labels);
  // below(圆点自身向下那截)不在标签 rect 里,任何时候都取估算值
  return { ...estimateLabelExtent(labels), side, above };
}

/**
 * 量出同层浮层的实际占位,连同标点占位一起换算成 setFitView 的 avoid 内缩(round-01 N12)。
 *
 * 约定:整页地图的浮层(KPI 卡 / 图例 / 右侧数据面板)挂 `data-map-overlay`,且与地图容器同为
 * MapPageShell 的直接子元素;这里就地量 getBoundingClientRect,不写死任何一张卡的尺寸——
 * 卡片高度随内容(KPI 换行、图例条数、面板收起成小浮钮)变,写死必漂。
 * 既无浮层也无标签时返回 undefined,高德按默认避让取景,其它调用点(大屏各图)行为不变。
 */
function readFitAvoid(
  root: HTMLElement | null,
  container: HTMLElement | null,
  markers: AmapMarkerInput[],
): [number, number, number, number] | undefined {
  const shell = root?.parentElement;
  if (!root || !shell) return undefined;
  const overlays = Array.from(shell.querySelectorAll<HTMLElement>("[data-map-overlay]"));
  return fitViewAvoid(
    root.getBoundingClientRect(),
    overlays.map((el) => el.getBoundingClientRect()),
    readMarkerExtent(container, markers),
  );
}

export function AmapContainer({
  center,
  zoom,
  markers,
  fitView = false,
  traffic = false,
  mapStyle,
  interactive = true,
  fallback,
  onReady,
  className,
}: AmapContainerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMap.Map | null>(null);
  const amapRef = useRef<AMapNamespace | null>(null);
  const markerObjsRef = useRef<AMap.Marker[]>([]);
  const trafficRef = useRef<AMap.TileLayer.Traffic | null>(null);

  // 挂载即进入 loading(状态机 idle 仅为语义占位,首帧即在加载)
  const [status, setStatus] = useState<Status>("loading");
  const [errorText, setErrorText] = useState(MSG_LOAD_FAILED);
  // 审计 P2-1:error 态可就地重试(自增 key 重跑 init effect),不必整页刷新
  const [attempt, setAttempt] = useState(0);

  // 初始化只跑一次;经 ref 读「当下」props,避免依赖变化导致地图重建。
  // ref 写入放 effect(每次渲染后同步),不在 render 期间写。
  const latestRef = useRef({ center, zoom, mapStyle, interactive, onReady });
  useEffect(() => {
    latestRef.current = { center, zoom, mapStyle, interactive, onReady };
  });

  // —— 初始化:加载 JS API → 建图(超时/reject 由 ensureAMap 兜底,绝不停留在 loading) ——
  useEffect(() => {
    let disposed = false;
    ensureAMap()
      .then((ns) => {
        if (disposed || !containerRef.current) return;
        const init = latestRef.current;
        const enable = init.interactive;
        const styleKey = init.mapStyle ?? (isDarkTheme() ? "dark" : "light");
        const map = new ns.Map(containerRef.current, {
          center: init.center ?? DEFAULT_CENTER,
          zoom: init.zoom ?? DEFAULT_ZOOM,
          viewMode: "2D",
          mapStyle: AMAP_STYLE[styleKey],
          dragEnable: enable,
          zoomEnable: enable,
          doubleClickZoom: enable,
          keyboardEnable: enable,
          scrollWheel: enable,
          touchZoom: enable,
        });
        // INVALID_USER_DOMAIN 等鉴权失败不会让 load reject,只能在 map error 事件兜底
        map.on("error", () => {
          if (disposed) return; // 审计 P2-2:卸载后事件晚到不再 setState
          setErrorText(MSG_LOAD_FAILED);
          setStatus("error");
        });
        amapRef.current = ns;
        mapRef.current = map;
        setStatus("ready");
        init.onReady?.(map);
      })
      .catch((err: unknown) => {
        if (disposed) return;
        setErrorText(
          err instanceof Error && err.message === "AMAP_KEY_MISSING"
            ? MSG_KEY_MISSING
            : MSG_LOAD_FAILED,
        );
        setStatus("error");
      });
    return () => {
      disposed = true;
      markerObjsRef.current = [];
      trafficRef.current = null;
      mapRef.current?.destroy();
      mapRef.current = null;
    };
    // attempt 自增 = 用户点「重试」,整段重跑(loader 失败已回滚缓存,可真重试)
  }, [attempt]);

  // —— 深浅主题:显式 mapStyle 固定;否则跟随 html.dark(MutationObserver) ——
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    if (mapStyle) {
      map.setMapStyle(AMAP_STYLE[mapStyle]);
      return;
    }
    const apply = () => map.setMapStyle(AMAP_STYLE[isDarkTheme() ? "dark" : "light"]);
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, [status, mapStyle]);

  // —— 中心/缩放更新(字符串 key 规避数组引用每次渲染都变) ——
  const centerKey = center ? `${center[0]},${center[1]}` : "";
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    if (centerKey) {
      const [lng, lat] = centerKey.split(",").map(Number);
      map.setCenter([lng, lat]);
    }
    if (zoom !== undefined) map.setZoom(zoom);
  }, [status, centerKey, zoom]);

  // —— 交互开关(大屏只读场景 interactive=false 全关) ——
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    map.setStatus({
      dragEnable: interactive,
      zoomEnable: interactive,
      doubleClickZoom: interactive,
      keyboardEnable: interactive,
      scrollWheel: interactive,
      touchZoom: interactive,
    });
  }, [status, interactive]);

  // —— markers:变化时清空重建(序列化 key 做值比较,避免父组件重渲染抖动) ——
  const markersKey = JSON.stringify(markers ?? []);
  useEffect(() => {
    const map = mapRef.current;
    const ns = amapRef.current;
    if (status !== "ready" || !map || !ns) return;
    if (markerObjsRef.current.length > 0) {
      map.remove(markerObjsRef.current);
    }
    const list = JSON.parse(markersKey) as AmapMarkerInput[];
    const objs = list.map((m) => {
      const marker = new ns.Marker({
        position: [m.lng, m.lat],
        title: m.title,
        anchor: "center",
        content:
          `<span style="display:block;width:14px;height:14px;border-radius:9999px;` +
          `background:${TONE_COLOR[m.tone ?? "default"]};border:2px solid #FFFFFF;` +
          `box-shadow:0 1px 4px rgba(0,0,0,0.35);"></span>`,
      });
      if (m.label) {
        marker.setLabel({
          content: `<span style="font-size:12px;line-height:1.6;">${escapeHtml(m.label)}</span>`,
          direction: "top",
          offset: new ns.Pixel(0, -LABEL_OFFSET_Y),
        });
      }
      return marker;
    });
    markerObjsRef.current = objs;
    if (objs.length > 0) {
      map.add(objs);
      // avoid=[上,下,左,右] 内缩,按浮层 + 标点标签的实测占位算(N12);
      // 两者都没有时传 undefined,走高德默认避让
      if (fitView) map.setFitView(objs, false, readFitAvoid(rootRef.current, containerRef.current, list));
    }
  }, [status, markersKey, fitView]);

  // —— 实时路况图层(插件按需增量加载,失败不影响底图) ——
  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !map) return;
    if (!traffic) {
      trafficRef.current?.setMap(null);
      return;
    }
    let cancelled = false;
    ensureAMap(["AMap.TileLayer.Traffic"])
      .then((ns) => {
        if (cancelled || !mapRef.current) return;
        if (!trafficRef.current) {
          trafficRef.current = new ns.TileLayer.Traffic({ autoRefresh: true, interval: 180 });
        }
        trafficRef.current.setMap(mapRef.current);
      })
      .catch(() => {
        // 路况插件加载失败仅缺一层叠加,不转 error 态
      });
    return () => {
      cancelled = true;
    };
  }, [status, traffic]);

  // 审计 P1-1:显式 mapStyle="dark"(大屏 always-dark 语境)时,覆盖层不能跟随后台
  // html.dark 的 token(后台浅色时会闪白块),改用固定深色(--screen-* 在大屏作用域可解析,带回退值)。
  const overlayDark = mapStyle === "dark";
  const overlayStyle = overlayDark ? { backgroundColor: "var(--screen-bg, #0D1A12)" } : undefined;
  const overlayTextStyle = overlayDark ? { color: "var(--screen-text-dim, #9AD6B0)" } : undefined;

  return (
    // 审计 P2-4:z-0 + isolate 把高德内部元素(logo z≈160)关进独立 stacking context,不与页面浮层竞争。
    // ⚠️ 地图 div 必须用 h-full/w-full 显式定尺寸,不能靠 absolute inset-0——
    //    高德 SDK 初始化会把容器 position 强写成 relative,inset 定高随之失效、高度塌 0(线上实测)。
    <div ref={rootRef} className={cn("relative h-full w-full overflow-hidden", className)}>
      <div ref={containerRef} className="h-full w-full z-0 isolate" />
      {(status === "idle" || status === "loading") && (
        <div className={cn("absolute inset-0 z-10 flex flex-col items-center justify-center gap-2", !overlayDark && "bg-muted")} style={overlayStyle}>
          <Loader2 className={cn("h-5 w-5 animate-spin", !overlayDark && "text-muted-foreground")} style={overlayTextStyle} aria-hidden />
          <p className={cn("text-[13px]", !overlayDark && "text-muted-foreground")} style={overlayTextStyle}>地图加载中…</p>
        </div>
      )}
      {status === "error" && (
        <div className={cn("absolute inset-0 z-10", !overlayDark && "bg-card")} style={overlayStyle}>
          {fallback}
          <div
            className={cn("absolute inset-x-0 bottom-0 z-10 flex items-center justify-center gap-3 px-3 py-1.5", !overlayDark && "bg-card/85")}
            style={overlayDark ? { backgroundColor: "rgba(13,26,18,0.85)" } : undefined}
          >
            <p className={cn("text-[12px]", !overlayDark && "text-muted-foreground")} style={overlayTextStyle}>{errorText}</p>
            <button
              type="button"
              onClick={() => { setStatus("loading"); setAttempt((a) => a + 1); }}
              className={cn(
                "shrink-0 rounded border px-2 py-0.5 text-[12px]",
                !overlayDark && "border-border text-foreground hover:bg-muted",
              )}
              style={overlayDark ? { borderColor: "var(--screen-card-border, #2D5A27)", color: "var(--screen-text, #E8F5E9)" } : undefined}
            >
              重试
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
