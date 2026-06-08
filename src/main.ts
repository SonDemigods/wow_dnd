/**
 * @fileoverview 应用入口文件
 * @description 初始化数据库、加载游戏数据、创建Vue应用并挂载到DOM，同时注册开发控制台命令
 * @module main
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { db } from '@/modules/data/core'
import { dataInitializer } from '@/modules/data/service'
import { initConsole } from '@/modules/console'
import './styles/popup.less'

/**
 * 初始化并启动应用
 * 依次执行：打开数据库 -> 初始化数据 -> 创建并挂载Vue应用 -> 注册开发控制台
 */
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
