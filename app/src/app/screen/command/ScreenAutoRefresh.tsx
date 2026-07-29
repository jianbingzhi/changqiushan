"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// 大屏挂墙常驻:周期性 router.refresh() 重跑 RSC,让整页数据自动滚动更新,
// 无需把每个面板改成 client 轮询岛。默认 15s,与 /api/screen 端点 TTL 对齐。
export function ScreenAutoRefresh({ intervalMs = 15_000 }: { intervalMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(() => router.refresh(), intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);
  return null;
}
