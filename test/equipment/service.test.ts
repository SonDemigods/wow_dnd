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
 * 7. countSetPieces / getSetPieceCount —— 套装件数统计
 * 8. getActiveSetBonuses —— 激活的套装奖励
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
  countSetPieces,
  getSetPieceCount,
  getActiveSetBonuses,
} from '@/modules/equipment/service';
import type { EquipmentItem, EquippedItem, EquipmentSlot } from '@/modules/equipment/types';

/** 构造测试用 EquipmentItem */
function makeItem(overrides: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'item_w1',
    name: '测试武器',
    type: 'weapon',
    rarity: 'common',
    icon: 'game-icons:sword',
    description: '测试用',
    value: 10,
    stackable: false,
    slots: ['weapon1'],
    bonus: { str: 5 },
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
  it('包含 6 个槽位', () => {
    expect(ALL_EQUIPMENT_SLOTS).toHaveLength(6);
  });

  it('包含 weapon1 / weapon2 两个武器槽', () => {
    expect(ALL_EQUIPMENT_SLOTS).toContain('weapon1');
    expect(ALL_EQUIPMENT_SLOTS).toContain('weapon2');
  });

  it('包含 armor1-4 四个护甲槽', () => {
    expect(ALL_EQUIPMENT_SLOTS).toContain('armor1');
    expect(ALL_EQUIPMENT_SLOTS).toContain('armor2');
    expect(ALL_EQUIPMENT_SLOTS).toContain('armor3');
    expect(ALL_EQUIPMENT_SLOTS).toContain('armor4');
  });
});

describe('createEmptySlotMap 空槽位映射', () => {
  it('为所有 6 个槽位生成键', () => {
    const map = createEmptySlotMap<string | null>(null);
    expect(Object.keys(map)).toHaveLength(6);
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
    expect(validateSlot(weapon, 'armor1')).toBe(false);
  });

  it('护甲匹配护甲槽时返回 true', () => {
    const armor = makeItem({ type: 'armor', slots: ['armor1'] });
    expect(validateSlot(armor, 'armor1')).toBe(true);
  });

  it('护甲不匹配武器槽时返回 false', () => {
    const armor = makeItem({ type: 'armor', slots: ['armor1'] });
    expect(validateSlot(armor, 'weapon1')).toBe(false);
  });

  it('装备 slots 不包含目标槽位时返回 false（类型匹配但槽位不兼容）', () => {
    const weapon = makeItem({ type: 'weapon', slots: ['weapon1'] });
    expect(validateSlot(weapon, 'weapon2')).toBe(false);
  });

  it('双持武器同时兼容 weapon1 和 weapon2', () => {
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
    const weapon = makeItem({ type: 'weapon', slots: ['armor1'] });
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

describe('countSetPieces / getSetPieceCount 套装件数统计', () => {
  it('无套装装备时返回空 Map', () => {
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeItem({ setId: undefined }));
    const counts = countSetPieces(equipment);
    expect(counts.size).toBe(0);
  });

  it('统计同 setId 的装备件数', () => {
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeItem({ id: 'a', setId: 'warrior_might' }));
    equipment.armor1 = makeEquipped(makeItem({ id: 'b', type: 'armor', slots: ['armor1'], setId: 'warrior_might' }));
    const counts = countSetPieces(equipment);
    expect(counts.get('warrior_might')).toBe(2);
  });

  it('不同 setId 分别统计', () => {
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeItem({ id: 'a', setId: 'set_a' }));
    equipment.armor1 = makeEquipped(makeItem({ id: 'b', type: 'armor', slots: ['armor1'], setId: 'set_b' }));
    const counts = countSetPieces(equipment);
    expect(counts.get('set_a')).toBe(1);
    expect(counts.get('set_b')).toBe(1);
  });

  it('getSetPieceCount 返回指定套装件数，不存在时返回 0', () => {
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeItem({ setId: 'warrior_might' }));
    expect(getSetPieceCount(equipment, 'warrior_might')).toBe(1);
    expect(getSetPieceCount(equipment, 'not_exist')).toBe(0);
  });
});

describe('getActiveSetBonuses 激活套装奖励', () => {
  it('穿戴件数达到 requiredPieces 时激活奖励', () => {
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeItem({ id: 'a', setId: 'warrior_might' }));
    equipment.armor1 = makeEquipped(makeItem({ id: 'b', type: 'armor', slots: ['armor1'], setId: 'warrior_might' }));
    const bonuses = getActiveSetBonuses(equipment);
    expect(bonuses).toHaveLength(1);
    expect(bonuses[0].setId).toBe('warrior_might');
    expect(bonuses[0].setName).toBe('力量套装');
    expect(bonuses[0].piecesEquipped).toBe(2);
    expect(bonuses[0].bonus.requiredPieces).toBe(2);
  });

  it('穿戴件数未达到 requiredPieces 时不激活奖励', () => {
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeItem({ setId: 'warrior_might' }));
    const bonuses = getActiveSetBonuses(equipment);
    expect(bonuses).toHaveLength(0);
  });

  it('无套装装备时返回空数组', () => {
    expect(getActiveSetBonuses(emptyEquipment())).toEqual([]);
  });

  it('setId 在 ITEM_SETS 中不存在时不返回奖励', () => {
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(makeItem({ setId: 'unknown_set' }));
    equipment.armor1 = makeEquipped(makeItem({ type: 'armor', slots: ['armor1'], setId: 'unknown_set' }));
    expect(getActiveSetBonuses(equipment)).toEqual([]);
  });
});
