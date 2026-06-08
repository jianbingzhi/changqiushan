import type { Metadata } from "next";
import "./screen-theme.css";

export const metadata: Metadata = {
  title: "数字大屏 · 长秋山森林公园智慧景区",
  // 大屏挂墙展示,禁止被搜索引擎收录
  robots: { index: false, follow: false },
};

// 独立全屏暗色外壳:不继承 (admin)/(dashboard) 的 sidebar/topbar/浅色主题。
// .screen-root 作用域内 --screen-* token 生效;恒为深色科技风,与后台双主题无关。
export default function ScreenLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="screen-root flex min-h-screen w-full items-center justify-center overflow-hidden">
      {children}
    </div>
  );
}
