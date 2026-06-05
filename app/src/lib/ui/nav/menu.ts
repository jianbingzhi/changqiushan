import { SUPER_ONLY } from "@/shared/auth/roles";

export interface MenuItem {
  label: string;
  href: string;
  icon: string;
  /** 可见角色(app_metadata.role)白名单;省略=所有已登录员工可见。与路由级 RBAC(R3)一致。 */
  roles?: readonly string[];
}

export interface MenuGroup {
  title: string;
  items: MenuItem[];
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: "基础宣传管理",
    items: [
      { label: "景区介绍维护", href: "/content/intro",       icon: "MapPin" },
      { label: "活动运营管理", href: "/content/activities",  icon: "CalendarDays" },
      { label: "AI问答知识库", href: "/content/knowledge",   icon: "BrainCircuit" },
      { label: "资讯模块",     href: "/content/news",        icon: "Newspaper" },
    ],
  },
  {
    title: "预约管理中心",
    items: [
      { label: "分时预约配额配置", href: "/booking/slots",        icon: "Clock" },
      { label: "预约单查询",       href: "/booking/bookings",     icon: "FileSearch" },
      { label: "渠道预约接入",     href: "/booking/channels",     icon: "Network" },
      { label: "现场补录面板",     href: "/booking/onsite",       icon: "ClipboardList" },
      { label: "爽约风控与黑名单", href: "/riskcontrol/blacklist", icon: "ShieldAlert" },
    ],
  },
  {
    title: "出行服务",
    items: [
      { label: "实时路况查询",     href: "/traffic/road",    icon: "Route" },
      { label: "停车场动静态上图", href: "/traffic/parking", icon: "ParkingSquare" },
    ],
  },
  {
    title: "数据可视化与分析",
    items: [
      { label: "客流分析", href: "/analytics/traffic", icon: "TrendingUp" },
      { label: "热力图分析", href: "/analytics/heatmap", icon: "Flame" },
      { label: "来源分析", href: "/analytics/source",   icon: "PieChart" },
      { label: "用户画像", href: "/analytics/profile",  icon: "Users" },
    ],
  },
  {
    title: "物联网设备监控",
    items: [
      { label: "实时设备列表", href: "/iot/devices", icon: "Cpu" },
    ],
  },
  {
    title: "系统设置",
    items: [
      { label: "系统管理", href: "/system", icon: "Settings", roles: SUPER_ONLY },
    ],
  },
];
