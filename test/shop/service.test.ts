/**
 * @fileoverview 商店模块服务函数单元测试
 * @description 测试价格计算、出售价计算、金币校验、商品生成等纯函数
 */
import { describe, it, expect } from 'vitest';
import {
  SHOP_TYPE_ITEM_TYPE_MAP,
  calculatePrice,
  computeSellPrice,
  canAffordItem,
  generateShopItems,
} from '@/modules/shop/service';
import type { ShopConfig, ShopType } from '@/modules/shop/types';
import type { Item, ItemRarity } from '@/modules/inventory/types';
import type { Character } from '@/modules/character/types';
import { RARITY_PRICE_MULTIPLIER, RARITY_SELL_DISCOUNT } from '@/config/inventory';

/** 创建测试用物品模板 */
function makeItem(overrides: Partial<Item> = {}): Item {
  return {
    id: 'item_001',
    name: '测试物品',
    type: 'potion',
    rarity: 'common',
    icon: 'game-icons:potion',
    description: '测试用物品',
    value: 100,
    stackable: true,
    ...overrides,
  };
}

/** 创建测试用商店配置 */
function makeShopConfig(overrides: Partial<ShopConfig> = {}): ShopConfig {
  return {
    id: 'shop_001',
    name: '测试商店',
    type: 'potion',
    icon: 'game-icons:shop',
    refreshInterval: 0,
    ...overrides,
  };
}

/** 创建测试用角色（仅包含 gold 字段，canAffordItem 只访问 gold） */
function makeCharacter(gold: number): Character {
  return { gold } as unknown as Character;
}

describe('SHOP_TYPE_ITEM_TYPE_MAP', () => {
  it('包含所有商店类型的物品类型映射', () => {
    const expectedTypes: ShopType[] = ['general', 'potion', 'scroll', 'food', 'material', 'equipment'];
    for (const type of expectedTypes) {
      expect(SHOP_TYPE_ITEM_TYPE_MAP[type]).toBeDefined();
      expect(Array.isArray(SHOP_TYPE_ITEM_TYPE_MAP[type])).toBe(true);
    }
  });

  it('general 商店可售药水、卷轴、食物、材料', () => {
    expect(SHOP_TYPE_ITEM_TYPE_MAP.general).toEqual(
      expect.arrayContaining(['potion', 'scroll', 'food', 'material'])
    );
  });

  it('potion 商店只售药水', () => {
    expect(SHOP_TYPE_ITEM_TYPE_MAP.potion).toEqual(['potion']);
  });

  it('equipment 商店可售武器和护甲', () => {
    expect(SHOP_TYPE_ITEM_TYPE_MAP.equipment).toEqual(
      expect.arrayContaining(['weapon', 'armor'])
    );
  });
});

