import { View, Text } from '@tarojs/components'
import type { VerifyCodeState } from '@/hooks/useVerifyCode'
import './VerifyCodeCard.scss'

interface Props {
  state: VerifyCodeState
}

// 动态核销码卡:大号 OTP + 倒计时 + 离线文本码降级;30s 滚动防截图转发
export function VerifyCodeCard({ state }: Props) {
  const { code, seconds, stale } = state

  if (!code) {
    return (
      <View className='vcode vcode--loading'>
        <Text className='vcode__tip'>核销码加载中…</Text>
      </View>
    )
  }

  return (
    <View className={`vcode ${stale ? 'vcode--stale' : ''}`}>
      <Text className='vcode__label'>入园核销码</Text>
      <Text className='vcode__otp'>{code.otp.replace(/(\d{3})(\d{3})/, '$1 $2')}</Text>

      <View className='vcode__meta'>
        {stale ? (
          <Text className='vcode__stale-tip'>网络异常，当前为最后有效码，请配合人工核销</Text>
        ) : (
          <Text className='vcode__count'>{seconds} 秒后自动刷新</Text>
        )}
      </View>

      <View className='vcode__text'>
        <Text className='vcode__text-label'>离线文本码</Text>
        <Text className='vcode__text-val'>{code.textCode}</Text>
      </View>

      <Text className='vcode__watermark'>长秋山 · 仅限本人入园 · 截图无效</Text>
    </View>
  )
}
