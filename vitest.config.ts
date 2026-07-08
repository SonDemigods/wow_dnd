/**
 * @fileoverview Vitest 测试框架配置
 * @description 独立于 vite.config.ts 的测试配置，避免构建配置与测试配置相互干扰（CMB-5 修复）。
 *              运行 `npm test` 时 vitest 自动读取本文件。
 */
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import path from 'path';

export default defineConfig({
  plugins: [vue()],
  test: {
    /** jsdom 环境提供 DOM API，便于后续组件测试 */
    environment: 'jsdom',
    /** 启用全局 API（describe/it/expect），减少 import 样板代码 */
    globals: true,
    /**
     * 测试文件匹配规则：
     * - test/ 目录为统一测试入口（推荐）
     * - 兼容 src 下遗留的 .test.ts / .spec.ts
     */
    include: ['test/**/*.test.ts', 'src/**/*.{test,spec}.ts'],
    /** 排除构建产物和 node_modules */
    exclude: ['node_modules', 'dist', '**/*.vue']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
