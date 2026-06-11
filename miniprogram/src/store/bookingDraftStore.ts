import { create } from 'zustand'

// A4 表单期间的占位草稿:选中的时段 + 5 分钟软性占位倒计时
// 注:BFF 未实现服务端预占,holdExpiresAt 为端内软计时(useDidShow 重算防切后台漂移)
const HOLD_MS = 5 * 60 * 1000

interface BookingDraftState {
  slotId: string | null
  // B26:选中日期(YYYY-MM-DD),下单随 slotId 一并提交以支持派生时段惰性物化
  date: string | null
  slotLabel: string | null
  holdExpiresAt: number | null
  selectSlot: (slotId: string, date: string, label: string) => void
  clear: () => void
}

export const useBookingDraftStore = create<BookingDraftState>((set) => ({
  slotId: null,
  date: null,
  slotLabel: null,
  holdExpiresAt: null,
  selectSlot: (slotId, date, label) =>
    set({ slotId, date, slotLabel: label, holdExpiresAt: Date.now() + HOLD_MS }),
  clear: () => set({ slotId: null, date: null, slotLabel: null, holdExpiresAt: null }),
}))
