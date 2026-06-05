// D1 瞬时承载量口径(红线 4)。PRD 给定正式数值前,这是占位单值(env PARK_INSTANT_CAPACITY),
// 由仪表盘在园数卡与数据大屏统一引用,作为「在园人数 / 承载量」90% 闪红的分母。
// ⚠️ 阈值任意 → 红线 4 仅「机制就绪」,待 PRD 数值确认后才算真正闭合。
// 注意:这是「瞬时」承载量,与「当日各时段容量求和」是两个口径(后者会让 90% 几乎永不触发,B4)。
const DEFAULT_INSTANT_CAPACITY = 5000;

export function getInstantCapacity(): number {
  const v = Number(process.env.PARK_INSTANT_CAPACITY);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_INSTANT_CAPACITY;
}
