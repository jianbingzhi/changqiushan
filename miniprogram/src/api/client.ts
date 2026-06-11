import Taro from '@tarojs/taro'
import { useAuthStore } from '@/store/authStore'

// 联调后端基址(三选一,按环境改):
//   · Vercel 公网(默认,带最新修复,真机/工具都够得到,https 利于真机预览): https://changqiushan.vercel.app/api/c
//   · 本地 docker 经 WireGuard(Windows 工具打 Linux 栈):                  http://10.7.0.1:3000/api/c
//   · Linux 本机(仅 H5 dev server 同机调试时):                            http://localhost:3000/api/c
// 注:非 https / 非备案域名,微信开发者工具须勾「不校验合法域名」。上线改 ICP 备案域名并打开 urlCheck。
export const API_BASE = 'https://changqiushan.vercel.app/api/c'

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string }

interface RequestOptions {
  method?: 'GET' | 'POST'
  data?: Record<string, unknown>
  auth?: boolean
}

interface CResponseBody {
  success?: boolean
  data?: unknown
  code?: string
  message?: string
}

async function rawRequest(path: string, method: 'GET' | 'POST', data: Record<string, unknown> | undefined, token: string | null) {
  const header: Record<string, string> = { 'content-type': 'application/json' }
  if (token) header['Authorization'] = `Bearer ${token}`
  return Taro.request({ url: `${API_BASE}${path}`, method, data, header })
}

// 401 静默重登:重走 wx.login → 换 token
async function silentRelogin(): Promise<string | null> {
  try {
    const { code } = await Taro.login()
    const res = await rawRequest('/auth/wechat-login', 'POST', { code }, null)
    const body = res.data as CResponseBody
    const loginData = body?.data as { token?: string; boundIdCard?: string | null } | undefined
    if (body?.success && loginData?.token) {
      useAuthStore.getState().setToken(loginData.token, loginData.boundIdCard ?? null)
      return loginData.token
    }
  } catch {
    // 重登失败,返回 null,调用方按未登录处理
  }
  return null
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const { method = 'GET', data, auth = false } = options
  let token = useAuthStore.getState().token
  let res = await rawRequest(path, method, data, auth ? token : null)

  if (auth && res.statusCode === 401) {
    token = await silentRelogin()
    if (token) res = await rawRequest(path, method, data, token)
  }

  const body = res.data as CResponseBody
  if (res.statusCode >= 200 && res.statusCode < 300 && body?.success) {
    return { ok: true, data: body.data as T }
  }
  return {
    ok: false,
    code: body?.code ?? 'ERROR',
    message: body?.message ?? '请求失败，请稍后重试',
  }
}
