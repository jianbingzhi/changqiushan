import { request } from './client'
import type { PublicParkingLot } from './types'

export function listParking() {
  return request<PublicParkingLot[]>('/parking')
}

// 导览 POI 接口待 c-07 接入(GET /api/c/poi)
