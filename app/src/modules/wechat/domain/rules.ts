// 微信 jscode2session 上游返回的最小形状(session_key 仅服务端短时用于解密手机号,不落库)
export interface Jscode2SessionResult {
  openid?: string;
  unionid?: string;
  session_key?: string;
  errcode?: number;
  errmsg?: string;
}

/** 校验 jscode2session 是否成功拿到 openid;失败给出可下发的中文文案(不含敏感字段)。 */
export function readOpenid(
  raw: Jscode2SessionResult,
): { ok: true; openid: string; unionid: string | null } | { ok: false; message: string } {
  if (raw.openid) {
    return { ok: true, openid: raw.openid, unionid: raw.unionid ?? null };
  }
  return {
    ok: false,
    message: raw.errmsg ? `微信登录失败：${raw.errmsg}` : "微信登录失败，请重试",
  };
}
