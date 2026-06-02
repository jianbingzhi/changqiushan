import type { ReactNode } from "react";
// Sidebar/Topbar 是 "use client" 组件且 SSR 安全(usePathname;document 仅在事件处理内)。
// Next 16 禁止在服务端组件里用 next/dynamic 的 ssr:false,直接 import 即可(SSR+水合)。
import { Sidebar } from "@/lib/ui/sidebar";
import { Topbar } from "@/lib/ui/topbar";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-full min-h-screen" style={{ backgroundColor: "#F9FAFB" }}>
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto" style={{ padding: 24 }}>
          {children}
        </main>
      </div>
    </div>
  );
}
