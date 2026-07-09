/**
 * @fileoverview 统一物品模板层入口
 * @description
 *   物品模板聚合层（A1/G1 修复），消除 inventory ↔ equipment 双向依赖。
 *
 *   职责：
 *   - 聚合 config_items（普通物品）与 config_equipmentItems（装备）查询
 *   - 提供统一的 Item 格式缓存（合并普通物品与装备模板）
 *   - 提供 convertEquipmentToItem / mergeItemTemplates 纯函数
 *
 *   依赖方向：item-template → inventory.db + equipment.db（单向，无循环）
 *
 *   使用方式：
 *   ```typescript
 *   import { unifiedItemTemplateCache } from '@/modules/item-template';
 *   const items = await unifiedItemTemplateCache.getAll(); // 合并后的 Item[]
 *   ```
 *
 * @module item-template
 */
export type {
  Item,
  ItemType,
  ItemRarity,
  ItemEffect,
  ItemEffectType,
  ItemFilters,
  SortField,
  SortOrder
} from './types';

export { ItemTemplateDbService, itemTemplateDbService } from './db';

export { convertEquipmentToItem, mergeItemTemplates } from './service';

export { unifiedItemTemplateCache } from './cache';
