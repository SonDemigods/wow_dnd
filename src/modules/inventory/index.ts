/**
 * @fileoverview 背包模块统一导出入口
 * @description
 * 背包模块（inventory）负责管理角色的物品背包，提供完整的物品生命周期管理。
 *
 * 模块架构（四层分离）：
 *   types.ts  —— 类型定义层：物品、背包、排序、筛选的所有类型和接口
 *   db.ts     —— 数据持久层：IndexedDB 读写封装（char_inventory + config_items 双表）
 *   service.ts —— 纯函数服务层：无状态的排序/筛选/堆叠计算逻辑
 *   store.ts  —— 状态管理层：Pinia Store，持有响应式状态并编排 Action 流程
 *
 * 使用方式：
 *   import { useInventoryStore } from '@/modules/inventory';
 *   const store = useInventoryStore();
 *   store.addItem('potion_01', 3);
 *
 * @module inventory
 */
export type {
  ItemType,
  ItemRarity,
  ItemTypeData,
  RarityConfig,
  ItemEffectType,
  ItemEffect,
  Item,
  InventoryItem,
  SortField,
  SortOrder,
  ItemFilters,
  InventoryDataStorage,
  ItemDataStorage,
  ItemStorage,
  InventoryStorage
} from './types';

export { InventoryDbService, inventoryDbService } from './db';

export {
  INVENTORY_SIZE,
  MAX_STACK,
  ITEM_TYPE_NAMES,
  RARITY_ORDER,
  canStackItem,
  computeStackResult,
  findItemIndex,
  sortItems,
  filterItems,
  sortAndFilterInventory,
  computeUseEffect
} from './service';

export { useInventoryStore, setInventoryExternalCallbacks, clearInventoryExternalCallbacks } from './store';
