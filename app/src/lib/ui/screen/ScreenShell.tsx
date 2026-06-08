"use client";

import { SCREEN_W, SCREEN_H, useScreenScale } from "./use-screen-scale";

// 1920×1080 固定画布缩放容器:外层 letterbox 黑底,内层等比缩放后居中。
// 每块大屏页把整页内容(含 ScreenHeader)作为 children 传入,占满 1920×1080。
export function ScreenShell({ children }: { children: React.ReactNode }) {
  const scale = useScreenScale();
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: SCREEN_W,
          height: SCREEN_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: "center center",
          backgroundColor: "var(--screen-bg)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
