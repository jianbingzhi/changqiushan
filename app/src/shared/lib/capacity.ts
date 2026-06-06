// D1 瞬时承载量口径(红线 4)。这是「在园人数 / 承载量」90% 闪红的分母。
// 注意:这是「瞬时」承载量,与「当日各时段容量求和」是两个口径(后者会让 90% 几乎永不触发,B4)。
//
// shared 是架构叶子,不能读 DB / 依赖业务模块。故此处只放纯常量 + 纯兜底解析:
// - 阈值常量统一引用,杜绝 0.9/0.8 在各处漂移;
// - resolveInstantCapacity 是纯函数,接收已取出的配置原值(运营可配),按「配置 → env → 默认」兜底;
// 配置读取(DB + 缓存)在 system 模块 configService.getInstantCapacity()。

export const DEFAULT_INSTANT_CAPACITY = 5000;

// 红线 4:在园人数达瞬时承载量 90% 触发熔断(大屏闪红 + 停当日预约入口)。
export const CIRCUIT_BREAK_RATIO = 0.9;
// 迟滞带:回落到 80% 以下方可恢复,避免 80–90% 区间反复抖动。
export const CIRCUIT_RESUME_RATIO = 0.8;

/** 纯兜底解析:配置原值 → env(PARK_INSTANT_CAPACITY)→ 默认值。任一非法跳到下一档。 */
export function resolveInstantCapacity(raw?: string | number | null): number {
  const fromConfig = Number(raw);
  if (Number.isFinite(fromConfig) && fromConfig > 0) return fromConfig;
  const fromEnv = Number(process.env.PARK_INSTANT_CAPACITY);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : DEFAULT_INSTANT_CAPACITY;
}
