import { View, Text } from '@tarojs/components'
import { useState } from 'react'
import { isPastDay, isSameDay } from '@/utils/date'
import './CalendarMonth.scss'

interface Props {
  selected: Date | null
  onSelect: (d: Date) => void
}

const WEEK = ['日', '一', '二', '三', '四', '五', '六']

export function CalendarMonth({ selected, onSelect }: Props) {
  const today = new Date()
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (Date | null)[] = []
  for (let i = 0; i < firstDay; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))

  return (
    <View className='calendar'>
      <View className='calendar__head'>
        <Text className='calendar__nav' onClick={() => setCursor(new Date(year, month - 1, 1))}>‹</Text>
        <Text className='calendar__title'>{year}年{month + 1}月</Text>
        <Text className='calendar__nav' onClick={() => setCursor(new Date(year, month + 1, 1))}>›</Text>
      </View>
      <View className='calendar__week'>
        {WEEK.map((w) => <Text key={w} className='calendar__wcell'>{w}</Text>)}
      </View>
      <View className='calendar__grid'>
        {cells.map((c, i) => {
          if (!c) return <View key={`e${i}`} className='calendar__cell calendar__cell--empty' />
          const past = isPastDay(c, today)
          const active = !!selected && isSameDay(c, selected)
          return (
            <View
              key={c.getTime()}
              className={`calendar__cell ${past ? 'calendar__cell--past' : ''} ${active ? 'calendar__cell--active' : ''}`}
              onClick={() => { if (!past) onSelect(c) }}
            >
              <Text>{c.getDate()}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}
