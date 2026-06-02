import type { NextRequest } from "next/server";
import { checkinService } from "@/modules/checkin";

export const dynamic = "force-dynamic";
export const runtime  = "nodejs";

const GATE_API_KEY = process.env.GATE_API_KEY ?? "";

export async function POST(req: NextRequest) {
  // 闸机设备 API Key 鉴权（middleware matcher 已排除 api/ 路径）
  const providedKey = req.headers.get("x-gate-key") ?? "";
  if (!GATE_API_KEY || providedKey !== GATE_API_KEY) {
    return Response.json({ success: false, message: "未授权：无效的闸机密钥" }, { status: 401 });
  }

  let body: { qrCode?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ success: false, code: "INVALID_INPUT", message: "请求体解析失败" }, { status: 400 });
  }

  const qrCode = typeof body.qrCode === "string" ? body.qrCode.trim() : "";
  if (!qrCode) {
    return Response.json({ success: false, code: "INVALID_INPUT", message: "qrCode 不可为空" }, { status: 400 });
  }

  try {
    const result = await checkinService.checkin(qrCode);
    if (result.ok) {
      const { bookingId, slotId, checkedInAt } = result.value;
      return Response.json({ success: true, bookingId, slotId, checkedInAt }, { status: 200 });
    }
    return Response.json({ success: false, code: result.code, message: result.message }, { status: 400 });
  } catch (e) {
    console.error("[gate/checkin] 服务异常:", e);
    return Response.json({ success: false, message: "服务异常" }, { status: 500 });
  }
}
