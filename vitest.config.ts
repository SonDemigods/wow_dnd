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
    exclude: ['node_modules', 'dist', '**/*.vue'],
    /**
     * 覆盖率配置（S5 修复）
     * code_rule.md 规定核心逻辑 ≥ 90%、组件/Store ≥ 80%。
     * 阈值设为 85% 作为缓冲，后续逐步提升至 90%。
     */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        statements: 85,
        branches: 80,
        functions: 85,
        lines: 85,
      },
    }
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  /**
   * CSS 预处理器配置（与 vite.config.ts 保持一致）
   * 自动注入全局 less 变量与 mixin，使组件测试中 <style lang="less"> 可正确编译。
   * 缺失此配置会导致所有含 less 变量的组件渲染失败。
   */
  css: {
    preprocessorOptions: {
      less: {
        additionalData: `@import "@/styles/variables.less";\n@import "@/styles/mixins.less";`
      }
    }
  }
});
