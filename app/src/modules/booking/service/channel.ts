import { z } from "zod";
import { Prisma } from "@prisma/client";
import type { BookingChannel, ChannelConfig } from "@prisma/client";
import { bookingRepository } from "../repository";
import { ok, err, ErrCode, type Result } from "@/shared/result";

// B33③ 渠道接入配置服务。渠道为固定枚举(只改 label/说明/排序/启停,不增删)。

const CHANNEL_CODES: readonly BookingChannel[] = ["MINI_PROGRAM", "ONSITE_MAKEUP", "OTA", "ADMIN_MANUAL"];

// 仅改 label/说明/排序;enabled 走独立 setEnabled,不在此处携带(避免保存时误改启停)
const channelUpdateSchema = z.object({
  label:       z.string().min(1, "渠道名称不能为空").max(40),
  description: z.string().max(120, "说明不超过 120 字").default(""),
  sortOrder:   z.coerce.number().int().min(0).max(999).default(0),
});

export type ChannelUpdateInput = z.infer<typeof channelUpdateSchema>;

const isValidCode = (code: string): code is BookingChannel =>
  (CHANNEL_CODES as readonly string[]).includes(code);

export const channelService = {
  list(): Promise<ChannelConfig[]> {
    return bookingRepository.listChannelConfigs();
  },

  async update(code: string, raw: unknown): Promise<Result<ChannelConfig>> {
    if (!isValidCode(code)) return err(ErrCode.INVALID_INPUT, "渠道码无效");
    const parsed = channelUpdateSchema.safeParse(raw);
    if (!parsed.success) {
      return err(ErrCode.INVALID_INPUT, parsed.error.issues[0]?.message ?? "输入校验失败");
    }
    try {
      const row = await bookingRepository.updateChannelConfig(code, parsed.data);
      return ok(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return err(ErrCode.NOT_FOUND, "渠道配置不存在");
      }
      throw e;
    }
  },

  async setEnabled(code: string, enabled: boolean): Promise<Result<ChannelConfig>> {
    if (!isValidCode(code)) return err(ErrCode.INVALID_INPUT, "渠道码无效");
    try {
      const row = await bookingRepository.updateChannelConfig(code, { enabled });
      return ok(row);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return err(ErrCode.NOT_FOUND, "渠道配置不存在");
      }
      throw e;
    }
  },

  // 下单校验用:无配置行视为启用(不阻塞历史/未初始化渠道)
  async isEnabled(code: BookingChannel): Promise<boolean> {
    const row = await bookingRepository.getChannelConfig(code);
    return row ? row.enabled : true;
  },
};
