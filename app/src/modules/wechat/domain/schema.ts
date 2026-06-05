import { z } from "zod";

export const wechatLoginSchema = z.object({
  code: z.string().min(1, "缺少微信登录凭证 code"),
});

// 实名绑定复用与预约同口径的身份证/手机号校验(红线#2 单一校验语义)
export const bindIdentitySchema = z.object({
  idCard: z.string().length(18, "身份证号必须 18 位"),
  phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式无效"),
});

export type WechatLoginInput = z.infer<typeof wechatLoginSchema>;
export type BindIdentityInput = z.infer<typeof bindIdentitySchema>;
