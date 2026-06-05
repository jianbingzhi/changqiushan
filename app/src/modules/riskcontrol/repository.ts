import { Prisma } from "@prisma/client";
import { db } from "@/infrastructure/db/client";
import type { RiskBlacklist, RiskAppeal, AppealStatus } from "@prisma/client";

export const riskcontrolRepository = {
  async incrementNoShow(userId: string): Promise<number> {
    const result = await db.$queryRaw<[{ count: bigint }]>(Prisma.sql`
      INSERT INTO risk_noshow_counter (id, user_id, count, last_no_show_at, created_at)
      VALUES (gen_random_uuid(), ${userId}::uuid, 1, NOW(), NOW())
      ON CONFLICT (user_id)
      DO UPDATE SET
        count            = risk_noshow_counter.count + 1,
        last_no_show_at  = NOW()
      RETURNING count
    `);
    return Number(result[0].count);
  },

  async getNoShowCount(userId: string): Promise<number> {
    const row = await db.riskNoshowCounter.findUnique({ where: { userId }, select: { count: true } });
    return row?.count ?? 0;
  },

  async resetNoShowCount(userId: string): Promise<void> {
    await db.riskNoshowCounter.updateMany({ where: { userId }, data: { count: 0 } });
  },

  addToBlacklist(data: { userId: string; idCard: string; plate?: string; reason?: string; reviewedBy?: string }): Promise<RiskBlacklist> {
    return db.riskBlacklist.upsert({
      where:  { userId: data.userId },
      create: { ...data, blacklistedAt: new Date(), plate: data.plate ?? null, reason: data.reason ?? null, reviewedBy: data.reviewedBy ?? null },
      update: { blacklistedAt: new Date(), reason: data.reason ?? null, reviewedBy: data.reviewedBy ?? null },
    });
  },

  async isBlacklisted(userId: string): Promise<boolean> {
    const r = await db.riskBlacklist.findUnique({ where: { userId }, select: { id: true } });
    return r !== null;
  },

  removeFromBlacklist(userId: string): Promise<RiskBlacklist> {
    return db.riskBlacklist.delete({ where: { userId } });
  },

  findBlacklistAll() {
    return db.riskBlacklist.findMany({ orderBy: { blacklistedAt: "desc" } });
  },

  findBlacklistByUserId(userId: string) {
    return db.riskBlacklist.findUnique({ where: { userId } });
  },

  findAppeal(id: string) {
    return db.riskAppeal.findUnique({ where: { id }, include: { blacklist: true } });
  },

  // B11: 申诉列表(含所属黑名单记录,取 idCard 展示),倒序
  listAppeals() {
    return db.riskAppeal.findMany({
      include: { blacklist: true },
      orderBy: { createdAt: "desc" },
    });
  },

  createAppeal(data: { blacklistId: string; userId: string; reason: string }): Promise<RiskAppeal> {
    return db.riskAppeal.create({ data });
  },

  updateAppeal(id: string, data: { status?: AppealStatus; reviewedBy?: string; reviewNote?: string }): Promise<RiskAppeal> {
    return db.riskAppeal.update({ where: { id }, data });
  },
};
