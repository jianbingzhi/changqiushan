"use client";

// 高德地图容器。四态状态机 idle→loading→ready|error:
// - 无 key → error 态,fallback 上叠「高德地图 Key 未配置」;
// - load reject / 10 秒超时 → error 态(严禁永久"加载中",历史 bug B28);
// - INVALID_USER_DOMAIN(域名白名单未过)不走 load reject → map.on("error") 兜底转 error;
// - mapStyle 未显式传时跟随 html.dark(MutationObserver),显式传则固定不跟随。

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { ensureAMap, type AMapNamespace } from "@/lib/amap/loader";
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
  /** true 时按标记自动调整视野 */
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
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<AMap.Map | null>(null);
  const amapRef = useRef<AMapNamespace | null>(null);
  const markerObjsRef = useRef<AMap.Marker[]>([]);
  const trafficRef = useRef<AMap.TileLayer.Traffic | null>(null);

  // 挂载即进入 loading(状态机 idle 仅为语义占位,首帧即在加载)
  const [status, setStatus] = useState<Status>("loading");
  const [errorText, setErrorText] = useState(MSG_LOAD_FAILED);

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
  }, []);

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
          offset: new ns.Pixel(0, -6),
        });
      }
      return marker;
    });
    markerObjsRef.current = objs;
    if (objs.length > 0) {
      map.add(objs);
      if (fitView) map.setFitView(objs);
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

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      <div ref={containerRef} className="absolute inset-0" />
      {(status === "idle" || status === "loading") && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
          <p className="text-[13px] text-muted-foreground">地图加载中…</p>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-10 bg-card">
          {fallback}
          <p className="absolute inset-x-0 bottom-0 z-10 bg-card/85 px-3 py-1.5 text-center text-[12px] text-muted-foreground">
            {errorText}
          </p>
        </div>
      )}
    </div>
  );
}
