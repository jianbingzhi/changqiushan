import { create } from 'zustand'
import Taro from '@tarojs/taro'

const TOKEN_KEY = 'visitor_token'
const ID_CARD_KEY = 'bound_id_card'

interface AuthState {
  token: string | null
  boundIdCard: string | null
  /** 是否已登录(持有游客 JWT) */
  isLoggedIn: () => boolean
  setToken: (token: string, boundIdCard?: string | null) => void
  setBoundIdCard: (idCard: string) => void
  clear: () => void
  hydrate: () => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  boundIdCard: null,
  isLoggedIn: () => !!get().token,
  setToken: (token, boundIdCard = null) => {
    Taro.setStorageSync(TOKEN_KEY, token)
    if (boundIdCard != null) Taro.setStorageSync(ID_CARD_KEY, boundIdCard)
    set({ token, boundIdCard: boundIdCard ?? get().boundIdCard })
  },
  setBoundIdCard: (idCard) => {
    Taro.setStorageSync(ID_CARD_KEY, idCard)
    set({ boundIdCard: idCard })
  },
  clear: () => {
    Taro.removeStorageSync(TOKEN_KEY)
    Taro.removeStorageSync(ID_CARD_KEY)
    set({ token: null, boundIdCard: null })
  },
  hydrate: () => {
    const token = (Taro.getStorageSync(TOKEN_KEY) as string) || null
    const boundIdCard = (Taro.getStorageSync(ID_CARD_KEY) as string) || null
    set({ token, boundIdCard })
  },
}))
