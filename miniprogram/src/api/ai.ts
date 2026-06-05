import Taro from '@tarojs/taro'
import { API_BASE, request } from './client'
import { useAuthStore } from '@/store/authStore'
import { decodeUtf8, decodeUtf8Stream } from '@/utils/utf8'

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
//   #5 增量解码:pending 仅保留尾部未完成的多字节,frameBuf 仅保留未闭合的半帧 → 无 O(n²)、无 token 重复
//   #6 降级:基础库无 onChunkReceived 时,complete/success 整段解析
//   #7 错误帧:后端校验失败走 data:{"error":...} → onError 显示
export function streamChat(
  params: { message: string; conversationId?: string },
  handlers: StreamHandlers,
) {
  const token = useAuthStore.getState().token
  let pending: number[] = []
  let frameBuf = ''
  let finished = false
  let gotChunk = false
  let erred = false

  const finish = () => {
    if (!finished) {
      finished = true
      handlers.onDone()
    }
  }

  const handleFrame = (frame: string) => {
    const line = frame.trim()
    if (!line.startsWith('data:')) return
    const payload = line.slice(5).trim()
    if (!payload) return
    try {
      const obj = JSON.parse(payload)
      if (obj.error) {
        erred = true
        handlers.onError(String(obj.error))
        return
      }
      if (obj.conversationId) handlers.onConversation?.(obj.conversationId)
      if (typeof obj.t === 'string') handlers.onToken(obj.t)
      if (obj.done) finish()
    } catch {
      // 不完整/非 JSON 帧跳过(下一片段补全)
    }
  }

  const pushText = (text: string) => {
    frameBuf += text
    const parts = frameBuf.split('\n\n')
    frameBuf = parts.pop() ?? ''
    for (const p of parts) handleFrame(p)
  }

  const onChunk = (res: { data: ArrayBuffer }) => {
    gotChunk = true
    const arr = new Uint8Array(res.data)
    for (let k = 0; k < arr.length; k++) pending.push(arr[k])
    const { text, consumed } = decodeUtf8Stream(Uint8Array.from(pending))
    if (consumed > 0) pending = pending.slice(consumed)
    if (text) pushText(text)
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
      if (!finished && !erred) handlers.onError('网络异常，请重试')
    },
    success: (res: { data?: string | ArrayBuffer }) => {
      // 降级:基础库不支持 onChunkReceived 时,整段响应落在 success.data
      if (!gotChunk && res && res.data != null) {
        const data = res.data
        const text = typeof data === 'string' ? data : decodeUtf8(new Uint8Array(data))
        if (text) pushText(text)
      }
    },
    complete: () => {
      if (frameBuf.trim()) handleFrame(frameBuf) // 末帧无 \n\n 兜底
      finish()
    },
  })

  if (typeof task.onChunkReceived === 'function') {
    task.onChunkReceived(onChunk)
  }
  return task
}

export interface AiConversation {
  id: string
  title: string
  updatedAt: string
}

export function listConversations() {
  return request<AiConversation[]>('/ai/conversations', { auth: true })
}

export function getMessages(conversationId: string) {
  return request<AiMessage[]>(`/ai/conversations/${conversationId}/messages`, { auth: true })
}
