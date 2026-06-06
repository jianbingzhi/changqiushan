import type { ReactNode } from "react";

// 登录页自带左右分栏全屏布局,故此处不再 items-center/justify-center(避免双重布局打架)。
export default function AuthLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-background">{children}</div>;
}
