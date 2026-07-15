/**
 * @fileoverview 应用入口文件
 * @description 初始化数据库、加载游戏数据、创建Vue应用并挂载到DOM，同时注册开发控制台命令
 * @module main
 */

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { MotionPlugin } from '@vueuse/motion'
import VueVirtualScroller from 'vue-virtual-scroller'
import App from './App.vue'
import { db } from '@/modules/data/core'
import { dataInitializer } from '@/modules/data/service'
import { initConsole } from '@/modules/console'
import { audioService } from '@/modules/audio/service'
import { errorReporter } from '@/utils/errorReport'
import './styles/popup.less'
import './styles/animations.less'
import './styles/icon-gradients.less'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

/**
 * 注册全局错误捕获
 *
 * 三层兜底确保未捕获的错误都能被 errorReporter 记录：
 * 1. Vue 组件内错误（app.config.errorHandler）
 * 2. 未处理的 Promise 拒绝（unhandledrejection）
 * 3. 脚本运行时错误（window.onerror）
 */
function setupGlobalErrorHandlers(app: ReturnType<typeof createApp>): void {
  // 1. Vue 组件内错误
  app.config.errorHandler = (err, _instance, info) => {
    errorReporter.report(err, 'vue', { info });
  };

  // 2. 未处理的 Promise 拒绝
  window.addEventListener('unhandledrejection', (event) => {
    errorReporter.report(event.reason, 'unhandledrejection');
  });

  // 3. 脚本运行时错误（忽略资源加载错误，event.error 为 null 时）
  window.addEventListener('error', (event) => {
    if (event.error) {
      errorReporter.report(event.error, 'window.onerror', {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      });
    }
  });
}

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
    errorReporter.report(error, 'manual', { context: '数据库打开失败，应用无法启动' })
    // 数据库是应用核心依赖，打开失败则无法正常运作，阻止后续挂载避免用户进入损坏状态
    throw error
  }

  // 尽早创建并挂载 Vue 应用，UI 先渲染 loading 视图
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(MotionPlugin)
  app.use(VueVirtualScroller)

  // 注册全局错误捕获（mount 前注册，捕获挂载过程中的错误）
  setupGlobalErrorHandlers(app)

  app.mount('#app')

  // UI 已渲染，后台初始化游戏数据（此期间 App.vue 显示 loading）
  try {
    await dataInitializer.initializeData()
  } catch (error) {
    console.error('游戏数据初始化失败，请刷新页面重试:', error)
    errorReporter.report(error, 'manual', { context: '游戏数据初始化失败' })
  }

  // 挂载开发控制台命令到 window.cmd
  initConsole()

  // 初始化音频服务（Tone.js 会在用户首次交互后自动启动 AudioContext）
  audioService.init()
}

initApp()
