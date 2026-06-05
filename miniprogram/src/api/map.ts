import { request } from './client'
import type { PublicParkingLot, PublicPoi } from './types'

export function listParking() {
  return request<PublicParkingLot[]>('/parking')
}

export function listPoi(category?: string) {
  return request<PublicPoi[]>(category ? `/poi?category=${encodeURIComponent(category)}` : '/poi')
}
