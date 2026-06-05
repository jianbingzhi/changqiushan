import { View, Text, Input, Button, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useRef } from 'react'
import {
  streamChat,
  listConversations,
  getMessages,
  type AiMessage,
  type AiConversation,
} from '@/api/ai'
import Markdown from '@/components/Markdown'
import { ensureLoggedIn } from '@/utils/guard'
import './index.scss'

const SUGGESTIONS = ['如何预约入园？', '园区有哪些活动？', '停车方便吗？']
const WELCOME: AiMessage = {
  role: 'assistant',
  content: '您好，我是长秋山智能助手，可以帮您解答预约、活动、停车等问题。',
}

export default function AiChat() {
  const [messages, setMessages] = useState<AiMessage[]>([WELCOME])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const convId = useRef<string | undefined>(undefined)
  const [scrollTop, setScrollTop] = useState(0)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [conversations, setConversations] = useState<AiConversation[]>([])

  const openHistory = async () => {
    setDrawerOpen(true)
    if (!ensureLoggedIn()) return
    const res = await listConversations()
    if (res.ok) setConversations(res.data)
  }

  const newChat = () => {
    convId.current = undefined
    setMessages([WELCOME])
    setDrawerOpen(false)
  }

  const loadConversation = async (id: string) => {
    setDrawerOpen(false)
    const res = await getMessages(id)
    if (res.ok) {
      convId.current = id
      setMessages(res.data.length ? res.data : [WELCOME])
      setScrollTop((v) => v + 9999)
    } else {
      Taro.showToast({ title: '会话加载失败', icon: 'none' })
    }
  }

  const send = (text: string) => {
    const msg = text.trim()
    if (!msg || sending) return
    if (!ensureLoggedIn()) return
    setInput('')
    setSending(true)
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
      <View className='chat__topbar'>
        <Text className='chat__title'>智能助手</Text>
        <View className='chat__actions'>
          <Text className='chat__action' onClick={newChat}>新建对话</Text>
          <Text className='chat__action' onClick={openHistory}>历史</Text>
        </View>
      </View>

      <ScrollView scrollY className='chat__list' scrollTop={scrollTop} scrollWithAnimation>
        {messages.map((m, i) => (
          <View key={i} className={`chat__row chat__row--${m.role}`}>
            <View className={`chat__bubble chat__bubble--${m.role}`}>
              {m.role === 'assistant'
                ? (m.content ? <Markdown content={m.content} /> : <Text>…</Text>)
                : <Text>{m.content}</Text>}
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

      {drawerOpen ? (
        <View className='chat__mask' onClick={() => setDrawerOpen(false)}>
          <View className='chat__drawer' onClick={(e) => e.stopPropagation()}>
            <View className='chat__drawer-head'>
              <Text className='chat__drawer-title'>历史对话</Text>
              <Text className='chat__action' onClick={newChat}>＋ 新建</Text>
            </View>
            <ScrollView scrollY className='chat__drawer-list'>
              {conversations.length === 0 ? (
                <View className='chat__drawer-empty'>
                  <Text>暂无历史对话</Text>
                </View>
              ) : (
                conversations.map((c) => (
                  <View
                    key={c.id}
                    className={`chat__conv ${c.id === convId.current ? 'chat__conv--active' : ''}`}
                    onClick={() => loadConversation(c.id)}
                  >
                    <Text className='chat__conv-title'>{c.title || '新对话'}</Text>
                  </View>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      ) : null}
    </View>
  )
}
