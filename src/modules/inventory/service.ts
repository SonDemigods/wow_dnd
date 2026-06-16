/**
 * 背包模块纯函数服务层
 * 
 * 提供无状态的背包计算函数，不持有状态、不调用DB、不发射事件。
 * 所有业务逻辑都是纯函数，由 Store 层编排调用。
 */
import type { Item, InventoryItem, SortField, SortOrder, ItemFilters, ItemType, ItemRarity, ItemEffect } from './types';
import { useInventoryStore } from './store';

// ==================== 常量 ====================

/** 背包容量 */
export const INVENTORY_SIZE = 50;

/** 最大堆叠数量 */
export const MAX_STACK = 10;

/** 物品类型名称映射 */
export const ITEM_TYPE_NAMES: Record<ItemType, string> = {
  gold: '货币',
  potion: '药水',
  scroll: '卷轴',
  food: '食物',
  material: '材料',
  quest: '任务物品',
  weapon: '武器',
  armor: '护甲',
  misc: '杂项'
};

/** 稀有度排序映射 */
const RARITY_ORDER: Record<ItemRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4
};

// ==================== 纯函数：堆叠计算 ====================

/**
 * 判断物品是否可堆叠到已有物品槽位
 * @param item - 物品模板
 * @param existingItem - 背包中已有物品
 * @returns 是否可堆叠
 */
export function canStackItem(item: Item, existingItem: InventoryItem): boolean {
  return item.stackable && item.id === existingItem.itemId && existingItem.count < MAX_STACK;
}

/**
 * 计算堆叠结果
 * @param existing - 已有数量
 * @param addQuantity - 要添加的数量
 * @param maxStack - 最大堆叠数
 * @returns 堆叠后的数量和溢出数量
 */
export function computeStackResult(
  existing: number,
  addQuantity: number,
  maxStack: number
): { quantity: number; overflow: number } {
  const available = maxStack - existing;
  if (addQuantity <= available) {
    return { quantity: existing + addQuantity, overflow: 0 };
  }
  return { quantity: maxStack, overflow: addQuantity - available };
}

// ==================== 纯函数：查找 ====================

/**
 * 在背包中查找物品索引
 * @param inventory - 背包物品列表
 * @param itemId - 物品ID
 * @returns 物品索引，未找到返回 -1
 */
export function findItemIndex(inventory: InventoryItem[], itemId: string): number {
  return inventory.findIndex(invItem => invItem.itemId === itemId);
}

// ==================== 纯函数：排序 ====================

/**
 * 排序物品列表（返回新数组，不修改原数组）
 * @param items - 物品列表
 * @param itemTemplates - 物品模板映射
 * @param sortBy - 排序字段
 * @param sortOrder - 排序顺序
 * @returns 排序后的新数组
 */
export function sortItems(
  items: InventoryItem[],
  itemTemplates: Map<string, Item>,
  sortBy: SortField,
  sortOrder: SortOrder
): InventoryItem[] {
  const multiplier = sortOrder === 'asc' ? 1 : -1;
  const sorted = [...items];

  sorted.sort((a, b) => {
    const itemA = itemTemplates.get(a.itemId);
    const itemB = itemTemplates.get(b.itemId);

    let comparison = 0;

    switch (sortBy) {
      case 'type':
        comparison = (ITEM_TYPE_NAMES[itemA?.type || 'misc'] || '').localeCompare(
          ITEM_TYPE_NAMES[itemB?.type || 'misc'] || ''
        );
        break;
      case 'rarity':
        comparison = (RARITY_ORDER[itemA?.rarity || 'common'] || 0) -
                     (RARITY_ORDER[itemB?.rarity || 'common'] || 0);
        break;
      case 'name':
        comparison = (itemA?.name || '').localeCompare(itemB?.name || '');
        break;
      case 'level':
        comparison = (itemA?.bonus?.str || 0) - (itemB?.bonus?.str || 0);
        break;
      case 'acquiredAt':
        comparison = 0;
        break;
    }

    return comparison * multiplier;
  });

  return sorted;
}

// ==================== 纯函数：筛选 ====================

/**
 * 筛选物品列表
 * @param items - 物品列表
 * @param itemTemplates - 物品模板映射
 * @param filters - 筛选条件
 * @param keyword - 搜索关键词
 * @returns 筛选后的物品列表
 */
export function filterItems(
  items: InventoryItem[],
  itemTemplates: Map<string, Item>,
  filters: ItemFilters,
  keyword: string
): InventoryItem[] {
  let result = [...items];

  // 关键词搜索
  if (keyword.trim()) {
    const lowerKeyword = keyword.toLowerCase();
    result = result.filter(invItem => {
      const item = itemTemplates.get(invItem.itemId);
      return item && (
        item.name.toLowerCase().includes(lowerKeyword) ||
        item.description.toLowerCase().includes(lowerKeyword)
      );
    });
  }

  // 类型筛选
  if (filters.types && filters.types.length > 0) {
    result = result.filter(invItem => {
      const item = itemTemplates.get(invItem.itemId);
      return item && filters.types!.includes(item.type);
    });
  }

  // 稀有度筛选
  if (filters.rarities && filters.rarities.length > 0) {
    result = result.filter(invItem => {
      const item = itemTemplates.get(invItem.itemId);
      return item && filters.rarities!.includes(item.rarity);
    });
  }

  // 可堆叠筛选
  if (filters.stackable !== undefined) {
    result = result.filter(invItem => {
      const item = itemTemplates.get(invItem.itemId);
      return item && item.stackable === filters.stackable;
    });
  }

  return result;
}

