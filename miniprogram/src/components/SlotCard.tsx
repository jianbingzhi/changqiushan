import { View, Text } from '@tarojs/components'
import { StatusBadge } from './StatusBadge'
import { SLOT_STATUS_TEXT } from '@/utils/format'
import type { PublicSlot } from '@/api/types'
import './SlotCard.scss'

interface Props {
  slot: PublicSlot
  onSelect?: (slot: PublicSlot) => void
}

export function SlotCard({ slot, onSelect }: Props) {
  const disabled = !slot.bookable
  const handle = () => {
    if (!disabled && onSelect) onSelect(slot)
  }
  return (
    <View className={`slot-card ${disabled ? 'slot-card--disabled' : ''}`} onClick={handle}>
      <View className='slot-card__main'>
        <Text className='slot-card__time'>{slot.startTime} - {slot.endTime}</Text>
        <Text className='slot-card__name'>{slot.name}</Text>
      </View>
      <View className='slot-card__right'>
        {slot.status !== 'ACTIVE' ? (
          <StatusBadge tone='muted' text={SLOT_STATUS_TEXT[slot.status]} />
        ) : slot.full ? (
          <StatusBadge tone='danger' text='已约满' />
        ) : (
          <Text className='slot-card__remaining'>余 {slot.remaining}</Text>
        )}
      </View>
    </View>
  )
}
