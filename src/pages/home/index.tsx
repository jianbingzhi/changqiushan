import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { listActivities } from '@/api/activity'
import { listIntro } from '@/api/content'
import { ActivityCard } from '@/components/ActivityCard'
import { NoticeCard } from '@/components/NoticeCard'
import type { PublicActivity, PublicIntro } from '@/api/types'
import './index.scss'

const QUICK_ENTRIES = [
  { key: 'booking', icon: '📅', label: '预约入园', tab: '/pages/booking-calendar/index' },
  { key: 'mine', icon: '🎫', label: '我的预约', tab: '/pages/my-bookings/index' },
  { key: 'activity', icon: '🎉', label: '活动报名', soon: true },
  { key: 'ai', icon: '🤖', label: '智能问答', soon: true },
  { key: 'map', icon: '🗺️', label: '导览地图', soon: true },
]

export default function Home() {
  const [activities, setActivities] = useState<PublicActivity[]>([])
  const [intros, setIntros] = useState<PublicIntro[]>([])

  const load = useCallback(async () => {
    const [act, intro] = await Promise.all([listActivities(), listIntro()])
    if (act.ok) setActivities(act.data)
    if (intro.ok) setIntros(intro.data)
  }, [])

  useDidShow(() => { void load() })
  usePullDownRefresh(async () => {
    await load()
    Taro.stopPullDownRefresh()
  })

  const onEntry = (e: typeof QUICK_ENTRIES[number]) => {
    if (e.soon) {
      Taro.showToast({ title: '敬请期待', icon: 'none' })
      return
    }
    if (e.tab) Taro.switchTab({ url: e.tab })
  }

  return (
    <View className='home'>
      <View className='home__banner'>
        <Text className='home__banner-title'>免费预约 · 绿色入园</Text>
        <Text className='home__banner-sub'>全园免费开放，预约即来</Text>
      </View>

      <View className='home__entries'>
        {QUICK_ENTRIES.map((e) => (
          <View key={e.key} className='home__entry' onClick={() => onEntry(e)}>
            <Text className='home__entry-icon'>{e.icon}</Text>
            <Text className='home__entry-label'>{e.label}</Text>
          </View>
        ))}
      </View>

      <NoticeCard
        title='温馨提示'
        text='预约需填写身份证号与车牌号（无车可声明）；在园人数达限时将暂停当日预约。'
      />

      <View className='home__section'>
        <Text className='home__section-title'>近期活动</Text>
        {activities.length > 0 ? (
          <ScrollView scrollX className='home__hscroll'>
            {activities.map((a) => (
              <View key={a.id} className='home__hitem'>
                <ActivityCard activity={a} onTap={() => Taro.showToast({ title: '活动详情敬请期待', icon: 'none' })} />
              </View>
            ))}
          </ScrollView>
        ) : (
          <Text className='home__empty'>暂无活动</Text>
        )}
      </View>

      {intros.length > 0 ? (
        <View className='home__section'>
          <Text className='home__section-title'>景区介绍</Text>
          {intros.slice(0, 3).map((i) => (
            <View key={i.id} className='home__intro'>
              <Text className='home__intro-title'>{i.title}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
