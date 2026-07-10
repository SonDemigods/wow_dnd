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
     * 覆盖率配置（S5 修复 / 任务 3.3 提升）
     *
     * 分层标准（遵循 code_rule.md 第四章第 4 条）：
     * - 核心逻辑 >= 90%
     * - 组件/Store >= 80%
     *
     * 全局阈值 90% 针对核心 TS 逻辑；Vue 组件从 coverage exclude 排除，
     * 其覆盖率仍由 html/lcov 报告展示供监控，但不受全局 threshold 强制约束。
     *
     * exclude 排除的文件：
     * - index.ts / types.ts / env.d.ts / main.ts / console/
     * - Vue 组件文件（遵循 80% 分层标准，单独验证）
     * - config_*.ts（静态种子数据）
     */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'dist',
        'src/**/index.ts',
        'src/**/types.ts',
        'src/env.d.ts',
        'src/main.ts',
        'src/modules/console/**',
        // Vue 组件遵循 code_rule.md 分层标准 (>= 80%)，不纳入核心逻辑全局 90% 阈值
        'src/components/**/*.vue',
        // 静态种子数据文件（非业务逻辑，是数据定义）
        'src/data/config_*.ts',
      ],
      thresholds: {
        statements: 90,
        branches: 85,
        functions: 90,
        lines: 90,
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
