import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "长秋山森林公园智慧景区 · 管理后台",
  description: "长秋山森林公园智慧景区 B 端管理后台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full">
      <body className="min-h-full flex flex-col antialiased">{children}</body>
    </html>
  );
}
