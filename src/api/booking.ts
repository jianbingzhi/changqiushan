import { request } from './client'
import { useAuthStore } from '@/store/authStore'
import type { CreateBookingInput } from '@shared/booking'
import type { PublicSlot, PublicBooking, VisitorStats } from './types'

export function listSlots(date: string) {
  return request<PublicSlot[]>(`/slots?date=${date}`)
}

export async function createBooking(input: CreateBookingInput) {
  const res = await request<{ booking: PublicBooking; token?: string }>('/booking', {
    method: 'POST',
    auth: true,
    data: input as unknown as Record<string, unknown>,
  })
  // 首单后端自动绑证并重签 token → 刷新本地存储
  if (res.ok && res.data.token) {
    useAuthStore.getState().setToken(res.data.token, input.idCard)
  }
  return res
}

export function cancelBooking(id: string) {
  return request<{ id: string; status: string }>(`/booking/${id}/cancel`, {
    method: 'POST',
    auth: true,
  })
}

export function listMyBookings() {
  return request<PublicBooking[]>('/me/bookings', { auth: true })
}

export function getMyStats() {
  return request<VisitorStats>('/me/stats', { auth: true })
}

export function submitAppeal(reason: string) {
  return request<{ id: string }>('/appeals', { method: 'POST', auth: true, data: { reason } })
}
