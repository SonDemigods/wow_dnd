/**
 * @fileoverview item/descriptors 单元测试
 *
 * 覆盖：
 * 1. formatStatBonus：属性加成格式化（正负/零/空/顺序）
 * 2. describeEffect：各效果类型描述 + 未注册降级
 * 3. describeItem：装备（单手/双手/职业限制/套装）/ 消耗品 / 材料描述
 * 4. describeSetProgress：套装进度描述（含/不含名称解析器、已激活/下一档）
 * 5. getRarityName / getStatName
 */
import { describe, it, expect } from 'vitest';
import {
  formatStatBonus,
  formatBonus,
  describeEffect,
  describeItem,
  describeSetProgress,
  describeSetBonusEffect,
  getRarityName,
  getStatName,
  type ItemNameResolver
} from '@/modules/item/descriptors';
import type {
  Item,
  ConsumableItem,
  MaterialItem,
  EquipmentItem
} from '@/modules/item/types';
import type { SetProgress } from '@/modules/equipment/setService';
import type { SetBonusEffect } from '@/modules/equipment/setTypes';
import type { ItemEffect } from '@/modules/inventory/types';

// ==================== 测试数据 helper ====================

function makeConsumable(o: Partial<ConsumableItem> = {}): ConsumableItem {
  return {
    id: 'p1', name: '生命药水', icon: '', description: '', rarity: 'common', value: 10,
    kind: 'consumable', subtype: 'potion', stackable: true, consumable: true,
    effects: [{ type: 'health_restore', value: 50 }], useMode: 'instant',
    capabilities: ['describable', 'usable', 'stackable', 'sellable'], ...o,
  };
}

function makeMaterial(o: Partial<MaterialItem> = {}): MaterialItem {
  return {
    id: 'm1', name: '铁矿', icon: '', description: '', rarity: 'common', value: 5,
    kind: 'material', stackable: true, consumable: false, effects: [],
    capabilities: ['describable', 'stackable', 'sellable'], ...o,
  };
}

function makeEquipment(o: Partial<EquipmentItem> = {}): EquipmentItem {
  return {
    id: 'w1', name: '铁剑', icon: '', description: '', rarity: 'common', value: 100,
    kind: 'equipment', subtype: 'sword', grip: 'one_handed', stackable: false, consumable: false,
    bonus: { str: 5 }, slots: ['weapon1', 'weapon2'], occupies: [],
    capabilities: ['describable', 'equippable', 'sellable', 'enchantable'], ...o,
  };
}

// ==================== formatStatBonus ====================

describe('formatStatBonus 属性加成格式化', () => {
  it('正数带 + 前缀', () => {
    expect(formatStatBonus({ str: 5, con: 3 })).toEqual(['力量 +5', '体质 +3']);
  });

  it('负数直接显示', () => {
    expect(formatStatBonus({ str: -2 })).toEqual(['力量 -2']);
  });

  it('零值属性被过滤', () => {
    expect(formatStatBonus({ str: 5, dex: 0 })).toEqual(['力量 +5']);
  });

  it('空对象返回空数组', () => {
    expect(formatStatBonus({})).toEqual([]);
  });

  it('按固定顺序输出（str/dex/con/int/wis/cha）', () => {
    const lines = formatStatBonus({ cha: 1, str: 2, int: 3 });
    expect(lines).toEqual(['力量 +2', '智力 +3', '魅力 +1']);
  });

  it('formatBonus 是 formatStatBonus 的别名', () => {
    expect(formatBonus({ str: 5 })).toEqual(formatStatBonus({ str: 5 }));
  });
});

// ==================== describeEffect ====================

describe('describeEffect 效果描述', () => {
  it('health_restore', () => {
    expect(describeEffect({ type: 'health_restore', value: 50 } as ItemEffect)).toBe('恢复 50 点生命值');
  });

  it('mana_restore', () => {
    expect(describeEffect({ type: 'mana_restore', value: 30 } as ItemEffect)).toBe('恢复 30 点法力值');
  });

  it('physical_damage', () => {
    expect(describeEffect({ type: 'physical_damage', value: 10 } as ItemEffect)).toBe('造成 10 点物理伤害');
  });

  it('magic_damage', () => {
    expect(describeEffect({ type: 'magic_damage', value: 20 } as ItemEffect)).toBe('造成 20 点法术伤害');
  });

  it('stat 多属性用顿号连接', () => {
    expect(describeEffect({ type: 'stat', value: { str: 5, con: 3 } } as ItemEffect)).toBe('力量 +5，体质 +3');
  });

  it('未注册的效果类型降级为 type: value', () => {
    expect(describeEffect({ type: 'unknown_effect', value: 7 } as unknown as ItemEffect)).toBe('unknown_effect: 7');
  });
});

