import { describe, it, expect, afterEach, vi } from "vitest";

import { createOnsiteForm } from "./form-state";

// round-01 N01 防回归:初始表单的日期必须**每次调用现取**。
// 原实现在模块作用域求值(`const INITIAL = { date: chinaToday() }`),模块一个进程只加载一次,
// 服务端那份被钉死在首次加载那天 → SSR 日期陈旧、水合后跳变 → React #418 + <html> 丢 dark。
describe("createOnsiteForm", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("日期跟随调用时刻,不被模块加载时刻冻结", () => {
    vi.useFakeTimers();

    vi.setSystemTime(new Date("2026-07-22T04:00:00Z"));
    const first = createOnsiteForm();

    vi.setSystemTime(new Date("2026-07-28T04:00:00Z"));
    const second = createOnsiteForm();

    expect(first.date).toBe("2026-07-22");
    expect(second.date).toBe("2026-07-28");
  });

  it("取北京墙钟日历日,不随 UTC 日界偏到昨天", () => {
    vi.useFakeTimers();
    // UTC 还是 27 日 23 点,北京已是 28 日 07 点
    vi.setSystemTime(new Date("2026-07-27T23:00:00Z"));
    expect(createOnsiteForm().date).toBe("2026-07-28");
  });

  it("除日期外其余字段为干净空值(继续录入时不残留上一单)", () => {
    const form = createOnsiteForm();
    expect(form).toMatchObject({
      slotId: "",
      slotLabel: "",
      visitorName: "",
      phone: "",
      idCard: "",
      hasVehicle: null,
      plate: "",
      noVehicleDeclared: false,
    });
  });

  it("每次返回全新对象,互不共享引用", () => {
    expect(createOnsiteForm()).not.toBe(createOnsiteForm());
  });
});
