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
import { db, dataInitializer } from '@/modules/data'
import { initConsole } from '@/modules/console'
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
 * 启动时序：先打开数据库，完成游戏数据初始化，再挂载 Vue 应用。
 * P3-127 修复：数据初始化移至 mount 之前完成，统一由 main.ts 负责，
 * App.vue 不再重复调用 initializeData，避免并发重复初始化。
 * 注意：数据初始化完成前不挂载应用，App 挂载后可直接初始化各模块 Store。
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

  // P3-127 修复：数据初始化移至 mount 之前完成，统一由 main.ts 负责，
  // App.vue 不再重复调用 initializeData（原 App.vue onMounted 中的调用已移除）。
  // 先完成数据初始化再挂载，确保 App 挂载时 baseStore/characterStore 可读到完整数据。
  try {
    await dataInitializer.initializeData()
  } catch (error) {
    console.error('游戏数据初始化失败，请刷新页面重试:', error)
    errorReporter.report(error, 'manual', { context: '游戏数据初始化失败' })
  }

  // 创建并挂载 Vue 应用（数据已就绪，App 挂载后可直接初始化各模块 Store）
  const app = createApp(App)
  const pinia = createPinia()

  app.use(pinia)
  app.use(MotionPlugin)
  app.use(VueVirtualScroller)

  // 注册全局错误捕获（mount 前注册，捕获挂载过程中的错误）
  setupGlobalErrorHandlers(app)

  app.mount('#app')

  // 挂载开发控制台命令到 window.cmd
  initConsole()

  // P3-141：音频服务延迟到首次用户交互时动态加载
  // Tone.js（gzip 后约 50KB+）非首屏必需，AudioContext 也必须等用户交互才能启动，
  // 改为动态 import 后首屏不再下载/解析 Tone，TTI 显著提升。
  setupLazyAudioInit()
}

/**
 * 延迟初始化音频服务
 *
 * 监听首次 pointerdown / keydown 事件，动态 import 音频模块并调用 init()。
 * 使用一次性监听器（{ once: true }），避免重复加载。失败时静默降级，
 * 不影响游戏核心逻辑（音频非核心路径）。
 */
function setupLazyAudioInit(): void {
  const startAudio = async () => {
    try {
      // P3-141：直接动态 import service.ts，避免通过 @/modules/audio 入口
      // （入口已不再 export audioService，避免静态引用拉入 Tone.js）
      const { audioService } = await import('@/modules/audio/service')
      await audioService.init()
    } catch (error) {
      // 音频失败不阻断游戏，仅记录
      errorReporter.report(error, 'manual', { context: '音频服务延迟初始化失败' })
      // P6-155 修复：初始化失败后重新注册一次性监听，为用户提供一次自动重试机会
      window.addEventListener('pointerdown', startAudio, { once: true })
      window.addEventListener('keydown', startAudio, { once: true })
    }
  }

  // 浏览器 AudioContext 必须由用户手势触发，监听首次交互
  window.addEventListener('pointerdown', startAudio, { once: true })
  window.addEventListener('keydown', startAudio, { once: true })
}

initApp()