// ==================== 纯函数：组合筛选排序 ====================

/**
 * 组合筛选与排序（纯函数，供 Store computed 属性直接使用）
 * 将筛选和排序合并为一次遍历，减少中间数组创建
 * @param items - 物品列表
 * @param itemTemplates - 物品模板映射
 * @param filters - 筛选条件
 * @param sortBy - 排序字段
 * @param sortOrder - 排序顺序
 * @param keyword - 搜索关键词
 * @returns 筛选并排序后的物品列表
 */
export function sortAndFilterInventory(
  items: InventoryItem[],
  itemTemplates: Map<string, Item>,
  filters: ItemFilters,
  sortBy: SortField,
  sortOrder: SortOrder,
  keyword: string
): InventoryItem[] {
  // 先筛选
  const filtered = filterItems(items, itemTemplates, filters, keyword);
  // 再排序
  return sortItems(filtered, itemTemplates, sortBy, sortOrder);
}

// ==================== 纯函数：物品使用 ====================

/**
 * 计算使用物品的效果
 * @param itemTemplate - 物品模板
 * @returns 物品效果对象，无可使用效果返回 null
 */
export function computeUseEffect(itemTemplate: Item): ItemEffect | null {
  if (!itemTemplate.effect) return null;
  return itemTemplate.effect;
}

/**
 * 判断物品是否可在战斗中使用
 * @param itemTemplate - 物品模板
 * @returns 是否可在战斗中使用
 */
export function isUsableInCombat(itemTemplate: Item): boolean {
  if (!itemTemplate.consumable) return false;
  if (!itemTemplate.effect) return false;

  const combatEffectTypes = ['health_restore', 'mana_restore', 'physical_damage', 'magic_damage'];
  return combatEffectTypes.includes(itemTemplate.effect.type);
}

// ==================== 向后兼容的代理对象 ====================
// 以下对象保持与旧 inventoryService 相同的接口，内部委托给 Pinia Store
// 供尚未迁移的外部模块（combat、exploration、shop、console、UI组件）继续使用

/**
 * 背包服务兼容代理（委托给 Pinia Store）
 * 
 * 保留旧的 inventoryService 接口，内部委托给 useInventoryStore()。
 * 外部模块可继续通过此对象访问背包功能，逐步迁移到直接使用 Store。
 */
export const inventoryService = {
  getInventory(): InventoryItem[] {
    return useInventoryStore().inventory;
  },

  getItem(index: number): InventoryItem | null {
    const inv = useInventoryStore().inventory;
    if (index < 0 || index >= inv.length) return null;
    return inv[index] || null;
  },

  getItemInfo(itemId: string): Item | null {
    return useInventoryStore().getItemInfo(itemId);
  },

  getAllItems(): Item[] {
    return useInventoryStore().getAllItems();
  },

  addItem(item: Item): boolean {
    return useInventoryStore().addItem(item.id, 1) > 0;
  },

  addItems(item: Item, count: number): number {
    return useInventoryStore().addItem(item.id, count);
  },

  removeItem(index: number): boolean {
    return useInventoryStore().removeItemByIndex(index) > 0;
  },

  async useItem(index: number): Promise<boolean> {
    return useInventoryStore().useItemByIndex(index);
  },

  getEmptySlots(): number {
    return useInventoryStore().emptySlots;
  },

  isFull(): boolean {
    return useInventoryStore().isFull;
  },

  reset(): void {
    useInventoryStore().resetInventory();
  },

  canStack(item: InventoryItem): boolean {
    const info = useInventoryStore().getItemInfo(item.itemId);
    return info ? canStackItem(info, item) : false;
  },

  getStackableCount(item: InventoryItem): number {
    const info = useInventoryStore().getItemInfo(item.itemId);
    if (!info?.stackable) return 0;
    return MAX_STACK - item.count;
  },

  dropItem(index: number, count?: number): boolean {
    return useInventoryStore().dropItemByIndex(index, count);
  },

  dropItems(indices: number[]): boolean {
    return useInventoryStore().dropItemsByIndices(indices);
  },

  sortItems(sortByParam: SortField, order: SortOrder): void {
    useInventoryStore().updateSort(sortByParam, order);
  },

  organizeInventory(): void {
    useInventoryStore().organizeInventory();
  },

  searchItems(keyword: string): InventoryItem[] {
    return useInventoryStore().searchItems(keyword);
  },

  filterItems(filters: ItemFilters): InventoryItem[] {
    return useInventoryStore().filterInventory(filters);
  },

  getTotalValue(): number {
    return useInventoryStore().totalValue;
  },

  getItemCountByType(): Record<ItemType, number> {
    return { ...useInventoryStore().itemCountByType };
  },

  addItemTemplate(item: Item): void {
    useInventoryStore().addItemTemplate(item);
  },

  removeItemTemplate(itemId: string): void {
    useInventoryStore().removeItemTemplate(itemId);
  },

  async getEquipment(): Promise<any[]> {
    return useInventoryStore().getEquipment();
  },

  async initialize(characterId?: string): Promise<void> {
    await useInventoryStore().initialize(characterId || '');
  },

  async setCharacter(characterId: string): Promise<void> {
    await useInventoryStore().initialize(characterId);
  }
};
