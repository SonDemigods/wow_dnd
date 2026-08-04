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

import type { Item, ItemType } from '@/modules/inventory/types';
import type { ShopConfig, ShopItem, ShopType } from './types';
import type { Character } from '@/modules/character/types';
import { RARITY_PRICE_MULTIPLIER, RARITY_SELL_DISCOUNT } from '@/config/inventory';
import { defaultRng, type Rng } from '@/utils/rng';

/**
 * 商店类型 → 可售物品类型映射表
 *
 * `Record<ShopType, ItemType[]>` 确保每种商店类型都有对应的物品池，
 * 新增 ShopType 时 TypeScript 会强制要求补充映射，编译期防止遗漏。
 */
export const SHOP_TYPE_ITEM_TYPE_MAP: Record<ShopType, ItemType[]> = {
  // P1-2：general 杂货商店售卖消耗品（药水/卷轴/食物/材料），与 SHOP_MODULE_DESIGN.md 一致
  general: ['potion', 'scroll', 'food', 'material'],
  potion: ['potion'],
  scroll: ['scroll'],
  food: ['food'],
  material: ['material'],
  // P3-161：装备商店售卖武器和护甲，补全装备获取渠道
  equipment: ['weapon', 'armor'],
};

/**
 * 计算物品在商店中的标准价格
 *
 * 公式：
 * - 购买价 = `Math.round(基价 × RARITY_PRICE_MULTIPLIER)`
 * - 出售价 = `Math.round(购买价 × RARITY_SELL_DISCOUNT)`
 *
 * 倍率与折扣均来源于 `config/inventory.ts` 的常量，service 层无硬编码，
 * 平衡性调整只需修改 config，无需改动本函数。
 *
 * @param itemTemplate - 物品模板（来自 inventory 模块）
 * @param isBuyPrice   - `true` 返回购买价，`false` 返回出售价，默认为 `true`
 * @returns 计算后的整数价格
 */
export function calculatePrice(itemTemplate: Item, isBuyPrice = true): number {
  const baseValue = itemTemplate.value || 0;
  const rarityMultiplier = getRarityMultiplier(itemTemplate.rarity);
  const buyPrice = Math.round(baseValue * rarityMultiplier);
  if (isBuyPrice) return buyPrice;

  const sellDiscount = getSellDiscount(itemTemplate.rarity);
  return Math.round(buyPrice * sellDiscount);
}

/**
 * 计算物品出售价格
 *
 * {@link calculatePrice} 的语义化包装，固定 isBuyPrice = false。
 * 供 Store 中 {@link sellItem} 和 {@link calculateSellPrice} 统一调用，
 * 避免多处硬编码 false 参数。
 *
 * @param itemTemplate - 物品模板
 * @returns 出售价格（购买价 × RARITY_SELL_DISCOUNT 后取整）
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
 * 根据稀有度返回购买价格倍率
 *
 * 倍率来源于 `config/inventory.ts` 的 `RARITY_PRICE_MULTIPLIER`，
 * 平衡性调整只需修改 config，service 层无硬编码。
 *
 * @param rarity - 稀有度字符串（common / uncommon / rare / epic / legendary）
 * @returns 对应的倍率，未识别的稀有度返回 1.0 作为容错
 */
function getRarityMultiplier(rarity: string): number {
  const multipliers = RARITY_PRICE_MULTIPLIER as Record<string, number>;
  return multipliers[rarity] ?? 1.0;
}

/**
 * 根据稀有度返回出售折扣率
 *
 * 折扣来源于 `config/inventory.ts` 的 `RARITY_SELL_DISCOUNT`，
 * 稀有度越高折扣越低，避免玩家靠出售稀有装备套利。
 *
 * @param rarity - 稀有度字符串（common / uncommon / rare / epic / legendary）
 * @returns 对应的折扣率，未识别的稀有度返回 0.5 作为容错
 */
function getSellDiscount(rarity: string): number {
  const discounts = RARITY_SELL_DISCOUNT as Record<string, number>;
  return discounts[rarity] ?? 0.5;
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
 * 6. BIZ-21：稀有及以上商品携带 `maxPurchaseCount` 限制购买次数，`purchasedCount` 初始化为 0
 *
 * @param shopConfig - 商店配置
 * @param allItems   - 所有物品模板列表
 * @param rng        - 随机数生成器，默认 `defaultRng`。传入确定性 RNG 可复现商品列表
 * @returns 生成的商品列表，物品池为空时返回空数组
 */
export function generateShopItems(shopConfig: ShopConfig, allItems: Item[], rng: Rng = defaultRng): ShopItem[] {
  const allowedTypes = SHOP_TYPE_ITEM_TYPE_MAP[shopConfig.type];

  // 筛选出该商店可售类型的物品模板
  const availableItems = allItems.filter(item => allowedTypes.includes(item.type));

  // 随机选择 6-12 件商品
  const count = Math.min(rng.int(6, 12), availableItems.length);
  // BIZ-8：使用 Fisher-Yates 洗牌算法，避免 sort(random) 分布不均匀（阶段十二：复用 rng.shuffle）
  const shuffled = rng.shuffle(availableItems);
  const selected = shuffled.slice(0, count);

  // 生成商品列表
  return selected.map(item => {
    const shopItem: ShopItem = {
      itemId: item.id,
      price: calculatePrice(item, true),
      quantity: Math.max(1, rng.int(1, 5)),
    };
    // BIZ-21：为稀有及以上商品设置购买次数上限，防止玩家囤积稀有物品
    const maxPurchaseCount = getMaxPurchaseCount(item.rarity);
    if (maxPurchaseCount !== undefined) {
      shopItem.maxPurchaseCount = maxPurchaseCount;
      shopItem.purchasedCount = 0;
    }
    return shopItem;
  });
}

/**
 * 根据稀有度返回购买次数上限（BIZ-21）
 *
 * 稀有及以上商品限制购买次数，防止玩家囤积稀有物品：
 * - rare（稀有）     : 5 次
 * - epic（史诗）     : 3 次
 * - legendary（传说）: 1 次
 * - 其他             : 不限制（返回 undefined）
 *
 * @param rarity - 物品稀有度
 * @returns 购买次数上限，未定义表示不限制
 */
function getMaxPurchaseCount(rarity: string): number | undefined {
  const limits: Record<string, number> = {
    rare: 5,
    epic: 3,
    legendary: 1,
  };
  return limits[rarity];
}
