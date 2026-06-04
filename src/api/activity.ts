import { request } from './client'
import type { PublicActivity } from './types'

export function listActivities() {
  return request<PublicActivity[]>('/activities')
}

export function getActivity(id: string) {
  return request<PublicActivity>(`/activities/${id}`)
}
