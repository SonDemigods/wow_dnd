/**
 * @fileoverview ItemTemplateCache 物品模板缓存服务单元测试
 *
 * 覆盖：
 * 1. load：首次加载、已加载返回缓存、并发去重、失败后可重试
 * 2. getById：命中、未命中返回 null、未加载时触发 load
 * 3. getAll：已加载返回列表、未加载触发 load、load 失败返回空数组
 * 4. invalidate：清空缓存后下次查询重新加载
 *
 * Mock 策略：
 * - inventoryDbService mock，控制 getAllItemTemplates 返回值
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { itemTemplateCache } from '@/services/ItemTemplateCache';
import type { Item } from '@/modules/inventory/types';

/** mock inventoryDbService，避免触碰真实 IndexedDB（使用 vi.hoisted 避免 hoisting 问题） */
const { getAllItemTemplatesMock } = vi.hoisted(() => ({
  getAllItemTemplatesMock: vi.fn(),
}));
vi.mock('@/modules/inventory/db', () => ({
  inventoryDbService: {
    getAllItemTemplates: getAllItemTemplatesMock,
  },
}));

/** 构造测试物品 */
function makeItem(id: string, name: string = id): Item {
  return {
    id,
    name,
    description: '',
    type: 'consumable',
    rarity: 'common',
    stackable: true,
    maxStack: 99,
  } as Item;
}

describe('ItemTemplateCache 物品模板缓存服务', () => {
  beforeEach(() => {
    getAllItemTemplatesMock.mockReset();
    // 每个用例前重置单例缓存状态
    itemTemplateCache.invalidate();
  });

  // ==================== load ====================

  describe('load：加载与缓存', () => {
    it('首次加载从 DB 读取并返回物品列表', async () => {
      // Arrange
      const items = [makeItem('i1'), makeItem('i2')];
      getAllItemTemplatesMock.mockResolvedValue(items);

      // Act
      const result = await itemTemplateCache.load();

      // Assert
      expect(result).toEqual(items);
      expect(getAllItemTemplatesMock).toHaveBeenCalledTimes(1);
    });

    it('已加载时返回缓存且不重复查询 DB', async () => {
      // Arrange
      getAllItemTemplatesMock.mockResolvedValue([makeItem('i1')]);
      await itemTemplateCache.load();
      getAllItemTemplatesMock.mockClear();

      // Act
      const result = await itemTemplateCache.load();

      // Assert
      expect(result).toHaveLength(1);
      expect(getAllItemTemplatesMock).not.toHaveBeenCalled();
    });

    it('并发调用时复用同一个 loadingPromise（去重）', async () => {
      // Arrange
      getAllItemTemplatesMock.mockResolvedValue([makeItem('i1')]);

      // Act：不 await，同时发起两次
      const p1 = itemTemplateCache.load();
      const p2 = itemTemplateCache.load();
      await Promise.all([p1, p2]);

      // Assert：DB 只查询一次
      expect(getAllItemTemplatesMock).toHaveBeenCalledTimes(1);
    });

    it('加载失败后 loaded 保持 false，下次调用重新加载', async () => {
      // Arrange
      getAllItemTemplatesMock.mockRejectedValueOnce(new Error('DB error'));
      getAllItemTemplatesMock.mockResolvedValueOnce([makeItem('i1')]);

      // Act & Assert：第一次失败
      await expect(itemTemplateCache.load()).rejects.toThrow('DB error');
      // 第二次成功（说明可重试）
      const result = await itemTemplateCache.load();
      expect(result).toHaveLength(1);
      expect(getAllItemTemplatesMock).toHaveBeenCalledTimes(2);
    });
  });

  // ==================== getById ====================

  describe('getById：按 ID 查询', () => {
    it('命中时返回物品模板', async () => {
      // Arrange
      const item = makeItem('potion', '药水');
      getAllItemTemplatesMock.mockResolvedValue([item]);

      // Act
      const result = await itemTemplateCache.getById('potion');

      // Assert
      expect(result).toEqual(item);
    });

    it('未命中时返回 null', async () => {
      // Arrange
      getAllItemTemplatesMock.mockResolvedValue([makeItem('i1')]);

      // Act
      const result = await itemTemplateCache.getById('not-exist');

      // Assert
      expect(result).toBeNull();
    });

    it('未加载时自动触发 load', async () => {
      // Arrange
      getAllItemTemplatesMock.mockResolvedValue([makeItem('i1')]);

      // Act
      await itemTemplateCache.getById('i1');

      // Assert
      expect(getAllItemTemplatesMock).toHaveBeenCalledTimes(1);
    });
  });

  // ==================== getAll ====================

  describe('getAll：获取全量模板', () => {
    it('已加载时返回缓存列表', async () => {
      // Arrange
      const items = [makeItem('i1'), makeItem('i2'), makeItem('i3')];
      getAllItemTemplatesMock.mockResolvedValue(items);
      await itemTemplateCache.load();

      // Act
      const result = await itemTemplateCache.getAll();

      // Assert
      expect(result).toHaveLength(3);
    });

    it('未加载时自动触发 load', async () => {
      // Arrange
      getAllItemTemplatesMock.mockResolvedValue([makeItem('i1')]);

      // Act
      await itemTemplateCache.getAll();

      // Assert
      expect(getAllItemTemplatesMock).toHaveBeenCalledTimes(1);
    });

    it('load 失败时 getAll 抛出错误（load 错误向上传播）', async () => {
      // Arrange
      getAllItemTemplatesMock.mockRejectedValue(new Error('fail'));

      // Act + Assert：getAll 内部 await this.load() 失败时错误向上传播
      await expect(itemTemplateCache.getAll()).rejects.toThrow('fail');
    });
  });

  // ==================== invalidate ====================

  describe('invalidate：缓存失效', () => {
    it('清空缓存后下次查询重新加载', async () => {
      // Arrange
      getAllItemTemplatesMock.mockResolvedValue([makeItem('i1')]);
      await itemTemplateCache.load();
      getAllItemTemplatesMock.mockClear();

      // Act
      itemTemplateCache.invalidate();
      await itemTemplateCache.load();

      // Assert
      expect(getAllItemTemplatesMock).toHaveBeenCalledTimes(1);
    });

    it('invalidate 后 getById 触发重新加载', async () => {
      // Arrange
      getAllItemTemplatesMock.mockResolvedValue([makeItem('i1')]);
      await itemTemplateCache.getById('i1');
      getAllItemTemplatesMock.mockClear();

      // Act
      itemTemplateCache.invalidate();
      await itemTemplateCache.getById('i1');

      // Assert
      expect(getAllItemTemplatesMock).toHaveBeenCalledTimes(1);
    });
  });
});
