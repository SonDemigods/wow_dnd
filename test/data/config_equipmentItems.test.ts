/**
 * @fileoverview 装备配置数据单元测试
 *
 * C3 阶段新增：验证法杖复合物品（equippable + usable）配置正确性。
 * 覆盖：5 件法杖存在、capabilities 含 usable+equippable、effects 含 magic_damage 且数值递增、
 * 非法杖装备不受影响（不含 usable、无 effects）。
 */
import { describe, it, expect } from 'vitest';
import { EQUIPMENT_ITEMS } from '@/data/config_equipmentItems';

describe('C3 法杖复合物品配置', () => {
  const staves = EQUIPMENT_ITEMS.filter(i => i.subtype === 'staff');
  const staffIds = ['oak_staff', 'crystal_staff', 'arcane_staff', 'jordan_staff', 'atiesh'];

  it('5 件法杖全部存在', () => {
    expect(staves).toHaveLength(5);
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

  it('法杖 magic_damage 数值按稀有度递增', () => {
    const getDmg = (id: string) =>
      staves.find(s => s.id === id)!.effects!.find(e => e.type === 'magic_damage')!.value as number;
    expect(getDmg('oak_staff')).toBeLessThan(getDmg('crystal_staff'));
    expect(getDmg('crystal_staff')).toBeLessThan(getDmg('arcane_staff'));
    expect(getDmg('arcane_staff')).toBeLessThan(getDmg('jordan_staff'));
    expect(getDmg('jordan_staff')).toBeLessThan(getDmg('atiesh'));
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
