"use client";

import { useSyncExternalStore } from "react";

// 主题态的唯一真相是 <html> 的 .dark 类(layout 里的防 FOUC 脚本在水合前已置好)。
// 用 useSyncExternalStore 订阅该类:服务端快照恒为浅色(false),客户端读真实类,
// 两侧首帧一致 → 天然无水合 mismatch。topbar 的开关与图表配色共用此源。

function subscribeHtmlClass(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const subscribeNever = () => () => {};

/** 当前是否深色主题。仅客户端组件可用。 */
export function useDarkMode(): boolean {
  return useSyncExternalStore(
    subscribeHtmlClass,
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

/**
 * 是否已在客户端挂载。SSR 与水合首帧恒 `false`,挂载后翻 `true`。
 *
 * 用途:`useDarkMode()` 的服务端快照只能是浅色(服务端读不到 <html> 的类),
 * 深色用户硬刷新时首帧必然按浅色算 —— 对吃 token 的 DOM 无所谓(CSS 变量自己跟),
 * 但 echarts 是**在自己的挂载副作用里按当时的 option 画到 canvas 上**的,
 * 会先画一帧浅色再翻深(round-01 code review r3 ②)。
 * 所以后台图表挂载前先占位、不初始化 echarts,挂载后一次性按真实主题画。
 */
export function useMounted(): boolean {
  // 用 useSyncExternalStore 而非 useState+useEffect(setState):后者被 React Compiler 的
  // "setState synchronously within an effect" 规则拒绝。这里订阅一个永不变化的源,
  // 差别只在服务端快照(false)与客户端快照(true),水合后 React 自行补一次渲染。
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}
