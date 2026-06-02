"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  CalendarDays,
  BrainCircuit,
  Newspaper,
  Clock,
  Network,
  ClipboardList,
  ShieldAlert,
  Route,
  ParkingSquare,
  TrendingUp,
  Flame,
  PieChart,
  Users,
  Cpu,
  Activity,
  HelpCircle,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { MENU_GROUPS } from "@/lib/ui/nav/menu";

const ICON_MAP: Record<string, LucideIcon> = {
  MapPin,
  CalendarDays,
  BrainCircuit,
  Newspaper,
  Clock,
  Network,
  ClipboardList,
  ShieldAlert,
  Route,
  ParkingSquare,
  TrendingUp,
  Flame,
  PieChart,
  Users,
  Cpu,
  Activity,
};

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside
      className="flex flex-col shrink-0 h-full overflow-y-auto"
      style={{ width: 240, backgroundColor: "#1F3F1A" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 pt-6 pb-5">
        <span
          className="flex items-center justify-center rounded-full shrink-0"
          style={{ width: 32, height: 32, backgroundColor: "#2D5A27" }}
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 14l4.5-7L10 11l2.5-4L16 14H2Z" fill="white" fillOpacity="0.9" />
          </svg>
        </span>
        <div className="leading-tight min-w-0">
          <p className="font-semibold truncate" style={{ fontSize: 14, color: "#E8EFE3" }}>
            长秋山森林公园智慧景区
          </p>
          <p style={{ fontSize: 11, color: "#A8C09A" }}>管理后台</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2">
        {MENU_GROUPS.map((group) => (
          <div key={group.title} className="mb-4">
            <p
              className="px-2 mb-1"
              style={{ fontSize: 11, color: "#A8C09A", paddingTop: 8, paddingBottom: 4 }}
            >
              {group.title}
            </p>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = ICON_MAP[item.icon];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-md mb-0.5 transition-colors"
                  style={{
                    paddingLeft: 12,
                    paddingRight: 12,
                    paddingTop: 8,
                    paddingBottom: 8,
                    backgroundColor: isActive ? "#2D5A27" : "transparent",
                    borderLeft: isActive ? "3px solid #4a8f42" : "3px solid transparent",
                    color: isActive ? "#FFFFFF" : "#E8EFE3",
                    fontWeight: isActive ? 600 : 400,
                    fontSize: 14,
                  }}
                >
                  {Icon && (
                    <Icon
                      size={20}
                      strokeWidth={1.5}
                      style={{ color: isActive ? "#FFFFFF" : "#A8C09A", flexShrink: 0 }}
                    />
                  )}
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Bottom */}
      <div className="px-2 pb-4 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}>
        {[
          { label: "帮助支持", Icon: HelpCircle },
          { label: "退出登录", Icon: LogOut },
        ].map(({ label, Icon }) => (
          <button
            key={label}
            className="flex w-full items-center gap-3 rounded-md mb-0.5 transition-colors hover:bg-white/10"
            style={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              fontSize: 14,
              color: "#A8C09A",
              background: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <Icon size={20} strokeWidth={1.5} style={{ flexShrink: 0 }} />
            {label}
          </button>
        ))}
      </div>
    </aside>
  );
}
