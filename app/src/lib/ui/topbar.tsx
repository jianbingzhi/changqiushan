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
    <header
      className="relative flex shrink-0 items-center justify-between"
      style={{
        height: 64,
        backgroundColor: "#FFFFFF",
        borderBottom: "1px solid #EEEEEE",
        paddingLeft: 24,
        paddingRight: 24,
      }}
    >
      {/* Left */}
      <div className="flex items-center gap-3">
        <span
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 32, height: 32, backgroundColor: "#2D5A27" }}
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 14l4.5-7L10 11l2.5-4L16 14H2Z" fill="white" fillOpacity="0.9" />
          </svg>
        </span>
        <span className="font-bold" style={{ fontSize: 16, color: "#2D5A27" }}>
          长秋山森林公园智慧景区
        </span>
      </div>

      {/* Center: breadcrumb */}
      <div
        className="absolute left-1/2 -translate-x-1/2 select-none"
        style={{ fontSize: 13, color: "#6B7280" }}
      >
        {crumb ? <>首页 · {crumb.group} · <span style={{ color: "#2D5A27" }}>{crumb.page}</span></> : "首页"}
      </div>

      {/* Right */}
      <div className="flex items-center gap-2">
        <button
          aria-label="全屏"
          className="flex items-center justify-center w-8 h-8 rounded-md text-[#6B7280] hover:bg-gray-100 transition-colors"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
          onClick={() => {
            if (!document.fullscreenElement) document.documentElement.requestFullscreen();
            else document.exitFullscreen();
          }}
        >
          <Maximize2 size={16} />
        </button>

        <button
          aria-label="通知"
          className="relative flex items-center justify-center w-8 h-8 rounded-md text-[#6B7280] hover:bg-gray-100 transition-colors"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <Bell size={16} />
          <span
            className="absolute top-1 right-1 flex items-center justify-center rounded-full text-white"
            style={{ width: 14, height: 14, fontSize: 9, fontWeight: 600, backgroundColor: "#DC2626" }}
          >
            3
          </span>
        </button>

        <button
          aria-label="帮助"
          className="flex items-center justify-center w-8 h-8 rounded-md text-[#6B7280] hover:bg-gray-100 transition-colors"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <HelpCircle size={16} />
        </button>

        <span
          aria-hidden="true"
          className="inline-block"
          style={{ width: 1, height: 20, backgroundColor: "#E5E7EB" }}
        />

        <button
          className="flex items-center gap-2 rounded-md px-2 py-1 hover:bg-gray-100 transition-colors"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
        >
          <span
            className="flex items-center justify-center rounded-full font-semibold text-white shrink-0"
            style={{ width: 32, height: 32, fontSize: 13, backgroundColor: "#2D5A27" }}
          >
            管
          </span>
          <span style={{ fontSize: 13, color: "#1F2937" }}>系统管理员</span>
          <ChevronDown size={14} style={{ color: "#6B7280" }} />
        </button>
      </div>
    </header>
  );
}
