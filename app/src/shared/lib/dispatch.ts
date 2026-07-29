// 智能调度策略(规则模板,非 AI)——纯函数,大屏页面与 /api/screen/dispatch 共用。
// 设计:平时空态(calm),命中真实态势阈值时给可执行编号策略(alert);纯展示,无 actuator。

export const DISPATCH_WARN_PCT = 80; // 在园承载率提示线(低于 90% 熔断线,提前介入)
export const PARKING_FULL_RATIO = 0.9; // 停车场「接近满载」占用率阈值

export interface DispatchInput {
  occupancyPct: number;
  fullLotNames: string[];
  soldOutSlotCount: number;
  alertDeviceNames: string[];
}

export interface DispatchResult {
  active: boolean;
  status: "calm" | "alert";
  situation: string;
  strategies: string[];
}

export function buildDispatch(input: DispatchInput): DispatchResult {
  const { occupancyPct, fullLotNames, soldOutSlotCount, alertDeviceNames } = input;
  const triggers: string[] = [];
  const strategies: string[] = [];

  if (occupancyPct >= DISPATCH_WARN_PCT) {
    triggers.push(`在园承载率 ${occupancyPct}%`);
    strategies.push("加强入口分流,临时下调高峰时段放量,密切监控承载率逼近熔断线");
  }
  if (fullLotNames.length > 0) {
    triggers.push(`${fullLotNames.join("、")} 接近满载`);
    strategies.push("全园广播疏导,引导车辆转至余位较多的停车场");
  }
  if (soldOutSlotCount > 0) {
    triggers.push(`${soldOutSlotCount} 个时段名额售罄`);
    strategies.push("关闭已满时段预约入口,引导游客改约邻近空闲时段");
  }
  if (alertDeviceNames.length > 0) {
    const names = alertDeviceNames.slice(0, 3).join("、");
    triggers.push(`${alertDeviceNames.length} 台设备告警/离线`);
    strategies.push(`派运维核查告警设备:${names}${alertDeviceNames.length > 3 ? " 等" : ""}`);
  }

  const active = strategies.length > 0;
  return {
    active,
    status: active ? "alert" : "calm",
    situation: active ? `检测到 ${triggers.join(";")}` : "当前运行平稳,暂无调度建议",
    strategies,
  };
}
