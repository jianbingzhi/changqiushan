import Taro from '@tarojs/taro'
import { request } from './client'
import { useAuthStore } from '@/store/authStore'

interface LoginData {
  token: string
  visitorId: string
  boundIdCard: string | null
}

/** A1:wx.login → code → 换游客 JWT 并存储 */
export async function wechatLogin(): Promise<{ ok: boolean; message?: string }> {
  let code: string
  try {
    const r = await Taro.login()
    code = r.code
  } catch {
    return { ok: false, message: '微信登录授权失败' }
  }
  const res = await request<LoginData>('/auth/wechat-login', { method: 'POST', data: { code } })
  if (res.ok) {
    useAuthStore.getState().setToken(res.data.token, res.data.boundIdCard)
    return { ok: true }
  }
  return { ok: false, message: res.message }
}

/** 首次预约/获取手机号时绑定实名(后端绑定后重签 token) */
export async function bindIdentity(idCard: string, phone: string) {
  const res = await request<{ token: string; boundIdCard: string }>('/auth/bind', {
    method: 'POST',
    auth: true,
    data: { idCard, phone },
  })
  if (res.ok) {
    useAuthStore.getState().setToken(res.data.token, res.data.boundIdCard)
  }
  return res
}
