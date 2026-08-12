/**
 * @fileoverview 装备模块 service 纯函数单元测试
 *
 * 覆盖范围：
 * 1. ALL_EQUIPMENT_SLOTS / createEmptySlotMap —— 槽位基础设施
 * 2. validateSlot —— 装备与槽位匹配校验（类型匹配 + 槽位兼容）
 * 3. computeEquipBonus —— 装备属性加成计算（含浅拷贝保护）
 * 4. canEquipItem —— 可装备性综合判断
 * 5. getEquipmentBySlot —— 槽位查询（含兜底）
 * 6. checkClassRestriction —— 职业限制校验
 *
 * P3.3b：套装件数统计与激活奖励计算已迁移至 setService.ts，对应测试在 setService.test.ts。
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_EQUIPMENT_SLOTS,
  createEmptySlotMap,
  validateSlot,
  computeEquipBonus,
  canEquipItem,
  getEquipmentBySlot,
  checkClassRestriction,
  isSlotLockedByTwoHanded,
} from '@/modules/equipment/service';
import type { EquipmentItem, EquippedItem, EquipmentSlot } from '@/modules/equipment/types';

/** 构造测试用 EquipmentItem（P3.1：含 subtype/grip/occupies 默认值） */
function makeItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'item_w1',
    name: '测试武器',
    type: 'weapon',
    subtype: 'sword',
    grip: 'one_handed',
    rarity: 'common',
    icon: 'game-icons:sword',
    description: '测试用',
    value: 10,
    stackable: false,
    slots: ['weapon1'],
    occupies: ['weapon1'],
    bonus: { str: 5 },
    capabilities: ['describable', 'equippable', 'sellable', 'enchantable'],
    ...overrides,
  };
}

/** 构造测试用 EquippedItem */
function makeEquipped(item: EquipmentItem, equippedAt = 1000): EquippedItem {
  return { item, equippedAt };
}

/** 构造空装备状态 */
function emptyEquipment(): Record<EquipmentSlot, EquippedItem | null> {
  return createEmptySlotMap<EquippedItem | null>(null);
}

describe('ALL_EQUIPMENT_SLOTS 槽位定义', () => {
  it('包含 7 个槽位', () => {
    expect(ALL_EQUIPMENT_SLOTS).toHaveLength(7);
  });

  it('包含 weapon1 / weapon2 两个武器槽', () => {
    expect(ALL_EQUIPMENT_SLOTS).toContain('weapon1');
    expect(ALL_EQUIPMENT_SLOTS).toContain('weapon2');
  });

  it('包含 5 个护甲部位槽（helm/chest/gloves/legs/boots）', () => {
    expect(ALL_EQUIPMENT_SLOTS).toContain('helm');
    expect(ALL_EQUIPMENT_SLOTS).toContain('chest');
    expect(ALL_EQUIPMENT_SLOTS).toContain('gloves');
    expect(ALL_EQUIPMENT_SLOTS).toContain('legs');
    expect(ALL_EQUIPMENT_SLOTS).toContain('boots');
  });
});

describe('createEmptySlotMap 空槽位映射', () => {
  it('为所有 7 个槽位生成键', () => {
    const map = createEmptySlotMap<string | null>(null);
    expect(Object.keys(map)).toHaveLength(7);
    for (const slot of ALL_EQUIPMENT_SLOTS) {
      expect(map[slot]).toBeNull();
    }
  });

  it('使用传入的默认值填充每个槽位', () => {
    const map = createEmptySlotMap(0);
    for (const slot of ALL_EQUIPMENT_SLOTS) {
      expect(map[slot]).toBe(0);
    }
  });

  it('支持任意类型默认值', () => {
    const map = createEmptySlotMap<boolean>(false);
    expect(map.weapon1).toBe(false);
  });
});

