import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { db } from '@/modules/data/core'
import { dataInitializer } from '@/modules/data/service'
import { initConsole } from '@/modules/console'
import './styles/popup.less'

async function initApp() {
  try {
    await db.open()

    await dataInitializer.initializeData()
  } catch (error) {
    console.error('初始化失败，请刷新页面重试:', error)
  }

  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.mount('#app')

  // 挂载开发控制台命令到 window.cmd
  initConsole()
}

initApp()
