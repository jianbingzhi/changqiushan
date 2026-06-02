import { createHash } from "node:crypto";
import { Prisma } from "@prisma/client";
import { db } from "@/infrastructure/db/client";
import { ok, err, ErrCode, type Result } from "@/shared/result";
import { shouldBlacklist } from "../domain/rules";
import { submitAppealSchema, reviewAppealSchema, type SubmitAppealInput, type ReviewAppealInput } from "../domain/schema";
import { riskcontrolRepository } from "../repository";
import type { RiskAppeal } from "@prisma/client";

export type ScanNoShowResult = { processed: number; blacklisted: number };

// idCard → 稳定 UUID 映射（SHA-256 前 16 字节，UUID v4 格式）
function idCardToUserId(idCard: string): string {
  const h = createHash("sha256").update(idCard).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const riskcontrolService = {
  async scanNoShow(slotId: string, _date: Date): Promise<ScanNoShowResult> {
    const affected = await db.$executeRaw(Prisma.sql`
      UPDATE booking
      SET    status      = 'NO_SHOW'::"BookingStatus",
             no_show_at  = NOW(),
             updated_at  = NOW()
      WHERE  slot_id     = ${slotId}::uuid
        AND  status      = 'CONFIRMED'::"BookingStatus"
    `);

    if (affected === 0) return { processed: 0, blacklisted: 0 };

    const noShows = await db.$queryRaw<Array<{ id_card: string; plate: string | null }>>(Prisma.sql`
      SELECT id_card, plate FROM booking
      WHERE  slot_id   = ${slotId}::uuid
        AND  status    = 'NO_SHOW'::"BookingStatus"
        AND  no_show_at >= NOW() - INTERVAL '10 seconds'
    `);

    let blacklisted = 0;
    for (const row of noShows) {
      const userId = idCardToUserId(row.id_card);
      const count = await riskcontrolRepository.incrementNoShow(userId);
      if (shouldBlacklist(count) && !(await riskcontrolRepository.isBlacklisted(userId))) {
        await riskcontrolRepository.addToBlacklist({
          userId, idCard: row.id_card, plate: row.plate ?? undefined,
          reason: `系统自动：爽约 ${count} 次达上限`,
        });
        blacklisted++;
      }
    }

    return { processed: noShows.length, blacklisted };
  },

  async submitAppeal(input: SubmitAppealInput): Promise<Result<{ id: string }>> {
    const parsed = submitAppealSchema.safeParse(input);
    if (!parsed.success) return err(ErrCode.INVALID_INPUT, parsed.error.issues[0].message);
    const { blacklistId, userId, reason } = parsed.data;

    const exists = await db.riskBlacklist.findUnique({ where: { id: blacklistId }, select: { id: true } });
    if (!exists) return err(ErrCode.NOT_FOUND, "黑名单记录不存在");

    const appeal = await riskcontrolRepository.createAppeal({ blacklistId, userId, reason });
    return ok({ id: appeal.id });
  },

  async reviewAppeal(input: ReviewAppealInput): Promise<Result<RiskAppeal>> {
    const parsed = reviewAppealSchema.safeParse(input);
    if (!parsed.success) return err(ErrCode.INVALID_INPUT, parsed.error.issues[0].message);
    const { appealId, status, reviewedBy, reviewNote } = parsed.data;

    const appeal = await riskcontrolRepository.findAppeal(appealId);
    if (!appeal) return err(ErrCode.NOT_FOUND, "申诉记录不存在");
    if (appeal.status !== "PENDING") return err(ErrCode.INVALID_INPUT, "该申诉已审核");

    const updated = await riskcontrolRepository.updateAppeal(appealId, { status, reviewedBy, reviewNote });
    if (status === "APPROVED") {
      await riskcontrolRepository.removeFromBlacklist(appeal.userId);
      await riskcontrolRepository.resetNoShowCount(appeal.userId);
    }
    return ok(updated);
  },

  async isBlacklisted(userId: string): Promise<boolean> {
    return riskcontrolRepository.isBlacklisted(userId);
  },
};
