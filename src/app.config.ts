export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/booking-calendar/index',
    'pages/booking-form/index',
    'pages/booking-success/index',
    'pages/my-bookings/index',
    'pages/profile/index',
    'pages/login/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#2D5A27',
    navigationBarTitleText: '长秋山森林公园',
    navigationBarTextStyle: 'white'
  },
  tabBar: {
    color: '#9CA3AF',
    selectedColor: '#2D5A27',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      { pagePath: 'pages/home/index', text: '首页' },
      { pagePath: 'pages/booking-calendar/index', text: '预约' },
      { pagePath: 'pages/my-bookings/index', text: '我的预约' },
      { pagePath: 'pages/profile/index', text: '我的' }
    ]
  }
})
