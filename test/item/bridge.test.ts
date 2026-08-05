/**
 * @fileoverview 旧 ItemType → 新 typeRegistry 桥接模块测试
 *
 * 覆盖：
 * 1. oldTypeToKindSubtype：9 种旧 ItemType 到新 ItemKind + subtype 的映射
 * 2. getOldItemTypeDisplayName：展示名查询（weapon/armor 直接映射，其余走 lookupTypeMeta）
 * 3. getOldItemTypeCategory：UI 分类查询
 * 4. isOldEquipmentType：装备类型判断
 * 5. getOldStatName：属性名查询（含未知键兜底）
 */
import { describe, it, expect } from 'vitest';
import {
  oldTypeToKindSubtype,
  getOldItemTypeDisplayName,
  getOldItemTypeCategory,
  isOldEquipmentType,
  getOldStatName
} from '@/modules/item/bridge';
import type { ItemType } from '@/modules/inventory/types';

// ==================== oldTypeToKindSubtype ====================

describe('oldTypeToKindSubtype：旧 ItemType → 新 kind + subtype 映射', () => {
  it('gold → currency/gold', () => {
    expect(oldTypeToKindSubtype('gold')).toEqual({ kind: 'currency', subtype: 'gold' });
  });

  it('potion → consumable/potion', () => {
    expect(oldTypeToKindSubtype('potion')).toEqual({ kind: 'consumable', subtype: 'potion' });
  });

  it('scroll → consumable/scroll', () => {
    expect(oldTypeToKindSubtype('scroll')).toEqual({ kind: 'consumable', subtype: 'scroll' });
  });

  it('food → consumable/food', () => {
    expect(oldTypeToKindSubtype('food')).toEqual({ kind: 'consumable', subtype: 'food' });
  });

  it('material → material（无 subtype）', () => {
    expect(oldTypeToKindSubtype('material')).toEqual({ kind: 'material' });
    expect(oldTypeToKindSubtype('material').subtype).toBeUndefined();
  });

  it('quest → quest（无 subtype）', () => {
    expect(oldTypeToKindSubtype('quest')).toEqual({ kind: 'quest' });
    expect(oldTypeToKindSubtype('quest').subtype).toBeUndefined();
  });

  it('weapon → equipment（无 subtype，旧类型太粗）', () => {
    expect(oldTypeToKindSubtype('weapon')).toEqual({ kind: 'equipment' });
    expect(oldTypeToKindSubtype('weapon').subtype).toBeUndefined();
  });

  it('armor → equipment（无 subtype，旧类型太粗）', () => {
    expect(oldTypeToKindSubtype('armor')).toEqual({ kind: 'equipment' });
    expect(oldTypeToKindSubtype('armor').subtype).toBeUndefined();
  });

  it('misc → misc（无 subtype）', () => {
    expect(oldTypeToKindSubtype('misc')).toEqual({ kind: 'misc' });
    expect(oldTypeToKindSubtype('misc').subtype).toBeUndefined();
  });

  it('覆盖全部 9 种 ItemType（穷尽性检查）', () => {
    const allTypes: ItemType[] = ['gold', 'potion', 'scroll', 'food', 'material', 'quest', 'weapon', 'armor', 'misc'];
    const results = allTypes.map(t => oldTypeToKindSubtype(t).kind);
    expect(results).toHaveLength(9);
    // 每种都有有效的 kind
    results.forEach(k => {
      expect(['consumable', 'material', 'equipment', 'quest', 'currency', 'misc']).toContain(k);
    });
  });
});

// ==================== getOldItemTypeDisplayName ====================

