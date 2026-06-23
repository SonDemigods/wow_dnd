/**
 * @fileoverview 商店模块核心服务函数（纯函数层）
 * @description 提供商店系统的价格计算、商品生成、角色校验等无副作用的核心逻辑。
 *              所有函数均为纯函数，不依赖 Store 或 DB，不修改参数，仅基于输入计算输出。
 *
 * **职责边界**：
 * - ✅ 价格计算（稀有度倍率 × 基价，买卖价格区分）
 * - ✅ 商品生成（根据商店类型从物品池中随机选取）
 * - ✅ 角色校验（金币是否足够）
 * - ❌ 状态管理（由 Store 负责）
 * - ❌ 数据持久化（由 DB 层负责）
 */

import type { Item, ItemType } from '../inventory/types';
import type { ShopConfig, ShopItem, ShopType } from './types';
import type { Character } from '../character/types';

/**
 * 商店类型 → 可售物品类型映射表
 *
 * `Record<ShopType, ItemType[]>` 确保每种商店类型都有对应的物品池，
 * 新增 ShopType 时 TypeScript 会强制要求补充映射，编译期防止遗漏。
 */
export const SHOP_TYPE_ITEM_TYPE_MAP: Record<ShopType, ItemType[]> = {
  general: ['weapon', 'armor', 'material', 'misc'],
  potion: ['potion'],
  scroll: ['scroll'],
  food: ['food'],
  material: ['material'],
};

/**
 * 计算物品在商店中的标准价格
 *
 * 公式：`Math.round(基价 × 稀有度倍率)`，购买价 = 标准价，出售价 = 标准价 × 0.5。
 * 稀有度倍率从高到低：传说(20x) > 史诗(10x) > 稀有(5x) > 优秀(2x) > 普通(1x)。
 *
 * @param itemTemplate - 物品模板（来自 inventory 模块）
 * @param isBuyPrice   - `true` 返回购买价，`false` 返回出售价（半价），默认为 `true`
 * @returns 计算后的整数价格
 */
export function calculatePrice(itemTemplate: Item, isBuyPrice = true): number {
  const baseValue = itemTemplate.value || 0;
  const rarityMultiplier = getRarityMultiplier(itemTemplate.rarity);
  const price = Math.round(baseValue * rarityMultiplier);
  return isBuyPrice ? price : Math.round(price * 0.5);
}

/**
 * 计算物品出售价格
 *
 * {@link calculatePrice} 的语义化包装，固定 isBuyPrice = false。
 * 供 Store 中 {@link sellItem} 和 {@link calculateSellPrice} 统一调用，
 * 避免多处硬编码 false 参数。
 *
 * @param itemTemplate - 物品模板
 * @returns 出售价格（标准价 × 0.5 后取整）
 */
export function computeSellPrice(itemTemplate: Item): number {
  return calculatePrice(itemTemplate, false);
}

/**
 * 检查角色金币是否足够购买物品
 *
 * 纯校验函数，不执行扣款。扣款由 Store 的 `spendGold` 负责。
 *
 * @param character - 角色数据
 * @param price     - 物品价格
 * @returns 金币是否足够
 */
export function canAffordItem(character: Character, price: number): boolean {
  return (character.gold ?? 0) >= price;
}

/**
 * 根据稀有度返回价格倍率
 *
 * @param rarity - 稀有度字符串（common / uncommon / rare / epic / legendary）
 * @returns 对应的倍率，未识别的稀有度返回 1.0 作为容错
 */
function getRarityMultiplier(rarity: string): number {
  const multipliers: Record<string, number> = {
    common: 1.0,
    uncommon: 2.0,
    rare: 5.0,
    epic: 10.0,
    legendary: 20.0,
  };
  return multipliers[rarity] ?? 1.0;
}

/**
 * 为指定商店生成商品列表
 *
 * 算法流程：
 * 1. 通过 {@link SHOP_TYPE_ITEM_TYPE_MAP} 获取该商店可售的物品类型
 * 2. 从物品池中筛选匹配类型的模板
 * 3. 随机抽取 6~12 件物品（不足时全取）
 * 4. 每件物品调用 {@link calculatePrice} 计算购买价
 * 5. 随机生成 1~5 的库存数量
 *
 * @param shopConfig - 商店配置
 * @param allItems   - 所有物品模板列表
 * @returns 生成的商品列表，物品池为空时返回空数组
 */
export function generateShopItems(shopConfig: ShopConfig, allItems: Item[]): ShopItem[] {
  const allowedTypes = SHOP_TYPE_ITEM_TYPE_MAP[shopConfig.type];

  // 筛选出该商店可售类型的物品模板
  const availableItems = allItems.filter(item => allowedTypes.includes(item.type));

  // 随机选择 6-12 件商品
  const count = Math.min(Math.floor(Math.random() * 7) + 6, availableItems.length);
  const shuffled = [...availableItems].sort(() => Math.random() - 0.5);
  const selected = shuffled.slice(0, count);

  // 生成商品列表
  return selected.map(item => ({
    itemId: item.id,
    price: calculatePrice(item, true),
    quantity: Math.max(1, Math.floor(Math.random() * 5) + 1),
  }));
}
