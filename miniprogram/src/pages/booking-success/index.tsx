import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter, useDidShow, useDidHide } from '@tarojs/taro'
import { useEffect } from 'react'
import { NoticeCard } from '@/components/NoticeCard'
import { VerifyCodeCard } from '@/components/VerifyCodeCard'
import { useVerifyCode } from '@/hooks/useVerifyCode'
import './index.scss'

export default function BookingSuccess() {
  const router = useRouter()
  const id = router.params.id ?? ''
  const verify = useVerifyCode(id)

  // 截图提示:动态码 30s 失效,截图转发无效
  useDidShow(() => {
    Taro.onUserCaptureScreen?.(() => {
      Taro.showToast({ title: '截图无效，请出示实时核销码', icon: 'none' })
    })
  })
  useDidHide(() => {
    Taro.offUserCaptureScreen?.(() => {})
  })

  useEffect(() => {
    Taro.setKeepScreenOn?.({ keepScreenOn: true })
  }, [])

  return (
    <View className='success'>
      <View className='success__icon'>✅</View>
      <Text className='success__title'>预约成功</Text>
      <Text className='success__sub'>入园当天请在闸机出示下方动态核销码</Text>

      {id ? <VerifyCodeCard state={verify} /> : null}

      <NoticeCard text='本园免费预约入园，无需支付任何费用。核销码每 30 秒自动刷新，请按预约时段准时到场。' />

      <Button className='success__btn' onClick={() => Taro.switchTab({ url: '/pages/my-bookings/index' })}>
        查看我的预约
      </Button>
      <Button className='success__btn success__btn--ghost' onClick={() => Taro.switchTab({ url: '/pages/home/index' })}>
        返回首页
      </Button>
    </View>
  )
}
