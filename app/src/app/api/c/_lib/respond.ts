// C 端 BFF 统一响应外壳 — 所有 /api/c/* handler 共用
// 响应体形状: { success, data } | { success, code, message }
import { ErrCode, type Result } from "@/shared/result";

const STATUS: Partial<Record<ErrCode, number>> = {
  [ErrCode.INVALID_INPUT]: 400,
  [ErrCode.NOT_FOUND]: 404,
  [ErrCode.PERMISSION_DENIED]: 403,
  [ErrCode.BLACKLISTED]: 403,
  [ErrCode.SLOT_FULL]: 409,
  [ErrCode.SLOT_INACTIVE]: 409,
  [ErrCode.DUPLICATE_BOOKING]: 409,
  [ErrCode.CIRCUIT_BREAKER_OPEN]: 409,
  [ErrCode.CHECKIN_ALREADY_DONE]: 409,
  [ErrCode.EXTERNAL_SERVICE_ERROR]: 502,
};

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json({ success: true, data }, { status });
}

export function jsonErr(code: ErrCode, message: string): Response {
  return Response.json({ success: false, code, message }, { status: STATUS[code] ?? 400 });
}

export function fromResult<T>(result: Result<T>): Response {
  return result.ok ? jsonOk(result.value) : jsonErr(result.code, result.message);
}

/** 统一兜底:请求体 JSON 解析失败时的 400 */
export function badJson(): Response {
  return Response.json(
    { success: false, code: ErrCode.INVALID_INPUT, message: "请求体解析失败" },
    { status: 400 },
  );
}

/** 统一兜底:handler 内未捕获异常时的 500(不泄漏内部细节) */
export function serverError(): Response {
  return Response.json({ success: false, message: "服务异常，请稍后重试" }, { status: 500 });
}
