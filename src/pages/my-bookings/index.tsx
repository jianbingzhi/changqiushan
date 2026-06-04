import { View, Text, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { StatusBadge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { listMyBookings, cancelBooking } from '@/api/booking'
import { BOOKING_STATUS_TEXT, BOOKING_STATUS_TONE } from '@/utils/format'
import { formatCnDate } from '@/utils/date'
import { ensureLoggedIn } from '@/utils/guard'
import type { PublicBooking } from '@/api/types'
import './index.scss'

const TABS = [
  { key: 'ALL', label: '全部' },
  { key: 'CONFIRMED', label: '待履约' },
  { key: 'CHECKED_IN', label: '已核销' },
  { key: 'CANCELLED', label: '已取消' },
  { key: 'NO_SHOW', label: '已爽约' },
]

export default function MyBookings() {
  const [tab, setTab] = useState('ALL')
  const [list, setList] = useState<PublicBooking[]>([])

  const load = useCallback(async () => {
    const r = await listMyBookings()
    if (r.ok) setList(r.data)
  }, [])

  useDidShow(() => {
    if (!ensureLoggedIn()) return
    void load()
  })

  const filtered = tab === 'ALL' ? list : list.filter((b) => b.status === tab)

  const onCancel = (b: PublicBooking) => {
    Taro.showModal({
      title: '取消预约',
      content: '确认取消该预约吗？距开始不足 2 小时将无法取消。',
      success: async (res) => {
        if (!res.confirm) return
        const r = await cancelBooking(b.id)
        if (r.ok) {
          Taro.showToast({ title: '已取消', icon: 'success' })
          void load()
        } else {
          Taro.showToast({ title: r.message, icon: 'none' })
        }
      },
    })
  }

  return (
    <View className='mb'>
      <View className='mb__tabs'>
        {TABS.map((t) => (
          <Text
            key={t.key}
            className={`mb__tab ${tab === t.key ? 'mb__tab--active' : ''}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </Text>
        ))}
      </View>

      {filtered.length > 0 ? (
        filtered.map((b) => (
          <View key={b.id} className='mb__card'>
            <View className='mb__card-head'>
              <Text className='mb__card-date'>{b.slot ? formatCnDate(b.slot.date) : ''}</Text>
              <StatusBadge tone={BOOKING_STATUS_TONE[b.status]} text={BOOKING_STATUS_TEXT[b.status]} />
            </View>
            <Text className='mb__card-time'>
              {b.slot ? `${b.slot.startTime}-${b.slot.endTime}　${b.slot.name}` : ''}
            </Text>
            <Text className='mb__card-info'>{b.visitorName}　{b.idCardMasked}</Text>
            <Text className='mb__card-info'>{b.noVehicleDeclared ? '无车辆入园' : `车牌 ${b.plate ?? '-'}`}</Text>
            {b.status === 'CONFIRMED' ? (
              <Button className='mb__cancel' size='mini' onClick={() => onCancel(b)}>
                取消预约
              </Button>
            ) : null}
          </View>
        ))
      ) : (
        <EmptyState text='暂无预约记录' hint='去首页预约入园吧' />
      )}
    </View>
  )
}
