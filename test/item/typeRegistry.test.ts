/**
 * @fileoverview item/typeRegistry 单元测试
 *
 * 覆盖：
 * 1. TYPE_REGISTRY 完整性（覆盖全部 ItemKind 与 EquipmentSubtype）
 * 2. lookupTypeMeta：精确匹配 / kind 兜底 / 未注册抛错
 * 3. getItemCategory / getItemDisplayName / getCategoryName
 * 4. CATEGORY_ORDER / CATEGORY_NAMES
 * 5. isEquipment / isConsumable 重新导出
 */
import { describe, it, expect } from 'vitest';
import {
  TYPE_REGISTRY,
  CATEGORY_ORDER,
  CATEGORY_NAMES,
  lookupTypeMeta,
  getItemCategory,
  getItemDisplayName,
  getCategoryName,
  isEquipment,
  isConsumable
} from '@/modules/item/typeRegistry';
import type {
  ItemKind,
  ConsumableItem,
  MaterialItem,
  CurrencyItem,
  QuestItem,
  EquipmentItem
} from '@/modules/item/types';

// ==================== 测试数据 helper ====================

function makeConsumable(o: Partial<ConsumableItem> = {}): ConsumableItem {
  return {
    id: 'p1', name: '药水', icon: '', description: '', rarity: 'common', value: 10,
    kind: 'consumable', subtype: 'potion', stackable: true, consumable: true,
    effects: [], useMode: 'instant', ...o,
  };
}
function makeMaterial(o: Partial<MaterialItem> = {}): MaterialItem {
  return {
    id: 'm1', name: '材料', icon: '', description: '', rarity: 'common', value: 5,
    kind: 'material', stackable: true, consumable: false, effects: [], ...o,
  };
}
function makeCurrency(o: Partial<CurrencyItem> = {}): CurrencyItem {
  return {
    id: 'gold', name: '金币', icon: '', description: '', rarity: 'common', value: 1,
    kind: 'currency', subtype: 'gold', stackable: false, consumable: false, ...o,
  };
}
function makeQuest(o: Partial<QuestItem> = {}): QuestItem {
  return {
    id: 'q1', name: '任务物品', icon: '', description: '', rarity: 'rare', value: 0,
    kind: 'quest', stackable: false, consumable: false, effects: [], ...o,
  };
}
function makeEquipment(o: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'w1', name: '剑', icon: '', description: '', rarity: 'common', value: 100,
    kind: 'equipment', subtype: 'sword', grip: 'one_handed', stackable: false, consumable: false,
    bonus: {}, slots: ['weapon1', 'weapon2'], occupies: [],
    capabilities: ['describable', 'equippable', 'sellable', 'enchantable'], ...o,
  };
}

// ==================== CATEGORY_ORDER / CATEGORY_NAMES ====================

describe('CATEGORY_ORDER / CATEGORY_NAMES', () => {
  it('分类顺序为 消耗品/装备/材料/其他', () => {
    expect(CATEGORY_ORDER).toEqual(['consumable', 'equipment', 'material', 'other']);
  });

  it('分类中文名映射完整', () => {
    expect(CATEGORY_NAMES.consumable).toBe('消耗品');
    expect(CATEGORY_NAMES.equipment).toBe('装备');
    expect(CATEGORY_NAMES.material).toBe('材料');
    expect(CATEGORY_NAMES.other).toBe('其他');
  });

  it('getCategoryName 返回分类中文名', () => {
    expect(getCategoryName('consumable')).toBe('消耗品');
    expect(getCategoryName('equipment')).toBe('装备');
  });
});

// ==================== TYPE_REGISTRY 完整性 ====================

