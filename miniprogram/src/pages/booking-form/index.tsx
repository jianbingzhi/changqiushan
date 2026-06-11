import { View, Text, Input, Switch, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { CountdownPill } from '@/components/CountdownPill'
import { NoticeCard } from '@/components/NoticeCard'
import { useCountdown } from '@/hooks/useCountdown'
import { useBookingDraftStore } from '@/store/bookingDraftStore'
import { createBooking } from '@/api/booking'
import { createBookingSchema } from '@shared/booking'
import './index.scss'

export default function BookingForm() {
  const draft = useBookingDraftStore()
  const [visitorName, setVisitorName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [phone, setPhone] = useState('')
  const [plate, setPlate] = useState('')
  const [noVehicle, setNoVehicle] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const remaining = useCountdown(draft.holdExpiresAt)

  // 未选时段直接进入 → 回日历;占位倒计时归零 → 提示并返回
  useEffect(() => {
    if (!draft.slotId) {
      Taro.redirectTo({ url: '/pages/booking-calendar/index' }).catch(() => {})
    }
  }, [draft.slotId])

  useEffect(() => {
    if (draft.holdExpiresAt && remaining === 0) {
      Taro.showToast({ title: '占位已超时，请重新选择时段', icon: 'none' })
      setTimeout(() => Taro.navigateBack(), 1200)
    }
  }, [remaining, draft.holdExpiresAt])

  const submit = async () => {
    if (!draft.slotId) return
    const input = {
      slotId: draft.slotId,
      // B26:带上选中日期,派生(未物化)时段下单时后端据此惰性物化;缺则订未物化时段会被判"时段不存在"
      ...(draft.date ? { date: draft.date } : {}),
      visitorName: visitorName.trim(),
      idCard: idCard.trim(),
      phone: phone.trim(),
      plate: noVehicle ? undefined : plate.trim() || undefined,
      noVehicleDeclared: noVehicle,
    }
    // 端内同源校验(与 BFF 同一 schema,红线#2)
    const parsed = createBookingSchema.safeParse(input)
    if (!parsed.success) {
      Taro.showToast({ title: parsed.error.issues[0]?.message ?? '请检查填写内容', icon: 'none' })
      return
    }

    setSubmitting(true)
    const res = await createBooking(parsed.data)
    setSubmitting(false)

    if (res.ok) {
      useBookingDraftStore.getState().clear()
      Taro.redirectTo({ url: `/pages/booking-success/index?id=${res.data.booking.id}` })
    } else {
      Taro.showModal({
        title: '预约未成功',
        content: res.message,
        showCancel: false,
        confirmText: '我知道了',
      })
    }
  }

  return (
    <View className='form'>
      <View className='form__head'>
        <Text className='form__slot'>{draft.slotLabel ?? ''}</Text>
        {draft.holdExpiresAt ? <CountdownPill seconds={remaining} label='占位剩余' /> : null}
      </View>

      <View className='form__card'>
        <View className='form__row'>
          <Text className='form__label'>姓名</Text>
          <Input
            className='form__input'
            placeholder='请输入预约人姓名'
            value={visitorName}
            onInput={(e) => setVisitorName(e.detail.value)}
          />
        </View>
        <View className='form__row'>
          <Text className='form__label'>身份证号</Text>
          <Input
            className='form__input'
            placeholder='18 位身份证号'
            maxlength={18}
            value={idCard}
            onInput={(e) => setIdCard(e.detail.value)}
          />
        </View>
        <View className='form__row'>
          <Text className='form__label'>手机号</Text>
          <Input
            className='form__input'
            type='number'
            placeholder='11 位手机号'
            maxlength={11}
            value={phone}
            onInput={(e) => setPhone(e.detail.value)}
          />
        </View>
        <View className='form__row'>
          <Text className='form__label'>车牌号</Text>
          <Input
            className='form__input'
            placeholder={noVehicle ? '已声明无车辆' : '如川A12345'}
            disabled={noVehicle}
            value={plate}
            onInput={(e) => setPlate(e.detail.value)}
          />
        </View>
        <View className='form__row form__row--switch'>
          <Text className='form__label'>本次入园无车辆</Text>
          <Switch
            checked={noVehicle}
            color='#2D5A27'
            onChange={(e) => {
              setNoVehicle(e.detail.value)
              if (e.detail.value) setPlate('')
            }}
          />
        </View>
      </View>

      <NoticeCard text='身份证号与车牌号为入园双要素，二者缺一不可（确无车辆请打开上方声明）。全程免费，不收取任何费用。' />

      <Button className='form__submit' loading={submitting} onClick={submit}>
        提交预约
      </Button>
    </View>
  )
}
