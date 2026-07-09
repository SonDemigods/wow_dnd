/**
 * @fileoverview 日志模块配置常量单元测试
 * @description 验证 @/config/log 的 PAGE_SIZE 为正整数，
 * 确保日志分页渲染参数有效（PERF-3）。
 */
import { describe, it, expect } from 'vitest';
import { PAGE_SIZE } from '@/config/log';

describe('日志配置', () => {
  it('PAGE_SIZE 为正整数', () => {
    expect(Number.isInteger(PAGE_SIZE)).toBe(true);
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });
});