// ==================== describeItem ====================

describe('describeItem 物品描述', () => {
  it('单手武器：稀有度·类型名 + 握持方式 + 可装备槽位 + 属性加成', () => {
    const item: Item = makeEquipment();
    const lines = describeItem(item);
    expect(lines[0]).toBe('普通 · 剑');
    expect(lines).toContain('单手武器');
    expect(lines).toContain('可装备槽位：主手、副手');
    expect(lines).toContain('力量 +5');
    // 单手武器不占用副手，无"占用"提示行
    expect(lines.some(l => l.includes('占用'))).toBe(false);
  });

  it('双手武器：含"双手武器"与"占用：主手 + 副手（双槽）"', () => {
    const item: Item = makeEquipment({
      subtype: 'greatsword', grip: 'two_handed', slots: ['weapon1'], bonus: { str: 55, dex: 35 },
    });
    const lines = describeItem(item);
    expect(lines[0]).toBe('普通 · 双手剑');
    expect(lines).toContain('双手武器');
    expect(lines).toContain('占用：主手 + 副手（双槽）');
    expect(lines).toContain('可装备槽位：主手');
    expect(lines).toContain('力量 +55');
    expect(lines).toContain('敏捷 +35');
  });

  it('装备含职业限制与套装归属', () => {
    const item: Item = makeEquipment({
      classRestriction: ['warrior', 'paladin'], setId: 'warrior_might',
      // C2：套装成员需显式声明 setMember 能力（替代旧 setId 隐式判断）
      capabilities: ['describable', 'equippable', 'setMember', 'sellable', 'enchantable'],
    });
    const lines = describeItem(item);
    expect(lines).toContain('职业限制：warrior、paladin');
    expect(lines).toContain('所属套装：warrior_might');
  });

  it('护甲无 grip 行', () => {
    const item: Item = makeEquipment({
      subtype: 'helm', grip: undefined, slots: ['helm'], bonus: { con: 3 },
    });
    const lines = describeItem(item);
    expect(lines[0]).toBe('普通 · 头盔');
    expect(lines.some(l => l.includes('武器'))).toBe(false);
    expect(lines).toContain('可装备槽位：头部');
  });

  it('消耗品：稀有度·类型名 + 各使用效果', () => {
    const item: Item = makeConsumable({
      effects: [
        { type: 'health_restore', value: 50 },
        { type: 'mana_restore', value: 20 },
      ],
    });
    const lines = describeItem(item);
    expect(lines[0]).toBe('普通 · 药水');
    expect(lines).toContain('恢复 50 点生命值');
    expect(lines).toContain('恢复 20 点法力值');
  });

  it('材料：仅稀有度·类型名行', () => {
    const item: Item = makeMaterial();
    const lines = describeItem(item);
    expect(lines).toEqual(['普通 · 材料']);
  });

  // ==================== C3：复合物品（魔法武器 equippable + usable）====================

  it('C3 法杖：同时展示装备信息与主动技能（复合物品核心价值）', () => {
    // 法杖：equippable + usable 复合，两分支独立触发
    // P3 升级后法杖为双手武器（grip: 'two_handed'，slots: ['weapon1']，占用主+副两槽）
    const item: Item = makeEquipment({
      id: 'oak_staff',
      name: '橡木法杖',
      subtype: 'staff',
      grip: 'two_handed',
      slots: ['weapon1'],
      occupies: ['weapon1', 'weapon2'],
      bonus: { int: 10 },
      capabilities: ['describable', 'equippable', 'usable', 'sellable', 'enchantable'],
      effects: [{ type: 'magic_damage', value: 15 }],
    });
    const lines = describeItem(item);
    // 首行：稀有度 · 类型名
    expect(lines[0]).toBe('普通 · 法杖');
    // equippable 分支：装备信息（双手武器）
    expect(lines).toContain('双手武器');
    expect(lines).toContain('占用：主手 + 副手（双槽）');
    expect(lines).toContain('可装备槽位：主手');
    expect(lines).toContain('智力 +10');
    // usable 分支（equipment 路径）：主动技能
    expect(lines).toContain('主动技能：');
    expect(lines).toContain('造成 15 点法术伤害');
  });

  it('C3 法杖无 effects 时不展示主动技能行', () => {
    // 边界：声明了 usable 能力但 effects 为空/缺省，不应触发主动技能分支
    const item: Item = makeEquipment({
      subtype: 'staff',
      grip: 'two_handed',
      slots: ['weapon1'],
      occupies: ['weapon1', 'weapon2'],
      bonus: { int: 10 },
      capabilities: ['describable', 'equippable', 'usable', 'sellable', 'enchantable'],
      // 无 effects 字段
    });
    const lines = describeItem(item);
    expect(lines.some(l => l.includes('主动技能'))).toBe(false);
  });
});

