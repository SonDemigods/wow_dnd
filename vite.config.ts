/**
 * @fileoverview Vite构建工具配置文件
 * @description 配置Vue项目的构建选项，包括路径别名、插件配置和CSS预处理器设置
 * @module vite.config
 */

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

/**
 * Vite项目配置
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  /**
   * Vite插件配置
   * @plugin vue - Vue 3单文件组件支持插件
   */
  plugins: [vue()],

  /**
   * 模块解析配置
   */
  resolve: {
    /**
     * 路径别名配置
     * 使用'@'作为src目录的简写，方便导入模块
     */
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },

  /**
   * CSS相关配置
   */
  css: {
    /**
     * CSS预处理器配置
     */
    preprocessorOptions: {
      /**
       * Less预处理器配置
       * 自动导入全局样式变量，使每个组件都可以直接使用
       */
      less: {
        additionalData: `@import "@/styles/variables.less";\n@import "@/styles/mixins.less";`
      }
    }
  },

  /**
   * esbuild 顶层配置
   *
   * 生产构建通过 `pure` 选项标记 `console.log` / `console.debug` / `console.info`
   * 为无副作用调用，esbuild minify 阶段会自动移除这些调用，
   * 减少 88+ 处调试日志在生产环境的输出（见 DBG-1 修复）。
   * 保留 `console.error` / `console.warn` 用于错误上报。
   *
   * 注意：Vite 在生产构建（`vite build`）时启用 minify，开发模式（`vite dev`）不生效，
   * 因此开发环境仍保留所有日志输出。
   */
  esbuild: {
    pure: ['console.log', 'console.debug', 'console.info'],
    drop: ['debugger'],
  },

  /**
   * 构建配置
   */
  build: {
    minify: 'esbuild',
    target: 'es2020',
  },
})
