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
 *  - inventoryDbService + unifiedItemTemplateCache 全量 mock，不触碰真实 IndexedDB。
 *    A1/G1 修复后，inventory 不再依赖 equipment DbService，物品模板通过 item-template 聚合层获取。
 *  - useCharacterStore / useLogStore 用 vi.hoisted stub 隔离跨 store 调用。
 *  - generateLogId mock 为固定值。
 *  - service 层纯函数（computeStackResult / findItemIndex / sortAndFilterInventory / computeUseEffect）
 *    与常量（INVENTORY_SIZE / MAX_STACK / RARITY_ORDER）使用真实实现，与样板模式一致。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useInventoryStore } from '@/modules/inventory/store';
import { createTestPinia } from '../utils/setup';
import { INVENTORY_SIZE, MAX_STACK } from '@/modules/inventory/service';
import type { Item, InventoryItem, ItemFilters } from '@/modules/inventory/types';

/** 跨 store stub + db stub：用 vi.hoisted 保证 mock 工厂可引用 */
const mocks = vi.hoisted(() => ({
  characterStore: {
    receiveHeal: vi.fn().mockResolvedValue(undefined),
    changeMp: vi.fn().mockResolvedValue(undefined),
    applyBonus: vi.fn().mockResolvedValue(undefined),
    // 四层属性：属性药剂永久叠加到药剂层（plan.md §3.5）
    applyPotionBonus: vi.fn().mockResolvedValue(undefined),
  },
  logStore: {
    addLogEntry: vi.fn(),
  },
  inventoryDb: {
    getInventory: vi.fn().mockResolvedValue([]),
    saveInventory: vi.fn().mockResolvedValue(undefined),
    saveItemTemplate: vi.fn().mockResolvedValue(undefined),
    deleteItemTemplate: vi.fn().mockResolvedValue(undefined),
    deleteInventory: vi.fn().mockResolvedValue(undefined),
    getItemTemplate: vi.fn().mockResolvedValue(null),
  },
  /** unifiedItemTemplateCache stub：A1/G1 修复后 inventory 通过聚合层获取合并模板 */
  unifiedCache: {
    getAll: vi.fn().mockResolvedValue([]),
  },
  // P3-153 扩展：currentCharacterId 收敛到 GameStore 只读 computed 代理
  gameStore: {
    currentCharacterId: null as string | null,
  },
}));

vi.mock('@/modules/inventory/db', () => ({ inventoryDbService: mocks.inventoryDb }));
vi.mock('@/modules/item-template/cache', () => ({ unifiedItemTemplateCache: mocks.unifiedCache }));
vi.mock('@/modules/character/store', () => ({ useCharacterStore: () => mocks.characterStore }));
vi.mock('@/modules/log/store', () => ({ useLogStore: () => mocks.logStore }));
vi.mock('@/modules/log/service', () => ({ generateLogId: vi.fn().mockReturnValue('log-id') }));
vi.mock('@/modules/game', () => ({ useGameStore: () => mocks.gameStore }));

import { inventoryDbService } from '@/modules/inventory/db';
import { unifiedItemTemplateCache } from '@/modules/item-template/cache';

// ==================== 测试数据 helper ====================

/**
 * 构造测试用消耗品 Item（P3.3：默认为药水，使用判别联合格式）
 *
 * 新模型以 `kind` 为判别字段，消耗品需提供 subtype/effects/useMode 等字面量字段。
 * 通过 Partial<Item> 覆盖可改写 effects（如 health_restore/stat 效果）。
 */
function makeItem(o: Partial<Item> = {}): Item {
  return {
    id: 'p1',
    name: '生命药水',
    kind: 'consumable',
    subtype: 'potion',
    rarity: 'common',
    icon: 'game-icons:potion-ball',
    description: '恢复 50 点生命值',
    value: 10,
    stackable: true,
    consumable: true,
    effects: [],
    useMode: 'instant',
    capabilities: ['describable', 'usable', 'stackable', 'sellable'],
    ...o,
  } as Item;
}

