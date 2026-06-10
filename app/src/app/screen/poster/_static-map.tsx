"use client";

import { useState } from "react";
import { PlaceholderTag } from "@/lib/ui/screen/PlaceholderTag";

// 审计 P2-5:代理 502/加载失败时 RSC 纯 <img> 只会显示浏览器裂图——
// 用最小 client 组件挂 onError 切回占位块,与未配置 key 的占位视觉一致。
export function StaticMapImage() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg" style={{ border: "1px dashed var(--screen-card-border)", backgroundColor: "rgba(45,90,39,0.08)" }}>
        <p className="text-[15px]" style={{ color: "var(--screen-text-dim)" }}>GIS 基础底图 · 2D / 2.5D / 3D</p>
        <PlaceholderTag text="高德静态地图服务暂不可用" />
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- 代理返回动态图片流,无需 next/image 优化
    <img
      src="/api/screen/staticmap"
      alt="长秋山景区高德静态地图"
      className="h-full w-full rounded-lg object-cover"
      style={{ border: "1px solid var(--screen-card-border)" }}
      onError={() => setFailed(true)}
    />
  );
}
