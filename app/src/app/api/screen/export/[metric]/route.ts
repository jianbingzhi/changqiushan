import type { NextRequest } from "next/server";
import { analyticsRepository } from "@/modules/analytics";
import { exportToExcel } from "@/lib/excel";
import { toCstDateStr } from "@/shared/lib/time";

// 大屏公开 Excel 导出(红线 5:客流/画像报表必须 Excel)。软门同 metric 端点;只导聚合脱敏数据。
export const dynamic = "force-dynamic";

function gatePassed(req: NextRequest): boolean {
  const expected = process.env.SCREEN_TOKEN;
  if (!expected) return true;
  const fromQuery = req.nextUrl.searchParams.get("k");
  const fromCookie = req.cookies.get("screen_token")?.value;
  return fromQuery === expected || fromCookie === expected;
}

function cnDateLabel(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${Number(m)} 月 ${Number(d)} 日`;
}

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
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ metric: string }> }) {
  if (!gatePassed(req)) {
    return new Response("缺少有效访问凭据", { status: 401 });
  }
  const { metric } = await ctx.params;
  const exporter = EXPORTERS[metric];
  if (!exporter) return new Response("未知导出项", { status: 404 });

  const { filename, sheetName, headers, rows } = await exporter();
  const buf = await exportToExcel({ sheetName, headers, rows });

  return new Response(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}
