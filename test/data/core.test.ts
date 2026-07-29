/**
 * @fileoverview 数据库核心模块单元测试
 *
 * 覆盖范围：
 * 1. DBService —— 带重试机制的数据库操作封装
 *    - withRetry：成功立即返回、失败重试、达到上限抛错、指数退避
 *    - setOptions：更新配置
 * 2. getTable —— 强类型表引用获取（类型断言收敛）
 *
 * 注意：不实例化 GameDatabase（会触发 IndexedDB 连接），DBService 为纯逻辑类可独立测试。
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { DBService, getTable } from '@/modules/data/core';
import { DB_SERVICE_CONFIG } from '@/config/database';
import type { GameDatabaseSchema } from '@/modules/data/core';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('DBService 带重试机制', () => {
  describe('withRetry 重试逻辑', () => {
    it('首次成功时直接返回结果（不重试）', async () => {
      const service = new DBService();
      const fn = vi.fn().mockResolvedValue('success');
      const result = await service.withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('首次失败第二次成功时返回结果', async () => {
      // 缩短 delay 避免测试等待
      const service = new DBService({ delay: 10, maxRetries: 3, backoff: 'exponential' });
      const fn = vi.fn()
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce('success');
      const result = await service.withRetry(fn);
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('达到最大重试次数后抛出最后一次错误', async () => {
      const service = new DBService({ delay: 10, maxRetries: 3, backoff: 'exponential' });
      const error = new Error('persistent failure');
      const fn = vi.fn().mockRejectedValue(error);
      await expect(service.withRetry(fn)).rejects.toThrow('persistent failure');
      expect(fn).toHaveBeenCalledTimes(3);
    });

    it('maxRetries=1 时不重试，直接抛错', async () => {
      const service = new DBService({ delay: 10, maxRetries: 1, backoff: 'exponential' });
      const fn = vi.fn().mockRejectedValue(new Error('one-shot'));
      await expect(service.withRetry(fn)).rejects.toThrow('one-shot');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('返回 Promise resolve 的值（非字符串）', async () => {
      const service = new DBService();
      const fn = vi.fn().mockResolvedValue({ count: 42, list: [1, 2, 3] });
      const result = await service.withRetry(fn);
      expect(result).toEqual({ count: 42, list: [1, 2, 3] });
    });

    it('返回 Promise resolve 的值（数字）', async () => {
      const service = new DBService();
      const fn = vi.fn().mockResolvedValue(0);
      const result = await service.withRetry(fn);
      expect(result).toBe(0);
    });

    it('返回 Promise resolve 的值（null）', async () => {
      const service = new DBService();
      const fn = vi.fn().mockResolvedValue(null);
      const result = await service.withRetry(fn);
      expect(result).toBeNull();
    });

    it('maxRetries=0 时直接抛出"所有重试均已耗尽"错误（不执行 fn）', async () => {
      const service = new DBService({ delay: 10, maxRetries: 0, backoff: 'exponential' });
      const fn = vi.fn().mockResolvedValue('success');
      await expect(service.withRetry(fn)).rejects.toThrow('所有重试均已耗尽');
      expect(fn).not.toHaveBeenCalled();
    });
  });

  describe('指数退避策略', () => {
    it('backoff=exponential 时每次延迟翻倍', async () => {
      const delaySpy = vi.spyOn(global, 'setTimeout');
      const service = new DBService({ delay: 10, maxRetries: 3, backoff: 'exponential' });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(service.withRetry(fn)).rejects.toThrow('fail');
      // 第一次失败后等待 10ms，第二次失败后等待 20ms
      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(delaySpy.mock.calls[0][1]).toBe(10);
      expect(delaySpy.mock.calls[1][1]).toBe(20);
    });

    it('backoff=constant 时延迟保持不变', async () => {
      const delaySpy = vi.spyOn(global, 'setTimeout');
      const service = new DBService({ delay: 15, maxRetries: 3, backoff: 'constant' });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(service.withRetry(fn)).rejects.toThrow('fail');
      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(delaySpy.mock.calls[0][1]).toBe(15);
      expect(delaySpy.mock.calls[1][1]).toBe(15);
    });
  });

  describe('setOptions 更新配置', () => {
    it('更新 maxRetries', async () => {
      const service = new DBService({ delay: 10, maxRetries: 2, backoff: 'exponential' });
      service.setOptions({ maxRetries: 5 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(service.withRetry(fn)).rejects.toThrow('fail');
      expect(fn).toHaveBeenCalledTimes(5);
    });

    it('更新 delay', async () => {
      const delaySpy = vi.spyOn(global, 'setTimeout');
      const service = new DBService({ delay: 10, maxRetries: 2, backoff: 'exponential' });
      service.setOptions({ delay: 50 });
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(service.withRetry(fn)).rejects.toThrow('fail');
      expect(delaySpy.mock.calls[0][1]).toBe(50);
    });

    it('部分更新不覆盖其他字段', async () => {
      const service = new DBService({ delay: 10, maxRetries: 3, backoff: 'exponential' });
      service.setOptions({ delay: 50 });
      // maxRetries 应保持 3
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(service.withRetry(fn)).rejects.toThrow('fail');
      expect(fn).toHaveBeenCalledTimes(3);
    });
  });

  describe('默认配置', () => {
    it('不传 options 时使用 DB_SERVICE_CONFIG 默认值', async () => {
      const service = new DBService();
      // 验证默认 maxRetries 来自 DB_SERVICE_CONFIG
      const fn = vi.fn().mockRejectedValue(new Error('fail'));
      await expect(service.withRetry(fn)).rejects.toThrow('fail');
      expect(fn).toHaveBeenCalledTimes(DB_SERVICE_CONFIG.maxRetries);
    });
  });
});

describe('getTable 强类型表引用获取', () => {
  it('返回指定名称的表引用', () => {
    // 使用 mock 对象避免实例化真实 GameDatabase
    const mockTable = { put: vi.fn(), get: vi.fn() };
    const mockDb = {
      config_items: mockTable,
    } as unknown as import('@/modules/data/core').GameDatabase;
    const table = getTable(mockDb, 'config_items');
    expect(table).toBe(mockTable);
  });

  it('返回不同表名对应的引用', () => {
    const mockFactions = { put: vi.fn() };
    const mockRaces = { put: vi.fn() };
    const mockDb = {
      config_factions: mockFactions,
      config_races: mockRaces,
    } as unknown as import('@/modules/data/core').GameDatabase;
    expect(getTable(mockDb, 'config_factions')).toBe(mockFactions);
    expect(getTable(mockDb, 'config_races')).toBe(mockRaces);
  });

  it('支持所有 GameDatabaseSchema 的键', () => {
    // 验证所有合法表名都能通过类型检查
    const tableNames: Array<keyof GameDatabaseSchema> = [
      'config_factions', 'config_races', 'config_classes', 'config_items',
      'config_equipmentItems', 'config_mobs', 'config_bosses', 'config_quests',
      'config_skills', 'config_locations', 'config_shops', 'config_class_items',
      'config_class_passives', 'config_class_talents', 'config_item_sets',
      'char_data', 'char_inventory', 'char_equipment', 'char_skills',
      'char_quests', 'char_exploration', 'runtime_gameState', 'runtime_combatLogs',
      'runtime_adventureLogs', 'runtime_mapState', 'runtime_shopItems', 'runtime_shopSoldItems'
    ];
    const mockDb = {} as unknown as import('@/modules/data/core').GameDatabase;
    for (const name of tableNames) {
      // 仅验证调用不抛错，返回值因 mockDb 为空对象可能为 undefined
      expect(() => getTable(mockDb, name)).not.toThrow();
    }
  });
});
