import type { ReactNode } from "react";
import { cookies } from "next/headers";
// Sidebar/Topbar 是 "use client" 组件且 SSR 安全(usePathname;document 仅在事件处理内)。
// Next 16 禁止在服务端组件里用 next/dynamic 的 ssr:false,直接 import 即可(SSR+水合)。
import { Sidebar } from "@/lib/ui/sidebar";
import { Topbar } from "@/lib/ui/topbar";
import { getSession } from "@/infrastructure/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  // B14 折叠态走 cookie(SSR 可读,天然无水合闪烁);值为折叠分组标题的 JSON 数组。
  const raw = (await cookies()).get("cqs-nav-collapsed")?.value;
  let collapsedGroups: string[] = [];
  try {
    if (raw) collapsedGroups = JSON.parse(raw);
  } catch {
    collapsedGroups = [];
  }

  // B24 露白根治:根容器去掉误导的 h-full(只留 min-h-screen),aside 靠 flex stretch 自动拉满;
  // 背景改 token(bg-background,B9 + 双主题双收)。
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar appRole={session?.appRole} collapsedGroups={collapsedGroups} />
      <div className="flex flex-1 flex-col min-w-0">
        <Topbar />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
