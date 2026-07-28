// 现场补录表单的初始态。抽成独立模块的唯一原因是「日期必须每次现取」——
// round-01 N01:原先 `const INITIAL = { date: chinaToday(), ... }` 在**模块作用域**求值,
// 模块一个进程只加载一次,服务端那份就被钉死在首次加载那天(实测陈旧 6 天);
// 客户端模块另行加载 → 水合时算出的是"今天" → 文本不一致(React #418),
// 且 React 会按 SSR 版本回写 <html> class,连带把 `dark` 抹掉(全站唯一不跟随深色主题的页)。
// 结论:凡「当前时间」派生的默认值,一律做成函数、在渲染时求值,不得在模块作用域固化。

import { chinaToday } from "@/shared/lib/time";

export interface FormState {
  date: string;
  slotId: string;
  slotLabel: string;
  visitorName: string;
  phone: string;
  idCard: string;
  hasVehicle: boolean | null;
  plate: string;
  noVehicleDeclared: boolean;
}

/** 与时间无关的空值部分,可安全地在模块作用域固化。 */
const EMPTY: Omit<FormState, "date"> = {
  slotId: "",
  slotLabel: "",
  visitorName: "",
  phone: "",
  idCard: "",
  hasVehicle: null,
  plate: "",
  noVehicleDeclared: false,
};

/**
 * 新建一份表单初始态,`date` = 调用时刻的北京日历日。
 * 必须在渲染时调用(`useState(createOnsiteForm)`),SSR 与水合各自求值得到同一天,天然无 mismatch。
 */
export function createOnsiteForm(): FormState {
  return { ...EMPTY, date: chinaToday() };
}
