import { request } from './client'

// AI 流式问答(chunked)在 c-05 接入;此处先留会话历史只读接口占位
export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export function listConversations() {
  return request<{ id: string; title: string; updatedAt: string }[]>('/ai/conversations', { auth: true })
}