describe('TYPE_REGISTRY 完整性', () => {
  it('覆盖全部 6 个 ItemKind', () => {
    const kinds = new Set(TYPE_REGISTRY.map(m => m.kind));
    const expectedKinds: ItemKind[] = ['consumable', 'material', 'equipment', 'quest', 'currency', 'misc'];
    expectedKinds.forEach(k => expect(kinds.has(k)).toBe(true));
  });

  it('覆盖全部 11 个武器子类型 + 5 个护甲子类型', () => {
    const equipmentSubtypes = TYPE_REGISTRY
      .filter(m => m.kind === 'equipment')
      .map(m => m.subtype) as string[];
    // 11 武器 + 5 护甲 = 16
    expect(equipmentSubtypes).toHaveLength(16);
    ['sword', 'axe', 'hammer', 'dagger', 'staff', 'shield', 'off_dagger',
     'greatsword', 'greataxe', 'greatbow', 'greatstaff',
     'helm', 'chest', 'gloves', 'legs', 'boots'].forEach(st => {
      expect(equipmentSubtypes).toContain(st);
    });
  });

  it('消耗品/装备不可堆叠性正确（消耗品可堆叠，装备不可）', () => {
    const potion = TYPE_REGISTRY.find(m => m.kind === 'consumable' && m.subtype === 'potion');
    expect(potion?.stackable).toBe(true);
    const sword = TYPE_REGISTRY.find(m => m.kind === 'equipment' && m.subtype === 'sword');
    expect(sword?.stackable).toBe(false);
  });
});

// ==================== lookupTypeMeta ====================

describe('lookupTypeMeta 查询', () => {
  it('精确匹配 (kind, subtype)', () => {
    const meta = lookupTypeMeta('consumable', 'potion');
    expect(meta.displayName).toBe('药水');
    expect(meta.category).toBe('consumable');
  });

  it('精确匹配装备子类型', () => {
    expect(lookupTypeMeta('equipment', 'sword').displayName).toBe('剑');
    expect(lookupTypeMeta('equipment', 'greatbow').displayName).toBe('长弓');
    expect(lookupTypeMeta('equipment', 'helm').displayName).toBe('头盔');
  });

  it('无 subtype 的 kind 走兜底匹配', () => {
    expect(lookupTypeMeta('material').displayName).toBe('材料');
    expect(lookupTypeMeta('quest').displayName).toBe('任务物品');
    expect(lookupTypeMeta('misc').displayName).toBe('杂项');
  });

  it('未注册的 subtype 回退到 kind 兜底', () => {
    // material 无 subtype 注册，传任意 subtype 应回退
    const meta = lookupTypeMeta('material', 'anything');
    expect(meta.displayName).toBe('材料');
  });

  it('未注册的 kind 抛出错误', () => {
    expect(() => lookupTypeMeta('unknown_kind' as ItemKind)).toThrow();
  });
});

// ==================== getItemCategory / getItemDisplayName ====================

describe('getItemCategory / getItemDisplayName', () => {
  it('消耗品分类为 consumable', () => {
    expect(getItemCategory(makeConsumable())).toBe('consumable');
    expect(getItemDisplayName(makeConsumable())).toBe('药水');
  });

  it('装备分类为 equipment', () => {
    expect(getItemCategory(makeEquipment())).toBe('equipment');
    expect(getItemDisplayName(makeEquipment())).toBe('剑');
  });

  it('材料分类为 material', () => {
    expect(getItemCategory(makeMaterial())).toBe('material');
    expect(getItemDisplayName(makeMaterial())).toBe('材料');
  });

  it('货币分类为 other', () => {
    expect(getItemCategory(makeCurrency())).toBe('other');
  });

  it('任务物品分类为 other', () => {
    expect(getItemCategory(makeQuest())).toBe('other');
  });

  it('不同装备子类型显示名不同', () => {
    const shield = makeEquipment({ subtype: 'shield' });
    const greatsword = makeEquipment({ subtype: 'greatsword', grip: 'two_handed' });
    expect(getItemDisplayName(shield)).toBe('盾牌');
    expect(getItemDisplayName(greatsword)).toBe('双手剑');
  });
});

// ==================== 重新导出的类型守卫 ====================

describe('isEquipment / isConsumable 重新导出', () => {
  it('isEquipment 对装备返回 true', () => {
    expect(isEquipment(makeEquipment())).toBe(true);
    expect(isEquipment(makeConsumable())).toBe(false);
  });

  it('isConsumable 对消耗品返回 true', () => {
    expect(isConsumable(makeConsumable())).toBe(true);
    expect(isConsumable(makeEquipment())).toBe(false);
  });
});
