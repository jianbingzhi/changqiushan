"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU_GROUPS } from "@/lib/ui/nav/menu";

// 由当前路由在菜单里反查「分组 / 页面」,拼成 首页 / 分组 / 页面 的面包屑
function resolveCrumb(pathname: string): { group: string; page: string } | null {
  for (const g of MENU_GROUPS) {
    for (const item of g.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        return { group: g.title, page: item.label };
      }
    }
  }
  return null;
}

export function Breadcrumb() {
  const pathname = usePathname();
  const crumb = resolveCrumb(pathname);
  const onHome = pathname === "/";

  return (
    <nav aria-label="面包屑" className="mb-2 flex items-center text-xs text-[#9CA3AF]">
      {onHome ? (
        <span className="text-[#6B7280]">首页</span>
      ) : (
        <Link href="/" className="transition-colors hover:text-[#6B7280]">首页</Link>
      )}
      {crumb && (
        <>
          <span className="mx-1.5">/</span>
          <span>{crumb.group}</span>
          <span className="mx-1.5">/</span>
          <span className="text-[#6B7280]">{crumb.page}</span>
        </>
      )}
    </nav>
  );
}