// ==================== describeSetBonusEffect ====================

describe('describeSetBonusEffect', () => {
  it('使用 description 字段', () => {
    const b: SetBonusEffect = { kind: 'stat', stat: 'str', value: 5, description: '力量 +5' };
    expect(describeSetBonusEffect(b)).toBe('力量 +5');
  });
});

// ==================== describeSetProgress ====================

describe('describeSetProgress 套装进度描述', () => {
  function makeProgress(o: Partial<SetProgress> = {}): SetProgress {
    return {
      setId: 's1',
      setName: '测试套',
      category: 'armor_set',
      totalPieces: 2,
      equippedPieces: 0,
      activeTiers: [],
      nextTier: {
        requiredPieces: 2,
        bonuses: [{ kind: 'stat', stat: 'str', value: 5, description: '2件：力量 +5' }],
      },
      partsStatus: [
        { spec: { slot: 'helm', subtype: 'helm' }, equipped: false, itemId: null },
        { spec: { slot: 'chest', subtype: 'chest' }, equipped: false, itemId: null },
      ],
      ...o,
    };
  }

  it('未穿戴：首行 + 各部件 ○ + 下一档提示', () => {
    const lines = describeSetProgress(makeProgress());
    expect(lines[0]).toBe('测试套（0/2 件）');
    expect(lines).toContain('  ○ 头部');
    expect(lines).toContain('  ○ 胸部');
    expect(lines).toContain('  [还需 2 件] 2件：力量 +5');
  });

  it('已穿戴 2 件：✓ 部件 + 已激活档位，无下一档', () => {
    const progress = makeProgress({
      equippedPieces: 2,
      activeTiers: [{
        requiredPieces: 2,
        bonuses: [{ kind: 'stat', stat: 'str', value: 5, description: '2件：力量 +5' }],
      }],
      nextTier: null,
      partsStatus: [
        { spec: { slot: 'helm', subtype: 'helm' }, equipped: true, itemId: 'h1' },
        { spec: { slot: 'chest', subtype: 'chest' }, equipped: true, itemId: 'c1' },
      ],
    });
    const lines = describeSetProgress(progress);
    expect(lines[0]).toBe('测试套（2/2 件）');
    expect(lines).toContain('  ✓ 头部');
    expect(lines).toContain('  ✓ 胸部');
    expect(lines).toContain('  [已激活 2件] 2件：力量 +5');
    expect(lines.some(l => l.includes('还需'))).toBe(false);
  });

  it('提供名称解析器时部件行展示装备名', () => {
    const progress = makeProgress({
      equippedPieces: 1,
      partsStatus: [
        { spec: { slot: 'helm', subtype: 'helm' }, equipped: true, itemId: 'h1' },
        { spec: { slot: 'chest', subtype: 'chest' }, equipped: false, itemId: null },
      ],
    });
    const resolver: ItemNameResolver = (id) => (id === 'h1' ? '钢铁头盔' : undefined);
    const lines = describeSetProgress(progress, resolver);
    expect(lines).toContain('  ✓ 头部：钢铁头盔');
    // 未穿戴的部件不展示装备名
    expect(lines).toContain('  ○ 胸部');
  });

  it('未提供名称解析器时部件行仅展示槽位名', () => {
    const progress = makeProgress({
      equippedPieces: 1,
      partsStatus: [
        { spec: { slot: 'helm', subtype: 'helm' }, equipped: true, itemId: 'h1' },
      ],
    });
    const lines = describeSetProgress(progress);
    expect(lines).toContain('  ✓ 头部');
    // 不含 "：装备名"
    expect(lines.some(l => l.includes('头部：'))).toBe(false);
  });
});

// ==================== getRarityName / getStatName ====================

describe('getRarityName / getStatName', () => {
  it('getRarityName 返回稀有度中文名', () => {
    expect(getRarityName('common')).toBe('普通');
    expect(getRarityName('rare')).toBe('稀有');
    expect(getRarityName('legendary')).toBe('传说');
  });

  it('getStatName 返回属性中文名', () => {
    expect(getStatName('str')).toBe('力量');
    expect(getStatName('wis')).toBe('感知');
  });
});
