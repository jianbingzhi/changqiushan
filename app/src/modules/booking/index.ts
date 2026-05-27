// 模块对外公共 API — 跨模块只允许 import 这里的 named exports
// 内部 service / repository / domain 不允许直接被其他模块引用(由 eslint-plugin-boundaries 强制)

export { bookingRepository } from "./repository";
export type { BookingSlot, Booking, BookingSlotStatus, BookingStatus, BookingChannel } from "@prisma/client";
