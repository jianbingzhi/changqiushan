import { View, Text, Image, Input, Button } from '@tarojs/components'
import Taro, { useRouter, useLoad } from '@tarojs/taro'
import { useState } from 'react'
import { getActivity, signupActivity } from '@/api/activity'
import { MpHtml } from '@/components/MpHtml'
import { StatusBadge } from '@/components/StatusBadge'
import { NoticeCard } from '@/components/NoticeCard'
import { formatCnDate } from '@/utils/date'
import { ensureLoggedIn } from '@/utils/guard'
import { useAuthStore } from '@/store/authStore'
import type { PublicActivity } from '@/api/types'
import './index.scss'

export default function ActivityDetail() {
  const router = useRouter()
  const id = router.params.id ?? ''
  const [activity, setActivity] = useState<PublicActivity | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [userName, setUserName] = useState('')
  const [idCard, setIdCard] = useState('')
  const [phone, setPhone] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useLoad(async () => {
    const r = await getActivity(id)
    if (r.ok) {
      setActivity(r.data)
      const bound = useAuthStore.getState().boundIdCard
      if (bound) setIdCard(bound)
    } else {
      Taro.showToast({ title: r.message, icon: 'none' })
    }
  })

  const openForm = () => {
    if (!ensureLoggedIn()) return
    setShowForm(true)
  }

  const submit = async () => {
    if (!userName.trim() || idCard.trim().length !== 18 || !/^1[3-9]\d{9}$/.test(phone.trim())) {
      Taro.showToast({ title: '请填写完整且有效的报名信息', icon: 'none' })
      return
    }
    setSubmitting(true)
    const r = await signupActivity(id, {
      userName: userName.trim(),
      idCard: idCard.trim(),
      phone: phone.trim(),
    })
    setSubmitting(false)
    if (r.ok) {
      Taro.showToast({ title: '报名成功', icon: 'success' })
      setShowForm(false)
    } else {
      Taro.showModal({ title: '报名未成功', content: r.message, showCancel: false })
    }
  }

  if (!activity) {
    return <View className='adetail adetail--loading'><Text>加载中…</Text></View>
  }

  return (
    <View className='adetail'>
      {activity.coverImage ? (
        <Image className='adetail__cover' src={activity.coverImage} mode='aspectFill' />
      ) : (
        <View className='adetail__cover adetail__cover--ph' />
      )}

      <View className='adetail__card'>
        <Text className='adetail__title'>{activity.title}</Text>
        <View className='adetail__row'>
          {activity.isFree ? (
            <StatusBadge tone='success' text='免费活动' />
          ) : (
            <StatusBadge tone='accent' text={`报名费 ¥${activity.registrationFee}`} />
          )}
          {activity.signupCount != null ? (
            <Text className='adetail__count'>已报名 {activity.signupCount}{activity.maxParticipants ? ` / ${activity.maxParticipants}` : ''}</Text>
          ) : null}
        </View>
        <Text className='adetail__date'>
          {formatCnDate(activity.startDate)} 至 {formatCnDate(activity.endDate)}
        </Text>
      </View>

      {activity.description ? (
        <View className='adetail__body'>
          <MpHtml html={activity.description} />
        </View>
      ) : null}

      {showForm ? (
        <View className='adetail__form'>
          <Input className='adetail__input' placeholder='姓名' value={userName} onInput={(e) => setUserName(e.detail.value)} />
          <Input className='adetail__input' placeholder='18 位身份证号' maxlength={18} value={idCard} onInput={(e) => setIdCard(e.detail.value)} />
          <Input className='adetail__input' type='number' placeholder='11 位手机号' maxlength={11} value={phone} onInput={(e) => setPhone(e.detail.value)} />
          <Button className='adetail__submit' loading={submitting} onClick={submit}>确认报名</Button>
        </View>
      ) : null}

      <View className='adetail__bar'>
        {activity.isFree ? (
          <Button className='adetail__cta' onClick={openForm}>立即报名</Button>
        ) : (
          <Button className='adetail__cta adetail__cta--disabled' disabled>
            付费报名 · 敬请期待
          </Button>
        )}
      </View>

      {!activity.isFree ? (
        <NoticeCard text='付费活动报名(微信支付)即将开放;入园预约全程免费,不涉及任何支付。' />
      ) : null}
    </View>
  )
}
