"use client";

import { usePathname } from "next/navigation";
import { ChevronDown, HelpCircle, Bell, Maximize2 } from "lucide-react";
import { MENU_GROUPS } from "@/lib/ui/nav/menu";

function useBreadcrumb(pathname: string) {
  for (const group of MENU_GROUPS) {
    for (const item of group.items) {
      if (pathname === item.href || pathname.startsWith(item.href + "/")) {
        return { group: group.title, page: item.label };
      }
    }
  }
  return null;
}

export function Topbar() {
  const pathname = usePathname();
  const crumb = useBreadcrumb(pathname);

  return (
    <header className="relative flex h-16 shrink-0 items-center justify-between border-b border-[#EEEEEE] bg-white px-6">
      {/* Left */}
      <div className="flex items-center gap-3">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary"
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 14l4.5-7L10 11l2.5-4L16 14H2Z" fill="white" fillOpacity="0.9" />
          </svg>
        </span>
        <span className="text-base font-bold text-primary">长秋山森林公园智慧景区</span>
      </div>

      {/* Center: breadcrumb */}
      <div className="absolute left-1/2 -translate-x-1/2 select-none text-[13px] text-[#6B7280]">
        {crumb ? <>首页 · {crumb.group} · <span className="text-primary">{crumb.page}</span></> : "首页"}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button
          aria-label="全屏"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-gray-100"
          onClick={() => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
          }}
        >
          <Maximize2 size={16} />
        </button>

        <button
          aria-label="通知"
          className="relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-gray-100"
        >
          <Bell size={16} />
          <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-xs font-semibold text-white">
            3
          </span>
        </button>

        <button
          aria-label="帮助"
          className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#6B7280] transition-colors hover:bg-gray-100"
        >
          <HelpCircle size={16} />
        </button>

        <span aria-hidden="true" className="inline-block h-5 w-px bg-[#E5E7EB]" />

        <button className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-gray-100">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[13px] font-semibold text-white">
            管
          </span>
          <span className="text-[13px] text-[#1F2937]">系统管理员</span>
          <ChevronDown size={14} className="text-[#6B7280]" />
        </button>
      </div>
    </header>
  );
}