describe('calculatePrice', () => {
  it('普通稀有度倍率为 1', () => {
    const item = makeItem({ value: 100, rarity: 'common' });
    expect(calculatePrice(item)).toBe(100);
  });

  it('优秀稀有度倍率为 2.5（读取 RARITY_PRICE_MULTIPLIER）', () => {
    const item = makeItem({ value: 100, rarity: 'uncommon' });
    expect(calculatePrice(item)).toBe(250);
  });

  it('稀有稀有度倍率为 5', () => {
    const item = makeItem({ value: 100, rarity: 'rare' });
    expect(calculatePrice(item)).toBe(500);
  });

  it('史诗稀有度倍率为 15（读取 RARITY_PRICE_MULTIPLIER）', () => {
    const item = makeItem({ value: 100, rarity: 'epic' });
    expect(calculatePrice(item)).toBe(1500);
  });

  it('传说稀有度倍率为 50（读取 RARITY_PRICE_MULTIPLIER）', () => {
    const item = makeItem({ value: 100, rarity: 'legendary' });
    expect(calculatePrice(item)).toBe(5000);
  });

  it('出售价按 RARITY_SELL_DISCOUNT 折扣计算（uncommon=0.4）', () => {
    const item = makeItem({ value: 100, rarity: 'uncommon' });
    // 购买价 = 100 * 2.5 = 250，出售价 = 250 * 0.4 = 100
    expect(calculatePrice(item, false)).toBe(100);
  });

  it('出售价按 RARITY_SELL_DISCOUNT 折扣计算（rare=0.35）', () => {
    const item = makeItem({ value: 100, rarity: 'rare' });
    // 购买价 = 100 * 5 = 500，出售价 = 500 * 0.35 = 175
    expect(calculatePrice(item, false)).toBe(175);
  });

  it('出售价按 RARITY_SELL_DISCOUNT 折扣计算（epic=0.3）', () => {
    const item = makeItem({ value: 100, rarity: 'epic' });
    // 购买价 = 100 * 15 = 1500，出售价 = 1500 * 0.3 = 450
    expect(calculatePrice(item, false)).toBe(450);
  });

  it('出售价按 RARITY_SELL_DISCOUNT 折扣计算（legendary=0.25）', () => {
    const item = makeItem({ value: 100, rarity: 'legendary' });
    // 购买价 = 100 * 50 = 5000，出售价 = 5000 * 0.25 = 1250
    expect(calculatePrice(item, false)).toBe(1250);
  });

  it('未识别的稀有度使用默认倍率 1.0', () => {
    const item = makeItem({ value: 100, rarity: 'unknown' as ItemRarity });
    expect(calculatePrice(item)).toBe(100);
  });

  it('未识别的稀有度出售价使用默认折扣 0.5', () => {
    const item = makeItem({ value: 100, rarity: 'unknown' as ItemRarity });
    // 购买价 = 100 * 1.0 = 100，出售价 = 100 * 0.5 = 50
    expect(calculatePrice(item, false)).toBe(50);
  });

  it('value 为 0 时价格返回 0', () => {
    const item = makeItem({ value: 0 });
    expect(calculatePrice(item)).toBe(0);
  });

  it('value 未定义时按 0 处理', () => {
    const item = makeItem({ value: undefined as unknown as number });
    expect(calculatePrice(item)).toBe(0);
  });

  it('四舍五入取整（Math.round）', () => {
    // 33 * 2.5 = 82.5 → Math.round(82.5) = 83
    const item = makeItem({ value: 33, rarity: 'uncommon' });
    expect(calculatePrice(item)).toBe(83);
  });
});

describe('calculatePrice 与 config 常量联动', () => {
  // P3-158 验证：calculatePrice 输出必须与 RARITY_PRICE_MULTIPLIER / RARITY_SELL_DISCOUNT 一致，
  // 证明 service 层无硬编码，平衡性调整只需改 config。
  it('购买价 = Math.round(value × RARITY_PRICE_MULTIPLIER)', () => {
    const rarities: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    for (const rarity of rarities) {
      const item = makeItem({ value: 100, rarity });
      const expected = Math.round(100 * RARITY_PRICE_MULTIPLIER[rarity]);
      expect(calculatePrice(item, true)).toBe(expected);
    }
  });

  it('出售价 = Math.round(购买价 × RARITY_SELL_DISCOUNT)', () => {
    const rarities: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    for (const rarity of rarities) {
      const item = makeItem({ value: 100, rarity });
      const buyPrice = Math.round(100 * RARITY_PRICE_MULTIPLIER[rarity]);
      const expected = Math.round(buyPrice * RARITY_SELL_DISCOUNT[rarity]);
      expect(calculatePrice(item, false)).toBe(expected);
    }
  });

  it('修改 config 常量后 calculatePrice 输出随之变化（证明无硬编码）', async () => {
    const item = makeItem({ value: 100, rarity: 'epic' });
    // 修改前：100 * 15 = 1500
    expect(calculatePrice(item, true)).toBe(1500);

    // 临时修改 config 常量
    const original = RARITY_PRICE_MULTIPLIER.epic;
    RARITY_PRICE_MULTIPLIER.epic = 20;
    try {
      // 修改后：100 * 20 = 2000
      expect(calculatePrice(item, true)).toBe(2000);
    } finally {
      // 恢复原值，避免污染其他测试
      RARITY_PRICE_MULTIPLIER.epic = original;
    }
    // 恢复后回到原值
    expect(calculatePrice(item, true)).toBe(1500);
  });
});

