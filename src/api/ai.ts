import Taro from '@tarojs/taro'
import { API_BASE, request } from './client'
import { useAuthStore } from '@/store/authStore'
import { decodeUtf8 } from '@/utils/utf8'

export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface StreamHandlers {
  onConversation?: (id: string) => void
  onToken: (t: string) => void
  onDone: () => void
  onError: (msg: string) => void
}

// A7 流式:Taro.request enableChunked + onChunkReceived 解析 data:{...}\n\n 帧
export function streamChat(
  params: { message: string; conversationId?: string },
  handlers: StreamHandlers,
) {
  const token = useAuthStore.getState().token
  const bytes: number[] = []
  let processed = 0
  let finished = false

  const handleFrame = (frame: string) => {
    const line = frame.trim()
    if (!line.startsWith('data:')) return
    const payload = line.slice(5).trim()
    if (!payload) return
    try {
      const obj = JSON.parse(payload)
      if (obj.conversationId) handlers.onConversation?.(obj.conversationId)
      if (typeof obj.t === 'string') handlers.onToken(obj.t)
      if (obj.done && !finished) {
        finished = true
        handlers.onDone()
      }
    } catch {
      // 跳过不完整/非 JSON 帧
    }
  }

  const task = Taro.request({
    url: `${API_BASE}/ai/chat`,
    method: 'POST',
    enableChunked: true,
    data: params,
    header: {
      'content-type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    fail: () => {
      if (!finished) handlers.onError('网络异常，请重试')
    },
    complete: () => {
      if (!finished) {
        finished = true
        handlers.onDone()
      }
    },
  })

  const onChunk = (res: { data: ArrayBuffer }) => {
    const arr = new Uint8Array(res.data)
    for (let k = 0; k < arr.length; k++) bytes.push(arr[k])
    const text = decodeUtf8(Uint8Array.from(bytes))
    const frames = text.split('\n\n')
    for (let k = processed; k < frames.length - 1; k++) handleFrame(frames[k])
    processed = frames.length - 1
  }

  // 老基础库无 onChunkReceived → 降级:complete 时整段解析
  if (typeof task.onChunkReceived === 'function') {
    task.onChunkReceived(onChunk)
  }
  return task
}

export function listConversations() {
  return request<{ id: string; title: string; updatedAt: string }[]>('/ai/conversations', { auth: true })
}

export function getMessages(conversationId: string) {
  return request<AiMessage[]>(`/ai/conversations/${conversationId}/messages`, { auth: true })
}
