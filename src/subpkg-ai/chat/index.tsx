import { View, Text, Input, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useRef } from 'react'
import { streamChat, type AiMessage } from '@/api/ai'
import { ensureLoggedIn } from '@/utils/guard'
import './index.scss'

const SUGGESTIONS = ['如何预约入园？', '园区有哪些活动？', '停车方便吗？']

export default function AiChat() {
  const [messages, setMessages] = useState<AiMessage[]>([
    { role: 'assistant', content: '您好，我是长秋山智能助手，可以帮您解答预约、活动、停车等问题。' },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const convId = useRef<string | undefined>(undefined)
  const [scrollTop, setScrollTop] = useState(0)

  const send = (text: string) => {
    const msg = text.trim()
    if (!msg || sending) return
    if (!ensureLoggedIn()) return
    setInput('')
    setSending(true)
    // 追加用户气泡 + 空 AI 气泡(流式累加)
    setMessages((prev) => [...prev, { role: 'user', content: msg }, { role: 'assistant', content: '' }])
    setScrollTop((v) => v + 9999)

    const appendToLast = (t: string) => {
      setMessages((prev) => {
        const next = prev.slice()
        const last = next[next.length - 1]
        if (last && last.role === 'assistant') next[next.length - 1] = { role: 'assistant', content: last.content + t }
        return next
      })
      setScrollTop((v) => v + 9999)
    }

    streamChat(
      { message: msg, conversationId: convId.current },
      {
        onConversation: (id) => { convId.current = id },
        onToken: (t) => appendToLast(t),
        onDone: () => setSending(false),
        onError: (m) => {
          appendToLast(`（${m}）`)
          setSending(false)
        },
      },
    )
  }

  return (
    <View className='chat'>
      <ScrollView scrollY className='chat__list' scrollTop={scrollTop} scrollWithAnimation>
        {messages.map((m, i) => (
          <View key={i} className={`chat__row chat__row--${m.role}`}>
            <View className={`chat__bubble chat__bubble--${m.role}`}>
              <Text>{m.content || '…'}</Text>
            </View>
          </View>
        ))}
        {messages.length <= 1 ? (
          <View className='chat__suggest'>
            {SUGGESTIONS.map((s) => (
              <Text key={s} className='chat__chip' onClick={() => send(s)}>{s}</Text>
            ))}
          </View>
        ) : null}
      </ScrollView>

      <View className='chat__bar'>
        <Input
          className='chat__input'
          placeholder='输入您的问题'
          value={input}
          confirmType='send'
          onInput={(e) => setInput(e.detail.value)}
          onConfirm={() => send(input)}
        />
        <Button className='chat__send' disabled={sending} onClick={() => send(input)}>发送</Button>
      </View>
    </View>
  )
}
