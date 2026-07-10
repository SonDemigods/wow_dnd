/**
 * @fileoverview 商店模块数据层（shop/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveShopConfig / getShopConfig / getAllShopConfigs / deleteShopConfig / clearAllShopConfigs：
 *    配置表 config_shops 的 CRUD
 *  - saveShopItems / getShopItems / getShopItemsStorage / getAllShopItemsStorage / clearAllShopItems：
 *    商品表 runtime_shopItems 的 CRUD + lastRefresh 时间戳语义
 *  - saveSoldItems / getSoldItems / getAllSoldItems / clearAllSoldItems：
 *    回购表 runtime_shopSoldItems 的 CRUD
 *  - saveCurrentShopId / getCurrentShopId：当前商店ID（runtime_gameState 表）读写
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 config_shops / runtime_shopItems / runtime_shopSoldItems / runtime_gameState 四张表
 *  - 不 mock db service，确保 put/get/delete/toArray 真实执行
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { shopDbService } from '@/modules/shop/db';
import { db } from '@/modules/data/core';
import type { ShopConfig, ShopItem, SoldItemEntry } from '@/modules/shop/types';

// ==================== 测试数据构造 helper ====================

function makeShopConfig(o: Partial<ShopConfig> = {}): ShopConfig {
  return {
    id: 'shop-1',
    name: '杂货店',
    type: 'general',
    icon: 'game-icons:shop',
    refreshInterval: 60000,
    ...o,
  };
}

function makeShopItem(itemId: string, price: number, quantity: number): ShopItem {
  return { itemId, price, quantity };
}

function makeSoldItem(itemId: string, price: number, quantity: number): SoldItemEntry {
  return { itemId, price, quantity };
}

// ==================== 测试用例 ====================

describe('ShopDbService - 商店数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    // 清空四张相关表，确保每个用例从空库开始
    await Promise.all([
      db.config_shops.clear(),
      db.runtime_shopItems.clear(),
      db.runtime_shopSoldItems.clear(),
      db.runtime_gameState.clear(),
    ]);
  });

  // -------------------- 配置表 config_shops --------------------

  describe('saveShopConfig / getShopConfig：商店配置读写', () => {
    it('保存配置后可读回完整数据', async () => {
      // Arrange
      const config = makeShopConfig({ id: 'general_goods', name: '通用杂货店' });
      // Act
      await shopDbService.saveShopConfig(config);
      const result = await shopDbService.getShopConfig('general_goods');
      // Assert
      expect(result).not.toBeNull();
      expect(result).toEqual(config);
    });

    it('配置不存在时 getShopConfig 返回 null', async () => {
      // Arrange & Act
      const result = await shopDbService.getShopConfig('non-existent');
      // Assert
      expect(result).toBeNull();
    });

    it('覆盖保存：相同 ID 再次保存，新数据替换旧数据', async () => {
      // Arrange
      await shopDbService.saveShopConfig(makeShopConfig({ id: 'dup', name: '旧' }));
      // Act
      await shopDbService.saveShopConfig(makeShopConfig({ id: 'dup', name: '新' }));
      const result = await shopDbService.getShopConfig('dup');
      // Assert
      expect(result!.name).toBe('新');
    });
  });

  describe('getAllShopConfigs：批量读取', () => {
    it('空表返回空数组', async () => {
      // Arrange & Act
      const result = await shopDbService.getAllShopConfigs();
      // Assert
      expect(result).toEqual([]);
    });

    it('多记录全部返回', async () => {
      // Arrange
      await shopDbService.saveShopConfig(makeShopConfig({ id: 'a', name: 'A' }));
      await shopDbService.saveShopConfig(makeShopConfig({ id: 'b', name: 'B' }));
      await shopDbService.saveShopConfig(makeShopConfig({ id: 'c', name: 'C' }));
      // Act
      const result = await shopDbService.getAllShopConfigs();
      // Assert
      expect(result).toHaveLength(3);
      const ids = result.map(c => c.id).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
    });
  });

  describe('deleteShopConfig / clearAllShopConfigs：删除', () => {
    it('deleteShopConfig 删除指定配置后读回 null', async () => {
      // Arrange
      await shopDbService.saveShopConfig(makeShopConfig({ id: 'del' }));
      expect(await shopDbService.getShopConfig('del')).not.toBeNull();
      // Act
      await shopDbService.deleteShopConfig('del');
      // Assert
      expect(await shopDbService.getShopConfig('del')).toBeNull();
    });

    it('deleteShopConfig 删除不影响其他配置', async () => {
      // Arrange
      await shopDbService.saveShopConfig(makeShopConfig({ id: 'a' }));
      await shopDbService.saveShopConfig(makeShopConfig({ id: 'b' }));
      // Act
      await shopDbService.deleteShopConfig('a');
      // Assert
      expect(await shopDbService.getShopConfig('a')).toBeNull();
      expect(await shopDbService.getShopConfig('b')).not.toBeNull();
      expect(await shopDbService.getAllShopConfigs()).toHaveLength(1);
    });

    it('clearAllShopConfigs 清空后 getAllShopConfigs 返回空数组', async () => {
      // Arrange
      await shopDbService.saveShopConfig(makeShopConfig({ id: 'a' }));
      await shopDbService.saveShopConfig(makeShopConfig({ id: 'b' }));
      // Act
      await shopDbService.clearAllShopConfigs();
      // Assert
      expect(await shopDbService.getAllShopConfigs()).toEqual([]);
    });
  });

  // -------------------- 商品表 runtime_shopItems --------------------

  describe('saveShopItems / getShopItems：商品列表读写', () => {
    it('保存商品列表后可读回', async () => {
      // Arrange
      const items = [
        makeShopItem('potion', 10, 5),
        makeShopItem('sword', 100, 1),
      ];
      // Act
      await shopDbService.saveShopItems('shop-1', items);
      const result = await shopDbService.getShopItems('shop-1');
      // Assert
      expect(result).not.toBeNull();
      expect(result).toEqual(items);
    });

    it('商品不存在时 getShopItems 返回 null', async () => {
      // Arrange & Act
      const result = await shopDbService.getShopItems('non-existent');
      // Assert
      expect(result).toBeNull();
    });

    it('空商品列表也可正常保存', async () => {
      // Arrange
      const items: ShopItem[] = [];
      // Act
      await shopDbService.saveShopItems('shop-1', items);
      const result = await shopDbService.getShopItems('shop-1');
      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('saveShopItems 的 lastRefresh 参数', () => {
    it('传入 lastRefresh 时保存指定时间戳', async () => {
      // Arrange
      const fixedTimestamp = 1700000000000;
      // Act
      await shopDbService.saveShopItems('shop-1', [makeShopItem('a', 1, 1)], fixedTimestamp);
      const storage = await shopDbService.getShopItemsStorage('shop-1');
      // Assert
      expect(storage).not.toBeNull();
      expect(storage!.lastRefresh).toBe(fixedTimestamp);
    });

    it('不传 lastRefresh 时使用 Date.now()', async () => {
      // Arrange
      const before = Date.now();
      // Act
      await shopDbService.saveShopItems('shop-1', [makeShopItem('a', 1, 1)]);
      const after = Date.now();
      const storage = await shopDbService.getShopItemsStorage('shop-1');
      // Assert
      expect(storage).not.toBeNull();
      expect(storage!.lastRefresh).toBeGreaterThanOrEqual(before);
      expect(storage!.lastRefresh).toBeLessThanOrEqual(after);
    });
  });

  describe('getShopItemsStorage：完整存储记录', () => {
    it('返回完整存储记录（含 shopId / items / lastRefresh）', async () => {
      // Arrange
      const items = [makeShopItem('a', 10, 3)];
      await shopDbService.saveShopItems('shop-1', items, 1700000000000);
      // Act
      const result = await shopDbService.getShopItemsStorage('shop-1');
      // Assert
      expect(result).not.toBeNull();
      expect(result!.shopId).toBe('shop-1');
      expect(result!.items).toEqual(items);
      expect(result!.lastRefresh).toBe(1700000000000);
    });

    it('记录不存在时返回 null', async () => {
      // Arrange & Act
      const result = await shopDbService.getShopItemsStorage('non-existent');
      // Assert
      expect(result).toBeNull();
    });
  });

  describe('getAllShopItemsStorage：批量读取', () => {
    it('空表返回空数组', async () => {
      // Arrange & Act
      const result = await shopDbService.getAllShopItemsStorage();
      // Assert
      expect(result).toEqual([]);
    });

    it('多商店商品记录全部返回', async () => {
      // Arrange
      await shopDbService.saveShopItems('shop-a', [makeShopItem('a', 1, 1)], 1000);
      await shopDbService.saveShopItems('shop-b', [makeShopItem('b', 2, 2)], 2000);
      // Act
      const result = await shopDbService.getAllShopItemsStorage();
      // Assert
      expect(result).toHaveLength(2);
      const ids = result.map(s => s.shopId).sort();
      expect(ids).toEqual(['shop-a', 'shop-b']);
    });
  });

  describe('clearAllShopItems：清空商品表', () => {
    it('清空后 getAllShopItemsStorage 返回空数组，getShopItems 返回 null', async () => {
      // Arrange
      await shopDbService.saveShopItems('shop-a', [makeShopItem('a', 1, 1)]);
      await shopDbService.saveShopItems('shop-b', [makeShopItem('b', 2, 2)]);
      // Act
      await shopDbService.clearAllShopItems();
      // Assert
      expect(await shopDbService.getAllShopItemsStorage()).toEqual([]);
      expect(await shopDbService.getShopItems('shop-a')).toBeNull();
    });
  });

  // -------------------- 回购表 runtime_shopSoldItems --------------------

  describe('saveSoldItems / getSoldItems：回购列表读写', () => {
    it('保存回购列表后可读回', async () => {
      // Arrange
      const soldItems = [
        makeSoldItem('sword', 50, 1),
        makeSoldItem('shield', 30, 2),
      ];
      // Act
      await shopDbService.saveSoldItems('shop-1', soldItems);
      const result = await shopDbService.getSoldItems('shop-1');
      // Assert
      expect(result).toEqual(soldItems);
    });

    it('回购列表不存在时 getSoldItems 返回空数组', async () => {
      // Arrange & Act
      const result = await shopDbService.getSoldItems('non-existent');
      // Assert
      expect(result).toEqual([]);
    });

    it('保存空数组可清空该商店回购列表', async () => {
      // Arrange
      await shopDbService.saveSoldItems('shop-1', [makeSoldItem('a', 10, 1)]);
      // Act
      await shopDbService.saveSoldItems('shop-1', []);
      const result = await shopDbService.getSoldItems('shop-1');
      // Assert
      expect(result).toEqual([]);
    });
  });

  describe('getAllSoldItems：批量读取', () => {
    it('空表返回空数组', async () => {
      // Arrange & Act
      const result = await shopDbService.getAllSoldItems();
      // Assert
      expect(result).toEqual([]);
    });

    it('多商店回购列表全部返回', async () => {
      // Arrange
      await shopDbService.saveSoldItems('shop-a', [makeSoldItem('a', 1, 1)]);
      await shopDbService.saveSoldItems('shop-b', [makeSoldItem('b', 2, 2)]);
      // Act
      const result = await shopDbService.getAllSoldItems();
      // Assert
      expect(result).toHaveLength(2);
      const ids = result.map(s => s.shopId).sort();
      expect(ids).toEqual(['shop-a', 'shop-b']);
    });
  });

  describe('clearAllSoldItems：清空回购表', () => {
    it('清空后 getSoldItems 返回空数组', async () => {
      // Arrange
      await shopDbService.saveSoldItems('shop-a', [makeSoldItem('a', 1, 1)]);
      await shopDbService.saveSoldItems('shop-b', [makeSoldItem('b', 2, 2)]);
      // Act
      await shopDbService.clearAllSoldItems();
      // Assert
      expect(await shopDbService.getSoldItems('shop-a')).toEqual([]);
      expect(await shopDbService.getSoldItems('shop-b')).toEqual([]);
      expect(await shopDbService.getAllSoldItems()).toEqual([]);
    });
  });

  // -------------------- 当前商店ID（runtime_gameState 表）--------------------

  describe('saveCurrentShopId / getCurrentShopId：当前商店ID读写', () => {
    it('保存当前商店ID后可读回', async () => {
      // Arrange
      await shopDbService.saveCurrentShopId('shop-1');
      // Act
      const result = await shopDbService.getCurrentShopId();
      // Assert
      expect(result).toBe('shop-1');
    });

    it('未保存过时 getCurrentShopId 返回 null', async () => {
      // Arrange & Act
      const result = await shopDbService.getCurrentShopId();
      // Assert
      expect(result).toBeNull();
    });

    it('传入 null 表示关闭商店，读回 null', async () => {
      // Arrange
      await shopDbService.saveCurrentShopId('shop-1');
      expect(await shopDbService.getCurrentShopId()).toBe('shop-1');
      // Act
      await shopDbService.saveCurrentShopId(null);
      // Assert
      expect(await shopDbService.getCurrentShopId()).toBeNull();
    });

    it('覆盖保存：再次保存新ID替换旧ID', async () => {
      // Arrange
      await shopDbService.saveCurrentShopId('shop-a');
      // Act
      await shopDbService.saveCurrentShopId('shop-b');
      const result = await shopDbService.getCurrentShopId();
      // Assert
      expect(result).toBe('shop-b');
    });
  });
});
