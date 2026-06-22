"use client";

import { DEFAULT_SCREEN_SIZE, type ScreenCanvasSize, useScreenScale } from "./use-screen-scale";

// 固定画布缩放容器:外层 letterbox 黑底,内层等比缩放后居中。
// C1-C7 默认 1920×1080;融合指挥总屏传 3840×1080。
export function ScreenShell({
  children,
  size = DEFAULT_SCREEN_SIZE,
}: {
  children: React.ReactNode;
  size?: ScreenCanvasSize;
}) {
  const scale = useScreenScale(size);
  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: size.width,
          height: size.height,
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
