import { createApp } from 'vue'
import { useDark } from '@vueuse/core'
import client, { connect, global, root, router } from '@koishijs/client'
import App from './layouts/index.vue'
import Home from './layouts/home.vue'

import './index.scss'

const app = createApp(App)

app.use(client)

app.provide('ecTheme', 'dark-blue')

root.page({
  path: '/',
  name: '欢迎',
  icon: 'activity:home',
  order: 1000,
  component: Home,
})

const isDark = useDark()

root.page({
  id: 'dark-mode',
  position: 'bottom',
  order: -100,
  name: () => isDark.value ? '暗黑模式' : '明亮模式',
  icon: () => 'activity:' + (isDark.value ? 'moon' : 'sun'),
  action: () => isDark.value = !isDark.value,
})

app.use(router)

router.afterEach((route) => {
  if (route.meta.activity) {
    document.title = `${route.meta.activity.name} | ${global.title || 'Koishi 控制台'}`
  }
})

app.mount('#app')

if (!global.static) {
  const endpoint = new URL(global.endpoint, location.origin).toString()
  connect(() => new WebSocket(endpoint.replace(/^http/, 'ws')))
}
