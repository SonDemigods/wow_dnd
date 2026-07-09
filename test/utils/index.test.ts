/**
 * @fileoverview utils/index 统一导出入口单元测试
 * @description 验证 @/utils 统一入口正确 re-export 了三个子模块的公共 API：
 * - calculations：属性计算函数（calculateMaxHp / getExpForLevel / calculateAllAttributes）
 * - db-helpers：ID 工具与数据清洗（generateId / toRawData / BaseDbService）
 * - fileDownload：浏览器下载工具（downloadBlob）
 *
 * 入口缺失导出会导致下游 `import { xxx } from '@/utils'` 编译失败。
 */
import { describe, it, expect } from 'vitest';
import * as utils from '@/utils';

describe('utils/index 统一导出入口', () => {
  it('re-export calculations 模块的计算函数', () => {
    expect(typeof utils.calculateMaxHp).toBe('function');
    expect(typeof utils.getExpForLevel).toBe('function');
    expect(typeof utils.calculateAllAttributes).toBe('function');
  });

  it('re-export db-helpers 模块的工具函数', () => {
    expect(typeof utils.generateId).toBe('function');
    expect(typeof utils.toRawData).toBe('function');
    expect(utils.BaseDbService).toBeDefined();
  });

  it('re-export fileDownload 模块的下载函数', () => {
    expect(typeof utils.downloadBlob).toBe('function');
  });

  it('generateId 生成的 ID 以给定前缀开头', () => {
    const id = utils.generateId('test');
    expect(id.startsWith('test_')).toBe(true);
  });
});
