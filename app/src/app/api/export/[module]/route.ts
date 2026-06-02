import type { NextRequest } from "next/server";
import { getSession } from "@/infrastructure/auth/session";
import { exportToExcel } from "@/lib/excel";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

const ALLOWED_MODULES = ["traffic", "heatmap", "source", "profile"] as const;
type ExportModule = (typeof ALLOWED_MODULES)[number];

const MODULE_NAMES: Record<ExportModule, string> = {
  traffic: "客流分析",
  heatmap: "热力图分析",
  source:  "来源分析",
  profile: "用户画像",
};

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ module: string }> },
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ message: "未授权" }, { status: 401 });
  }

  const { module: mod } = await params;
  if (!ALLOWED_MODULES.includes(mod as ExportModule)) {
    return Response.json({ message: "不支持的导出模块" }, { status: 400 });
  }

  const exportModule = mod as ExportModule;

  // TODO 阶段7: 接入 analyticsRepository 查询真实数据
  // const { analyticsRepository } = await import("@/modules/analytics");
  let headers: string[] = [];
  let rows: (string | number | null)[][] = [];

  switch (exportModule) {
    case "traffic":
      headers = ["日期", "游客总数", "已入园", "已取消", "爽约"];
      break;
    case "heatmap":
      headers = ["时段(时)", "平均游客数", "峰值游客数"];
      break;
    case "source":
      headers = ["来源渠道", "游客数量", "占比(%)"];
      break;
    case "profile":
      headers = ["维度", "数值", "占比(%)"];
      break;
  }

  const sheetName = MODULE_NAMES[exportModule];
  if (rows.length === 0) {
    rows = [["暂无数据", null, null]];
  }

  const buffer = await exportToExcel({ sheetName, headers, rows });
  const filename = encodeURIComponent(`${sheetName}_${new Date().toISOString().slice(0, 10)}.xlsx`);

  return new Response(buffer.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
