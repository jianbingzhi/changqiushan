"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MENU_GROUPS } from "@/lib/ui/nav/menu";

// 由当前路由在菜单里反查「分组 / 页面」,拼成 首页 / 分组 / 页面 的面包屑
function resolveCrumb(
  pathname: string,
): { group: string; page: string; href: string } | null {
  for (const g of MENU_GROUPS) {
    for (const item of g.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        return { group: g.title, page: item.label, href: item.href };
      }
    }
  }
  return null;
}

// 子页末段中文名:仅识别常见后缀,未知则不渲染末段(避免误标)
function subPageLabel(pathname: string, href: string): string | null {
  const rest = pathname.slice(href.length);
  if (rest.endsWith("/new")) return "新建";
  if (rest.endsWith("/edit")) return "编辑";
  if (rest.endsWith("/signups")) return "报名名单";
  if (rest.endsWith("/awards")) return "获奖名单";
  return "详情";
}

export function Breadcrumb() {
  const pathname = usePathname();
  const crumb = resolveCrumb(pathname);
  const onHome = pathname === "/";
  // 子页时 page 段可点返回列表;精确命中时 page 为当前页(不可点)
  const onSubPage = crumb != null && pathname !== crumb.href;
  const subLabel = onSubPage && crumb ? subPageLabel(pathname, crumb.href) : null;

  return (
    <nav aria-label="面包屑" className="mb-2 flex items-center text-xs text-text-muted">
      {onHome ? (
        <span className="text-muted-foreground" aria-current="page">首页</span>
      ) : (
        <Link href="/" className="transition-colors hover:text-muted-foreground">首页</Link>
      )}
      {crumb && (
        <>
          <span className="mx-1.5">/</span>
          <span>{crumb.group}</span>
          <span className="mx-1.5">/</span>
          {onSubPage ? (
            <Link href={crumb.href} className="transition-colors hover:text-muted-foreground">
              {crumb.page}
            </Link>
          ) : (
            <span className="text-muted-foreground" aria-current="page">{crumb.page}</span>
          )}
          {subLabel && (
            <>
              <span className="mx-1.5">/</span>
              <span className="text-muted-foreground" aria-current="page">{subLabel}</span>
            </>
          )}
        </>
      )}
    </nav>
  );
}
