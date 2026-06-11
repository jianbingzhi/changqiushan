// ★ 同源 zod 校验 — 与 app/src/modules/booking/domain/schema.ts 保持一致
// 仅依赖 zod(无 Prisma/Next),端内提交前 safeParse,与 BFF createBooking 同一口径(红线#2)
// 维护纪律:改此文件须同步改后端 createBookingSchema;CI 校验两端哈希一致
import { z } from "zod";

export const createBookingSchema = z
  .object({
    slotId: z.string().uuid("slotId 必须是 UUID"),
    // B26:派生时段下单需带北京日历日(YYYY-MM-DD)以惰性物化;物化时段可省略(按 id 直查)
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式无效").optional(),
    visitorName: z.string().min(1, "姓名不能为空").max(40),
    idCard: z.string().length(18, "身份证号必须 18 位"),
    phone: z.string().regex(/^1[3-9]\d{9}$/, "手机号格式无效"),
    plate: z.string().max(16).optional(),
    noVehicleDeclared: z.boolean().optional().default(false),
  })
  .refine((v) => v.plate != null || v.noVehicleDeclared === true, {
    message: "请填写车牌号或声明无车辆",
    path: ["plate"],
  })
  .refine((v) => !(v.plate != null && v.noVehicleDeclared === true), {
    message: "填写了车牌号则不能同时声明无车辆",
    path: ["noVehicleDeclared"],
  });

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
