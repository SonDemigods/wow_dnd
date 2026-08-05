/**
 * @fileoverview equipment/slotRegistry 单元测试
 *
 * 覆盖：
 * 1. 槽位基础设施：ALL_EQUIPMENT_SLOTS（7 槽）/ SLOT_GROUP / SLOT_CONFIG / createEmptySlotMap
 * 2. 子类型映射表：SUBTYPE_SLOTS / SUBTYPE_OCCUPIES / WEAPON_SUBTYPE_GRIP
 * 3. 派生函数：deriveSlots / deriveGrip / isWeaponSubtype / isArmorSubtype / getOccupiedSlots
 * 4. 校验函数：validateSubtypeSlot / canEquip / getAvailableSlots
 */
import { describe, it, expect } from 'vitest';
import {
  ALL_EQUIPMENT_SLOTS,
  SLOT_GROUP,
  SLOT_CONFIG,
  createEmptySlotMap,
  getSlotGroup,
  SUBTYPE_SLOTS,
  SUBTYPE_OCCUPIES,
  WEAPON_SUBTYPE_GRIP,
  deriveSlots,
  deriveGrip,
  isWeaponSubtype,
  isArmorSubtype,
  getOccupiedSlots,
  validateSubtypeSlot,
  canEquip,
  getAvailableSlots
} from '@/modules/equipment/slotRegistry';
import type { EquipmentItem, EquipmentSlot, EquippedItem, EquipmentState } from '@/modules/item/types';

// ==================== 测试数据 helper ====================

function makeEquipment(o: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'w1',
    name: '测试装备',
    icon: 'game-icons:broadsword',
    description: '测试用',
    rarity: 'common',
    value: 10,
    kind: 'equipment',
    subtype: 'sword',
    grip: 'one_handed',
    stackable: false,
    consumable: false,
    bonus: { str: 5 },
    slots: ['weapon1', 'weapon2'],
    occupies: [],
    capabilities: ['describable', 'equippable', 'sellable', 'enchantable'],
    ...o,
  };
}

function makeEquipped(item: EquipmentItem, equippedAt = 1000): EquippedItem {
  return { item, equippedAt };
}

function emptyEquipment(): EquipmentState {
  return createEmptySlotMap<EquippedItem | null>(null);
}

// ==================== 槽位基础设施 ====================

describe('ALL_EQUIPMENT_SLOTS 槽位定义（7 槽）', () => {
  it('包含 7 个槽位', () => {
    expect(ALL_EQUIPMENT_SLOTS).toHaveLength(7);
  });

  it('包含 weapon1 / weapon2 两个武器槽', () => {
    expect(ALL_EQUIPMENT_SLOTS).toContain('weapon1');
    expect(ALL_EQUIPMENT_SLOTS).toContain('weapon2');
  });

  it('包含 helm/chest/gloves/legs/boots 五个护甲部位槽', () => {
    expect(ALL_EQUIPMENT_SLOTS).toContain('helm');
    expect(ALL_EQUIPMENT_SLOTS).toContain('chest');
    expect(ALL_EQUIPMENT_SLOTS).toContain('gloves');
    expect(ALL_EQUIPMENT_SLOTS).toContain('legs');
    expect(ALL_EQUIPMENT_SLOTS).toContain('boots');
  });

  it('不再包含旧版 armor1-4 槽位', () => {
    expect(ALL_EQUIPMENT_SLOTS).not.toContain('armor1');
    expect(ALL_EQUIPMENT_SLOTS).not.toContain('armor2');
    expect(ALL_EQUIPMENT_SLOTS).not.toContain('armor3');
    expect(ALL_EQUIPMENT_SLOTS).not.toContain('armor4');
  });
});

describe('SLOT_GROUP / getSlotGroup 槽位分组', () => {
  it('武器槽归入 weapon 组', () => {
    expect(SLOT_GROUP.weapon1).toBe('weapon');
    expect(SLOT_GROUP.weapon2).toBe('weapon');
    expect(getSlotGroup('weapon1')).toBe('weapon');
  });

  it('护甲槽归入 armor 组', () => {
    const armorSlots: EquipmentSlot[] = ['helm', 'chest', 'gloves', 'legs', 'boots'];
    armorSlots.forEach(slot => {
      expect(SLOT_GROUP[slot]).toBe('armor');
      expect(getSlotGroup(slot)).toBe('armor');
    });
  });

  it('覆盖全部 7 个槽位', () => {
    expect(Object.keys(SLOT_GROUP)).toHaveLength(7);
  });
});

