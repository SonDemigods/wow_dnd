import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { dbManager } from './services/database'

async function initApp() {
  try {
    await dbManager.init()
    console.log('Database initialized successfully')
  } catch (error) {
    console.error('Failed to initialize database:', error)
  }

  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.mount('#app')
}

initApp()