/**
 * 构造测试用装备 Item（P3.3：默认为铁剑，使用判别联合格式）
 *
 * EquipmentItem 必须提供 subtype/bonus/slots/occupies 等专有字段。
 */
function makeWeaponItem(o: Partial<Item> = {}): Item {
  return makeItem({
    id: 'w1',
    name: '铁剑',
    kind: 'equipment',
    subtype: 'sword',
    rarity: 'rare',
    description: '一把铁剑',
    value: 50,
    stackable: false,
    consumable: false,
    bonus: {},
    slots: ['weapon1'],
    occupies: ['weapon1'],
    effects: [],
    capabilities: ['describable', 'equippable', 'sellable', 'enchantable'],
    ...o,
  } as Partial<Item>);
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
    // P3-153 扩展：重置 gameStore.currentCharacterId
    mocks.gameStore.currentCharacterId = null;
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

    it('filters 初始为空对象，sortBy=kind，sortOrder=asc，searchKeyword=空', () => {
      // P3.3：sortBy 默认值从 'type' 改为 'kind'（判别字段）
      const store = useInventoryStore();
      expect(store.filters).toEqual({});
      expect(store.sortBy).toBe('kind');
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

    it('itemCountByKind 按大类统计数量', () => {
      // P3.3：itemCountByType 改为 itemCountByKind，按判别字段 ItemKind 统计
      const store = useInventoryStore();
      store.$patch({
        inventory: [inv('p1', 2), inv('w1', 1)],
        itemTemplates: mapOf(makeItem(), makeWeaponItem()),
      });
      const counts = store.itemCountByKind;
      expect(counts.consumable).toBe(2); // p1 为消耗品
      expect(counts.equipment).toBe(1); // w1 为装备
      expect(counts.currency).toBe(0); // 无货币
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
      // P3.3：filters.types 改为 filters.kinds（按判别字段 ItemKind 筛选）
      store.setFilters({ kinds: ['equipment'] });
      expect(store.filteredInventory).toHaveLength(1);
      expect(store.filteredInventory[0].itemId).toBe('w1');

      // 清除筛选，按稀有度降序：w1(rare) 在 p1(common) 前
      store.setFilters({});
      store.updateSort('rarity', 'desc');
      const ordered = store.filteredInventory.map(i => i.itemId);
      expect(ordered).toEqual(['w1', 'p1']);
    });

    it('allItemKinds 返回 6 种大类', () => {
      // P3.3：allItemTypes（基于旧 ItemType 9 种）改为 allItemKinds（基于 ItemKind 6 种）
      // 6 种大类：consumable/material/equipment/quest/currency/misc
      const store = useInventoryStore();
      expect(store.allItemKinds).toHaveLength(6);
      expect(store.allItemKinds[0]).toEqual(expect.objectContaining({ id: expect.any(String), name: expect.any(String) }));
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
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ itemTemplates: mapOf(makeItem()) });
      expect(store.addItem('p1', 0)).toBe(0);
      expect(store.addItem('p1', -3)).toBe(0);
    });

    it('物品模板不存在时返回 0', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ itemTemplates: mapOf() });
      expect(store.addItem('nope', 1)).toBe(0);
    });

    it('可堆叠物品：先填满已有槽位，溢出部分新建槽位', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 8)],
        itemTemplates: mapOf(makeItem()),
      });
      // 已有 8，加 5：填满到 10（+2），剩余 3 新建槽位
      const added = store.addItem('p1', 5);
      expect(added).toBe(5);
      expect(store.inventory).toEqual([inv('p1', 10), inv('p1', 3)]);
    });

    // P9-013 修复：addItem 使用 itemTemplate.maxStack 替代硬编码 MAX_STACK
    it('可堆叠物品 maxStack=99 时按 99 堆叠而非默认 10', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [],
        itemTemplates: mapOf(makeItem({ id: 'mat1', maxStack: 99 })),
      });
      // 99 个材料应全部放入一个槽位（而非旧 MAX_STACK=10 的 10 个槽位）
      const added = store.addItem('mat1', 99);
      expect(added).toBe(99);
      expect(store.inventory).toEqual([inv('mat1', 99)]);
    });

    it('不可堆叠物品：每件占用独立槽位', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
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
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
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
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ itemTemplates: mapOf(makeItem()) });
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
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 10), inv('p1', 3)],
        itemTemplates: mapOf(makeItem()),
      });
      const removed = store.removeItem('p1', 5);
      expect(removed).toBe(5);
      expect(store.inventory).toEqual([inv('p1', 5), inv('p1', 3)]);
    });

    it('全部移除：数量不足时返回实际移除数', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
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
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ itemTemplates: mapOf(makeItem({ consumable: true })) });
      expect(await store.useItem('p1')).toBe(false);
    });

    it('非消耗品返回 false', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('w1', 1)],
        itemTemplates: mapOf(makeWeaponItem()),
      });
      expect(await store.useItem('w1')).toBe(false);
    });

    it('health_restore 效果：调用 receiveHeal，堆叠物品 count-1', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 2)],
        // P3.3：旧 effect 字段改为 effects[] 数组
        itemTemplates: mapOf(makeItem({ effects: [{ type: 'health_restore', value: 50 }] } as Partial<Item>)),
      });
      const result = await store.useItem('p1');
      expect(result).toBe(true);
      expect(mocks.characterStore.receiveHeal).toHaveBeenCalledWith(50);
      expect(store.inventory).toEqual([inv('p1', 1)]);
    });

    it('单件消耗品使用后槽位移除', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 1)],
        // P3.3：旧 effect 字段改为 effects[] 数组
        itemTemplates: mapOf(makeItem({ effects: [{ type: 'mana_restore', value: 20 }] } as Partial<Item>)),
      });
      const result = await store.useItem('p1');
      expect(result).toBe(true);
      expect(mocks.characterStore.changeMp).toHaveBeenCalledWith(20);
      expect(store.inventory).toEqual([]);
    });

    it('bonus 字段：调用 applyBonus 应用属性加成', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p2', 1)],
        // P3.3：旧 bonus 字段改为 effects[] 中的 stat 类型效果
        // p2 不在 ATTRIBUTE_POTION_IDS 白名单中，走 applyBonus 路径
        itemTemplates: mapOf(makeItem({ id: 'p2', name: '力量药水', effects: [{ type: 'stat', value: { str: 2 } }] } as Partial<Item>)),
      });
      const result = await store.useItem('p2');
      expect(result).toBe(true);
      expect(mocks.characterStore.applyBonus).toHaveBeenCalledWith({ str: 2 });
    });

    it('属性药剂(strength_potion)：调用 applyPotionBonus 而非 applyBonus，堆叠数 -1', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('strength_potion', 2)],
        // P3.3：旧 bonus 字段改为 effects[] 中的 stat 类型效果
        // strength_potion 在 ATTRIBUTE_POTION_IDS 白名单中，走 applyPotionBonus 路径
        itemTemplates: mapOf(makeItem({
          id: 'strength_potion',
          name: '巨人之力药剂',
          capabilities: ['describable', 'usable', 'stackable', 'sellable', 'attribute_potion'],
          effects: [{ type: 'stat', value: { str: 1 } }],
        } as Partial<Item>)),
      });
      const result = await store.useItem('strength_potion');
      expect(result).toBe(true);
      // 属性药剂走四层属性模型的药剂层（永久叠加，不可重置）
      expect(mocks.characterStore.applyPotionBonus).toHaveBeenCalledWith({ str: 1 });
      expect(mocks.characterStore.applyBonus).not.toHaveBeenCalled();
      expect(store.inventory).toEqual([inv('strength_potion', 1)]);
    });

    it('属性药剂(constitution_potion)：调用 applyPotionBonus（con 影响 maxHp 由 store 重算）', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('constitution_potion', 1)],
        // P3.3：旧 bonus 字段改为 effects[] 中的 stat 类型效果
        itemTemplates: mapOf(makeItem({
          id: 'constitution_potion',
          name: '坚韧药剂',
          capabilities: ['describable', 'usable', 'stackable', 'sellable', 'attribute_potion'],
          effects: [{ type: 'stat', value: { con: 1 } }],
        } as Partial<Item>)),
      });
      const result = await store.useItem('constitution_potion');
      expect(result).toBe(true);
      expect(mocks.characterStore.applyPotionBonus).toHaveBeenCalledWith({ con: 1 });
      expect(mocks.characterStore.applyBonus).not.toHaveBeenCalled();
      // 单件消耗品使用后槽位移除
      expect(store.inventory).toEqual([]);
    });

    it('属性药剂与 HP 恢复药剂互不干扰：strength_potion 不触发 receiveHeal', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('strength_potion', 1)],
        itemTemplates: mapOf(makeItem({
          id: 'strength_potion',
          name: '巨人之力药剂',
          consumable: true,
          bonus: { str: 1 },
          // 故意不配置 effect，验证属性药剂分支不依赖 effect
        })),
      });
      await store.useItem('strength_potion');
      // 属性药剂无 HP 恢复效果
      expect(mocks.characterStore.receiveHeal).not.toHaveBeenCalled();
      expect(mocks.characterStore.changeMp).not.toHaveBeenCalled();
    });

    it('成功使用后记录日志', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
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
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
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
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
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
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ inventory: [inv('p1', 1)] });
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
      vi.mocked(unifiedItemTemplateCache.getAll).mockResolvedValueOnce(templates);

      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      await store.initialize('char-1');

      expect(store.currentCharacterId).toBe('char-1');
      expect(store.isLoading).toBe(false);
      expect(store.inventory).toEqual(items);
      expect(store.getItemInfo('p1')).toEqual(templates[0]);
    });

    it('initialize 空 characterId 时背包为空', async () => {
      vi.mocked(unifiedItemTemplateCache.getAll).mockResolvedValueOnce([]);
      const store = useInventoryStore();
      await store.initialize('');
      expect(store.inventory).toEqual([]);
    });

    it('loadInventory 复用当前角色 ID 重新初始化', async () => {
      vi.mocked(inventoryDbService.getInventory).mockResolvedValueOnce([inv('p1', 5)]);
      vi.mocked(unifiedItemTemplateCache.getAll).mockResolvedValueOnce([makeItem()]);
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      await store.loadInventory();
      expect(store.inventory).toEqual([inv('p1', 5)]);
    });
  });

  // -------------------- Actions: useItemByIndex --------------------
  describe('Actions: useItemByIndex', () => {
    it('索引为负数时返回 false', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ inventory: [inv('p1', 1)] });
      expect(await store.useItemByIndex(-1)).toBe(false);
    });

    it('索引越界（>= length）时返回 false', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ inventory: [inv('p1', 1)] });
      expect(await store.useItemByIndex(1)).toBe(false);
    });

    it('正常索引时委托 useItem 执行', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 2)],
        // P3.3：旧 effect 字段改为 effects[] 数组
        itemTemplates: mapOf(makeItem({ effects: [{ type: 'health_restore', value: 30 }] } as Partial<Item>)),
      });
      const result = await store.useItemByIndex(0);
      expect(result).toBe(true);
      expect(mocks.characterStore.receiveHeal).toHaveBeenCalledWith(30);
      expect(store.inventory).toEqual([inv('p1', 1)]);
    });
  });

  // -------------------- Actions: dropItemByIndex --------------------
  describe('Actions: dropItemByIndex', () => {
    it('索引为负数时返回 false', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ inventory: [inv('p1', 1)] });
      expect(store.dropItemByIndex(-1)).toBe(false);
    });

    it('索引越界（>= length）时返回 false', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ inventory: [inv('p1', 1)] });
      expect(store.dropItemByIndex(1)).toBe(false);
    });

    it('未提供 count 时丢弃整个槽位', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 3), inv('w1', 1)],
        itemTemplates: mapOf(makeItem()),
      });
      expect(store.dropItemByIndex(0)).toBe(true);
      expect(store.inventory).toEqual([inv('w1', 1)]);
    });

    it('count >= 槽位数量时丢弃整个槽位', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 3)],
        itemTemplates: mapOf(makeItem()),
      });
      expect(store.dropItemByIndex(0, 5)).toBe(true);
      expect(store.inventory).toEqual([]);
    });

    it('count < 槽位数量时部分丢弃', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 5)],
        itemTemplates: mapOf(makeItem()),
      });
      expect(store.dropItemByIndex(0, 2)).toBe(true);
      expect(store.inventory).toEqual([inv('p1', 3)]);
    });

    it('count=0 时槽位保留原数量（使用 ?? 而非 ||）', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 5)],
        itemTemplates: mapOf(makeItem()),
      });
      // count=0 是合法输入，dropCount = 0 ?? 5 = 0，走部分丢弃分支：5 - 0 = 5
      expect(store.dropItemByIndex(0, 0)).toBe(true);
      expect(store.inventory).toEqual([inv('p1', 5)]);
    });

    it('丢弃单个物品（dropCount=1）时日志不含 xN', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 3)],
        itemTemplates: mapOf(makeItem({ name: '生命药水' })),
      });
      store.dropItemByIndex(0, 1);
      await Promise.resolve();
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        type: 'item',
        message: '丢弃了：生命药水',
      }));
    });

    it('丢弃多个物品（dropCount>1）时日志包含 xN', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 5)],
        itemTemplates: mapOf(makeItem({ name: '生命药水' })),
      });
      store.dropItemByIndex(0, 3);
      await Promise.resolve();
      expect(mocks.logStore.addLogEntry).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('x3'),
      }));
    });

    it('丢弃的物品模板不存在时不记录日志但返回 true', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('unknown', 1)],
        itemTemplates: mapOf(),
      });
      expect(store.dropItemByIndex(0)).toBe(true);
      await Promise.resolve();
      expect(mocks.logStore.addLogEntry).not.toHaveBeenCalled();
    });

    it('成功丢弃后触发持久化', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 2)],
        itemTemplates: mapOf(makeItem()),
      });
      store.dropItemByIndex(0, 1);
      await Promise.resolve();
      expect(inventoryDbService.saveInventory).toHaveBeenCalledWith('char-1', expect.any(Array));
    });
  });

  // -------------------- Actions: dropItemsByIndices --------------------
  describe('Actions: dropItemsByIndices', () => {
    it('空索引数组返回 false', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ inventory: [inv('p1', 1)] });
      expect(await store.dropItemsByIndices([])).toBe(false);
    });

    it('批量删除多个索引（从大到小 splice 避免索引偏移）', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('a', 1), inv('b', 1), inv('c', 1), inv('d', 1)],
      });
      // 删除索引 0 和 2（a 和 c），保留 b 和 d
      expect(await store.dropItemsByIndices([0, 2])).toBe(true);
      expect(store.inventory).toEqual([inv('b', 1), inv('d', 1)]);
      await Promise.resolve();
      expect(inventoryDbService.saveInventory).toHaveBeenCalled();
    });

    it('包含越界索引（>= length）时仅删除有效索引', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('a', 1), inv('b', 1)],
      });
      expect(await store.dropItemsByIndices([1, 99])).toBe(true);
      expect(store.inventory).toEqual([inv('a', 1)]);
    });

    it('包含负数索引时仅删除有效索引', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('a', 1), inv('b', 1), inv('c', 1)],
      });
      expect(await store.dropItemsByIndices([-1, 1])).toBe(true);
      expect(store.inventory).toEqual([inv('a', 1), inv('c', 1)]);
    });
  });

  // -------------------- Actions: 模板管理 - 持久化失败 --------------------
  describe('Actions: 模板管理 - 持久化失败', () => {
    it('addItemTemplate 持久化失败时输出错误日志但不抛出异常', async () => {
      const err = new Error('DB write failed');
      vi.mocked(inventoryDbService.saveItemTemplate).mockRejectedValueOnce(err);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* 吞掉错误输出 */ });

      const store = useInventoryStore();
      const item = makeItem({ id: 'fail-add' });
      // 不应抛出异常
      expect(() => store.addItemTemplate(item)).not.toThrow();
      // 内存缓存仍更新
      expect(store.getItemInfo('fail-add')).toEqual(item);

      // 等待 Promise.catch 执行
      await Promise.resolve();
      await Promise.resolve();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('保存物品模板失败'),
        'fail-add',
        err
      );
      spy.mockRestore();
    });

    it('removeItemTemplate 持久化失败时输出错误日志但不抛出异常', async () => {
      const err = new Error('DB delete failed');
      vi.mocked(inventoryDbService.deleteItemTemplate).mockRejectedValueOnce(err);
      const spy = vi.spyOn(console, 'error').mockImplementation(() => { /* 吞掉错误输出 */ });

      const store = useInventoryStore();
      const item = makeItem({ id: 'fail-rm' });
      store.$patch({ itemTemplates: mapOf(item) });
      expect(() => store.removeItemTemplate('fail-rm')).not.toThrow();
      // 内存缓存仍更新
      expect(store.getItemInfo('fail-rm')).toBeNull();

      await Promise.resolve();
      await Promise.resolve();
      expect(spy).toHaveBeenCalledWith(
        expect.stringContaining('删除物品模板失败'),
        'fail-rm',
        err
      );
      spy.mockRestore();
    });
  });

  // -------------------- Actions: removeItemByIndex --------------------
  describe('Actions: removeItemByIndex', () => {
    it('索引为负数时返回 0', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ inventory: [inv('p1', 1)] });
      expect(store.removeItemByIndex(-1)).toBe(0);
    });

    it('索引越界（>= length）时返回 0', () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({ inventory: [inv('p1', 1)] });
      expect(store.removeItemByIndex(1)).toBe(0);
    });

    it('正常移除时返回槽位数量并删除槽位', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 3), inv('w1', 1)],
      });
      expect(store.removeItemByIndex(0)).toBe(3);
      expect(store.inventory).toEqual([inv('w1', 1)]);
      await Promise.resolve();
      expect(inventoryDbService.saveInventory).toHaveBeenCalled();
    });
  });

  // -------------------- Actions: useItem - 效果分支 --------------------
  describe('Actions: useItem - 效果分支', () => {
    it('physical_damage 效果：进入分支但不报错（TODO 待战斗系统实现）', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 1)],
        itemTemplates: mapOf(makeItem({
          consumable: true,
          effect: { type: 'physical_damage', value: 30 },
        })),
      });
      const result = await store.useItem('p1');
      expect(result).toBe(true);
      // 物品仍被消耗
      expect(store.inventory).toEqual([]);
      // 不应调用恢复效果
      expect(mocks.characterStore.receiveHeal).not.toHaveBeenCalled();
      expect(mocks.characterStore.changeMp).not.toHaveBeenCalled();
    });

    it('magic_damage 效果：进入分支但不报错（TODO 待战斗系统实现）', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 1)],
        itemTemplates: mapOf(makeItem({
          consumable: true,
          effect: { type: 'magic_damage', value: 30 },
        })),
      });
      const result = await store.useItem('p1');
      expect(result).toBe(true);
      expect(store.inventory).toEqual([]);
      expect(mocks.characterStore.receiveHeal).not.toHaveBeenCalled();
    });

    it('stat 效果：effect.type=stat 时不触发即时效果，bonus 通过 applyBonus 应用', async () => {
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 1)],
        // P3.3：旧 effect.type=stat + bonus 字段统一为 effects[] 中的 stat 类型效果
        // p1 不在 ATTRIBUTE_POTION_IDS 白名单中，走 applyBonus 路径
        itemTemplates: mapOf(makeItem({
          effects: [{ type: 'stat', value: { str: 2 } }],
        } as Partial<Item>)),
      });
      const result = await store.useItem('p1');
      expect(result).toBe(true);
      // bonus 被应用
      expect(mocks.characterStore.applyBonus).toHaveBeenCalledWith({ str: 2 });
      // 即时恢复效果不应被调用
      expect(mocks.characterStore.receiveHeal).not.toHaveBeenCalled();
      expect(mocks.characterStore.changeMp).not.toHaveBeenCalled();
    });
  });

  // -------------------- Actions: persistInventory 持久化失败 --------------------
  describe('Actions: persistInventory 持久化失败', () => {
    it('saveInventory 抛错时进入 catch 通过 errorReporter 上报并设置 persistError', async () => {
      const err = new Error('DB write failed');
      vi.mocked(inventoryDbService.saveInventory).mockRejectedValueOnce(err);
      // P2-50 修复：错误现在通过 errorReporter 上报，不再直接 console.error
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => { /* 吞掉错误输出 */ });

      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [],
        itemTemplates: mapOf(makeItem({ id: 'p1', stackable: true })),
      });

      // addItem 内部调用 persistInventory（fire-and-forget），saveInventory 抛错被 catch
      store.addItem('p1', 1);

      // 等待 fire-and-forget 的 Promise 完成
      await Promise.resolve();
      await Promise.resolve();

      // P2-50 修复：persistError 暴露错误状态供 UI 监听
      expect(store.persistError).toBe('DB write failed');
      // errorReporter 会上报错误（输出到 console.error 作为日志格式）
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  // -------------------- 补充覆盖：防御性分支 --------------------
  describe('补充覆盖：防御性分支', () => {
    it('totalValue 中物品模板缺失时跳过该物品（if (item) FALSE 分支）', () => {
      // 覆盖 line 91: if (item) 的 FALSE 分支
      const store = useInventoryStore();
      store.$patch({
        inventory: [inv('p1', 2), inv('unknown', 3)],
        itemTemplates: mapOf(makeItem({ value: 10 })),
      });
      // unknown 无模板 → 跳过，只计 p1: 10*2 = 20
      expect(store.totalValue).toBe(20);
    });

    it('itemCountByKind 中物品模板缺失时跳过该物品（if (item) FALSE 分支）', () => {
      // P3.3：itemCountByType 改为 itemCountByKind
      // 覆盖 line 106: if (item) 的 FALSE 分支
      const store = useInventoryStore();
      store.$patch({
        inventory: [inv('p1', 2), inv('unknown', 5)],
        itemTemplates: mapOf(makeItem()),
      });
      const counts = store.itemCountByKind;
      // unknown 无模板 → 跳过，只计 p1（consumable）
      expect(counts.consumable).toBe(2);
    });

    it('removeItem 物品不在背包时 removed=0 不触发持久化（if (removed > 0) FALSE 分支）', () => {
      // 覆盖 line 308: if (removed > 0) 的 FALSE 分支
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 5)],
        itemTemplates: mapOf(makeItem()),
      });
      const removed = store.removeItem('not_in_inv', 3);
      expect(removed).toBe(0);
      expect(store.inventory).toEqual([inv('p1', 5)]);
    });

    it('useItem 多物品背包中堆叠物品 count-1（ternary FALSE 分支）', async () => {
      // 覆盖 line 401: i === idx ? ... : item 中 : item 分支
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 2), inv('w1', 1)],
        itemTemplates: mapOf(makeItem({ consumable: true, effect: { type: 'health_restore', value: 50 } })),
      });
      await store.useItem('p1');
      // p1 count 减 1，w1 不变
      expect(store.inventory).toEqual([inv('p1', 1), inv('w1', 1)]);
    });

    it('dropItemByIndex 多物品背包中部分丢弃（ternary FALSE 分支）', () => {
      // 覆盖 line 463: i === index ? ... : item 中 : item 分支
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 5), inv('w1', 1)],
        itemTemplates: mapOf(makeItem()),
      });
      store.dropItemByIndex(0, 2);
      // p1 count 减 2，w1 不变
      expect(store.inventory).toEqual([inv('p1', 3), inv('w1', 1)]);
    });

    it('useItem effect.type 非 stat 且非已知类型时跳过所有效果分支', async () => {
      // 覆盖 line 387: else if (type === 'stat') 的 FALSE 分支
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('p1', 1)],
        itemTemplates: mapOf(makeItem({
          consumable: true,
          effect: { type: 'health_restore' as any, value: 0 },
        })),
      });
      // value=0 → health_restore 条件不满足 → 所有 else if 都不匹配
      const result = await store.useItem('p1');
      expect(result).toBe(true);
      expect(mocks.characterStore.receiveHeal).not.toHaveBeenCalled();
    });

    it('organizeInventory 物品模板缺失时排序回退为 common/misc', () => {
      // 覆盖 lines 557-561: RARITY_ORDER[itemA?.rarity || 'common'] 和 ITEM_TYPE_NAMES[itemA?.type || 'misc']
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('unknown', 1), inv('p1', 1)],
        itemTemplates: mapOf(makeItem({ id: 'p1', stackable: true })),
      });
      store.organizeInventory();
      // 不报错即可，unknown 回退为 common/misc
      expect(store.inventory).toHaveLength(2);
    });

    it('organizeInventory 所有物品模板均缺失时 itemA 和 itemB 的 rarity/type 均回退', () => {
      // 覆盖 line 557/560: itemB?.rarity || 'common' 和 itemB?.type || 'misc' 的 itemB 回退分支
      // 当所有物品模板均缺失时，comparator 任意配对都会触发 itemA 和 itemB 的 || 回退
      const store = useInventoryStore();
      mocks.gameStore.currentCharacterId = 'char-1';
      store.$patch({
        inventory: [inv('unknown_a', 1), inv('unknown_b', 1)],
        itemTemplates: new Map(),
      });
      store.organizeInventory();
      expect(store.inventory).toHaveLength(2);
    });

    it('organizeInventory 无 currentCharacterId 时 persistInventory 早返回不持久化', async () => {
      // 覆盖 line 163: if (currentCharacterId.value) 的 FALSE 分支
      const store = useInventoryStore();
      // currentCharacterId 默认为 null
      store.$patch({
        inventory: [inv('a', 1)],
        itemTemplates: mapOf(makeItem({ id: 'a', stackable: true })),
      });
      store.organizeInventory();
      // flush fire-and-forget persistInventory
      await new Promise(resolve => setTimeout(resolve, 0));
      // currentCharacterId 为 null → persistInventory 早返回，不应调用 saveInventory
      expect(inventoryDbService.saveInventory).not.toHaveBeenCalled();
    });

    it('loadInventory 无 currentCharacterId 时不执行初始化', async () => {
      // 覆盖 line 689: if (currentCharacterId.value) 的 FALSE 分支
      const store = useInventoryStore();
      // currentCharacterId 默认为 null
      await store.loadInventory();
      // 不应调用 DB
      expect(inventoryDbService.getInventory).not.toHaveBeenCalled();
    });
  });
});
