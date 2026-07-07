/**
 * @fileoverview Vitest 测试框架配置文件
 * @description 配置测试环境、路径别名、覆盖率收集等选项。
 *               复用 Vite 的 Vue 插件和路径别名，确保测试环境与开发环境一致。
 * @module vitest.config
 */
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  /** Vue 3 单文件组件支持 */
  plugins: [vue()],

  /** 模块解析配置：复用 Vite 的 @ 路径别名 */
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },

  /** 测试配置 */
  test: {
    /** 测试环境：jsdom 提供 DOM API，支持 Vue 组件挂载 */
    environment: 'jsdom',

    /** 全局 API：允许直接使用 describe/it/expect 无需导入 */
    globals: true,

    /** 测试 setup 文件：在每个测试文件执行前运行 */
    setupFiles: ['./src/__tests__/setup.ts'],

    /** 覆盖率配置 */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/modules/**/*.ts'],
      exclude: [
        'src/modules/**/types.ts',
        'src/modules/**/index.ts',
        'src/modules/**/db.ts'
      ]
    },

    /** 包含的测试文件路径 */
    include: ['src/**/__tests__/**/*.test.ts']
  }
});