describe('getOldItemTypeDisplayName：旧 ItemType 展示名', () => {
  it('weapon → 武器（旧装备类型直接映射）', () => {
    expect(getOldItemTypeDisplayName('weapon')).toBe('武器');
  });

  it('armor → 护甲（旧装备类型直接映射）', () => {
    expect(getOldItemTypeDisplayName('armor')).toBe('护甲');
  });

  it('gold → 金币（走 lookupTypeMeta）', () => {
    expect(getOldItemTypeDisplayName('gold')).toBe('金币');
  });

  it('potion → 药水（走 lookupTypeMeta）', () => {
    expect(getOldItemTypeDisplayName('potion')).toBe('药水');
  });

  it('scroll → 卷轴（走 lookupTypeMeta）', () => {
    expect(getOldItemTypeDisplayName('scroll')).toBe('卷轴');
  });

  it('food → 食物（走 lookupTypeMeta）', () => {
    expect(getOldItemTypeDisplayName('food')).toBe('食物');
  });

  it('material → 材料（走 lookupTypeMeta）', () => {
    expect(getOldItemTypeDisplayName('material')).toBe('材料');
  });

  it('quest → 任务物品（走 lookupTypeMeta）', () => {
    expect(getOldItemTypeDisplayName('quest')).toBe('任务物品');
  });

  it('misc → 杂项（走 lookupTypeMeta）', () => {
    expect(getOldItemTypeDisplayName('misc')).toBe('杂项');
  });
});

// ==================== getOldItemTypeCategory ====================

describe('getOldItemTypeCategory：旧 ItemType UI 分类', () => {
  it('potion/scroll/food → consumable', () => {
    expect(getOldItemTypeCategory('potion')).toBe('consumable');
    expect(getOldItemTypeCategory('scroll')).toBe('consumable');
    expect(getOldItemTypeCategory('food')).toBe('consumable');
  });

  it('material → material', () => {
    expect(getOldItemTypeCategory('material')).toBe('material');
  });

  it('weapon/armor → equipment', () => {
    expect(getOldItemTypeCategory('weapon')).toBe('equipment');
    expect(getOldItemTypeCategory('armor')).toBe('equipment');
  });

  it('gold/quest/misc → other', () => {
    expect(getOldItemTypeCategory('gold')).toBe('other');
    expect(getOldItemTypeCategory('quest')).toBe('other');
    expect(getOldItemTypeCategory('misc')).toBe('other');
  });
});

// ==================== isOldEquipmentType ====================

describe('isOldEquipmentType：装备类型判断', () => {
  it('weapon → true', () => {
    expect(isOldEquipmentType('weapon')).toBe(true);
  });

  it('armor → true', () => {
    expect(isOldEquipmentType('armor')).toBe(true);
  });

  it('potion → false', () => {
    expect(isOldEquipmentType('potion')).toBe(false);
  });

  it('gold → false', () => {
    expect(isOldEquipmentType('gold')).toBe(false);
  });

  it('misc → false', () => {
    expect(isOldEquipmentType('misc')).toBe(false);
  });

  it('undefined → false（安全处理可选参数）', () => {
    expect(isOldEquipmentType(undefined)).toBe(false);
  });
});

// ==================== getOldStatName ====================

describe('getOldStatName：属性中文名（含兜底）', () => {
  it('str → 力量', () => {
    expect(getOldStatName('str')).toBe('力量');
  });

  it('dex → 敏捷', () => {
    expect(getOldStatName('dex')).toBe('敏捷');
  });

  it('con → 体质', () => {
    expect(getOldStatName('con')).toBe('体质');
  });

  it('int → 智力', () => {
    expect(getOldStatName('int')).toBe('智力');
  });

  it('wis → 感知', () => {
    expect(getOldStatName('wis')).toBe('感知');
  });

  it('cha → 魅力', () => {
    expect(getOldStatName('cha')).toBe('魅力');
  });

  it('未知属性键 → 返回原字符串（兜底）', () => {
    expect(getOldStatName('unknown')).toBe('unknown');
  });

  it('空字符串 → 返回空字符串（兜底）', () => {
    expect(getOldStatName('')).toBe('');
  });
});
