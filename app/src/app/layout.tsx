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
      <body className="min-h-full flex flex-col antialiased">
        {/* 水合前预置主题,防 FOUC:仅认显式选择(cqs-theme),缺省走浅色。
            FE-3 折叠态预置脚本将并入此处一次注入。 */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{if(localStorage.getItem('cqs-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})()",
          }}
        />
        {children}
      </body>
    </html>
  );
}
