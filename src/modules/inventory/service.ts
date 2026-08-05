/**
 * 背包模块纯函数服务层
 *
 * 提供无状态的背包计算函数，不持有状态、不调用 DB、不发射事件。
 * 所有业务逻辑都是纯函数，由 Store 层编排调用。
 *
 * ## 设计原则
 * - 纯函数：相同输入始终产生相同输出，无副作用
 * - 不可变：所有函数返回新数组，不修改传入的参数
 * - 无依赖：不导入 Store、DB 或其他有状态模块
 *
 * ## P3.3 升级
 * - 删除旧 `ITEM_TYPE_NAMES`（Record<ItemType, string>），改用 typeRegistry 的 `getItemDisplayName`
 * - sortItems/filterItems 按 `kind`（判别字段）排序/筛选，替代旧 `type`
 * - computeUseEffect 从 `effects[]` 提取首个非 stat 效果；新增 computeStatBonus 提取属性加成
 */
import type { Item, InventoryItem, SortField, SortOrder, ItemFilters, ItemRarity, ItemEffect } from './types';
import type { Stats } from '../character/types';
import { getItemDisplayName } from '../item/typeRegistry';

// ==================== 常量 ====================

/**
 * 背包容量（槽位数）
 *
 * 50 个槽位是设计上限，超出后 addItem 会丢弃溢出部分。
 * 需要在 UI 中告知玩家容量已满。
 */
export const INVENTORY_SIZE = 50;

/**
 * 最大堆叠数量
 *
 * 堆叠物品（如药水、材料）在单个槽位中可堆叠的上限。
 * 不可堆叠物品（如武器、护甲）在 addItem 中通过 perSlot = 1 独立处理。
 */
export const MAX_STACK = 10;

/**
 * 稀有度排序权重映射
 *
 * 将稀有度字符串映射为数值，用于排序比较。
 * 权重值：common(0) < uncommon(1) < rare(2) < epic(3) < legendary(4)
 *
 * 注意：Record<ItemRarity, number> 确保所有 ItemRarity 值都有对应映射，
 * 因此 RARITY_ORDER[item?.rarity || 'common'] 不需要额外 || 0 回退。
 */
export const RARITY_ORDER: Record<ItemRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4
};

// ==================== 纯函数：堆叠计算 ====================

/**
 * 判断物品是否可堆叠到已有物品槽位
 *
 * 三个条件必须同时满足：
 * 1. 物品模板允许堆叠（item.stackable）
 * 2. 槽位中是同种物品（item.id === existingItem.itemId）
 * 3. 槽位尚未达到堆叠上限（existingItem.count < MAX_STACK）
 *
 * @param item - 物品模板
 * @param existingItem - 背包中已有物品
 * @returns 是否可堆叠到此槽位
 */
export function canStackItem(item: Item, existingItem: InventoryItem): boolean {
  return item.stackable && item.id === existingItem.itemId && existingItem.count < MAX_STACK;
}

/**
 * 计算堆叠结果
 *
 * 将 addQuantity 个物品尝试堆叠到已有 existing 个物品的槽位中。
 * 返回最终数量和超出上限的溢出数量。
 *
 * 示例：existing=8, addQuantity=5, maxStack=10 → quantity=10, overflow=3
 *
 * @param existing - 已有数量
 * @param addQuantity - 要添加的数量
 * @param maxStack - 最大堆叠数
 * @returns 堆叠后的数量（quantity）和溢出数量（overflow）
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
 *
 * 按 itemId 查找第一个匹配的物品槽位位置。
 * 只查找 itemId，不区分 count。如需查找特定数量的物品，由调用方自行处理。
 *
 * @param inventory - 背包物品列表
 * @param itemId - 物品 ID
 * @returns 物品索引（0-based），未找到返回 -1
 */
export function findItemIndex(inventory: InventoryItem[], itemId: string): number {
  return inventory.findIndex(invItem => invItem.itemId === itemId);
}

// ==================== 纯函数：排序 ====================

