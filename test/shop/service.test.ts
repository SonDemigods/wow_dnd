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
import type { Item, ItemRarity, ItemType } from '@/modules/inventory/types';
import type { Character } from '@/modules/character/types';

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
    const expectedTypes: ShopType[] = ['general', 'potion', 'scroll', 'food', 'material'];
    for (const type of expectedTypes) {
      expect(SHOP_TYPE_ITEM_TYPE_MAP[type]).toBeDefined();
      expect(Array.isArray(SHOP_TYPE_ITEM_TYPE_MAP[type])).toBe(true);
    }
  });

  it('general 商店可售武器、护甲、材料、杂物', () => {
    expect(SHOP_TYPE_ITEM_TYPE_MAP.general).toEqual(
      expect.arrayContaining(['weapon', 'armor', 'material', 'misc'])
    );
  });

  it('potion 商店只售药水', () => {
    expect(SHOP_TYPE_ITEM_TYPE_MAP.potion).toEqual(['potion']);
  });
});

describe('calculatePrice', () => {
  it('普通稀有度倍率为 1.0', () => {
    const item = makeItem({ value: 100, rarity: 'common' });
    expect(calculatePrice(item)).toBe(100);
  });

  it('优秀稀有度倍率为 2.0', () => {
    const item = makeItem({ value: 100, rarity: 'uncommon' });
    expect(calculatePrice(item)).toBe(200);
  });

  it('稀有稀有度倍率为 5.0', () => {
    const item = makeItem({ value: 100, rarity: 'rare' });
    expect(calculatePrice(item)).toBe(500);
  });

  it('史诗稀有度倍率为 10.0', () => {
    const item = makeItem({ value: 100, rarity: 'epic' });
    expect(calculatePrice(item)).toBe(1000);
  });

  it('传说稀有度倍率为 20.0', () => {
    const item = makeItem({ value: 100, rarity: 'legendary' });
    expect(calculatePrice(item)).toBe(2000);
  });

  it('出售价为购买价的一半（向下取整）', () => {
    const item = makeItem({ value: 100, rarity: 'uncommon' });
    expect(calculatePrice(item, false)).toBe(100); // 200 * 0.5 = 100
  });

  it('未识别的稀有度使用默认倍率 1.0', () => {
    const item = makeItem({ value: 100, rarity: 'unknown' as ItemRarity });
    expect(calculatePrice(item)).toBe(100);
  });

  it('value 为 0 时价格返回 0', () => {
    const item = makeItem({ value: 0 });
    expect(calculatePrice(item)).toBe(0);
  });

  it('value 未定义时按 0 处理', () => {
    const item = makeItem({ value: undefined as unknown as number });
    expect(calculatePrice(item)).toBe(0);
  });

  it('四舍五入取整', () => {
    // 33 * 2.0 = 66（无小数）
    const item = makeItem({ value: 33, rarity: 'uncommon' });
    expect(calculatePrice(item)).toBe(66);
  });
});

describe('computeSellPrice', () => {
  it('等于购买价的一半', () => {
    const item = makeItem({ value: 100, rarity: 'rare' });
    const buyPrice = calculatePrice(item, true);
    expect(computeSellPrice(item)).toBe(Math.round(buyPrice * 0.5));
  });

  it('传说物品出售价', () => {
    const item = makeItem({ value: 100, rarity: 'legendary' });
    // 购买价 = 100 * 20 = 2000，出售价 = 2000 * 0.5 = 1000
    expect(computeSellPrice(item)).toBe(1000);
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
      makeItem({ id: 'w1', type: 'weapon' }),
      makeItem({ id: 'a1', type: 'armor' }),
      makeItem({ id: 'm1', type: 'material' }),
      makeItem({ id: 'x1', type: 'misc' }),
    ];
    const shopItems = generateShopItems(shop, items);
    const itemIds = shopItems.map(si => si.itemId);
    // 全部 4 件物品都应在商品列表中（因为商品池只有 4 件）
    expect(itemIds).toEqual(expect.arrayContaining(['w1', 'a1', 'm1', 'x1']));
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
      makeItem({ id: 'rare1', type: 'weapon', rarity: 'rare', value: 100 }),
    ];
    const shopItems = generateShopItems(shop, items);
    expect(shopItems[0].maxPurchaseCount).toBe(5);
    expect(shopItems[0].purchasedCount).toBe(0);
  });

  it('史诗商品 maxPurchaseCount 为 3', () => {
    const shop = makeShopConfig({ type: 'general' });
    const items = [
      makeItem({ id: 'epic1', type: 'weapon', rarity: 'epic', value: 100 }),
    ];
    const shopItems = generateShopItems(shop, items);
    expect(shopItems[0].maxPurchaseCount).toBe(3);
  });

  it('传说商品 maxPurchaseCount 为 1', () => {
    const shop = makeShopConfig({ type: 'general' });
    const items = [
      makeItem({ id: 'leg1', type: 'weapon', rarity: 'legendary', value: 100 }),
    ];
    const shopItems = generateShopItems(shop, items);
    expect(shopItems[0].maxPurchaseCount).toBe(1);
  });

  it('普通和优秀商品不携带 maxPurchaseCount', () => {
    const shop = makeShopConfig({ type: 'general' });
    const items = [
      makeItem({ id: 'c1', type: 'weapon', rarity: 'common', value: 100 }),
      makeItem({ id: 'u1', type: 'armor', rarity: 'uncommon', value: 100 }),
    ];
    const shopItems = generateShopItems(shop, items);
    for (const si of shopItems) {
      expect(si.maxPurchaseCount).toBeUndefined();
    }
  });
});
