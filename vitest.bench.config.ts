/**
 * @fileoverview Benchmark 专用 Vitest 配置
 *
 * 与 vitest.config.ts 隔离，仅用于手动运行 benchmarks/ 目录下的性能基准。
 * 不接入 CI（`npm test` 使用 vitest.config.ts，不会触发本配置）。
 *
 * 运行方式：
 *   npx vitest run --config vitest.bench.config.ts
 */
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['benchmarks/**/*.ts'],
    exclude: ['node_modules', 'dist', 'src', 'test'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  }
});
