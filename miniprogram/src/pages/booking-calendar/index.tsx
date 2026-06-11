import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect, useCallback } from 'react'
import { CalendarMonth } from '@/components/CalendarMonth'
import { SlotCard } from '@/components/SlotCard'
import { EmptyState } from '@/components/EmptyState'
import { usePolling } from '@/hooks/usePolling'
import { listSlots } from '@/api/booking'
import { toDateParam, formatCnDate } from '@/utils/date'
import { ensureLoggedIn } from '@/utils/guard'
import { useBookingDraftStore } from '@/store/bookingDraftStore'
import type { PublicSlot } from '@/api/types'
import './index.scss'

export default function BookingCalendar() {
  const [selected, setSelected] = useState<Date>(new Date())
  const [slots, setSlots] = useState<PublicSlot[]>([])

  const loadSlots = useCallback(async () => {
    const r = await listSlots(toDateParam(selected))
    if (r.ok) setSlots(r.data)
  }, [selected])

  // 选中日期变化时立即拉取
  useEffect(() => { void loadSlots() }, [loadSlots])
  // 页面可见时每 5s 轮询库存
  usePolling(loadSlots, 5000, true)

  const onSelectSlot = (slot: PublicSlot) => {
    if (!ensureLoggedIn()) return
    useBookingDraftStore
      .getState()
      .selectSlot(slot.id, toDateParam(selected), `${formatCnDate(selected)} ${slot.startTime}-${slot.endTime}`)
    Taro.navigateTo({ url: '/pages/booking-form/index' })
  }

  return (
    <View className='cal'>
      <CalendarMonth selected={selected} onSelect={(d) => setSelected(d)} />
      <View className='cal__slots'>
        <Text className='cal__date'>{formatCnDate(selected)} 可约时段</Text>
        {slots.length > 0
          ? slots.map((s) => <SlotCard key={s.id} slot={s} onSelect={onSelectSlot} />)
          : <EmptyState text='当日暂无可约时段' hint='请选择其他日期' />}
      </View>
    </View>
  )
}
