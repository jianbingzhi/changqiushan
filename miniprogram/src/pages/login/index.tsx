import { View, Text, Button } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState } from 'react'
import { wechatLogin } from '@/api/auth'
import './index.scss'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)
    const r = await wechatLogin()
    setLoading(false)
    if (r.ok) {
      const redirect = router.params.redirect
      if (redirect) {
        Taro.redirectTo({ url: decodeURIComponent(redirect) }).catch(() => {
          Taro.switchTab({ url: '/pages/home/index' })
        })
      } else {
        Taro.switchTab({ url: '/pages/home/index' })
      }
    } else {
      Taro.showToast({ title: r.message || '登录失败，请重试', icon: 'none' })
    }
  }

  return (
    <View className='login'>
      <View className='login__logo'>🌲</View>
      <Text className='login__title'>长秋山森林公园</Text>
      <Text className='login__sub'>免费预约入园 · 绿色出行</Text>

      <Button className='login__btn' loading={loading} onClick={handleLogin}>
        微信一键登录
      </Button>

      <Text className='login__tip'>
        登录即同意《用户协议》与《隐私政策》。本园全程免费预约，不收取任何费用。
      </Text>
    </View>
  )
}
