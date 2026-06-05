import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { getMyStats, submitAppeal } from '@/api/booking'
import { useAuthStore } from '@/store/authStore'
import { useThemeStore } from '@/store/themeStore'
import { maskIdCard } from '@/utils/format'
import type { VisitorStats } from '@/api/types'
import './index.scss'

export default function Profile() {
  const [stats, setStats] = useState<VisitorStats | null>(null)
  const token = useAuthStore((s) => s.token)
  const boundIdCard = useAuthStore((s) => s.boundIdCard)
  const theme = useThemeStore((s) => s.theme)

  const load = useCallback(async () => {
    if (!useAuthStore.getState().token) return
    const r = await getMyStats()
    if (r.ok) setStats(r.data)
  }, [])

  useDidShow(() => { void load() })

  const onAppeal = () => {
    Taro.showModal({
      title: '黑名单申诉',
      editable: true,
      placeholderText: '请填写申诉理由（至少 10 字）',
      success: async (res) => {
        if (!res.confirm) return
        const r = await submitAppeal((res.content ?? '').trim())
        Taro.showToast({ title: r.ok ? '申诉已提交' : r.message, icon: r.ok ? 'success' : 'none' })
      },
    })
  }

  const stat = (n: number, l: string) => (
    <View className='profile__stat'>
      <Text className='profile__stat-n'>{n}</Text>
      <Text className='profile__stat-l'>{l}</Text>
    </View>
  )

  return (
    <View className='profile'>
      <View className='profile__card'>
        <View className='profile__avatar'>🧑</View>
        <View className='profile__meta'>
          <Text className='profile__name'>{token ? '微信游客' : '未登录'}</Text>
          <Text className='profile__id'>
            {boundIdCard ? `已实名 ${maskIdCard(boundIdCard)}` : '未实名认证（首次预约自动绑定）'}
          </Text>
        </View>
      </View>

      <View className='profile__stats'>
        {stat(stats?.pending ?? 0, '待履约')}
        {stat(stats?.checkedIn ?? 0, '已核销')}
        {stat(stats?.noShow ?? 0, '已爽约')}
        {stat(stats?.total ?? 0, '累计')}
      </View>

      <View className='profile__menu'>
        {!token ? (
          <View className='profile__item' onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}>
            <Text>登录 / 切换账号</Text>
          </View>
        ) : null}
        <View className='profile__item' onClick={onAppeal}>
          <Text>黑名单申诉</Text>
        </View>
        <View className='profile__item' onClick={() => useThemeStore.getState().toggle()}>
          <Text>外观主题</Text>
          <Text className='profile__item-val'>{theme === 'dark' ? '深色' : '浅色'}</Text>
        </View>
      </View>

      <Text className='profile__foot'>长秋山森林公园 · 免费预约入园</Text>
    </View>
  )
}
