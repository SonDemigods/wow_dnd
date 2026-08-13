/**
 * @fileoverview 日志模块配置常量单元测试
 * @description 验证 @/config/log 的 PAGE_SIZE 为正整数，
 * 确保日志分页渲染参数有效（PERF-3）；
 * 验证 MAX_LOG_ENTRIES 为正整数且大于 PAGE_SIZE（BIZ-12）。
 */
import { describe, it, expect } from 'vitest';
import { PAGE_SIZE, MAX_LOG_ENTRIES } from '@/config/log';

describe('日志配置', () => {
  it('PAGE_SIZE 为正整数', () => {
    expect(Number.isInteger(PAGE_SIZE)).toBe(true);
    expect(PAGE_SIZE).toBeGreaterThan(0);
  });

  it('BIZ-12：MAX_LOG_ENTRIES 为正整数且不小于 PAGE_SIZE', () => {
    expect(Number.isInteger(MAX_LOG_ENTRIES)).toBe(true);
    expect(MAX_LOG_ENTRIES).toBeGreaterThanOrEqual(PAGE_SIZE);
  });
});