describe('computeSellPrice', () => {
  it('等于购买价 × RARITY_SELL_DISCOUNT', () => {
    const item = makeItem({ value: 100, rarity: 'rare' });
    const buyPrice = calculatePrice(item, true);
    expect(computeSellPrice(item)).toBe(Math.round(buyPrice * RARITY_SELL_DISCOUNT.rare));
  });

  it('传说物品出售价（legendary 折扣 0.25）', () => {
    const item = makeItem({ value: 100, rarity: 'legendary' });
    // 购买价 = 100 * 50 = 5000，出售价 = 5000 * 0.25 = 1250
    expect(computeSellPrice(item)).toBe(1250);
  });
});

describe('canAffordItem', () => {
  it('金币足够时返回 true', () => {
    const character = makeCharacter(500);
    expect(canAffordItem(character, 100)).toBe(true);
  });

  it('金币刚好等于价格时返回 true', () => {
    const character = makeCharacter(100);
    expect(canAffordItem(character, 100)).toBe(true);
  });

  it('金币不足时返回 false', () => {
    const character = makeCharacter(50);
    expect(canAffordItem(character, 100)).toBe(false);
  });

  it('金币为 0 时返回 false（当价格 > 0）', () => {
    const character = makeCharacter(0);
    expect(canAffordItem(character, 1)).toBe(false);
  });

  it('价格为 0 时始终返回 true', () => {
    const character = makeCharacter(0);
    expect(canAffordItem(character, 0)).toBe(true);
  });

  it('gold 为 undefined 时按 0 处理', () => {
    const character = { gold: undefined } as unknown as Character;
    expect(canAffordItem(character, 1)).toBe(false);
  });
});

