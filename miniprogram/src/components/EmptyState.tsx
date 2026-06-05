import { View, Text } from '@tarojs/components'
import './EmptyState.scss'

interface Props {
  text: string
  hint?: string
}

export function EmptyState({ text, hint }: Props) {
  return (
    <View className='empty-state'>
      <View className='empty-state__icon'>🌲</View>
      <Text className='empty-state__text'>{text}</Text>
      {hint ? <Text className='empty-state__hint'>{hint}</Text> : null}
    </View>
  )
}
