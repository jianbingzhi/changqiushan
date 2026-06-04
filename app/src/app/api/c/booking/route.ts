import type { NextRequest } from "next/server";
import { bookingService } from "@/modules/booking";
import { riskcontrolService } from "@/modules/riskcontrol";
import { wechatAuthService } from "@/modules/wechat";
import { requireVisitor } from "../_lib/requireVisitor";
import { jsonOk, jsonErr, badJson, serverError } from "../_lib/respond";
import { publicBooking } from "../_lib/serialize";
import { ErrCode } from "@/shared/result";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// POST /api/c/booking — 黑名单预检 → createBooking(固定 MINI_PROGRAM,双要素单一校验)
// 首单成功后自动绑定身份证到当前微信(支撑「我的预约」精确查询);已绑定则强制同证(一期单证)
export async function POST(req: NextRequest) {
  const auth = await requireVisitor(req);
  if (!auth.ok) return auth.response;

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return badJson();
  }

  const idCard = typeof body.idCard === "string" ? body.idCard : "";

  // 一期:一个微信绑定单一身份证;换证暂不支持代他人预约(避免「我的预约」出现读不到的孤单)
  if (auth.session.boundIdCard && idCard && idCard !== auth.session.boundIdCard) {
    return jsonErr(ErrCode.PERMISSION_DENIED, "当前微信已绑定其他身份证，暂不支持代他人预约");
  }

  try {
    // 红线#3:预约前黑名单预检(app 层组合两公共面,四路渠道一致)
    if (idCard && (await riskcontrolService.isBlacklistedByIdCard(idCard))) {
      return jsonErr(ErrCode.BLACKLISTED, "该身份证已被限制预约，请通过「我的-申诉」提交复核");
    }

    // 红线#2:写库唯一经 createBooking,固定渠道 MINI_PROGRAM,双要素校验无第二实现
    const result = await bookingService.createBooking({ ...body, channel: "MINI_PROGRAM" });
    if (!result.ok) return jsonErr(result.code, result.message);

    const booking = result.value;

    // 首单自动绑定实名 → 重签 token(boundIdCard 写入),前端据 newToken 刷新存储
    let newToken: string | undefined;
    if (!auth.session.boundIdCard) {
      const bound = await wechatAuthService.bindIdentity(auth.session.visitorId, {
        idCard: booking.idCard,
        phone: booking.phone,
      });
      if (bound.ok) newToken = bound.value.token;
    }

    return jsonOk({ booking: publicBooking(booking), token: newToken }, 201);
  } catch (e) {
    console.error("[c/booking] 服务异常:", e);
    return serverError();
  }
}
