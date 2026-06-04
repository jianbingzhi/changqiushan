import { View, Text } from '@tarojs/components'
import './CountdownPill.scss'

interface Props {
  seconds: number
  label?: string
}

function fmt(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s < 10 ? '0' : ''}${s}`
}

export function CountdownPill({ seconds, label = '剩余' }: Props) {
  const urgent = seconds <= 30
  return (
    <View className={`countdown-pill ${urgent ? 'countdown-pill--urgent' : ''}`}>
      <Text>{label} {fmt(seconds)}</Text>
    </View>
  )
}
