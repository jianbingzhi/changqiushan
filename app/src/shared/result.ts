export type Ok<T> = { ok: true; value: T };
export type Err = { ok: false; code: ErrCode; message: string };
export type Result<T> = Ok<T> | Err;

export const ok = <T>(value: T): Ok<T> => ({ ok: true, value });
export const err = (code: ErrCode, message: string): Err => ({ ok: false, code, message });

export enum ErrCode {
  INVALID_INPUT = "INVALID_INPUT",
  NOT_FOUND = "NOT_FOUND",
  SLOT_FULL = "SLOT_FULL",
  SLOT_INACTIVE = "SLOT_INACTIVE",
  CIRCUIT_BREAKER_OPEN = "CIRCUIT_BREAKER_OPEN",
  BLACKLISTED = "BLACKLISTED",
  DUPLICATE_BOOKING = "DUPLICATE_BOOKING",
  CHECKIN_ALREADY_DONE = "CHECKIN_ALREADY_DONE",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
}
