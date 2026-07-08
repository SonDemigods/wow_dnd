/**
 * @fileoverview 应用入口文件
 * @description 初始化数据库、加载游戏数据、创建Vue应用并挂载到DOM，同时注册开发控制台命令
 * @module main
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { MotionPlugin } from '@vueuse/motion'
import App from './App.vue'
import { db } from '@/modules/data/core'
import { dataInitializer } from '@/modules/data/service'
import { initConsole } from '@/modules/console'
import { audioService } from '@/modules/audio/service'
import './styles/popup.less'
import './styles/animations.less'
import './styles/icon-gradients.less'

/**
 * 初始化并启动应用
 *
 * 优化启动时序（INIT-1）：先打开数据库并挂载 Vue 应用，让 UI 尽早渲染（显示 loading），
 * 再后台执行游戏数据初始化。避免冷启动期间长时间白屏。
 * 注意：数据初始化完成前，App.vue 通过 loading 状态阻止用户操作。
 */
async function initApp() {
  // 先打开数据库（IndexedDB 打开很快），确保后续初始化与 Store 读取可用
  try {
    await db.open()
  } catch (error) {
    console.error('数据库打开失败，请刷新页面重试:', error)
  }

  // 尽早创建并挂载 Vue 应用，UI 先渲染 loading 视图
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(MotionPlugin)
  app.mount('#app')

  // UI 已渲染，后台初始化游戏数据（此期间 App.vue 显示 loading）
  try {
    await dataInitializer.initializeData()
  } catch (error) {
    console.error('游戏数据初始化失败，请刷新页面重试:', error)
  }

  // 挂载开发控制台命令到 window.cmd
  initConsole()

  // 初始化音频服务（Tone.js 会在用户首次交互后自动启动 AudioContext）
  audioService.init()
}

initApp()
