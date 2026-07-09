/**
 * @fileoverview 背包/物品配置常量单元测试
 * @description 验证 @/config/inventory 中配置表的完整性与语义不变量：
 * - ITEM_TYPES：覆盖全部 ItemType、id 与键一致、maxStack 正整数、stackable 与 maxStack 一致
 * - RARITY_CONFIG：覆盖全部 ItemRarity、名称非空、颜色为合法 hex
 * - RARITY_SELL_DISCOUNT：稀有度越高折扣越低（严格递减）
 * - RARITY_PRICE_MULTIPLIER：稀有度越高价格越高（严格递增）
 *
 * 配置表缺失键会导致物品显示异常；单调性反转会破坏经济平衡。
 */
import { describe, it, expect } from 'vitest';
import {
  ITEM_TYPES,
  RARITY_CONFIG,
  RARITY_SELL_DISCOUNT,
  RARITY_PRICE_MULTIPLIER,
} from '@/config/inventory';
import type { ItemType, ItemRarity } from '@/modules/inventory/types';

const EXPECTED_ITEM_TYPES: ItemType[] = [
  'gold', 'potion', 'scroll', 'food', 'material', 'quest', 'weapon', 'armor', 'misc',
];
const EXPECTED_RARITIES: ItemRarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;

describe('ITEM_TYPES 物品类型配置表', () => {
  it('覆盖全部 ItemType 且无多余键', () => {
    const keys = Object.keys(ITEM_TYPES).sort();
    const expected = [...EXPECTED_ITEM_TYPES].sort();
    expect(keys).toEqual(expected);
  });

  it('每条记录 id 与键一致、名称非空、maxStack 为正整数', () => {
    for (const key of EXPECTED_ITEM_TYPES) {
      const data = ITEM_TYPES[key];
      expect(data.id).toBe(key);
      expect(data.name.length).toBeGreaterThan(0);
      expect(Number.isInteger(data.maxStack)).toBe(true);
      expect(data.maxStack).toBeGreaterThan(0);
    }
  });

  it('不可堆叠物品 maxStack = 1', () => {
    for (const key of EXPECTED_ITEM_TYPES) {
      const data = ITEM_TYPES[key];
      if (!data.stackable) {
        expect(data.maxStack).toBe(1);
      }
    }
  });
});

describe('RARITY_CONFIG 稀有度配置表', () => {
  it('覆盖全部 ItemRarity 且无多余键', () => {
    const keys = Object.keys(RARITY_CONFIG).sort();
    const expected = [...EXPECTED_RARITIES].sort();
    expect(keys).toEqual(expected);
  });

  it('每条记录名称非空、颜色为合法 hex', () => {
    for (const r of EXPECTED_RARITIES) {
      const cfg = RARITY_CONFIG[r];
      expect(cfg.name.length).toBeGreaterThan(0);
      expect(HEX_RE.test(cfg.color)).toBe(true);
    }
  });
});

describe('RARITY_SELL_DISCOUNT 出售折扣率', () => {
  it('覆盖全部稀有度', () => {
    for (const r of EXPECTED_RARITIES) {
      expect(RARITY_SELL_DISCOUNT).toHaveProperty(r);
    }
  });

  it('折扣率在 (0, 1] 区间', () => {
    for (const r of EXPECTED_RARITIES) {
      expect(RARITY_SELL_DISCOUNT[r]).toBeGreaterThan(0);
      expect(RARITY_SELL_DISCOUNT[r]).toBeLessThanOrEqual(1);
    }
  });

  it('稀有度越高折扣率越低（严格递减）', () => {
    for (let i = 1; i < EXPECTED_RARITIES.length; i++) {
      expect(RARITY_SELL_DISCOUNT[EXPECTED_RARITIES[i]]).toBeLessThan(
        RARITY_SELL_DISCOUNT[EXPECTED_RARITIES[i - 1]]
      );
    }
  });
});

describe('RARITY_PRICE_MULTIPLIER 价格倍率', () => {
  it('覆盖全部稀有度', () => {
    for (const r of EXPECTED_RARITIES) {
      expect(RARITY_PRICE_MULTIPLIER).toHaveProperty(r);
    }
  });

  it('倍率为正数', () => {
    for (const r of EXPECTED_RARITIES) {
      expect(RARITY_PRICE_MULTIPLIER[r]).toBeGreaterThan(0);
    }
  });

  it('稀有度越高价格倍率越高（严格递增）', () => {
    for (let i = 1; i < EXPECTED_RARITIES.length; i++) {
      expect(RARITY_PRICE_MULTIPLIER[EXPECTED_RARITIES[i]]).toBeGreaterThan(
        RARITY_PRICE_MULTIPLIER[EXPECTED_RARITIES[i - 1]]
      );
    }
  });
});
