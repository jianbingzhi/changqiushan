import { View, Text, Image } from '@tarojs/components'
import { StatusBadge } from './StatusBadge'
import { formatCnDate } from '@/utils/date'
import type { PublicActivity } from '@/api/types'
import './ActivityCard.scss'

interface Props {
  activity: PublicActivity
  onTap?: (id: string) => void
}

export function ActivityCard({ activity, onTap }: Props) {
  return (
    <View className='activity-card' onClick={() => onTap?.(activity.id)}>
      {activity.coverImage ? (
        <Image className='activity-card__cover' src={activity.coverImage} mode='aspectFill' />
      ) : (
        <View className='activity-card__cover activity-card__cover--ph' />
      )}
      <View className='activity-card__body'>
        <Text className='activity-card__title'>{activity.title}</Text>
        <Text className='activity-card__date'>{formatCnDate(activity.startDate)} 起</Text>
        <View className='activity-card__foot'>
          {activity.isFree ? (
            <StatusBadge tone='success' text='免费' />
          ) : (
            <StatusBadge tone='accent' text={`报名费 ¥${activity.registrationFee}`} />
          )}
          {activity.signupCount != null ? (
            <Text className='activity-card__count'>已报名 {activity.signupCount}</Text>
          ) : null}
        </View>
      </View>
    </View>
  )
}
