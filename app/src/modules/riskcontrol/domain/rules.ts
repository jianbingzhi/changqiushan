export const NOSHOW_BLACKLIST_THRESHOLD = 3;

export function shouldBlacklist(noShowCount: number): boolean {
  return noShowCount >= NOSHOW_BLACKLIST_THRESHOLD;
}

export function isValidAppealStatus(status: string): status is "APPROVED" | "REJECTED" {
  return status === "APPROVED" || status === "REJECTED";
}
