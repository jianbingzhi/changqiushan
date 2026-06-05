import { View, Text } from '@tarojs/components'
import { ReactNode } from 'react'
import './NoticeCard.scss'

interface Props {
  title?: string
  children?: ReactNode
  text?: string
}

export function NoticeCard({ title, children, text }: Props) {
  return (
    <View className='notice-card'>
      {title ? <Text className='notice-card__title'>{title}</Text> : null}
      {text ? <Text className='notice-card__text'>{text}</Text> : null}
      {children}
    </View>
  )
}
