import { create } from 'zustand'
import Taro from '@tarojs/taro'

type Theme = 'light' | 'dark'
const THEME_KEY = 'theme'

interface ThemeState {
  theme: Theme
  manual: boolean
  init: () => void
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: 'light',
  manual: false,
  init: () => {
    const saved = Taro.getStorageSync(THEME_KEY) as Theme | ''
    if (saved === 'light' || saved === 'dark') {
      set({ theme: saved, manual: true })
      return
    }
    try {
      const sys = Taro.getSystemInfoSync()
      set({ theme: sys.theme === 'dark' ? 'dark' : 'light' })
    } catch {
      // 部分基础库不支持 theme,降级浅色
    }
    if (typeof Taro.onThemeChange === 'function') {
      Taro.onThemeChange(({ theme }) => {
        if (!get().manual) set({ theme: theme === 'dark' ? 'dark' : 'light' })
      })
    }
  },
  toggle: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    Taro.setStorageSync(THEME_KEY, next)
    set({ theme: next, manual: true })
  },
}))
