/**
 * @fileoverview item 模块类型层单元测试
 *
 * 覆盖：
 * 1. 判别联合类型守卫：isEquipment / isConsumable / isTwoHanded
 * 2. 各物品类别（consumable/material/currency/quest/equipment）的类型构造可用性
 * 3. expectTypeOf 编译期校验：Item 判别联合的 kind 字段收窄
 */
import { describe, it, expect, expectTypeOf } from 'vitest';
import {
  isEquipment,
  isConsumable,
  isTwoHanded,
  type Item,
  type ConsumableItem,
  type MaterialItem,
  type CurrencyItem,
  type QuestItem,
  type EquipmentItem,
  type EquipmentSlot,
  type WeaponGrip,
  type EquipmentSubtype
} from '@/modules/item/types';

// ==================== 测试数据 helper ====================

function makeConsumable(o: Partial<ConsumableItem> = {}): ConsumableItem {
  return {
    id: 'p1',
    name: '生命药水',
    icon: 'game-icons:potion-ball',
    description: '恢复 50 点生命值',
    rarity: 'common',
    value: 10,
    kind: 'consumable',
    subtype: 'potion',
    stackable: true,
    consumable: true,
    effects: [{ type: 'health_restore', value: 50 }],
    useMode: 'instant',
    ...o,
  };
}

function makeMaterial(o: Partial<MaterialItem> = {}): MaterialItem {
  return {
    id: 'm1',
    name: '铁矿',
    icon: 'game-icons:ore',
    description: '常见锻造材料',
    rarity: 'common',
    value: 5,
    kind: 'material',
    stackable: true,
    consumable: false,
    effects: [],
    ...o,
  };
}

function makeCurrency(o: Partial<CurrencyItem> = {}): CurrencyItem {
  return {
    id: 'gold',
    name: '金币',
    icon: 'game-icons:gold-bar',
    description: '通用货币',
    rarity: 'common',
    value: 1,
    kind: 'currency',
    subtype: 'gold',
    stackable: false,
    consumable: false,
    ...o,
  };
}

function makeQuest(o: Partial<QuestItem> = {}): QuestItem {
  return {
    id: 'q1',
    name: '密信',
    icon: 'game-icons:scroll-unfurled',
    description: '一封需要送达的密信',
    rarity: 'rare',
    value: 0,
    kind: 'quest',
    stackable: false,
    consumable: false,
    effects: [],
    ...o,
  };
}

function makeEquipment(o: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'w1',
    name: '铁剑',
    icon: 'game-icons:broadsword',
    description: '一把普通的铁剑',
    rarity: 'common',
    value: 100,
    kind: 'equipment',
    subtype: 'sword',
    grip: 'one_handed',
    stackable: false,
    consumable: false,
    bonus: { str: 5 },
    slots: ['weapon1', 'weapon2'],
    occupies: [],
    ...o,
  };
}

// ==================== isEquipment ====================

describe('isEquipment 类型守卫', () => {
  it('装备物品返回 true', () => {
    expect(isEquipment(makeEquipment())).toBe(true);
  });

  it('消耗品返回 false', () => {
    expect(isEquipment(makeConsumable())).toBe(false);
  });

  it('材料返回 false', () => {
    expect(isEquipment(makeMaterial())).toBe(false);
  });

  it('货币返回 false', () => {
    expect(isEquipment(makeCurrency())).toBe(false);
  });

  it('任务物品返回 false', () => {
    expect(isEquipment(makeQuest())).toBe(false);
  });

  it('守卫后可安全访问装备专有字段（编译期收窄）', () => {
    const item: Item = makeEquipment({ bonus: { str: 8, con: 3 } });
    if (isEquipment(item)) {
      // item 此处收窄为 EquipmentItem，可访问 bonus / slots / grip
      expect(item.bonus.str).toBe(8);
      expect(item.slots).toContain('weapon1');
      expect(item.grip).toBe('one_handed');
    }
  });
});

// ==================== isConsumable ====================

describe('isConsumable 类型守卫', () => {
  it('消耗品返回 true', () => {
    expect(isConsumable(makeConsumable())).toBe(true);
  });

  it('装备返回 false', () => {
    expect(isConsumable(makeEquipment())).toBe(false);
  });

  it('守卫后可安全访问 effects / useMode', () => {
    const item: Item = makeConsumable({ effects: [{ type: 'mana_restore', value: 30 }] });
    if (isConsumable(item)) {
      expect(item.effects).toHaveLength(1);
      expect(item.useMode).toBe('instant');
    }
  });
});

// ==================== isTwoHanded ====================

describe('isTwoHanded 双手武器判定', () => {
  it('双手武器返回 true', () => {
    const greatsword = makeEquipment({ subtype: 'greatsword', grip: 'two_handed' });
    expect(isTwoHanded(greatsword)).toBe(true);
  });

  it('单手武器返回 false', () => {
    expect(isTwoHanded(makeEquipment({ grip: 'one_handed' }))).toBe(false);
  });

  it('副手武器返回 false', () => {
    expect(isTwoHanded(makeEquipment({ subtype: 'shield', grip: 'off_hand' }))).toBe(false);
  });

  it('护甲（无 grip）返回 false', () => {
    const helm = makeEquipment({ subtype: 'helm', grip: undefined, slots: ['helm'] });
    expect(isTwoHanded(helm)).toBe(false);
  });
});

// ==================== 编译期类型校验 ====================

describe('Item 判别联合编译期校验', () => {
  it('Item 联合包含全部 5 个类别', () => {
    expectTypeOf<Item>().toMatchTypeOf<
      | ConsumableItem
      | MaterialItem
      | CurrencyItem
      | QuestItem
      | EquipmentItem
    >();
  });

  it('各子类型均以 kind 为判别字段', () => {
    expectTypeOf<ConsumableItem['kind']>().toEqualTypeOf<'consumable'>();
    expectTypeOf<MaterialItem['kind']>().toEqualTypeOf<'material'>();
    expectTypeOf<CurrencyItem['kind']>().toEqualTypeOf<'currency'>();
    expectTypeOf<QuestItem['kind']>().toEqualTypeOf<'quest'>();
    expectTypeOf<EquipmentItem['kind']>().toEqualTypeOf<'equipment'>();
  });

  it('EquipmentSlot 为 7 槽', () => {
    expectTypeOf<EquipmentSlot>().toEqualTypeOf<
      'weapon1' | 'weapon2' | 'helm' | 'chest' | 'gloves' | 'legs' | 'boots'
    >();
  });

  it('WeaponGrip 为三态', () => {
    expectTypeOf<WeaponGrip>().toEqualTypeOf<'one_handed' | 'off_hand' | 'two_handed'>();
  });

  it('EquipmentSubtype 覆盖武器与护甲子类型', () => {
    // 仅校验存在性，不逐一列举
    expectTypeOf<EquipmentSubtype>().toMatchTypeOf<string>();
  });
});
