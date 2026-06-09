import type { NextRequest } from "next/server";
import { getSession } from "@/infrastructure/auth/session";
import { exportToExcel } from "@/lib/excel";
import { chinaToday, formatCnDate, formatCnDateTime } from "@/shared/lib/time";
import { channelLabel } from "@/shared/labels";
import type { BookingStatus } from "@/modules/booking";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

const ALLOWED_MODULES = ["traffic", "heatmap", "source", "profile", "bookings"] as const;
type ExportModule = (typeof ALLOWED_MODULES)[number];

const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  CONFIRMED: "已预约", CHECKED_IN: "已核销", CANCELLED: "已取消", NO_SHOW: "爽约", EXPIRED: "已过期",
};
const VALID_BOOKING_STATUS: readonly string[] = Object.keys(BOOKING_STATUS_LABEL);

// E1: 可导出报表的业务角色(app_metadata.role)
const EXPORT_ROLES: readonly string[] = ["SUPER_ADMIN", "ADMIN"];

const MODULE_NAMES: Record<ExportModule, string> = {
  traffic: "客流分析",
  heatmap: "热力图分析",
  source:  "来源分析",
  profile: "用户画像",
  bookings: "预约单",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "未授权" }, { status: 401 });
  }
  // E1: GoTrue 密码登录 JWT 顶层 role 恒为 "authenticated",业务角色在 app_metadata。
  // 报表导出仅放行管理角色(超管/管理员),操作员等其他角色 403。
  if (!session.appRole || !EXPORT_ROLES.includes(session.appRole)) {
    return Response.json({ message: "权限不足" }, { status: 403 });
  }

  const { module: mod } = await params;
  if (!ALLOWED_MODULES.includes(mod as ExportModule)) {
    return Response.json({ message: "不支持的导出模块" }, { status: 400 });
  }

  const exportModule = mod as ExportModule;

  let headers: string[] = [];
  let rows: (string | number | null)[][] = [];

  // B32: 预约单导出 — 复用列表筛选(身份证/手机/状态),运营对账用,管理角色已校验
  if (exportModule === "bookings") {
    const { bookingService } = await import("@/modules/booking");
    const query = req.nextUrl.searchParams;
    const statusRaw = query.get("status") ?? "";
    const list = await bookingService.listBookingsForExport({
      idCard: query.get("idCard") || undefined,
      phone: query.get("phone") || undefined,
      status: VALID_BOOKING_STATUS.includes(statusRaw) ? (statusRaw as BookingStatus) : undefined,
    });
    headers = ["预约编号", "姓名", "身份证号", "手机号", "车牌", "渠道", "日期", "时段", "状态", "核销时间", "预约时间"];
    rows = list.map((b) => [
      b.qrCode.slice(0, 10).toUpperCase(),
      b.visitorName,
      b.idCard,
      b.phone,
      b.plate ?? (b.noVehicleDeclared ? "无车辆" : ""),
      channelLabel(b.channel),
      formatCnDate(b.slot.date),
      `${b.slot.name} ${b.slot.startTime}-${b.slot.endTime}`,
      BOOKING_STATUS_LABEL[b.status],
      b.checkedInAt ? formatCnDateTime(b.checkedInAt) : "",
      formatCnDateTime(b.createdAt),
    ]);
    const sheetName = MODULE_NAMES.bookings;
    if (rows.length === 0) rows = [["暂无数据", null, null, null, null, null, null, null, null, null, null]];
    const buffer = await exportToExcel({ sheetName, headers, rows });
    const filename = encodeURIComponent(`${sheetName}_${chinaToday()}.xlsx`);
    return new Response(buffer.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const { analyticsRepository } = await import("@/modules/analytics");

  switch (exportModule) {
    case "traffic": {
      headers = ["日期", "游客总数", "已入园", "已取消", "爽约"];
      // 近 30 天每日客流
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const data = await analyticsRepository.getDailyTraffic(start, end);
      rows = data.map((r) => [
        formatCnDate(r.date),
        Number(r.total_visitors),
        Number(r.checked_in_count),
        Number(r.cancelled_count),
        Number(r.noshow_count),
      ]);
      break;
    }
    case "heatmap": {
      headers = ["时段(时)", "平均游客数", "峰值游客数"];
      const data = await analyticsRepository.getHourlyPeak();
      rows = data.map((r) => [`${r.hour} 时`, r.avg_visitors, Number(r.max_visitors)]);
      break;
    }
    case "source": {
      headers = ["来源渠道", "游客数量", "占比(%)"];
      const data = await analyticsRepository.getVisitorSource();
      rows = data.map((r) => [channelLabel(r.source_channel), Number(r.visitor_count), r.percentage]);
      break;
    }
    case "profile": {
      headers = ["维度", "数值", "占比(%)"];
      const data = await analyticsRepository.getProfileOverview();
      rows = data.map((r) => [r.dimension, Number(r.value), r.percentage]);
      break;
    }
  }

  const sheetName = MODULE_NAMES[exportModule];
  if (rows.length === 0) {
    rows = [["暂无数据", null, null]];
  }

  const buffer = await exportToExcel({ sheetName, headers, rows });
  const filename = encodeURIComponent(`${sheetName}_${chinaToday()}.xlsx`);

  return new Response(buffer.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
