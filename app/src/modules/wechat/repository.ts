import { db } from "@/infrastructure/db/client";
import type { WechatVisitor } from "@prisma/client";

export const wechatRepository = {
  upsertByOpenid(data: {
    openid: string;
    unionid?: string | null;
    nickname?: string | null;
    avatarUrl?: string | null;
  }): Promise<WechatVisitor> {
    return db.wechatVisitor.upsert({
      where: { openid: data.openid },
      create: {
        openid: data.openid,
        unionid: data.unionid ?? null,
        nickname: data.nickname ?? null,
        avatarUrl: data.avatarUrl ?? null,
      },
      update: {
        unionid: data.unionid ?? undefined,
        nickname: data.nickname ?? undefined,
        avatarUrl: data.avatarUrl ?? undefined,
      },
    });
  },

  findById(id: string): Promise<WechatVisitor | null> {
    return db.wechatVisitor.findUnique({ where: { id } });
  },

  findByBoundIdCard(idCard: string): Promise<WechatVisitor | null> {
    return db.wechatVisitor.findFirst({ where: { boundIdCard: idCard } });
  },

  bindIdentity(id: string, idCard: string, phone: string): Promise<WechatVisitor> {
    return db.wechatVisitor.update({
      where: { id },
      data: { boundIdCard: idCard, phone },
    });
  },
};
