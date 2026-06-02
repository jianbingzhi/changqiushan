import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const Sidebar = dynamic(() => import("@/lib/ui/sidebar").then((m) => ({ default: m.Sidebar })), {
  ssr: false,
});

const Topbar = dynamic(() => import("@/lib/ui/topbar").then((m) => ({ default: m.Topbar })), {
  ssr: false,
});

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
