import { z } from "zod";

// IoT 设备增改输入校验(纯规则,不碰 DB)。
// 字段对齐 IotDevice 模型:name(唯一) / type / location(可空);
// status/lastSeen 由心跳链路维护,不在 CRUD 表单内编辑。
export const deviceSchema = z.object({
  name:     z.string().trim().min(1, "设备名称不能为空").max(80, "设备名称不超过 80 字"),
  type:     z.string().trim().min(1, "设备类型不能为空").max(40, "设备类型不超过 40 字"),
  location: z
    .string()
    .trim()
    .max(255, "安装位置不超过 255 字")
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type DeviceInput = z.infer<typeof deviceSchema>;
