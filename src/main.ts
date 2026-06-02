import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { db } from '@/modules/data/core'
import { dataInitializer } from '@/modules/data/service'
import './styles/popup.less'

async function initApp() {
  try {
    await db.open()
    console.log('Database initialized successfully')

    await dataInitializer.initializeData()
    console.log('Game data initialized')
  } catch (error) {
    console.error('Failed to initialize:', error)
  }

  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.mount('#app')
}

initApp()
