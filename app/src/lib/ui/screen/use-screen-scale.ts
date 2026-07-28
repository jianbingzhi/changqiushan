"use client";

import { useEffect, useState } from "react";

export const SCREEN_W = 1920;
export const SCREEN_H = 1080;

export interface ScreenCanvasSize {
  width: number;
  height: number;
}

export const DEFAULT_SCREEN_SIZE: ScreenCanvasSize = { width: SCREEN_W, height: SCREEN_H };
export const ULTRAWIDE_SCREEN_SIZE: ScreenCanvasSize = { width: 3840, height: 1080 };

// 等比缩放:scale = min(vw/designW, vh/designH),外层 letterbox 居中。
// 默认 1920×1080;超宽融合总屏可传 3840×1080,避免复制一套缩放外壳。
export function useScreenScale(size: ScreenCanvasSize = DEFAULT_SCREEN_SIZE): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      const s = Math.min(window.innerWidth / size.width, window.innerHeight / size.height);
      setScale(s > 0 ? s : 1);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, [size.height, size.width]);

  return scale;
}
