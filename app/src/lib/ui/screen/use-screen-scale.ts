"use client";

import { useEffect, useState } from "react";

export const SCREEN_W = 1920;
export const SCREEN_H = 1080;

// 等比缩放:scale = min(vw/1920, vh/1080),外层 letterbox 居中。
// 数据大屏行业惯例:固定画布 1:1 还原设计稿,跨分辨率零回流,一处缩放全页共享。
export function useScreenScale(): number {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const compute = () => {
      const s = Math.min(window.innerWidth / SCREEN_W, window.innerHeight / SCREEN_H);
      setScale(s > 0 ? s : 1);
    };
    compute();
    window.addEventListener("resize", compute);
    return () => window.removeEventListener("resize", compute);
  }, []);

  return scale;
}
