import { describe, it, expect, vi, beforeEach } from "vitest";

// round-01 N19 防回归:红线 4 熔断期间「已物化时段」在 C 端仍显示可约,点了才被拒。
//
// 写守卫(createBooking → CIRCUIT_BREAKER_OPEN)一直是牢的,漏的是**显示口径**:
// listSlotsForDate 此前只把**派生行**置 PAUSED,已物化的今日时段(运营在 /booking/slots
// 补建是正常生产路径)照旧返回 ACTIVE → serialize 算出 bookable:true → 用户填完表单提交才被拒。
//
// 判据取「熔断时当日**每一条**时段(不分物化/派生)都不得是 ACTIVE」,而不是断言某一条,
// 否则只要再多一条来源(比如将来的第三种时段行)就又会漏过去。

vi.mock("../repository", () => ({
  bookingRepository: {
    listSlotsByDate: vi.fn(),
    listEnabledTemplates: vi.fn(),
    getHoliday: vi.fn(),
    getInstantCapacityRaw: vi.fn(),
  },
  // booking.ts 以值的形式 import 这几个错误类型(createBooking 用),mock 必须一并给出
  SlotFullError: class SlotFullError extends Error {},
  DuplicateBookingError: class DuplicateBookingError extends Error {},
  SlotInactiveError: class SlotInactiveError extends Error {},
  DailyStockExhaustedError: class DailyStockExhaustedError extends Error {},
  PhoneLimitError: class PhoneLimitError extends Error {},
  IdCardLimitError: class IdCardLimitError extends Error {},
}));

const { bookingRepository } = await import("../repository");
const { bookingService } = await import("./booking");

const DATE = "2026-07-29";
const CAPACITY = 1000;

/** 模板:派生出「上午场」一条(startTime 09:00),与物化行的 10:00 错开,两种来源同时在场 */
const TEMPLATE = {
  id: "tpl-1",
  name: "上午场",
  dayType: "WEEKDAY",
  startTime: "09:00",
  endTime: "12:00",
  miniProgramQuota: 100,
  onsiteQuota: 20,
  otaQuota: 0,
  adminQuota: 0,
  enabled: true,
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** 物化行:运营在 /booking/slots 为本日补建的那种行,状态 ACTIVE、还有余位 */
function materializedSlot(checkedInCount: number, status = "ACTIVE") {
  return {
    id: "slot-materialized",
    date: new Date(`${DATE}T00:00:00Z`),
    name: "下午场",
    startTime: "10:00",
    endTime: "16:00",
    capacity: 200,
    miniProgramQuota: 150, onsiteQuota: 50, otaQuota: 0, adminQuota: 0,
    miniProgramBooked: 1, onsiteBooked: 0, otaBooked: 0, adminBooked: 0,
    bookedCount: 1,
    checkedInCount,
    status,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function arrange(checkedInCount: number, materializedStatus = "ACTIVE") {
  vi.mocked(bookingRepository.listSlotsByDate).mockResolvedValue([
    materializedSlot(checkedInCount, materializedStatus),
  ] as never);
  vi.mocked(bookingRepository.listEnabledTemplates).mockResolvedValue([TEMPLATE] as never);
  vi.mocked(bookingRepository.getHoliday).mockResolvedValue(null as never);
  vi.mocked(bookingRepository.getInstantCapacityRaw).mockResolvedValue(String(CAPACITY) as never);
}

beforeEach(() => vi.clearAllMocks());

describe("N19 熔断期间的显示口径:物化行与派生行一视同仁", () => {
  it("未熔断(在园 500 / 承载 1000 = 50%)时两种行都照常 ACTIVE", async () => {
    arrange(500);
    const slots = await bookingService.listSlotsForDate(DATE);
    expect(slots).toHaveLength(2);
    expect(slots.map((s) => s.status)).toEqual(["ACTIVE", "ACTIVE"]);
  });

  it("熔断(在园 900 / 承载 1000 = 90%)时**没有任何一条**还是 ACTIVE", async () => {
    arrange(900);
    const slots = await bookingService.listSlotsForDate(DATE);
    expect(slots).toHaveLength(2);
    expect(slots.filter((s) => s.status === "ACTIVE")).toEqual([]);
  });

  // 这一条就是 N19 本身:缺陷版里派生行已经 PAUSED、物化行还是 ACTIVE
  it("熔断时那条**已物化**的时段同样是 PAUSED(N19 复现位)", async () => {
    arrange(900);
    const slots = await bookingService.listSlotsForDate(DATE);
    const materialized = slots.find((s) => s.materialized);
    expect(materialized, "物化行没被取回,这条用例等于没测").toBeDefined();
    expect(materialized!.status).toBe("PAUSED");
  });

  // 与写侧 pauseSlotsForCircuitBreak(where status:ACTIVE)同口径:CLOSED 比 PAUSED 更严格,不得被冲淡
  it("熔断不把 CLOSED 的物化行改成 PAUSED", async () => {
    arrange(900, "CLOSED");
    const slots = await bookingService.listSlotsForDate(DATE);
    expect(slots.find((s) => s.materialized)!.status).toBe("CLOSED");
  });
});
