/**
 * @fileoverview 装备配置数据单元测试
 *
 * C3 阶段新增：验证法杖复合物品（equippable + usable）配置正确性。
 * 覆盖：10 件法杖存在、capabilities 含 usable+equippable、effects 含 magic_damage 且数值递增、
 * 非法杖装备不受影响（不含 usable、无 effects）。
 *
 * 装备扩充阶段新增：验证每个装备子类型均为 10 件，装备总数为 150 件（15 子类型 × 10）。
 * 新增 POLEARMS（长柄武器）与 HELM_ARMOR（头部护甲）分组测试。
 */
import { describe, it, expect } from 'vitest';
import { EQUIPMENT_ITEMS } from '@/data/config_equipment_items';

describe('装备总数与子类型分布', () => {
  it('装备总数为 150 件（15 个子类型 × 10 件）', () => {
    expect(EQUIPMENT_ITEMS).toHaveLength(150);
  });

  it('每个装备子类型均有 10 件', () => {
    const subtypes = [
      'sword', 'axe', 'hammer', 'dagger', 'staff',
      'greatsword', 'greataxe', 'polearm', 'greatbow', 'shield',
      'helm', 'chest', 'legs', 'boots', 'gloves'
    ] as const;
    subtypes.forEach(subtype => {
      const items = EQUIPMENT_ITEMS.filter(i => i.subtype === subtype);
      expect(items, `子类型 ${subtype} 应有 10 件`).toHaveLength(10);
    });
  });

  it('所有装备 id 唯一', () => {
    const ids = EQUIPMENT_ITEMS.map(i => i.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});

describe('C3 法杖复合物品配置', () => {
  const staves = EQUIPMENT_ITEMS.filter(i => i.subtype === 'staff');
  const staffIds = [
    'oak_staff', 'ash_staff', 'crystal_staff', 'ember_staff', 'arcane_staff',
    'frost_staff', 'jordan_staff', 'nether_staff', 'atiesh', 'cosmos_staff'
  ];

  it('10 件法杖全部存在', () => {
    expect(staves).toHaveLength(10);
    staffIds.forEach(id => {
      expect(staves.find(s => s.id === id)).toBeDefined();
    });
  });

  it('法杖 capabilities 含 usable 与 equippable（复合物品核心标志）', () => {
    staves.forEach(staff => {
      expect(staff.capabilities).toContain('usable');
      expect(staff.capabilities).toContain('equippable');
    });
  });

  it('法杖 effects 含 magic_damage 且数值为正', () => {
    staves.forEach(staff => {
      expect(staff.effects).toBeDefined();
      expect(staff.effects!.length).toBeGreaterThan(0);
      const dmg = staff.effects!.find(e => e.type === 'magic_damage');
      expect(dmg).toBeDefined();
      expect(typeof dmg!.value).toBe('number');
      expect(dmg!.value as number).toBeGreaterThan(0);
    });
  });

  it('法杖 magic_damage 数值按等级递增', () => {
    // 按等级升序排列后验证 magic_damage 严格递增
    const sorted = [...staves].sort((a, b) =>
      (a.levelRequirement ?? 0) - (b.levelRequirement ?? 0));
    const dmgs = sorted.map(s =>
      s.effects!.find(e => e.type === 'magic_damage')!.value as number);
    for (let i = 1; i < dmgs.length; i++) {
      expect(dmgs[i]).toBeGreaterThan(dmgs[i - 1]);
    }
  });

  it('非法杖装备不含 usable 能力（普通装备不受影响）', () => {
    const nonStaves = EQUIPMENT_ITEMS.filter(i => i.subtype !== 'staff');
    nonStaves.forEach(item => {
      expect(item.capabilities).not.toContain('usable');
    });
  });

  it('非法杖装备无 effects 字段（普通装备不污染）', () => {
    const nonStaves = EQUIPMENT_ITEMS.filter(i => i.subtype !== 'staff');
    nonStaves.forEach(item => {
      expect(item.effects).toBeUndefined();
    });
  });
});

describe('POLEARMS 长柄武器分组配置', () => {
  const polearms = EQUIPMENT_ITEMS.filter(i => i.subtype === 'polearm');
  const polearmIds = [
    'wooden_spear', 'iron_spear', 'steel_halberd', 'jagged_pike', 'mithril_spear',
    'rune_polearm', 'dragon_lance', 'void_halberd', 'celestial_spear', 'eternity_polearm'
  ];

  it('10 件长柄武器全部存在', () => {
    expect(polearms).toHaveLength(10);
    polearmIds.forEach(id => {
      expect(polearms.find(p => p.id === id)).toBeDefined();
    });
  });

  it('长柄武器均为双手握持（two_handed）', () => {
    polearms.forEach(p => {
      expect(p.grip).toBe('two_handed');
    });
  });

  it('长柄武器占用主+副两槽（双手武器槽位约束）', () => {
    polearms.forEach(p => {
      expect(p.occupies).toEqual(['weapon1', 'weapon2']);
    });
  });

  it('长柄武器 capabilities 含 equippable 但不含 usable（普通双手武器）', () => {
    polearms.forEach(p => {
      expect(p.capabilities).toContain('equippable');
      expect(p.capabilities).not.toContain('usable');
    });
  });

  it('长柄武器无 effects 字段（普通武器不污染）', () => {
    polearms.forEach(p => {
      expect(p.effects).toBeUndefined();
    });
  });

  it('长柄武器 bonus 含 str 与 dex（力量+敏捷双主属性）', () => {
    polearms.forEach(p => {
      expect(p.bonus.str).toBeGreaterThan(0);
      expect(p.bonus.dex).toBeGreaterThan(0);
    });
  });

  it('长柄武器等级与稀有度梯度完整覆盖 10 档', () => {
    const rarities = polearms.map(p => p.rarity);
    expect(rarities.filter(r => r === 'common')).toHaveLength(2);
    expect(rarities.filter(r => r === 'uncommon')).toHaveLength(2);
    expect(rarities.filter(r => r === 'rare')).toHaveLength(2);
    expect(rarities.filter(r => r === 'epic')).toHaveLength(2);
    expect(rarities.filter(r => r === 'legendary')).toHaveLength(2);
  });
});

describe('HELM_ARMOR 头部护甲分组配置', () => {
  const helms = EQUIPMENT_ITEMS.filter(i => i.subtype === 'helm');
  const helmIds = [
    'leather_cap', 'iron_helm', 'steel_helm', 'knight_helm', 'mithril_helm',
    'rune_helm', 'dragon_helm', 'void_helm', 'crown_of_wisdom', 'eternity_helm'
  ];

  it('10 件头部护甲全部存在', () => {
    expect(helms).toHaveLength(10);
    helmIds.forEach(id => {
      expect(helms.find(h => h.id === id)).toBeDefined();
    });
  });

  it('头部护甲无 grip 字段（护甲不握持）', () => {
    helms.forEach(h => {
      expect(h.grip).toBeUndefined();
    });
  });

  it('头部护甲占用 helm 槽（一部位一槽）', () => {
    helms.forEach(h => {
      expect(h.slots).toEqual(['helm']);
    });
  });

  it('头部护甲 capabilities 含 equippable 但不含 usable', () => {
    helms.forEach(h => {
      expect(h.capabilities).toContain('equippable');
      expect(h.capabilities).not.toContain('usable');
    });
  });

  it('头部护甲无 effects 字段（普通护甲不污染）', () => {
    helms.forEach(h => {
      expect(h.effects).toBeUndefined();
    });
  });

  it('头部护甲 bonus 含 con（体质主属性）', () => {
    helms.forEach(h => {
      expect(h.bonus.con).toBeGreaterThan(0);
    });
  });

  it('头部护甲等级与稀有度梯度完整覆盖 10 档', () => {
    const rarities = helms.map(h => h.rarity);
    expect(rarities.filter(r => r === 'common')).toHaveLength(2);
    expect(rarities.filter(r => r === 'uncommon')).toHaveLength(2);
    expect(rarities.filter(r => r === 'rare')).toHaveLength(2);
    expect(rarities.filter(r => r === 'epic')).toHaveLength(2);
    expect(rarities.filter(r => r === 'legendary')).toHaveLength(2);
  });
});

describe('装备数值梯度一致性', () => {
  it('每件装备的 value 为正数', () => {
    EQUIPMENT_ITEMS.forEach(item => {
      expect(item.value).toBeGreaterThan(0);
    });
  });

  it('每件装备的 levelRequirement 为正数', () => {
    EQUIPMENT_ITEMS.forEach(item => {
      expect(item.levelRequirement).toBeGreaterThan(0);
    });
  });

  it('每件装备 bonus 至少含一个正属性', () => {
    EQUIPMENT_ITEMS.forEach(item => {
      const bonusValues = Object.values(item.bonus);
      const hasPositive = bonusValues.some(v => (v ?? 0) > 0);
      expect(hasPositive, `装备 ${item.id} 应至少含一个正属性`).toBe(true);
    });
  });
});
