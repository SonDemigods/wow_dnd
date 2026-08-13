/**
 * @fileoverview 统一物品模板缓存单元测试（P3-106）
 *
 * 覆盖范围：
 * 1. load 成功路径：合并模板并缓存，二次调用命中缓存
 * 2. load 失败路径：loaded 保持 false，下次调用自动重试
 * 3. getAll 降级：load 失败时返回空数组（P3-106 兑现注释承诺）
 * 4. getById 降级：load 失败时返回 null（P3-106）
 * 5. invalidate：清空缓存，下次查询重新加载
 * 6. 并发去重：load 中重复调用复用同一 Promise
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/modules/item-template/db', () => ({
  itemTemplateDbService: {
    getAllItemTemplates: vi.fn(),
    getAllEquipmentTemplates: vi.fn(),
  },
}));

vi.mock('@/modules/item-template/service', () => ({
  mergeItemTemplates: vi.fn((items, equipment) => {
    const map = new Map();
    items.forEach((it: { id: string }) => map.set(it.id, it));
    equipment.forEach((eq: { id: string }) => map.set(eq.id, eq));
    return map;
  }),
}));

import { unifiedItemTemplateCache } from '@/modules/item-template/cache';
import { itemTemplateDbService } from '@/modules/item-template/db';

describe('UnifiedItemTemplateCache - 统一物品模板缓存', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    unifiedItemTemplateCache.invalidate();
  });

  describe('load 成功路径', () => {
    it('首次 load 从 DB 加载并合并模板', async () => {
      vi.mocked(itemTemplateDbService.getAllItemTemplates).mockResolvedValue([
        { id: 'item1', name: '物品1' },
      ] as never);
      vi.mocked(itemTemplateDbService.getAllEquipmentTemplates).mockResolvedValue([
        { id: 'eq1', name: '装备1' },
      ] as never);

      const result = await unifiedItemTemplateCache.load();
      expect(result).toHaveLength(2);
      expect(itemTemplateDbService.getAllItemTemplates).toHaveBeenCalledTimes(1);
      expect(itemTemplateDbService.getAllEquipmentTemplates).toHaveBeenCalledTimes(1);
    });

    it('二次 load 命中缓存，不重复查询 DB', async () => {
      vi.mocked(itemTemplateDbService.getAllItemTemplates).mockResolvedValue([]);
      vi.mocked(itemTemplateDbService.getAllEquipmentTemplates).mockResolvedValue([]);

      await unifiedItemTemplateCache.load();
      await unifiedItemTemplateCache.load();

      expect(itemTemplateDbService.getAllItemTemplates).toHaveBeenCalledTimes(1);
    });
  });

  describe('load 失败路径（P3-106）', () => {
    it('load 失败时 loaded 保持 false，下次调用自动重试', async () => {
      vi.mocked(itemTemplateDbService.getAllItemTemplates).mockRejectedValueOnce(new Error('DB 故障'));
      vi.mocked(itemTemplateDbService.getAllEquipmentTemplates).mockResolvedValue([]);
      vi.mocked(itemTemplateDbService.getAllItemTemplates).mockResolvedValueOnce([
        { id: 'item1', name: '物品1' },
      ] as never);

      // 第一次 load 失败
      await expect(unifiedItemTemplateCache.load()).rejects.toThrow('DB 故障');

      // 第二次 load 应该重试并成功
      const result = await unifiedItemTemplateCache.load();
      expect(result).toHaveLength(1);
      expect(itemTemplateDbService.getAllItemTemplates).toHaveBeenCalledTimes(2);
    });
  });

  describe('getAll 降级（P3-106）', () => {
    it('load 失败时 getAll 降级返回空数组，不抛异常', async () => {
      vi.mocked(itemTemplateDbService.getAllItemTemplates).mockRejectedValue(new Error('DB 故障'));
      vi.mocked(itemTemplateDbService.getAllEquipmentTemplates).mockResolvedValue([]);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await unifiedItemTemplateCache.getAll();
      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('getAll 降级返回空数组'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('load 成功时 getAll 返回合并后的模板列表', async () => {
      vi.mocked(itemTemplateDbService.getAllItemTemplates).mockResolvedValue([
        { id: 'item1', name: '物品1' },
      ] as never);
      vi.mocked(itemTemplateDbService.getAllEquipmentTemplates).mockResolvedValue([
        { id: 'eq1', name: '装备1' },
      ] as never);

      const result = await unifiedItemTemplateCache.getAll();
      expect(result).toHaveLength(2);
    });
  });

  describe('getById 降级（P3-106）', () => {
    it('load 失败时 getById 降级返回 null，不抛异常', async () => {
      vi.mocked(itemTemplateDbService.getAllItemTemplates).mockRejectedValue(new Error('DB 故障'));
      vi.mocked(itemTemplateDbService.getAllEquipmentTemplates).mockResolvedValue([]);

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await unifiedItemTemplateCache.getById('item1');
      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('getById 降级返回 null'),
        expect.any(Error)
      );

      consoleSpy.mockRestore();
    });

    it('load 成功但 ID 不存在时返回 null', async () => {
      vi.mocked(itemTemplateDbService.getAllItemTemplates).mockResolvedValue([
        { id: 'item1', name: '物品1' },
      ] as never);
      vi.mocked(itemTemplateDbService.getAllEquipmentTemplates).mockResolvedValue([]);

      const result = await unifiedItemTemplateCache.getById('not-exist');
      expect(result).toBeNull();
    });

    it('load 成功且 ID 存在时返回对应模板', async () => {
      vi.mocked(itemTemplateDbService.getAllItemTemplates).mockResolvedValue([
        { id: 'item1', name: '物品1' },
      ] as never);
      vi.mocked(itemTemplateDbService.getAllEquipmentTemplates).mockResolvedValue([]);

      const result = await unifiedItemTemplateCache.getById('item1');
      expect(result).toEqual({ id: 'item1', name: '物品1' });
    });
  });

  describe('invalidate', () => {
    it('invalidate 后下次查询重新从 DB 加载', async () => {
      vi.mocked(itemTemplateDbService.getAllItemTemplates).mockResolvedValue([
        { id: 'item1', name: '物品1' },
      ] as never);
      vi.mocked(itemTemplateDbService.getAllEquipmentTemplates).mockResolvedValue([]);

      await unifiedItemTemplateCache.load();
      expect(itemTemplateDbService.getAllItemTemplates).toHaveBeenCalledTimes(1);

      unifiedItemTemplateCache.invalidate();

      await unifiedItemTemplateCache.load();
      expect(itemTemplateDbService.getAllItemTemplates).toHaveBeenCalledTimes(2);
    });
  });

  describe('并发去重', () => {
    it('并发调用 load 时复用同一 Promise，只触发一次 DB 查询', async () => {
      vi.mocked(itemTemplateDbService.getAllItemTemplates).mockResolvedValue([]);
      vi.mocked(itemTemplateDbService.getAllEquipmentTemplates).mockResolvedValue([]);

      const [p1, p2, p3] = [
        unifiedItemTemplateCache.load(),
        unifiedItemTemplateCache.load(),
        unifiedItemTemplateCache.load(),
      ];
      await Promise.all([p1, p2, p3]);

      expect(itemTemplateDbService.getAllItemTemplates).toHaveBeenCalledTimes(1);
    });
  });
});
