import Taro from '@tarojs/taro'
import { useAuthStore } from '@/store/authStore'

/** 需登录的操作前调用;未登录跳 A1 登录页并返回 false */
export function ensureLoggedIn(): boolean {
  if (useAuthStore.getState().token) return true
  Taro.navigateTo({ url: '/pages/login/index' })
  return false
}
