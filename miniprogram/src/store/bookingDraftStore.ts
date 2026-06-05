import { create } from 'zustand'

// A4 表单期间的占位草稿:选中的时段 + 5 分钟软性占位倒计时
// 注:BFF 未实现服务端预占,holdExpiresAt 为端内软计时(useDidShow 重算防切后台漂移)
const HOLD_MS = 5 * 60 * 1000

interface BookingDraftState {
  slotId: string | null
  slotLabel: string | null
  holdExpiresAt: number | null
  selectSlot: (slotId: string, label: string) => void
  clear: () => void
}

export const useBookingDraftStore = create<BookingDraftState>((set) => ({
  slotId: null,
  slotLabel: null,
  holdExpiresAt: null,
  selectSlot: (slotId, label) =>
    set({ slotId, slotLabel: label, holdExpiresAt: Date.now() + HOLD_MS }),
  clear: () => set({ slotId: null, slotLabel: null, holdExpiresAt: null }),
}))
