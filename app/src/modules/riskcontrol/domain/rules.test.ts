import { describe, it, expect } from "vitest";
import {
  shouldBlacklist,
  isValidAppealStatus,
  NOSHOW_BLACKLIST_THRESHOLD,
} from "./rules";

describe("shouldBlacklist — 爽约拉黑阈值", () => {
  it(`阈值常量为 ${NOSHOW_BLACKLIST_THRESHOLD}`, () => {
    expect(NOSHOW_BLACKLIST_THRESHOLD).toBe(3);
  });

  it("差一次(2)→ 不拉黑", () => {
    expect(shouldBlacklist(2)).toBe(false);
  });

  it("恰达阈值(3)→ 拉黑", () => {
    expect(shouldBlacklist(3)).toBe(true);
  });

  it("超过阈值(4)→ 拉黑", () => {
    expect(shouldBlacklist(4)).toBe(true);
  });

  it("零次 → 不拉黑", () => {
    expect(shouldBlacklist(0)).toBe(false);
  });
});

describe("isValidAppealStatus — 申诉状态白名单", () => {
  it("APPROVED / REJECTED 合法", () => {
    expect(isValidAppealStatus("APPROVED")).toBe(true);
    expect(isValidAppealStatus("REJECTED")).toBe(true);
  });

  it("其余值非法", () => {
    expect(isValidAppealStatus("PENDING")).toBe(false);
    expect(isValidAppealStatus("")).toBe(false);
    expect(isValidAppealStatus("approved")).toBe(false);
  });
});
