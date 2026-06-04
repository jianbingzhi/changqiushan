import { View } from '@tarojs/components'
import './StatusBadge.scss'

type Tone = 'brand' | 'success' | 'muted' | 'danger' | 'accent'

interface Props {
  tone?: Tone
  text: string
}

export function StatusBadge({ tone = 'brand', text }: Props) {
  return <View className={`status-badge status-badge--${tone}`}>{text}</View>
}
