import { wechatRepository } from "../repository";
import { wechatLoginSchema, bindIdentitySchema } from "../domain/schema";
import { readOpenid, type Jscode2SessionResult } from "../domain/rules";
import { getWechatCredentials } from "@/infrastructure/config/integration";
import { signVisitorToken } from "@/infrastructure/auth/visitor-session";
import { ok, err, ErrCode, type Result } from "@/shared/result";

export interface VisitorLoginResult {
  token: string;
  visitorId: string;
  boundIdCard: string | null;
}

export const wechatAuthService = {
  /** wx.login 的 code → jscode2session → upsert 游客 → 签发自签游客 JWT */
  async loginByCode(raw: unknown): Promise<Result<VisitorLoginResult>> {
    const parsed = wechatLoginSchema.safeParse(raw);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0]?.message ?? "输入校验失败");
    }

    const { appId, secret } = getWechatCredentials();
    if (!appId || !secret) {
      return err(ErrCode.EXTERNAL_SERVICE_ERROR, "微信登录暂未配置，请稍后重试");
    }

    let data: Jscode2SessionResult;
    try {
      const url =
        "https://api.weixin.qq.com/sns/jscode2session" +
        `?appid=${encodeURIComponent(appId)}` +
        `&secret=${encodeURIComponent(secret)}` +
        `&js_code=${encodeURIComponent(parsed.data.code)}` +
        "&grant_type=authorization_code";
      const res = await fetch(url);
      data = (await res.json()) as Jscode2SessionResult;
    } catch {
      return err(ErrCode.EXTERNAL_SERVICE_ERROR, "微信服务暂不可用，请稍后重试");
    }

    // session_key 仅服务端短时用于解密手机号,不落库、不下发
    const parsedOpenid = readOpenid(data);
    if (!parsedOpenid.ok) {
      return err(ErrCode.EXTERNAL_SERVICE_ERROR, parsedOpenid.message);
    }

    const visitor = await wechatRepository.upsertByOpenid({
      openid: parsedOpenid.openid,
      unionid: parsedOpenid.unionid,
    });
    const token = await signVisitorToken({
      visitorId: visitor.id,
      openid: visitor.openid,
      boundIdCard: visitor.boundIdCard,
    });
    return ok({ token, visitorId: visitor.id, boundIdCard: visitor.boundIdCard });
  },

  /** 首次预约/获取手机号时绑定实名;绑定后重签 token 让后续请求带上 boundIdCard */
  async bindIdentity(
    visitorId: string,
    raw: unknown,
  ): Promise<Result<{ token: string; boundIdCard: string }>> {
    const parsed = bindIdentitySchema.safeParse(raw);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0]?.message ?? "输入校验失败");
    }
    const visitor = await wechatRepository.findById(visitorId);
    if (!visitor) return err(ErrCode.NOT_FOUND, "游客身份不存在");

    // 实名唯一性:该身份证不得已被其他游客绑定(身份证为预约唯一主体,红线#2)
    const holder = await wechatRepository.findByBoundIdCard(parsed.data.idCard);
    if (holder && holder.id !== visitorId) {
      return err(ErrCode.CONFLICT, "该身份证已绑定其他微信账号，如有疑问请联系客服");
    }

    const updated = await wechatRepository.bindIdentity(
      visitorId,
      parsed.data.idCard,
      parsed.data.phone,
    );
    const token = await signVisitorToken({
      visitorId: updated.id,
      openid: updated.openid,
      boundIdCard: updated.boundIdCard,
    });
    return ok({ token, boundIdCard: parsed.data.idCard });
  },
};
