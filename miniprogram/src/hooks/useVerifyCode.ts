import { useState, useEffect, useRef, useCallback } from 'react'
import { useDidShow, useDidHide } from '@tarojs/taro'
import { getCheckinCode, type CheckinCode } from '@/api/booking'

export interface VerifyCodeState {
  code: CheckinCode | null
  seconds: number
  /** 拉取失败(断网等)→ 展示最后有效码灰化 + 文本码人工核销 */
  stale: boolean
}

/** A5 动态核销码:每秒递减,到 0 拉新 OTP;onHide 暂停、onShow 立即刷新 */
export function useVerifyCode(bookingId: string): VerifyCodeState {
  const [code, setCode] = useState<CheckinCode | null>(null)
  const [seconds, setSeconds] = useState(0)
  const [stale, setStale] = useState(false)
  const visible = useRef(true)

  const refresh = useCallback(async () => {
    if (!bookingId) return
    const r = await getCheckinCode(bookingId)
    if (r.ok) {
      setCode(r.data)
      setSeconds(r.data.secondsRemaining)
      setStale(false)
    } else {
      setStale(true)
    }
  }, [bookingId])

  useDidShow(() => {
    visible.current = true
    void refresh()
  })
  useDidHide(() => {
    visible.current = false
  })

  useEffect(() => { void refresh() }, [refresh])

  useEffect(() => {
    const id = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (visible.current) void refresh()
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [refresh])

  return { code, seconds, stale }
}