describe('SLOT_CONFIG 槽位展示配置', () => {
  it('每个槽位都有 name / icon / group', () => {
    for (const slot of ALL_EQUIPMENT_SLOTS) {
      const cfg = SLOT_CONFIG[slot];
      expect(typeof cfg.name).toBe('string');
      expect(cfg.name.length).toBeGreaterThan(0);
      expect(typeof cfg.icon).toBe('string');
      expect(cfg.icon).toContain(':');
      expect(['weapon', 'armor']).toContain(cfg.group);
    }
  });

  it('主手槽名称为"主手"', () => {
    expect(SLOT_CONFIG.weapon1.name).toBe('主手');
  });
});

describe('createEmptySlotMap 空槽位映射（7 槽）', () => {
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
    expect(map.boots).toBe(false);
  });
});

// ==================== 子类型映射表 ====================

describe('SUBTYPE_SLOTS 子类型可装备槽位', () => {
  it('单手武器（剑）可装主手或副手', () => {
    expect(SUBTYPE_SLOTS.sword).toEqual(['weapon1', 'weapon2']);
  });

  it('副手武器（盾牌）只能副手', () => {
    expect(SUBTYPE_SLOTS.shield).toEqual(['weapon2']);
  });

  it('双手武器（双手剑）只能主手', () => {
    expect(SUBTYPE_SLOTS.greatsword).toEqual(['weapon1']);
  });

  it('护甲一部位一槽（修正旧版手套装头部 bug）', () => {
    expect(SUBTYPE_SLOTS.helm).toEqual(['helm']);
    expect(SUBTYPE_SLOTS.chest).toEqual(['chest']);
    expect(SUBTYPE_SLOTS.gloves).toEqual(['gloves']);
    expect(SUBTYPE_SLOTS.legs).toEqual(['legs']);
    expect(SUBTYPE_SLOTS.boots).toEqual(['boots']);
  });

  it('手套不能装头部槽（bug 修复回归）', () => {
    expect(SUBTYPE_SLOTS.gloves).not.toContain('helm');
  });
});

describe('SUBTYPE_OCCUPIES 子类型占用槽位', () => {
  it('双手武器占用主+副两槽', () => {
    expect(SUBTYPE_OCCUPIES.greatsword).toEqual(['weapon1', 'weapon2']);
    expect(SUBTYPE_OCCUPIES.greataxe).toEqual(['weapon1', 'weapon2']);
    expect(SUBTYPE_OCCUPIES.greatbow).toEqual(['weapon1', 'weapon2']);
    expect(SUBTYPE_OCCUPIES.greatstaff).toEqual(['weapon1', 'weapon2']);
  });

  it('非双手武器未列出（occupies = 装备时选定的目标槽）', () => {
    expect(SUBTYPE_OCCUPIES.sword).toBeUndefined();
    expect(SUBTYPE_OCCUPIES.shield).toBeUndefined();
    expect(SUBTYPE_OCCUPIES.helm).toBeUndefined();
  });
});

describe('WEAPON_SUBTYPE_GRIP 武器子类型握持方式', () => {
  it('单手武器子类型 → one_handed', () => {
    expect(WEAPON_SUBTYPE_GRIP.sword).toBe('one_handed');
    expect(WEAPON_SUBTYPE_GRIP.axe).toBe('one_handed');
    expect(WEAPON_SUBTYPE_GRIP.dagger).toBe('one_handed');
    expect(WEAPON_SUBTYPE_GRIP.staff).toBe('one_handed');
  });

  it('副手武器子类型 → off_hand', () => {
    expect(WEAPON_SUBTYPE_GRIP.shield).toBe('off_hand');
    expect(WEAPON_SUBTYPE_GRIP.off_dagger).toBe('off_hand');
  });

  it('双手武器子类型 → two_handed', () => {
    expect(WEAPON_SUBTYPE_GRIP.greatsword).toBe('two_handed');
    expect(WEAPON_SUBTYPE_GRIP.greatbow).toBe('two_handed');
    expect(WEAPON_SUBTYPE_GRIP.greatstaff).toBe('two_handed');
  });

  it('覆盖全部 11 个武器子类型', () => {
    expect(Object.keys(WEAPON_SUBTYPE_GRIP)).toHaveLength(11);
  });
});

