import { View, Text } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { listActivities } from '@/api/activity'
import { ActivityCard } from '@/components/ActivityCard'
import { EmptyState } from '@/components/EmptyState'
import type { PublicActivity } from '@/api/types'
import './index.scss'

const FILTERS = [
  { key: 'ALL', label: '全部' },
  { key: 'FREE', label: '免费' },
  { key: 'PAID', label: '付费' },
]

export default function ActivityList() {
  const [items, setItems] = useState<PublicActivity[]>([])
  const [filter, setFilter] = useState('ALL')

  const load = useCallback(async () => {
    const r = await listActivities()
    if (r.ok) setItems(r.data)
  }, [])

  useDidShow(() => { void load() })

  const filtered = items.filter(
    (a) => filter === 'ALL' || (filter === 'FREE' ? a.isFree : !a.isFree),
  )

  return (
    <View className='alist'>
      <View className='alist__filters'>
        {FILTERS.map((f) => (
          <Text
            key={f.key}
            className={`alist__filter ${filter === f.key ? 'alist__filter--active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </Text>
        ))}
      </View>

      {filtered.length > 0 ? (
        filtered.map((a) => (
          <View key={a.id} className='alist__item'>
            <ActivityCard
              activity={a}
              onTap={(id) => Taro.navigateTo({ url: `/subpkg-activity/detail/index?id=${id}` })}
            />
          </View>
        ))
      ) : (
        <EmptyState text='暂无活动' hint='敬请关注后续公告' />
      )}
    </View>
  )
}
