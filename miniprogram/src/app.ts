import { PropsWithChildren } from 'react'
import { useLaunch } from '@tarojs/taro'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import { wechatLogin } from './api/auth'
import './app.scss'

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    useThemeStore.getState().init()
    useAuthStore.getState().hydrate()
    // 静默登录:wx.login 无需用户交互;未登录则尝试换发游客 JWT
    if (!useAuthStore.getState().token) {
      void wechatLogin()
    }
  })

  return children
}

export default App