describe('validateSlot 槽位校验', () => {
  it('武器匹配武器槽时返回 true', () => {
    const weapon = makeItem({ type: 'weapon', slots: ['weapon1'] });
    expect(validateSlot(weapon, 'weapon1')).toBe(true);
  });

  it('武器不匹配护甲槽时返回 false', () => {
    const weapon = makeItem({ type: 'weapon', slots: ['weapon1'] });
    expect(validateSlot(weapon, 'helm')).toBe(false);
  });

  it('护甲匹配护甲槽时返回 true', () => {
    const armor = makeItem({ type: 'armor', subtype: 'helm', grip: undefined, slots: ['helm'], occupies: ['helm'] });
    expect(validateSlot(armor, 'helm')).toBe(true);
  });

  it('护甲不匹配武器槽时返回 false', () => {
    const armor = makeItem({ type: 'armor', subtype: 'helm', grip: undefined, slots: ['helm'], occupies: ['helm'] });
    expect(validateSlot(armor, 'weapon1')).toBe(false);
  });

  it('盾牌（副手武器）只能装副手槽', () => {
    const shield = makeItem({ type: 'weapon', subtype: 'shield', grip: 'off_hand', slots: ['weapon2'], occupies: ['weapon2'] });
    expect(validateSlot(shield, 'weapon2')).toBe(true);
    expect(validateSlot(shield, 'weapon1')).toBe(false);
  });

  it('单手武器同时兼容 weapon1 和 weapon2（subtype=sword）', () => {
    const weapon = makeItem({ type: 'weapon', slots: ['weapon1', 'weapon2'] });
    expect(validateSlot(weapon, 'weapon1')).toBe(true);
    expect(validateSlot(weapon, 'weapon2')).toBe(true);
  });
});

describe('computeEquipBonus 装备属性加成', () => {
  it('返回装备的 bonus 字段', () => {
    const item = makeItem({ bonus: { str: 5, con: 3 } });
    expect(computeEquipBonus(item)).toEqual({ str: 5, con: 3 });
  });

  it('无 bonus 字段时返回空对象', () => {
    const item = makeItem({ bonus: undefined });
    expect(computeEquipBonus(item)).toEqual({});
  });

  it('返回浅拷贝，修改结果不影响原装备', () => {
    const item = makeItem({ bonus: { str: 5 } });
    const result = computeEquipBonus(item);
    result.str = 999;
    expect(item.bonus!.str).toBe(5);
  });
});

describe('canEquipItem 可装备性判断', () => {
  it('有空闲兼容槽位时返回 canEquip=true', () => {
    const weapon = makeItem({ type: 'weapon', slots: ['weapon1'] });
    const result = canEquipItem(weapon, emptyEquipment());
    expect(result.canEquip).toBe(true);
    expect(result.reason).toBe('');
  });

  it('无兼容槽位时返回 canEquip=false', () => {
    const weapon = makeItem({ type: 'weapon', slots: ['helm'] });
    const result = canEquipItem(weapon, emptyEquipment());
    expect(result.canEquip).toBe(false);
    expect(result.reason).toContain('槽位');
  });

  it('所有兼容槽位被占用时返回 canEquip=false', () => {
    const weapon = makeItem({ type: 'weapon', slots: ['weapon1'] });
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(weapon);
    const result = canEquipItem(weapon, equipment);
    expect(result.canEquip).toBe(false);
    expect(result.reason).toContain('占用');
  });

  it('多兼容槽位中有一个空闲时返回 canEquip=true', () => {
    const weapon = makeItem({ type: 'weapon', slots: ['weapon1', 'weapon2'] });
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(weapon);
    const result = canEquipItem(weapon, equipment);
    expect(result.canEquip).toBe(true);
  });
});

describe('getEquipmentBySlot 槽位查询', () => {
  it('返回指定槽位的装备', () => {
    const weapon = makeItem();
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(weapon);
    expect(getEquipmentBySlot(equipment, 'weapon1')).toEqual(makeEquipped(weapon));
  });

  it('空槽位返回 null', () => {
    expect(getEquipmentBySlot(emptyEquipment(), 'weapon1')).toBeNull();
  });
});

describe('checkClassRestriction 职业限制', () => {
  it('无 classRestriction 字段时允许任何职业', () => {
    const item = makeItem({ classRestriction: undefined });
    expect(checkClassRestriction(item, 'warrior')).toBe(true);
    expect(checkClassRestriction(item, 'mage')).toBe(true);
  });

  it('classRestriction 为空数组时允许任何职业', () => {
    const item = makeItem({ classRestriction: [] });
    expect(checkClassRestriction(item, 'warrior')).toBe(true);
  });

  it('职业在限制列表中时允许', () => {
    const item = makeItem({ classRestriction: ['warrior', 'paladin'] });
    expect(checkClassRestriction(item, 'warrior')).toBe(true);
    expect(checkClassRestriction(item, 'paladin')).toBe(true);
  });

  it('职业不在限制列表中时拒绝', () => {
    const item = makeItem({ classRestriction: ['warrior'] });
    expect(checkClassRestriction(item, 'mage')).toBe(false);
  });
});

