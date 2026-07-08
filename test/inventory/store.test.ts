/**
 * @fileoverview 背包模块 Pinia Store 单元测试
 *
 * 覆盖 useInventoryStore 的：
 * 1. State 初始值（inventory/itemTemplates/filters/sortBy/sortOrder/searchKeyword/currentCharacterId/isLoading）
 * 2. Getters：filteredInventory（过滤+排序）/ emptySlots / isFull（INVENTORY_SIZE 边界）/ totalValue / itemCountByType / allItemTypes / allRarities
 * 3. Actions：
 *    - addItem（堆叠 / 新增槽位 / 无模板 / 无角色 / 数量<=0）
 *    - removeItem（部分扣减 / 全部移除 / 不足）
 *    - useItem（health_restore / bonus / 非消耗品 / 不在背包 / 无角色）
 *    - searchItems / setFilters / updateSort / setSearchKeyword / resetFilters
 *    - organizeInventory（合并 + 重排 + 排序）
 *    - addItemTemplate / removeItemTemplate / resetInventory / loadInventory
 *
 * Mock 策略（遵循 code_rule 隔离原则）：
 *  - inventoryDbService / equipmentDbService 全量 mock，不触碰真实 IndexedDB。
 *  - useCharacterStore / useLogStore 用 vi.hoisted stub 隔离跨 store 调用。
 *  - generateLogId mock 为固定值。
 *  - service 层纯函数（computeStackResult / findItemIndex / sortAndFilterInventory / computeUseEffect）
 *    与常量（INVENTORY_SIZE / MAX_STACK / RARITY_ORDER）使用真实实现，与样板模式一致。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useInventoryStore } from '@/modules/inventory/store';
import { createTestPinia } from '../utils/setup';
import { INVENTORY_SIZE, MAX_STACK } from '@/modules/inventory/service';
import type { Item, InventoryItem, ItemFilters, SortField, SortOrder } from '@/modules/inventory/types';

/** 跨 store stub + db stub：用 vi.hoisted 保证 mock 工厂可引用 */
const mocks = vi.hoisted(() => ({
  characterStore: {
    receiveHeal: vi.fn().mockResolvedValue(undefined),
    changeMp: vi.fn().mockResolvedValue(undefined),
    applyBonus: vi.fn().mockResolvedValue(undefined),
  },
  logStore: {
    addLogEntry: vi.fn(),
  },
  inventoryDb: {
    getAllItemTemplates: vi.fn().mockResolvedValue([]),
    getInventory: vi.fn().mockResolvedValue([]),
    saveInventory: vi.fn().mockResolvedValue(undefined),
    saveItemTemplate: vi.fn().mockResolvedValue(undefined),
    deleteItemTemplate: vi.fn().mockResolvedValue(undefined),
    deleteInventory: vi.fn().mockResolvedValue(undefined),
    getItemTemplate: vi.fn().mockResolvedValue(null),
  },
  equipmentDb: {
    getAllEquipmentTemplates: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/modules/inventory/db', () => ({ inventoryDbService: mocks.inventoryDb }));
vi.mock('@/modules/equipment/db', () => ({ equipmentDbService: mocks.equipmentDb }));
vi.mock('@/modules/character/store', () => ({ useCharacterStore: () => mocks.characterStore }));
vi.mock('@/modules/log/store', () => ({ useLogStore: () => mocks.logStore }));
vi.mock('@/modules/log/service', () => ({ generateLogId: vi.fn().mockReturnValue('log-id') }));

import { inventoryDbService } from '@/modules/inventory/db';

// ==================== 测试数据 helper ====================

function makeItem(o: Partial<Item> = {}): Item {
  return {
    id: 'p1',
    name: '生命药水',
    type: 'potion',
    rarity: 'common',
    icon: 'game-icons:potion-ball',
    description: '恢复 50 点生命值',
    value: 10,
    stackable: true,
    ...o,
  } as Item;
}

function makeWeaponItem(o: Partial<Item> = {}): Item {
  return makeItem({
    id: 'w1',
    name: '铁剑',
    type: 'weapon',
    rarity: 'rare',
    description: '一把铁剑',
    value: 50,
    stackable: false,
    ...o,
  });
}

function inv(itemId: string, count: number): InventoryItem {
  return { itemId, count };
}

function mapOf(...items: Item[]): Map<string, Item> {
  return new Map(items.map(i => [i.id, i]));
}

describe('useInventoryStore - 背包 Store', () => {
  beforeEach(() => {
    createTestPinia();
    vi.clearAllMocks();
  });

  // -------------------- State 初始值 --------------------
  describe('State 初始值', () => {
    it('inventory 初始为空数组', () => {
      const store = useInventoryStore();
      expect(store.inventory).toEqual([]);
    });

    it('itemTemplates 初始为空 Map', () => {
      const store = useInventoryStore();
      expect(store.itemTemplates.size).toBe(0);
    });

    it('filters 初始为空对象，sortBy=type，sortOrder=asc，searchKeyword=空', () => {
      const store = useInventoryStore();
      expect(store.filters).toEqual({});
      expect(store.sortBy).toBe('type');
      expect(store.sortOrder).toBe('asc');
      expect(store.searchKeyword).toBe('');
    });

    it('currentCharacterId 初始为 null，isLoading 初始为 false', () => {
      const store = useInventoryStore();
      expect(store.currentCharacterId).toBeNull();
      expect(store.isLoading).toBe(false);
    });
  });

  // -------------------- Getters --------------------
  describe('Getters', () => {
    it('emptySlots 初始 = INVENTORY_SIZE，isFull = false', () => {
      const store = useInventoryStore();
      expect(store.emptySlots).toBe(INVENTORY_SIZE);
      expect(store.isFull).toBe(false);
    });

    it('isFull 在 inventory.length 达到 INVENTORY_SIZE 时为 true，emptySlots=0', () => {
      const store = useInventoryStore();
      const full: InventoryItem[] = Array.from({ length: INVENTORY_SIZE }, () => inv('x', 1));
      store.$patch({ inventory: full });
      expect(store.isFull).toBe(true);
      expect(store.emptySlots).toBe(0);
    });

    it('isFull 边界：length = INVENTORY_SIZE-1 时为 false，emptySlots=1', () => {
      const store = useInventoryStore();
      const almost: InventoryItem[] = Array.from({ length: INVENTORY_SIZE - 1 }, () => inv('x', 1));
      store.$patch({ inventory: almost });
      expect(store.isFull).toBe(false);
      expect(store.emptySlots).toBe(1);
    });

    it('totalValue = 物品单价 × 数量 累加', () => {
      const store = useInventoryStore();
      store.$patch({
        inventory: [inv('p1', 2), inv('w1', 1)],
        itemTemplates: mapOf(makeItem({ value: 10 }), makeWeaponItem({ value: 50 })),
      });
      // 10*2 + 50*1 = 70
      expect(store.totalValue).toBe(70);
    });

    it('itemCountByType 按类型统计数量', () => {
      const store = useInventoryStore();
      store.$patch({
        inventory: [inv('p1', 2), inv('w1', 1)],
        itemTemplates: mapOf(makeItem(), makeWeaponItem()),
      });
      const counts = store.itemCountByType;
      expect(counts.potion).toBe(2);
      expect(counts.weapon).toBe(1);
      expect(counts.gold).toBe(0);
    });

    it('filteredInventory 按搜索关键词过滤', () => {
      const store = useInventoryStore();
      store.$patch({
        inventory: [inv('p1', 1), inv('w1', 1)],
        itemTemplates: mapOf(makeItem({ name: '生命药水' }), makeWeaponItem({ name: '铁剑' })),
      });
      store.setSearchKeyword('药');
      const result = store.filteredInventory;
      expect(result).toHaveLength(1);
      expect(result[0].itemId).toBe('p1');
    });

    it('filteredInventory 按类型筛选 + 稀有度降序排序', () => {
      const store = useInventoryStore();
      store.$patch({
        inventory: [inv('p1', 1), inv('w1', 1)],
        itemTemplates: mapOf(makeItem({ name: '生命药水' }), makeWeaponItem({ name: '铁剑' })),
      });
      store.setFilters({ types: ['weapon'] });
      expect(store.filteredInventory).toHaveLength(1);
      expect(store.filteredInventory[0].itemId).toBe('w1');

      // 清除筛选，按稀有度降序：w1(rare) 在 p1(common) 前
      store.setFilters({});
      store.updateSort('rarity', 'desc');
      const ordered = store.filteredInventory.map(i => i.itemId);
      expect(ordered).toEqual(['w1', 'p1']);
    });

    it('allItemTypes 返回 9 种类型', () => {
      const store = useInventoryStore();
      expect(store.allItemTypes).toHaveLength(9);
      expect(store.allItemTypes[0]).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
    });

    it('allRarities 返回全部 5 种稀有度', () => {
      const store = useInventoryStore();
      const ids = store.allRarities.map(r => r.id).sort();
      expect(ids).toEqual(['common', 'epic', 'legendary', 'rare', 'uncommon']);
      store.allRarities.forEach(r => {
        expect(r).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String), color: expect.any(String) }));
      });
    });
  });

  // -------------------- Actions: addItem --------------------
  describe('Actions: addItem', () => {
    it('无角色 ID 时返回 0', () => {
      const store = useInventoryStore();
      store.$patch({ itemTemplates: mapOf(makeItem()) });
      expect(store.addItem('p1', 1)).toBe(0);
    });

    it('数量 <= 0 时返回 0', () => {
      const store = useInventoryStore();
      store.$patch({ currentCharacterId: 'char-1', itemTemplates: mapOf(makeItem()) });
      expect(store.addItem('p1', 0)).toBe(0);
      expect(store.addItem('p1', -3)).toBe(0);
    });

    it('物品模板不存在时返回 0', () => {
      const store = useInventoryStore();
      store.$patch({ currentCharacterId: 'char-1', itemTemplates: mapOf() });
      expect(store.addItem('nope', 1)).toBe(0);
    });

    it('可堆叠物品：先填满已有槽位，溢出部分新建槽位', () => {
      const store = useInventoryStore();
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: [inv('p1', 8)],
        itemTemplates: mapOf(makeItem()),
      });
      // 已有 8，加 5：填满到 10（+2），剩余 3 新建槽位
      const added = store.addItem('p1', 5);
      expect(added).toBe(5);
      expect(store.inventory).toEqual([inv('p1', 10), inv('p1', 3)]);
    });

    it('不可堆叠物品：每件占用独立槽位', () => {
      const store = useInventoryStore();
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: [],
        itemTemplates: mapOf(makeWeaponItem()),
      });
      const added = store.addItem('w1', 2);
      expect(added).toBe(2);
      expect(store.inventory).toEqual([inv('w1', 1), inv('w1', 1)]);
    });

    it('背包满时不可堆叠新物品返回 0，可堆叠物品仍可填入已有槽位', () => {
      const store = useInventoryStore();
      const full = Array.from({ length: INVENTORY_SIZE }, () => inv('w1', 1));
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: full,
        itemTemplates: mapOf(makeWeaponItem(), makeItem({ id: 'p2', stackable: true })),
      });
      // 不可堆叠：无空槽，添加失败
      expect(store.addItem('w1', 1)).toBe(0);
      // 可堆叠：已有 p2 槽位（这里没有 p2，所以也无法新增槽位）
      expect(store.addItem('p2', 1)).toBe(0);
    });

    it('成功添加后触发持久化与日志', async () => {
      const store = useInventoryStore();
      store.$patch({ currentCharacterId: 'char-1', itemTemplates: mapOf(makeItem()) });
      store.addItem('p1', 1);
      await Promise.resolve();
      expect(inventoryDbService.saveInventory).toHaveBeenCalledWith('char-1', expect.any(Array));
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'item',
        message: expect.stringContaining('生命药水'),
      }));
    });
  });

  // -------------------- Actions: removeItem --------------------
  describe('Actions: removeItem', () => {
    it('部分扣减：保留剩余数量', () => {
      const store = useInventoryStore();
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: [inv('p1', 10), inv('p1', 3)],
        itemTemplates: mapOf(makeItem()),
      });
      const removed = store.removeItem('p1', 5);
      expect(removed).toBe(5);
      expect(store.inventory).toEqual([inv('p1', 5), inv('p1', 3)]);
    });

    it('全部移除：数量不足时返回实际移除数', () => {
      const store = useInventoryStore();
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: [inv('p1', 10), inv('p1', 3)],
        itemTemplates: mapOf(makeItem()),
      });
      const removed = store.removeItem('p1', 100);
      expect(removed).toBe(13);
      expect(store.inventory).toEqual([]);
    });

    it('无角色 ID 时返回 0', () => {
      const store = useInventoryStore();
      store.$patch({ inventory: [inv('p1', 5)] });
      expect(store.removeItem('p1', 1)).toBe(0);
    });
  });

  // -------------------- Actions: useItem --------------------
  describe('Actions: useItem', () => {
    it('无角色 ID 时返回 false', async () => {
      const store = useInventoryStore();
      store.$patch({
        inventory: [inv('p1', 1)],
        itemTemplates: mapOf(makeItem({ consumable: true, effect: { type: 'health_restore', value: 50 } })),
      });
      expect(await store.useItem('p1')).toBe(false);
    });

    it('物品不在背包时返回 false', async () => {
      const store = useInventoryStore();
      store.$patch({ currentCharacterId: 'char-1', itemTemplates: mapOf(makeItem({ consumable: true })) });
      expect(await store.useItem('p1')).toBe(false);
    });

    it('非消耗品返回 false', async () => {
      const store = useInventoryStore();
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: [inv('w1', 1)],
        itemTemplates: mapOf(makeWeaponItem()),
      });
      expect(await store.useItem('w1')).toBe(false);
    });

    it('health_restore 效果：调用 receiveHeal，堆叠物品 count-1', async () => {
      const store = useInventoryStore();
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: [inv('p1', 2)],
        itemTemplates: mapOf(makeItem({ consumable: true, effect: { type: 'health_restore', value: 50 } })),
      });
      const result = await store.useItem('p1');
      expect(result).toBe(true);
      expect(mocks.characterStore.receiveHeal).toHaveBeenCalledWith(50);
      expect(store.inventory).toEqual([inv('p1', 1)]);
    });

    it('单件消耗品使用后槽位移除', async () => {
      const store = useInventoryStore();
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: [inv('p1', 1)],
        itemTemplates: mapOf(makeItem({ consumable: true, effect: { type: 'mana_restore', value: 20 } })),
      });
      const result = await store.useItem('p1');
      expect(result).toBe(true);
      expect(mocks.characterStore.changeMp).toHaveBeenCalledWith(20);
      expect(store.inventory).toEqual([]);
    });

    it('bonus 字段：调用 applyBonus 应用属性加成', async () => {
      const store = useInventoryStore();
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: [inv('p2', 1)],
        itemTemplates: mapOf(makeItem({ id: 'p2', name: '力量药水', consumable: true, bonus: { str: 2 } })),
      });
      const result = await store.useItem('p2');
      expect(result).toBe(true);
      expect(mocks.characterStore.applyBonus).toHaveBeenCalledWith({ str: 2 });
    });

    it('成功使用后记录日志', async () => {
      const store = useInventoryStore();
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: [inv('p1', 1)],
        itemTemplates: mapOf(makeItem({ consumable: true, effect: { type: 'health_restore', value: 50 } })),
      });
      await store.useItem('p1');
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'item',
        message: expect.stringContaining('生命药水'),
      }));
    });
  });

  // -------------------- Actions: 查询 --------------------
  describe('Actions: 查询', () => {
    it('getItemInfo 命中返回模板，未命中返回 null', () => {
      const store = useInventoryStore();
      const item = makeItem();
      store.$patch({ itemTemplates: mapOf(item) });
      expect(store.getItemInfo('p1')).toEqual(item);
      expect(store.getItemInfo('nope')).toBeNull();
    });

    it('getAllItems 返回全部模板数组', () => {
      const store = useInventoryStore();
      store.$patch({ itemTemplates: mapOf(makeItem(), makeWeaponItem()) });
      expect(store.getAllItems()).toHaveLength(2);
    });

    it('searchItems 按关键词过滤', () => {
      const store = useInventoryStore();
      store.$patch({
        inventory: [inv('p1', 1), inv('w1', 1)],
        itemTemplates: mapOf(makeItem({ name: '生命药水' }), makeWeaponItem({ name: '铁剑' })),
      });
      const result = store.searchItems('剑');
      expect(result).toHaveLength(1);
      expect(result[0].itemId).toBe('w1');
    });

    it('filterInventory 按筛选条件过滤', () => {
      const store = useInventoryStore();
      store.$patch({
        inventory: [inv('p1', 1), inv('w1', 1)],
        itemTemplates: mapOf(makeItem({ rarity: 'common' }), makeWeaponItem({ rarity: 'rare' })),
      });
      const result = store.filterInventory({ rarities: ['rare'] });
      expect(result).toHaveLength(1);
      expect(result[0].itemId).toBe('w1');
    });
  });

  // -------------------- Actions: 筛选与排序设置 --------------------
  describe('Actions: 筛选与排序设置', () => {
    it('updateSort 同时设置字段和顺序', () => {
      const store = useInventoryStore();
      store.updateSort('rarity', 'desc');
      expect(store.sortBy).toBe('rarity');
      expect(store.sortOrder).toBe('desc');
    });

    it('setFilters 替换筛选条件', () => {
      const store = useInventoryStore();
      const filters: ItemFilters = { types: ['weapon'], rarities: ['rare'] };
      store.setFilters(filters);
      expect(store.filters).toEqual(filters);
    });

    it('setSearchKeyword 设置关键词', () => {
      const store = useInventoryStore();
      store.setSearchKeyword('药');
      expect(store.searchKeyword).toBe('药');
    });

    it('resetFilters 清空筛选与关键词', () => {
      const store = useInventoryStore();
      store.$patch({ filters: { types: ['weapon'] }, searchKeyword: 'abc' });
      store.resetFilters();
      expect(store.filters).toEqual({});
      expect(store.searchKeyword).toBe('');
    });
  });

  // -------------------- Actions: organizeInventory --------------------
  describe('Actions: organizeInventory', () => {
    it('合并同类物品、重新堆叠并按稀有度降序+类型升序排序', () => {
      const store = useInventoryStore();
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: [inv('a', 3), inv('b', 1), inv('a', 2)],
        itemTemplates: mapOf(
          makeItem({ id: 'a', name: '药水', type: 'potion', rarity: 'common', stackable: true, value: 5 }),
          makeWeaponItem({ id: 'b', name: '铁剑', type: 'weapon', rarity: 'rare', stackable: false, value: 50 }),
        ),
      });

      store.organizeInventory();

      // a 合并为 5（单槽，5 < MAX_STACK），b 单件；rare(b) 降序在 common(a) 前
      expect(store.inventory).toEqual([inv('b', 1), inv('a', 5)]);
    });

    it('可堆叠物品超过 MAX_STACK 时分拆到多个槽位', () => {
      const store = useInventoryStore();
      store.$patch({
        currentCharacterId: 'char-1',
        inventory: [inv('a', MAX_STACK), inv('a', MAX_STACK), inv('a', 3)],
        itemTemplates: mapOf(makeItem({ id: 'a', stackable: true })),
      });

      store.organizeInventory();

      // 合并 23，分拆为 10 + 10 + 3
      expect(store.inventory).toEqual([inv('a', MAX_STACK), inv('a', MAX_STACK), inv('a', 3)]);
    });
  });

  // -------------------- Actions: 模板管理 / 重置 --------------------
  describe('Actions: 模板管理 / 重置', () => {
    it('addItemTemplate 写入缓存并持久化', async () => {
      const store = useInventoryStore();
      const item = makeItem({ id: 'new' });
      store.addItemTemplate(item);
      expect(store.getItemInfo('new')).toEqual(item);
      await Promise.resolve();
      expect(inventoryDbService.saveItemTemplate).toHaveBeenCalledWith(item);
    });

    it('removeItemTemplate 从缓存删除并持久化', async () => {
      const store = useInventoryStore();
      const item = makeItem({ id: 'rm' });
      store.$patch({ itemTemplates: mapOf(item) });
      store.removeItemTemplate('rm');
      expect(store.getItemInfo('rm')).toBeNull();
      await Promise.resolve();
      expect(inventoryDbService.deleteItemTemplate).toHaveBeenCalledWith('rm');
    });

    it('resetInventory 清空背包并持久化', async () => {
      const store = useInventoryStore();
      store.$patch({ currentCharacterId: 'char-1', inventory: [inv('p1', 1)] });
      store.resetInventory();
      expect(store.inventory).toEqual([]);
      await Promise.resolve();
      expect(inventoryDbService.saveInventory).toHaveBeenCalledWith('char-1', []);
    });
  });

  // -------------------- Actions: initialize / loadInventory --------------------
  describe('Actions: initialize / loadInventory', () => {
    it('initialize 加载角色背包与物品模板，isLoading 最终为 false', async () => {
      const items = [inv('p1', 2)];
      const templates = [makeItem()];
      vi.mocked(inventoryDbService.getInventory).mockResolvedValueOnce(items);
      vi.mocked(inventoryDbService.getAllItemTemplates).mockResolvedValueOnce(templates);

      const store = useInventoryStore();
      await store.initialize('char-1');

      expect(store.currentCharacterId).toBe('char-1');
      expect(store.isLoading).toBe(false);
      expect(store.inventory).toEqual(items);
      expect(store.getItemInfo('p1')).toEqual(templates[0]);
    });

    it('initialize 空 characterId 时背包为空', async () => {
      vi.mocked(inventoryDbService.getAllItemTemplates).mockResolvedValueOnce([]);
      const store = useInventoryStore();
      await store.initialize('');
      expect(store.inventory).toEqual([]);
    });

    it('loadInventory 复用当前角色 ID 重新初始化', async () => {
      vi.mocked(inventoryDbService.getInventory).mockResolvedValueOnce([inv('p1', 5)]);
      vi.mocked(inventoryDbService.getAllItemTemplates).mockResolvedValueOnce([makeItem()]);
      const store = useInventoryStore();
      store.$patch({ currentCharacterId: 'char-1' });
      await store.loadInventory();
      expect(store.inventory).toEqual([inv('p1', 5)]);
    });
  });
});
