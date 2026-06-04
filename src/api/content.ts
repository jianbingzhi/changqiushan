import { request } from './client'
import type { PublicIntro, PublicNews, PublicKnowledge } from './types'

export function listIntro() {
  return request<PublicIntro[]>('/intro')
}

export function listNews() {
  return request<PublicNews[]>('/news')
}

export function listKnowledge(category?: string) {
  return request<PublicKnowledge[]>(category ? `/knowledge?category=${encodeURIComponent(category)}` : '/knowledge')
}
