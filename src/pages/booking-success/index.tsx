import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { NoticeCard } from '@/components/NoticeCard'
import './index.scss'

export default function BookingSuccess() {
  const router = useRouter()
  const id = router.params.id ?? ''

  return (
    <View className='success'>
      <View className='success__icon'>✅</View>
      <Text className='success__title'>预约成功</Text>
      <Text className='success__sub'>入园当天请在闸机出示动态核销码</Text>

      {/* A5 30 秒动态核销码由 c-03(checkin OTP)接入此处 */}
      <View className='success__code-ph'>
        <Text className='success__code-tip'>核销码将在「我的预约」详情中展示</Text>
        {id ? <Text className='success__ref'>预约编号 {id.slice(0, 8).toUpperCase()}</Text> : null}
      </View>

      <NoticeCard text='本园免费预约入园，无需支付任何费用。请按预约时段准时到场，逾期未到将记为爽约。' />

      <Button className='success__btn' onClick={() => Taro.switchTab({ url: '/pages/my-bookings/index' })}>
        查看我的预约
      </Button>
      <Button className='success__btn success__btn--ghost' onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
        返回首页
      </Button>
    </View>
  )
}
