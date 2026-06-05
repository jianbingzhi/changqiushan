import { useState, useEffect } from 'react'

/** 倒计时到目标时间戳(ms),返回剩余秒数;targetMs 为空则停。 */
export function useCountdown(targetMs: number | null): number {
  const [remaining, setRemaining] = useState(0)

  useEffect(() => {
    if (!targetMs) {
      setRemaining(0)
      return
    }
    const tick = () => setRemaining(Math.max(0, Math.ceil((targetMs - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetMs])

  return remaining
}
