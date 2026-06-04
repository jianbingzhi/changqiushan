import { request } from './client'
import type { PublicActivity } from './types'

export function listActivities() {
  return request<PublicActivity[]>('/activities')
}

export function getActivity(id: string) {
  return request<PublicActivity>(`/activities/${id}`)
}

export function signupActivity(id: string, input: { userName: string; idCard: string; phone: string }) {
  return request<{ id: string }>(`/activities/${id}/signup`, {
    method: 'POST',
    auth: true,
    data: input,
  })
}
