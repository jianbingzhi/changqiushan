import { z } from "zod";

// B33③ 停车场增改校验。
// occupied(已占用)是动态数据,由设备/同步链路写入(syncParkingStatus),不开放给增改表单 → 新建恒为 0。
// coordinates(经纬度上图坐标)可选:[经度, 纬度];缺省存 null。
const coordinatesSchema = z
  .object({
    lng: z.coerce.number().min(-180).max(180),
    lat: z.coerce.number().min(-90).max(90),
  })
  .nullable()
  .optional();

const parkingLotBase = z.object({
  name:        z.string().trim().min(1, "停车场名称不能为空").max(80, "停车场名称不超过 80 字"),
  capacity:    z.coerce.number({ message: "总车位须为数字" }).int("总车位须为整数").min(0, "总车位不能为负"),
  status:      z.enum(["OPEN", "FULL", "CLOSED"]).default("OPEN"),
  location:    z.string().trim().max(255, "位置描述不超过 255 字").optional(),
  coordinates: coordinatesSchema,
});

export const createParkingLotSchema = parkingLotBase;
export const updateParkingLotSchema = parkingLotBase;

export type CreateParkingLotInput = z.infer<typeof createParkingLotSchema>;
export type UpdateParkingLotInput = z.infer<typeof updateParkingLotSchema>;
