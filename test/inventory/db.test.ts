/**
 * @fileoverview 背包模块数据层（inventory/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveInventory / getInventory / deleteInventory：背包表 char_inventory 的 CRUD
 *  - saveItemTemplate / getItemTemplate / getAllItemTemplates / deleteItemTemplate：
 *    物品模板表 config_items 的 CRUD + mapToItem 字段映射
 *  - toRawData 去响应式包装（避免 DataCloneError）
 *  - 空数据兜底：getInventory 角色不存在时返回 []
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 char_inventory 与 config_items 两张表，避免用例间污染
 *  - 不 mock db service，确保 put/get/delete/toArray 真实执行
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { inventoryDbService } from '@/modules/inventory/db';
import { db } from '@/modules/data/core';
import type { Item, InventoryItem } from '@/modules/inventory/types';

// ==================== 测试数据构造 helper ====================

function makeItem(o: Partial<Item> = {}): Item {
  return {
    id: 'item-1',
    name: '回复药水',
    type: 'potion',
    rarity: 'common',
    icon: 'game-icons:potion',
    description: '恢复 50 点生命',
    value: 10,
    stackable: true,
    ...o,
  } as Item;
}

function makeInventoryItem(itemId: string, count: number): InventoryItem {
  return { itemId, count };
}

// ==================== 测试用例 ====================

describe('InventoryDbService - 背包数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await Promise.all([
      db.char_inventory.clear(),
      db.config_items.clear(),
    ]);
  });

  // -------------------- 背包表 char_inventory --------------------

  describe('saveInventory / getInventory：背包读写', () => {
    it('保存背包后可读回完整物品列表', async () => {
      const items = [
        makeInventoryItem('potion', 5),
        makeInventoryItem('sword', 1),
      ];
      await inventoryDbService.saveInventory('char-1', items);

      const result = await inventoryDbService.getInventory('char-1');
      expect(result).toEqual(items);
    });

    it('覆盖保存：相同 characterId 再次保存，新数据替换旧数据', async () => {
      await inventoryDbService.saveInventory('char-1', [makeInventoryItem('a', 1)]);
      await inventoryDbService.saveInventory('char-1', [makeInventoryItem('b', 2)]);

      const result = await inventoryDbService.getInventory('char-1');
      expect(result).toEqual([makeInventoryItem('b', 2)]);
      expect(result).toHaveLength(1);
    });

    it('多角色并存：不同 characterId 各自独立', async () => {
      await inventoryDbService.saveInventory('char-1', [makeInventoryItem('a', 1)]);
      await inventoryDbService.saveInventory('char-2', [makeInventoryItem('b', 2)]);

      expect(await inventoryDbService.getInventory('char-1')).toEqual([makeInventoryItem('a', 1)]);
      expect(await inventoryDbService.getInventory('char-2')).toEqual([makeInventoryItem('b', 2)]);
    });

    it('角色不存在时 getInventory 返回空数组（不返回 null）', async () => {
      const result = await inventoryDbService.getInventory('non-existent');
      expect(result).toEqual([]);
    });

    it('空 items 数组也可正常保存', async () => {
      await inventoryDbService.saveInventory('char-1', []);
      const result = await inventoryDbService.getInventory('char-1');
      expect(result).toEqual([]);
    });

    it('直接通过 Dexie 验证写入字段含 updatedAt 时间戳', async () => {
      await inventoryDbService.saveInventory('char-1', [makeInventoryItem('a', 1)]);
      const raw = await db.char_inventory.get('char-1');
      expect(raw).toBeDefined();
      expect(raw!.characterId).toBe('char-1');
      expect(raw!.updatedAt).toBeTypeOf('number');
      expect(raw!.items).toEqual([makeInventoryItem('a', 1)]);
    });

    it('data.items 不是数组时返回空数组（类型守卫兜底）', async () => {
      // 直接写入损坏的数据（items 字段为字符串）
      await db.char_inventory.put({
        characterId: 'corrupt-str',
        items: 'not-an-array' as unknown as InventoryItem[],
        updatedAt: Date.now()
      });
      const result = await inventoryDbService.getInventory('corrupt-str');
      expect(result).toEqual([]);
    });

    it('data.items 为 null 时返回空数组', async () => {
      await db.char_inventory.put({
        characterId: 'corrupt-null',
        items: null as unknown as InventoryItem[],
        updatedAt: Date.now()
      });
      const result = await inventoryDbService.getInventory('corrupt-null');
      expect(result).toEqual([]);
    });
  });

  describe('deleteInventory：删除背包', () => {
    it('删除已存在记录后，再读返回空数组', async () => {
      await inventoryDbService.saveInventory('char-1', [makeInventoryItem('a', 1)]);
      expect(await inventoryDbService.getInventory('char-1')).toHaveLength(1);

      await inventoryDbService.deleteInventory('char-1');
      expect(await inventoryDbService.getInventory('char-1')).toEqual([]);
    });

    it('删除不存在的记录不抛错', async () => {
      await expect(inventoryDbService.deleteInventory('non-existent')).resolves.toBeUndefined();
    });

    it('删除某角色背包不影响其他角色', async () => {
      await inventoryDbService.saveInventory('char-1', [makeInventoryItem('a', 1)]);
      await inventoryDbService.saveInventory('char-2', [makeInventoryItem('b', 2)]);

      await inventoryDbService.deleteInventory('char-1');
      expect(await inventoryDbService.getInventory('char-1')).toEqual([]);
      expect(await inventoryDbService.getInventory('char-2')).toEqual([makeInventoryItem('b', 2)]);
    });
  });

  // -------------------- 物品模板表 config_items --------------------

  describe('saveItemTemplate / getItemTemplate：模板读写与字段映射', () => {
    it('保存模板后可读回，字段类型被 mapToItem 正确转换', async () => {
      const item = makeItem({
        id: 'potion-hp',
        name: '治疗药水',
        type: 'potion',
        rarity: 'common',
        bonus: { str: 5 },
        effect: { type: 'health_restore', value: 50 },
        consumable: true,
        levelRequirement: 5,
      });
      await inventoryDbService.saveItemTemplate(item);

      const result = await inventoryDbService.getItemTemplate('potion-hp');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('potion-hp');
      expect(result!.name).toBe('治疗药水');
      expect(result!.type).toBe('potion');
      expect(result!.rarity).toBe('common');
      expect(result!.bonus).toEqual({ str: 5 });
      expect(result!.effect).toEqual({ type: 'health_restore', value: 50 });
      expect(result!.consumable).toBe(true);
      expect(result!.levelRequirement).toBe(5);
    });

    it('物品不存在时 getItemTemplate 返回 null', async () => {
      const result = await inventoryDbService.getItemTemplate('non-existent');
      expect(result).toBeNull();
    });

    it('可选字段缺失时使用默认值（bonus={}、consumable=undefined、levelRequirement=undefined）', async () => {
      const item: Item = {
        id: 'plain',
        name: '普通物品',
        type: 'misc',
        rarity: 'common',
        icon: 'icon',
        description: '',
        value: 0,
        stackable: false,
      };
      await inventoryDbService.saveItemTemplate(item);

      const result = await inventoryDbService.getItemTemplate('plain');
      expect(result).not.toBeNull();
      expect(result!.bonus).toEqual({});
      expect(result!.consumable).toBeUndefined();
      expect(result!.levelRequirement).toBeUndefined();
    });

    it('levelRequirement=0 时保留 0（用 ?? 而非 ||，避免误判为 falsy）', async () => {
      const item = makeItem({ id: 'zero-req', levelRequirement: 0 });
      await inventoryDbService.saveItemTemplate(item);

      const result = await inventoryDbService.getItemTemplate('zero-req');
      expect(result!.levelRequirement).toBe(0);
    });

    it('bonus 为 null 时 mapToItem 返回空对象作为 bonus（|| 兜底）', async () => {
      // 直接写入 bonus 为 null 的损坏数据，验证 mapToItem 的 || {} 兜底
      await db.config_items.put({
        id: 'null-bonus',
        name: '无加成物品',
        type: 'misc',
        rarity: 'common',
        level: 1,
        icon: 'icon',
        description: '',
        bonus: null as unknown as Record<string, number>,
        effect: null,
        value: 0,
        stackable: false,
        consumable: false,
        template: null,
        levelRequirement: null
      });
      const result = await inventoryDbService.getItemTemplate('null-bonus');
      expect(result).not.toBeNull();
      expect(result!.bonus).toEqual({});
    });

    it('覆盖保存：相同 ID 再次保存，新数据替换旧数据', async () => {
      await inventoryDbService.saveItemTemplate(makeItem({ id: 'dup', name: '旧' }));
      await inventoryDbService.saveItemTemplate(makeItem({ id: 'dup', name: '新' }));

      const result = await inventoryDbService.getItemTemplate('dup');
      expect(result!.name).toBe('新');
    });
  });

  describe('getAllItemTemplates：批量读取', () => {
    it('空表返回空数组', async () => {
      const result = await inventoryDbService.getAllItemTemplates();
      expect(result).toEqual([]);
    });

    it('多模板时全部返回，且字段被 mapToItem 转换', async () => {
      await inventoryDbService.saveItemTemplate(makeItem({ id: 'a', name: 'A' }));
      await inventoryDbService.saveItemTemplate(makeItem({ id: 'b', name: 'B' }));
      await inventoryDbService.saveItemTemplate(makeItem({ id: 'c', name: 'C' }));

      const result = await inventoryDbService.getAllItemTemplates();
      expect(result).toHaveLength(3);
      const ids = result.map(i => i.id).sort();
      expect(ids).toEqual(['a', 'b', 'c']);
    });
  });

  describe('deleteItemTemplate：删除模板', () => {
    it('删除已存在模板后，getItemTemplate 返回 null', async () => {
      await inventoryDbService.saveItemTemplate(makeItem({ id: 'del' }));
      expect(await inventoryDbService.getItemTemplate('del')).not.toBeNull();

      await inventoryDbService.deleteItemTemplate('del');
      expect(await inventoryDbService.getItemTemplate('del')).toBeNull();
    });

    it('删除不影响其他模板', async () => {
      await inventoryDbService.saveItemTemplate(makeItem({ id: 'a' }));
      await inventoryDbService.saveItemTemplate(makeItem({ id: 'b' }));

      await inventoryDbService.deleteItemTemplate('a');
      expect(await inventoryDbService.getItemTemplate('a')).toBeNull();
      expect(await inventoryDbService.getItemTemplate('b')).not.toBeNull();
      expect(await inventoryDbService.getAllItemTemplates()).toHaveLength(1);
    });

    it('删除不存在的模板不抛错', async () => {
      await expect(inventoryDbService.deleteItemTemplate('non-existent')).resolves.toBeUndefined();
    });
  });
});
