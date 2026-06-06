"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  CalendarDays,
  BrainCircuit,
  Newspaper,
  Clock,
  CalendarCog,
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
  FileSearch,
  Settings,
  HelpCircle,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { MENU_GROUPS } from "@/lib/ui/nav/menu";
import { cn } from "@/lib/ui/utils";

const ICON_MAP: Record<string, LucideIcon> = {
  MapPin,
  CalendarDays,
  BrainCircuit,
  Newspaper,
  Clock,
  CalendarCog,
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
  FileSearch,
  Settings,
};

export function Sidebar({ appRole }: { appRole?: string | null }) {
  const pathname = usePathname();

  // 按角色过滤(R3 路由级 RBAC 同源):item.roles 缺省=所有员工可见;过滤后空分组不渲染
  const groups = MENU_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => !item.roles || (appRole != null && item.roles.includes(appRole)),
    ),
  })).filter((group) => group.items.length > 0);

  return (
    <aside className="flex h-full w-60 shrink-0 flex-col overflow-y-auto bg-sidebar">
      {/* Logo — 点击返回仪表盘首页(N3/B13) */}
      <Link
        href="/"
        aria-label="返回仪表盘首页"
        className="flex items-center gap-3 px-4 pt-6 pb-5 transition-colors hover:bg-white/5"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary"
          aria-hidden="true"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M2 14l4.5-7L10 11l2.5-4L16 14H2Z" fill="white" fillOpacity="0.9" />
          </svg>
        </span>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-sidebar-text">长秋山森林公园智慧景区</p>
          <p className="text-xs text-sidebar-section">管理后台</p>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="flex-1 px-2">
        {groups.map((group) => (
          <div key={group.title} className="mb-4">
            <p className="px-2 pt-2 pb-1 text-xs text-sidebar-section">{group.title}</p>
            {group.items.map((item) => {
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/");
              const Icon = ICON_MAP[item.icon];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "mb-0.5 flex items-center gap-3 rounded-md border-l-[3px] px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "border-[#4a8f42] bg-sidebar-active font-semibold text-white"
                      : "border-transparent font-normal text-sidebar-text",
                  )}
                >
                  {Icon && (
                    <Icon
                      size={20}
                      strokeWidth={1.5}
                      className={cn("shrink-0", isActive ? "text-white" : "text-sidebar-section")}
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
      <div className="border-t border-white/10 px-2 pt-2 pb-4">
        {[
          { label: "帮助支持", Icon: HelpCircle },
          { label: "退出登录", Icon: LogOut },
        ].map(({ label, Icon }) => (
          <button
            key={label}
            className="mb-0.5 flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-section transition-colors hover:bg-white/10"
          >
            <Icon size={20} strokeWidth={1.5} className="shrink-0" />
            {label}
          </button>
        ))}
      </div>
    </aside>
  );
}