describe('generateShopItems', () => {
  it('返回的商品类型与商店配置匹配', () => {
    const shop = makeShopConfig({ type: 'potion' });
    const items = [
      makeItem({ id: 'p1', type: 'potion' }),
      makeItem({ id: 'w1', type: 'weapon' }),
    ];
    const shopItems = generateShopItems(shop, items);
    expect(shopItems.every(si => si.itemId === 'p1')).toBe(true);
  });

  it('general 商店可售多种类型物品', () => {
    const shop = makeShopConfig({ type: 'general' });
    const items = [
      makeItem({ id: 'p1', type: 'potion' }),
      makeItem({ id: 's1', type: 'scroll' }),
      makeItem({ id: 'f1', type: 'food' }),
      makeItem({ id: 'm1', type: 'material' }),
    ];
    const shopItems = generateShopItems(shop, items);
    const itemIds = shopItems.map(si => si.itemId);
    // 全部 4 件物品都应在商品列表中（因为商品池只有 4 件）
    expect(itemIds).toEqual(expect.arrayContaining(['p1', 's1', 'f1', 'm1']));
  });

  it('物品池为空时返回空数组', () => {
    const shop = makeShopConfig();
    expect(generateShopItems(shop, [])).toEqual([]);
  });

  it('商品数量不超过物品池大小', () => {
    const shop = makeShopConfig();
    const items = [
      makeItem({ id: 'p1', type: 'potion' }),
      makeItem({ id: 'p2', type: 'potion' }),
    ];
    const shopItems = generateShopItems(shop, items);
    expect(shopItems.length).toBeLessThanOrEqual(2);
  });

  it('商品数量在 6-12 范围内（当物品池充足时）', () => {
    const shop = makeShopConfig();
    const items = Array.from({ length: 20 }, (_, i) =>
      makeItem({ id: `p${i}`, type: 'potion' })
    );
    const shopItems = generateShopItems(shop, items);
    expect(shopItems.length).toBeGreaterThanOrEqual(6);
    expect(shopItems.length).toBeLessThanOrEqual(12);
  });

  it('每件商品包含 itemId、price、quantity 字段', () => {
    const shop = makeShopConfig();
    const items = [makeItem({ id: 'p1', type: 'potion', value: 100, rarity: 'common' })];
    const shopItems = generateShopItems(shop, items);
    expect(shopItems[0].itemId).toBe('p1');
    expect(typeof shopItems[0].price).toBe('number');
    expect(typeof shopItems[0].quantity).toBe('number');
    expect(shopItems[0].quantity).toBeGreaterThanOrEqual(1);
  });

  it('稀有及以上商品携带 maxPurchaseCount 和 purchasedCount', () => {
    const shop = makeShopConfig({ type: 'general' });
    const items = [
      makeItem({ id: 'rare1', type: 'potion', rarity: 'rare', value: 100 }),
    ];
    const shopItems = generateShopItems(shop, items);
    expect(shopItems[0].maxPurchaseCount).toBe(5);
    expect(shopItems[0].purchasedCount).toBe(0);
  });

  it('史诗商品 maxPurchaseCount 为 3', () => {
    const shop = makeShopConfig({ type: 'general' });
    const items = [
      makeItem({ id: 'epic1', type: 'potion', rarity: 'epic', value: 100 }),
    ];
    const shopItems = generateShopItems(shop, items);
    expect(shopItems[0].maxPurchaseCount).toBe(3);
  });

  it('传说商品 maxPurchaseCount 为 1', () => {
    const shop = makeShopConfig({ type: 'general' });
    const items = [
      makeItem({ id: 'leg1', type: 'potion', rarity: 'legendary', value: 100 }),
    ];
    const shopItems = generateShopItems(shop, items);
    expect(shopItems[0].maxPurchaseCount).toBe(1);
  });

  it('普通和优秀商品不携带 maxPurchaseCount', () => {
    const shop = makeShopConfig({ type: 'general' });
    const items = [
      makeItem({ id: 'c1', type: 'potion', rarity: 'common', value: 100 }),
      makeItem({ id: 'u1', type: 'scroll', rarity: 'uncommon', value: 100 }),
    ];
    const shopItems = generateShopItems(shop, items);
    for (const si of shopItems) {
      expect(si.maxPurchaseCount).toBeUndefined();
    }
  });

  // P3-161：装备商店用例
  it('equipment 商店正确上架武器和护甲', () => {
    const shop = makeShopConfig({ type: 'equipment' });
    const items = [
      makeItem({ id: 'w1', type: 'weapon', rarity: 'common', value: 100 }),
      makeItem({ id: 'a1', type: 'armor', rarity: 'common', value: 100 }),
    ];
    const shopItems = generateShopItems(shop, items);
    const itemIds = shopItems.map(si => si.itemId);
    expect(itemIds).toEqual(expect.arrayContaining(['w1', 'a1']));
  });

  it('equipment 商店不会上架药水/卷轴等消耗品', () => {
    const shop = makeShopConfig({ type: 'equipment' });
    const items = [
      makeItem({ id: 'w1', type: 'weapon', rarity: 'common', value: 100 }),
      makeItem({ id: 'p1', type: 'potion', rarity: 'common', value: 100 }),
      makeItem({ id: 's1', type: 'scroll', rarity: 'common', value: 100 }),
      makeItem({ id: 'f1', type: 'food', rarity: 'common', value: 100 }),
      makeItem({ id: 'm1', type: 'material', rarity: 'common', value: 100 }),
    ];
    const shopItems = generateShopItems(shop, items);
    // 装备商店只应上架 weapon，potion/scroll/food/material 均被过滤
    const itemIds = shopItems.map(si => si.itemId);
    expect(itemIds).toContain('w1');
    expect(itemIds).not.toContain('p1');
    expect(itemIds).not.toContain('s1');
    expect(itemIds).not.toContain('f1');
    expect(itemIds).not.toContain('m1');
  });
});