// ==================== 派生函数 ====================

describe('deriveSlots / deriveGrip 派生函数', () => {
  it('deriveSlots 返回子类型可装备槽位的拷贝', () => {
    const slots = deriveSlots('sword');
    expect(slots).toEqual(['weapon1', 'weapon2']);
    // 修改返回值不影响映射表
    slots.push('helm' as EquipmentSlot);
    expect(SUBTYPE_SLOTS.sword).toEqual(['weapon1', 'weapon2']);
  });

  it('deriveGrip 武器子类型返回握持方式', () => {
    expect(deriveGrip('sword')).toBe('one_handed');
    expect(deriveGrip('greatbow')).toBe('two_handed');
    expect(deriveGrip('shield')).toBe('off_hand');
  });

  it('deriveGrip 护甲子类型返回 undefined', () => {
    expect(deriveGrip('helm')).toBeUndefined();
    expect(deriveGrip('chest')).toBeUndefined();
  });
});

describe('isWeaponSubtype / isArmorSubtype', () => {
  it('武器子类型判定', () => {
    expect(isWeaponSubtype('sword')).toBe(true);
    expect(isWeaponSubtype('greatsword')).toBe(true);
    expect(isWeaponSubtype('shield')).toBe(true);
  });

  it('护甲子类型判定', () => {
    expect(isArmorSubtype('helm')).toBe(true);
    expect(isArmorSubtype('boots')).toBe(true);
  });

  it('武器不是护甲，护甲不是武器', () => {
    expect(isArmorSubtype('sword')).toBe(false);
    expect(isWeaponSubtype('helm')).toBe(false);
  });
});

describe('getOccupiedSlots 实际占用槽位', () => {
  it('双手武器占主+副两槽（无论目标槽）', () => {
    const greatsword = makeEquipment({ subtype: 'greatsword', grip: 'two_handed', slots: ['weapon1'] });
    expect(getOccupiedSlots(greatsword, 'weapon1')).toEqual(['weapon1', 'weapon2']);
  });

  it('单手武器占目标槽', () => {
    const sword = makeEquipment({ subtype: 'sword', grip: 'one_handed' });
    expect(getOccupiedSlots(sword, 'weapon1')).toEqual(['weapon1']);
    expect(getOccupiedSlots(sword, 'weapon2')).toEqual(['weapon2']);
  });

  it('护甲占目标槽', () => {
    const helm = makeEquipment({ subtype: 'helm', grip: undefined, slots: ['helm'] });
    expect(getOccupiedSlots(helm, 'helm')).toEqual(['helm']);
  });
});

// ==================== 校验函数 ====================

describe('validateSubtypeSlot 子类型槽位校验', () => {
  it('单手剑 + 主手 → true', () => {
    expect(validateSubtypeSlot('sword', 'weapon1')).toBe(true);
  });

  it('单手剑 + 副手 → true', () => {
    expect(validateSubtypeSlot('sword', 'weapon2')).toBe(true);
  });

  it('单手剑 + 头部 → false（武器不能装护甲槽）', () => {
    expect(validateSubtypeSlot('sword', 'helm')).toBe(false);
  });

  it('盾牌 + 主手 → false（副手武器只能副手）', () => {
    expect(validateSubtypeSlot('shield', 'weapon1')).toBe(false);
  });

  it('盾牌 + 副手 → true', () => {
    expect(validateSubtypeSlot('shield', 'weapon2')).toBe(true);
  });

  it('双手剑 + 副手 → false（双手武器只能主手）', () => {
    expect(validateSubtypeSlot('greatsword', 'weapon2')).toBe(false);
  });

  it('头盔 + 头部 → true', () => {
    expect(validateSubtypeSlot('helm', 'helm')).toBe(true);
  });

  it('头盔 + 胸部 → false（一部位一槽）', () => {
    expect(validateSubtypeSlot('helm', 'chest')).toBe(false);
  });
});

