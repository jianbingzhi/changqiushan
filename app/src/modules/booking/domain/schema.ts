import { z } from "zod";

export const createBookingSchema = z
  .object({
    slotId:           z.string().uuid("slotId 必须是 UUID"),
    // B26:派生时段下单需带北京日历日(YYYY-MM-DD)以惰性物化;物化时段可省略(按 id 直查)
    date:             z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式无效").optional(),
    visitorName:      z.string().min(1, "姓名不能为空").max(40),
    idCard:           z.string().length(18, "身份证号必须 18 位"),
    phone:            z.string().regex(/^1[3-9]\d{9}$/, "手机号格式无效"),
    plate:            z.string().max(16).optional(),
    noVehicleDeclared: z.boolean().optional().default(false),
    channel:          z.enum(["MINI_PROGRAM", "ONSITE_MAKEUP", "OTA", "ADMIN_MANUAL"]),
  })
  .refine(
    (v) => v.plate != null || v.noVehicleDeclared === true,
    { message: "请填写车牌号或声明无车辆", path: ["plate"] },
  )
  .refine(
    (v) => !(v.plate != null && v.noVehicleDeclared === true),
    { message: "填写了车牌号则不能同时声明无车辆", path: ["noVehicleDeclared"] },
  );

export type CreateBookingInput = z.infer<typeof createBookingSchema>;

// C4:运营后台手动建时段(止血)。date 为北京日历日 YYYY-MM-DD,各渠道配额之和即总名额。
export const createSlotSchema = z
  .object({
    date:      z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式无效"),
    name:      z.string().min(1, "时段名不能为空").max(80),
    startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "开始时间格式无效"),
    endTime:   z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "结束时间格式无效"),
    miniProgramQuota: z.coerce.number().int().min(0).max(100000).default(0),
    onsiteQuota:      z.coerce.number().int().min(0).max(100000).default(0),
    otaQuota:         z.coerce.number().int().min(0).max(100000).default(0),
    adminQuota:       z.coerce.number().int().min(0).max(100000).default(0),
  })
  .refine((v) => v.endTime > v.startTime, {
    message: "结束时间须晚于开始时间",
    path: ["endTime"],
  })
  .refine(
    (v) => v.miniProgramQuota + v.onsiteQuota + v.otaQuota + v.adminQuota > 0,
    { message: "各渠道名额之和须大于 0", path: ["miniProgramQuota"] },
  );

export type CreateSlotInput = z.infer<typeof createSlotSchema>;
