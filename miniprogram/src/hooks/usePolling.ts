import { useEffect, useRef } from 'react'
import { useDidShow, useDidHide } from '@tarojs/taro'

/** 页面可见时按 intervalMs 轮询 fn;onHide 暂停、onShow 立即刷新一次(A3 库存/A10 车位)。 */
export function usePolling(fn: () => void, intervalMs: number, enabled = true): void {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const visible = useRef(true)

  useDidShow(() => {
    visible.current = true
    if (enabled) fnRef.current()
  })
  useDidHide(() => {
    visible.current = false
  })

  useEffect(() => {
    if (!enabled) return
    fnRef.current()
    const id = setInterval(() => {
      if (visible.current) fnRef.current()
    }, intervalMs)
    return () => clearInterval(id)
  }, [enabled, intervalMs])
}
