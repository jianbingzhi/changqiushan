"use client";

// 高德 JS API 浏览器端加载器(单例)。
// - ensureAMap() 返回全局 AMap 命名空间,模块级 Promise 缓存,重复调用复用;
// - plugins 并集增量加载:缓存已加载插件集合,缺失插件经 AMapLoader.load 二次补载
//   (官方 loader 支持多次 load 自动合并,key/version 必须一致);
// - 整体 10 秒超时(Promise.race),失败回滚缓存允许重试;
// - 无 key 直接拒绝 AMAP_KEY_MISSING,容器层据此显示「高德地图 Key 未配置」。
// ⚠️ NEXT_PUBLIC_AMAP_SECURITY 打进 bundle 属演示级用法;生产应改 serviceHost
//    (Nginx 代理 _AMapService)方案,不向浏览器下发安全密钥。
// ⚠️ @amap/amap-jsapi-loader 模块求值期就摸 window,"use client" 组件 SSR 也会评估模块——
//    必须延迟到 ensureAMap 调用时动态 import(顶层静态 import 会让大屏 SSR 500)。

/* eslint-disable @typescript-eslint/no-namespace -- 高德 JS API 是 script 注入的全局命名空间,只能用 ambient namespace 声明 */
declare global {
  interface Window {
    /** 高德安全密钥配置,必须在 JS API <script> 注入之前赋值 */
    _AMAP_SECURITY_CONFIG?: { securityJsCode: string };
  }

  /** 最小化自声明(项目未引入 @amap/amap-jsapi-types,只声明用到的面) */
  namespace AMap {
    interface MapStatus {
      dragEnable?: boolean;
      zoomEnable?: boolean;
      doubleClickZoom?: boolean;
      keyboardEnable?: boolean;
      scrollWheel?: boolean;
      touchZoom?: boolean;
    }

    interface MapOptions extends MapStatus {
      center?: [number, number];
      zoom?: number;
      viewMode?: "2D" | "3D";
      mapStyle?: string;
    }

    class Map {
      constructor(container: string | HTMLElement, opts?: MapOptions);
      on(event: string, handler: (e: { type?: string; info?: string }) => void): void;
      setMapStyle(style: string): void;
      setCenter(center: [number, number], immediately?: boolean): void;
      setZoom(zoom: number, immediately?: boolean): void;
      getZoom(): number;
      setStatus(status: MapStatus): void;
      add(overlays: Marker | Marker[]): void;
      remove(overlays: Marker | Marker[]): void;
      /** avoid = 视野四周的内缩像素 [上, 下, 左, 右],缺省 [60,60,60,60](用于避开页面浮层) */
      setFitView(
        overlays?: Marker[] | null,
        immediately?: boolean,
        avoid?: [number, number, number, number],
        maxZoom?: number,
      ): void;
      /** 经纬度 → 容器像素坐标(取景实测校正靠它读出标点真正落在哪,round-01 N12) */
      lngLatToContainer(position: LngLat): Pixel;
      /** 容器像素坐标 → 经纬度(反算校正后应把中心挪到哪) */
      containerToLngLat(pixel: Pixel): LngLat;
      destroy(): void;
    }

    class Pixel {
      constructor(x: number, y: number);
      getX(): number;
      getY(): number;
    }

    class LngLat {
      constructor(lng: number, lat: number);
      getLng(): number;
      getLat(): number;
    }

    interface MarkerLabel {
      content: string;
      direction?: "top" | "right" | "bottom" | "left" | "center";
      offset?: Pixel;
    }

    interface MarkerOptions {
      position: [number, number];
      title?: string;
      content?: string | HTMLElement;
      anchor?: string;
      label?: MarkerLabel;
    }

    class Marker {
      constructor(opts: MarkerOptions);
      setLabel(label: MarkerLabel): void;
      getPosition(): LngLat | null;
    }

    namespace TileLayer {
      /** 实时路况图层(插件名 "AMap.TileLayer.Traffic") */
      class Traffic {
        constructor(opts?: { zIndex?: number; autoRefresh?: boolean; interval?: number });
        setMap(map: Map | null): void;
      }
    }
  }
}
/* eslint-enable @typescript-eslint/no-namespace */

export type AMapNamespace = typeof AMap;

// 20s:线上实测首访冷加载(JS API ~200KB+init 链)在普通网络可超 10s,过紧会把首屏打成 error 逼用户点重试
const LOAD_TIMEOUT_MS = 20_000;

let amapPromise: Promise<AMapNamespace> | null = null;
const loadedPlugins = new Set<string>();

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("AMAP_LOAD_TIMEOUT")), LOAD_TIMEOUT_MS);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * 确保高德 JS API 已加载并返回全局 AMap 命名空间(单例)。
 * 重复调用复用同一 Promise;携带新插件时在已加载基础上增量补载。
 */
export function ensureAMap(plugins: string[] = []): Promise<AMapNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("AMAP_BROWSER_ONLY"));
  }
  const key = process.env.NEXT_PUBLIC_AMAP_KEY;
  if (!key) {
    return Promise.reject(new Error("AMAP_KEY_MISSING"));
  }

  const missing = plugins.filter((p) => !loadedPlugins.has(p));
  if (amapPromise && missing.length === 0) {
    return amapPromise;
  }

  // 顺序硬约束:安全密钥必须先挂到 window,再触发脚本注入
  const securityJsCode = process.env.NEXT_PUBLIC_AMAP_SECURITY;
  if (securityJsCode) {
    window._AMAP_SECURITY_CONFIG = { securityJsCode };
  }

  for (const p of missing) loadedPlugins.add(p);

  const doLoad = () =>
    withTimeout(
      import("@amap/amap-jsapi-loader").then(
        (m) => m.default.load({ key, version: "2.0", plugins: missing }) as Promise<AMapNamespace>,
      ),
    );

  // 已有在途/已成功的加载 → 串联一次仅含缺失插件的增量 load
  const next: Promise<AMapNamespace> = amapPromise ? amapPromise.then(doLoad) : doLoad();
  const guarded: Promise<AMapNamespace> = next.catch((err: unknown) => {
    // 失败回滚缓存,允许下一次调用重试
    if (amapPromise === guarded) amapPromise = null;
    for (const p of missing) loadedPlugins.delete(p);
    throw err;
  });
  amapPromise = guarded;
  return guarded;
}
