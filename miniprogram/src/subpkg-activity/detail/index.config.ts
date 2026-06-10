export default definePageConfig({
  navigationBarTitleText: '活动详情',
  // mp-html 原生第三方组件(支持 video/可点链接);本体经 config copy 进 dist,不走 Taro 编译
  usingComponents: {
    'mp-html': '../components/mp-html/index'
  }
})