describe('canEquip 综合可装备性校验', () => {
  it('单手剑装入空闲主手 → ok', () => {
    const sword = makeEquipment({ subtype: 'sword', grip: 'one_handed' });
    const result = canEquip(sword, emptyEquipment(), 'weapon1');
    expect(result.ok).toBe(true);
    expect(result.reason).toBe('');
  });

  it('子类型不匹配槽位 → 不可装备', () => {
    const sword = makeEquipment({ subtype: 'sword', grip: 'one_handed' });
    const result = canEquip(sword, emptyEquipment(), 'helm');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('不能放入');
  });

  it('目标槽位已被占用 → 不可装备', () => {
    const sword = makeEquipment({ subtype: 'sword', grip: 'one_handed' });
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(sword);
    const result = canEquip(sword, equipment, 'weapon1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('占用');
  });

  it('双手武器主副手都空闲 → ok', () => {
    const greatsword = makeEquipment({ subtype: 'greatsword', grip: 'two_handed', slots: ['weapon1'] });
    const result = canEquip(greatsword, emptyEquipment(), 'weapon1');
    expect(result.ok).toBe(true);
  });

  it('双手武器副手已被占用 → 不可装备', () => {
    const greatsword = makeEquipment({ subtype: 'greatsword', grip: 'two_handed', slots: ['weapon1'] });
    const equipment = emptyEquipment();
    equipment.weapon2 = makeEquipped(makeEquipment({ subtype: 'shield', grip: 'off_hand', slots: ['weapon2'] }));
    const result = canEquip(greatsword, equipment, 'weapon1');
    expect(result.ok).toBe(false);
    expect(result.reason).toContain('双手武器');
  });

  it('盾牌装入空闲副手 → ok', () => {
    const shield = makeEquipment({ subtype: 'shield', grip: 'off_hand', slots: ['weapon2'] });
    const result = canEquip(shield, emptyEquipment(), 'weapon2');
    expect(result.ok).toBe(true);
  });

  it('盾牌装入主手 → 不可装备', () => {
    const shield = makeEquipment({ subtype: 'shield', grip: 'off_hand', slots: ['weapon2'] });
    const result = canEquip(shield, emptyEquipment(), 'weapon1');
    expect(result.ok).toBe(false);
  });
});

describe('getAvailableSlots 可用槽位查询', () => {
  it('单手剑双武器槽空闲 → 返回主+副', () => {
    const sword = makeEquipment({ subtype: 'sword', grip: 'one_handed' });
    expect(getAvailableSlots(sword, emptyEquipment())).toEqual(['weapon1', 'weapon2']);
  });

  it('单手剑主手被占用 → 仅返回副手', () => {
    const sword = makeEquipment({ subtype: 'sword', grip: 'one_handed' });
    const equipment = emptyEquipment();
    equipment.weapon1 = makeEquipped(sword);
    expect(getAvailableSlots(sword, equipment)).toEqual(['weapon2']);
  });

  it('双手剑双槽空闲 → 仅返回主手（双手只能装主手）', () => {
    const greatsword = makeEquipment({ subtype: 'greatsword', grip: 'two_handed', slots: ['weapon1'] });
    expect(getAvailableSlots(greatsword, emptyEquipment())).toEqual(['weapon1']);
  });

  it('双手剑副手被占用 → 返回空数组', () => {
    const greatsword = makeEquipment({ subtype: 'greatsword', grip: 'two_handed', slots: ['weapon1'] });
    const equipment = emptyEquipment();
    equipment.weapon2 = makeEquipped(makeEquipment({ subtype: 'shield', grip: 'off_hand', slots: ['weapon2'] }));
    expect(getAvailableSlots(greatsword, equipment)).toEqual([]);
  });

  it('护甲仅返回对应部位槽', () => {
    const helm = makeEquipment({ subtype: 'helm', grip: undefined, slots: ['helm'] });
    expect(getAvailableSlots(helm, emptyEquipment())).toEqual(['helm']);
  });
});