/**
 * 排序物品列表（返回新数组，不修改原数组）
 *
 * 通过 itemTemplates 查询每个槽位对应物品的完整信息，再按指定字段排序。
 * 排序策略（P3.3：`type` 字段已改为 `kind`）：
 * - kind：按类型显示名称拼音排序（typeRegistry 的 getItemDisplayName，含 subtype 精确名）
 * - rarity：按稀有度权重排序（RARITY_ORDER 映射）
 * - name：按物品名称拼音排序
 * - level：按物品等级数值排序
 *
 * 当 itemTemplates 中找不到对应物品时（itemA/itemB 为 undefined），
 * 使用安全的回退值保证排序不中断：kind → '杂项'、rarity → 'common'、
 * name → ''、level → 0
 *
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
      case 'kind':
        comparison = (itemA ? getItemDisplayName(itemA) : '杂项').localeCompare(
          itemB ? getItemDisplayName(itemB) : '杂项'
        );
        break;
      case 'rarity':
        comparison = RARITY_ORDER[itemA?.rarity || 'common'] -
                     RARITY_ORDER[itemB?.rarity || 'common'];
        break;
      case 'name':
        comparison = (itemA?.name || '').localeCompare(itemB?.name || '');
        break;
      case 'level':
        comparison = (itemA?.level || 0) - (itemB?.level || 0);
        break;
    }

    return comparison * multiplier;
  });

  return sorted;
}

// ==================== 纯函数：筛选 ====================

/**
 * 筛选物品列表
 *
 * 支持四种筛选条件，按顺序依次执行（链式过滤）：
 * 1. 关键词搜索（匹配物品名称和描述，不区分大小写）
 * 2. 大类筛选（filters.kinds，按判别字段 ItemKind）
 * 3. 稀有度筛选（filters.rarities）
 * 4. 可堆叠筛选（filters.stackable）
 *
 * 每步过滤都创建新数组，最终返回的是全新数组实例。
 * 空条件的步骤会被跳过（不执行无意义的遍历）。
 *
 * P3.3：旧 `filters.types`（ItemType）已改为 `filters.kinds`（ItemKind）。
 *
 * @param items - 物品列表
 * @param itemTemplates - 物品模板映射
 * @param filters - 筛选条件（所有字段可选，未设置不参与过滤）
 * @param keyword - 搜索关键词（空字符串表示不搜索）
 * @returns 筛选后的新物品列表
 */
export function filterItems(
  items: InventoryItem[],
  itemTemplates: Map<string, Item>,
  filters: ItemFilters,
  keyword: string
): InventoryItem[] {
  let result = [...items];

  // 关键词搜索：匹配名称或描述
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

  // 大类筛选：物品 kind 必须在指定列表中
  if (filters.kinds && filters.kinds.length > 0) {
    const kinds = filters.kinds;
    result = result.filter(invItem => {
      const item = itemTemplates.get(invItem.itemId);
      return item && kinds.includes(item.kind);
    });
  }

  // 稀有度筛选：稀有度必须在指定列表中
  if (filters.rarities && filters.rarities.length > 0) {
    const rarities = filters.rarities;
    result = result.filter(invItem => {
      const item = itemTemplates.get(invItem.itemId);
      return item && rarities.includes(item.rarity);
    });
  }

  // 可堆叠筛选：stackable 必须匹配
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
 *
 * 执行流程：先筛选 → 再排序。两个步骤各创建一次中间数组，
 * 总内存开销为 N + M（N=原数组长度，M=筛选后长度）。
 *
 * 此函数是 filteredInventory 计算属性的底层实现。
 *
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
 * 获取物品的即时使用效果（非属性加成类）
 *
 * P3.3 升级：从消耗品的 `effects[]` 中提取首个非 stat 效果
 * （health_restore / mana_restore / physical_damage / magic_damage 等）。
 * stat 类型效果（属性加成）由 {@link computeStatBonus} 单独提取，
 * 在 useItem 中走属性加成分支（applyPotionBonus / applyBonus）。
 *
 * 非消耗品无使用效果，返回 null。
 *
 * @param itemTemplate - 物品模板
 * @returns 首个即时效果，无可使用效果返回 null
 */
export function computeUseEffect(itemTemplate: Item): ItemEffect | null {
  if (itemTemplate.kind !== 'consumable') return null;
  return itemTemplate.effects.find(e => e.type !== 'stat') ?? null;
}

/**
 * 获取消耗品的属性加成（stat 效果）
 *
 * P3.3 升级：旧版属性药剂通过 `bonus` 字段表达属性加成，新版统一为 `effects[]`
 * 中的 `type:'stat'` 效果（plan.md T6，消除 ATTRIBUTE_POTION_IDS 白名单的根因）。
 * 本函数从 effects 提取 stat 效果的 value（Partial<Stats>），供 useItem 的属性加成分支使用。
 *
 * 非消耗品或无 stat 效果时返回 null。
 *
 * @param itemTemplate - 物品模板
 * @returns 属性加成对象，无属性加成返回 null
 */
export function computeStatBonus(itemTemplate: Item): Partial<Stats> | null {
  if (itemTemplate.kind !== 'consumable') return null;
  const statEffect = itemTemplate.effects.find(e => e.type === 'stat');
  if (!statEffect || typeof statEffect.value !== 'object') return null;
  return statEffect.value as Partial<Stats>;
}