// ============================================================================
// 套装相关测试已迁移至 test/equipment/setService.test.ts
// ============================================================================

// ============================================================================
// P3.2：双手武器联动测试
// ============================================================================

describe('P3.2 双手武器联动 canEquipItem', () => {
  /** 构造双手武器（greatsword，占主+副两槽） */
  function makeTwoHandedWeapon(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
    return makeItem({
      id: 'two_handed_w',
      name: '双手巨剑',
      subtype: 'greatsword',
      grip: 'two_handed',
      slots: ['weapon1'],
      occupies: ['weapon1', 'weapon2'],
      ...overrides,
    });
  }

  it('双手武器在 weapon1/weapon2 都空闲时可装备', () => {
    const weapon = makeTwoHandedWeapon();
    const result = canEquipItem(weapon, emptyEquipment());
    expect(result.canEquip).toBe(true);
    expect(result.reason).toBe('');
  });

  it('双手武器在 weapon2 已占用时可装备（P11-104：equipItem 自动卸下 weapon2）', () => {
    const weapon = makeTwoHandedWeapon();
    const equipment = emptyEquipment();
    equipment.weapon2 = makeEquipped(makeItem({ id: 'shield', subtype: 'shield', grip: 'off_hand', slots: ['weapon2'], occupies: ['weapon2'] }));
    const result = canEquipItem(weapon, equipment);
    expect(result.canEquip).toBe(true);
    expect(result.reason).toBe('');
  });

  it('双手武器在 weapon1 已占用时不可装备', () => {
    const weapon = makeTwoHandedWeapon();
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeItem({ id: 'old_w' }));
    const result = canEquipItem(weapon, equipment);
    expect(result.canEquip).toBe(false);
    expect(result.reason).toContain('占用');
  });

  it('单手武器在 weapon1 装备双手武器后不可装到 weapon2（被锁定）', () => {
    const oneHanded = makeItem({
      id: 'sword',
      subtype: 'sword',
      grip: 'one_handed',
      slots: ['weapon1', 'weapon2'],
      occupies: ['weapon1'],
    });
    const equipment = emptyEquipment();
    // weapon1 已装备双手武器
    equipment.weapon1 = makeEquipped(makeTwoHandedWeapon({ id: 'two_handed_equipped' }));
    const result = canEquipItem(oneHanded, equipment);
    // weapon1 被占用、weapon2 被锁定 → 无可用槽位
    expect(result.canEquip).toBe(false);
  });

  it('盾牌在 weapon1 装备双手武器后不可装到 weapon2', () => {
    const shield = makeItem({
      id: 'shield',
      subtype: 'shield',
      grip: 'off_hand',
      slots: ['weapon2'],
      occupies: ['weapon2'],
    });
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeTwoHandedWeapon());
    const result = canEquipItem(shield, equipment);
    expect(result.canEquip).toBe(false);
    expect(result.reason).toContain('槽位');
  });
});

describe('P3.2 isSlotLockedByTwoHanded 槽位锁定查询', () => {
  /** 构造双手武器 */
  function makeTwoHandedWeapon(): EquipmentItem {
    return makeItem({
      id: 'two_handed_w',
      subtype: 'greatsword',
      grip: 'two_handed',
      slots: ['weapon1'],
      occupies: ['weapon1', 'weapon2'],
    });
  }

  it('weapon1 无装备时 weapon2 未锁定', () => {
    expect(isSlotLockedByTwoHanded(emptyEquipment(), 'weapon2')).toBe(false);
  });

  it('weapon1 装备单手武器时 weapon2 未锁定', () => {
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeItem({ grip: 'one_handed' }));
    expect(isSlotLockedByTwoHanded(equipment, 'weapon2')).toBe(false);
  });

  it('weapon1 装备双手武器时 weapon2 被锁定', () => {
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeTwoHandedWeapon());
    expect(isSlotLockedByTwoHanded(equipment, 'weapon2')).toBe(true);
  });

  it('非 weapon2 槽位永远不锁定', () => {
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeTwoHandedWeapon());
    expect(isSlotLockedByTwoHanded(equipment, 'weapon1')).toBe(false);
    expect(isSlotLockedByTwoHanded(equipment, 'helm')).toBe(false);
    expect(isSlotLockedByTwoHanded(equipment, 'chest')).toBe(false);
  });
});
