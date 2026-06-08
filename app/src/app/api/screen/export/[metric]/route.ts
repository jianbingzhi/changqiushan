import type { NextRequest } from "next/server";
import { analyticsRepository } from "@/modules/analytics";
import { exportToExcel } from "@/lib/excel";
import { toCstDateStr } from "@/shared/lib/time";
import { screenGatePassed } from "@/shared/auth/screen-gate";

// 大屏公开 Excel 导出(红线 5:客流/画像报表必须 Excel)。软门同 metric 端点;只导聚合脱敏数据。
export const dynamic = "force-dynamic";

// 导出结果按 metric 进程内缓存:全表聚合 + Excel 序列化开销大,公开端点须防反复触发被压垮(DoS 面)。
const EXPORT_TTL_MS = 60_000;
const exportCache = new Map<string, { at: number; filename: string; buf: Uint8Array<ArrayBuffer> }>();

function cnDateLabel(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)} 月 ${Number(d)} 日`;
}

const DOW_CN = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

const EXPORTERS: Record<
  string,
  () => Promise<{ filename: string; sheetName: string; headers: string[]; rows: (string | number)[][] }>
> = {
  // 近 30 天客流与预约趋势
  trend: async () => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 29);
    const rows = await analyticsRepository.getDailyTraffic(start, end).catch(() => []);
    return {
      filename: `客流与预约趋势_${toCstDateStr(end)}.xlsx`,
      sheetName: "客流与预约趋势",
      headers: ["日期", "预约总数", "入园核销", "取消", "爽约", "履约率"],
      rows: rows.map((r) => {
        const total = Number(r.total_visitors);
        const checked = Number(r.checked_in_count);
        const rate = total > 0 ? `${Math.round((checked / total) * 1000) / 10}%` : "—";
        return [cnDateLabel(r.date), total, checked, Number(r.cancelled_count), Number(r.noshow_count), rate];
      }),
    };
  },

  // 7×24 分时预约量热力矩阵(行=星期,列=小时)
  heatmap: async () => {
    const heat = await analyticsRepository.getWeeklyHourlyHeat().catch(() => []);
    const matrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    heat.forEach((r) => {
      if (r.dow >= 0 && r.dow < 7 && r.hour >= 0 && r.hour < 24) matrix[r.dow][r.hour] = Number(r.bookings);
    });
    const today = new Date();
    return {
      filename: `预约分时热力矩阵_${toCstDateStr(today)}.xlsx`,
      sheetName: "预约分时热力",
      headers: ["星期", ...Array.from({ length: 24 }, (_, h) => `${h}时`)],
      rows: matrix.map((row, dow) => [DOW_CN[dow], ...row]),
    };
  },
};

function download(filename: string, buf: Uint8Array<ArrayBuffer>, cache: "hit" | "miss"): Response {
  return new Response(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      // 受软门控的下载不应被中间代理缓存;TTL 缓存在进程内自管。
      "cache-control": "private, no-store",
      "x-screen-cache": cache,
    },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ metric: string }> }) {
  if (!screenGatePassed(req.nextUrl.searchParams.get("k"), req.cookies.get("screen_token")?.value)) {
    return new Response("缺少有效访问凭据", { status: 401 });
  }
  const { metric } = await ctx.params;
  const exporter = EXPORTERS[metric];
  if (!exporter) return new Response("未知导出项", { status: 404 });

  const hit = exportCache.get(metric);
  const now = Date.now();
  if (hit && now - hit.at < EXPORT_TTL_MS) {
    return download(hit.filename, hit.buf, "hit");
  }

  // 与 metric 端点一致:DB/Excel 任一抛出都收敛为结构化 500,不向客户端泄露堆栈。
  try {
    const { filename, sheetName, headers, rows } = await exporter();
    // Uint8Array.from 收敛为 ArrayBuffer 背衬(BodyInit 要求),兼作缓存副本。
    const buf = Uint8Array.from(await exportToExcel({ sheetName, headers, rows }));
    exportCache.set(metric, { at: now, filename, buf });
    return download(filename, buf, "miss");
  } catch {
    return new Response("导出失败，请稍后重试", { status: 500 });
  }
}
