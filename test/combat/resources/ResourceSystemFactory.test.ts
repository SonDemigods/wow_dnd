/**
 * @fileoverview 资源系统工厂单元测试（全职业映射）
 * @description 覆盖 ResourceSystemFactory 对所有职业的映射：
 * 1. warrior → [RageSystem]，replacesMana=true
 * 2. rogue → [EnergySystem, ComboPointSystem]，replacesMana=true
 * 3. warlock → [SoulShardSystem]，replacesMana=false
 * 4. hunter → [FocusSystem]，replacesMana=true
 * 5. paladin → [HolyPowerSystem]，replacesMana=false
 * 6. monk → [EnergySystem, ChiSystem]，replacesMana=true
 * 7. death_knight → [RunicPowerSystem, RuneSystem]，replacesMana=true
 * 8. demon_hunter → [FurySystem, SoulSystem]，replacesMana=true
 * 9. evoker → [EssenceSystem]，replacesMana=false
 * 10. 未知职业 → []，replacesMana=false
 * 11. getManaReplacingSystems 方法
 */
import { describe, it, expect } from 'vitest';
import { ResourceSystemFactory } from '@/modules/combat/resources/ResourceSystemFactory';

describe('ResourceSystemFactory 全职业映射', () => {
  it('warrior 返回 [RageSystem]，replacesMana 为 true', () => {
    const systems = ResourceSystemFactory.create('warrior');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('rage');
    expect(systems[0].currentValue).toBe(0);
    expect(systems[0].maxValue).toBe(100);
    expect(ResourceSystemFactory.replacesMana('warrior')).toBe(true);
  });

  it('rogue 返回 [EnergySystem, ComboPointSystem]，replacesMana 为 true', () => {
    const systems = ResourceSystemFactory.create('rogue');
    expect(systems).toHaveLength(2);
    expect(systems[0].type).toBe('energy');
    expect(systems[0].currentValue).toBe(50);
    expect(systems[1].type).toBe('combo_point');
    expect(systems[1].currentValue).toBe(0);
    expect(ResourceSystemFactory.replacesMana('rogue')).toBe(true);
  });

  it('warlock 返回 [SoulShardSystem]，replacesMana 为 false', () => {
    const systems = ResourceSystemFactory.create('warlock');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('soul_shard');
    expect(systems[0].currentValue).toBe(1);
    expect(systems[0].maxValue).toBe(5);
    expect(ResourceSystemFactory.replacesMana('warlock')).toBe(false);
  });

  it('hunter 返回 [FocusSystem]，replacesMana 为 true', () => {
    const systems = ResourceSystemFactory.create('hunter');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('focus');
    expect(systems[0].currentValue).toBe(100);
    expect(systems[0].maxValue).toBe(100);
    expect(ResourceSystemFactory.replacesMana('hunter')).toBe(true);
  });

  it('paladin 返回 [HolyPowerSystem]，replacesMana 为 false', () => {
    const systems = ResourceSystemFactory.create('paladin');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('holy_power');
    expect(systems[0].currentValue).toBe(0);
    expect(systems[0].maxValue).toBe(5);
    expect(ResourceSystemFactory.replacesMana('paladin')).toBe(false);
  });

  it('monk 返回 [EnergySystem, ChiSystem]，replacesMana 为 true', () => {
    const systems = ResourceSystemFactory.create('monk');
    expect(systems).toHaveLength(2);
    expect(systems[0].type).toBe('energy');
    expect(systems[0].currentValue).toBe(50);
    expect(systems[1].type).toBe('chi');
    expect(systems[1].currentValue).toBe(1);
    expect(ResourceSystemFactory.replacesMana('monk')).toBe(true);
  });

  it('death_knight 返回 [RunicPowerSystem, RuneSystem]，replacesMana 为 true', () => {
    const systems = ResourceSystemFactory.create('death_knight');
    expect(systems).toHaveLength(2);
    expect(systems[0].type).toBe('runic_power');
    expect(systems[0].currentValue).toBe(0);
    expect(systems[0].maxValue).toBe(100);
    expect(systems[1].type).toBe('rune');
    expect(systems[1].currentValue).toBe(6);
    expect(systems[1].maxValue).toBe(6);
    expect(ResourceSystemFactory.replacesMana('death_knight')).toBe(true);
  });

  it('demon_hunter 返回 [FurySystem, SoulSystem]，replacesMana 为 true', () => {
    const systems = ResourceSystemFactory.create('demon_hunter');
    expect(systems).toHaveLength(2);
    expect(systems[0].type).toBe('fury');
    expect(systems[0].currentValue).toBe(0);
    expect(systems[0].maxValue).toBe(100);
    expect(systems[1].type).toBe('soul');
    expect(systems[1].currentValue).toBe(0);
    expect(systems[1].maxValue).toBe(5);
    expect(ResourceSystemFactory.replacesMana('demon_hunter')).toBe(true);
  });

  it('evoker 返回 [EssenceSystem]，replacesMana 为 false', () => {
    const systems = ResourceSystemFactory.create('evoker');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('essence');
    expect(systems[0].currentValue).toBe(1);
    expect(systems[0].maxValue).toBe(5);
    expect(ResourceSystemFactory.replacesMana('evoker')).toBe(false);
  });

  it('未知职业返回空数组，replacesMana 为 false', () => {
    expect(ResourceSystemFactory.create('mage')).toEqual([]);
    expect(ResourceSystemFactory.create('unknown')).toEqual([]);
    expect(ResourceSystemFactory.replacesMana('mage')).toBe(false);
    expect(ResourceSystemFactory.replacesMana('unknown')).toBe(false);
  });

  it('每次 create 返回新实例（无单例缓存）', () => {
    const a = ResourceSystemFactory.create('paladin');
    const b = ResourceSystemFactory.create('paladin');
    expect(a).not.toBe(b);
    expect(a[0]).not.toBe(b[0]);
    a[0].generate(10, 'skill'); // 3
    expect(b[0].currentValue).toBe(0); // 不受影响
  });
});

describe('ResourceSystemFactory.getManaReplacingSystems 替代型资源系统', () => {
  it('warrior 返回 [RageSystem]（怒气替代 MP）', () => {
    const systems = ResourceSystemFactory.getManaReplacingSystems('warrior');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('rage');
  });

  it('rogue 返回 [EnergySystem]（仅能量替代 MP，连击点不替代）', () => {
    const systems = ResourceSystemFactory.getManaReplacingSystems('rogue');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('energy');
  });

  it('hunter 返回 [FocusSystem]（集中值替代 MP）', () => {
    const systems = ResourceSystemFactory.getManaReplacingSystems('hunter');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('focus');
  });

  it('death_knight 返回 [RunicPowerSystem]（仅符能替代 MP，符文不替代）', () => {
    const systems = ResourceSystemFactory.getManaReplacingSystems('death_knight');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('runic_power');
  });

  it('demon_hunter 返回 [FurySystem]（仅怒火替代 MP，灵魂不替代）', () => {
    const systems = ResourceSystemFactory.getManaReplacingSystems('demon_hunter');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('fury');
  });

  it('paladin 返回空数组（神圣为辅助资源，不替代 MP）', () => {
    const systems = ResourceSystemFactory.getManaReplacingSystems('paladin');
    expect(systems).toEqual([]);
  });

  it('warlock 返回空数组（灵魂碎片为辅助资源，不替代 MP）', () => {
    const systems = ResourceSystemFactory.getManaReplacingSystems('warlock');
    expect(systems).toEqual([]);
  });

  it('evoker 返回空数组（精华为辅助资源，不替代 MP）', () => {
    const systems = ResourceSystemFactory.getManaReplacingSystems('evoker');
    expect(systems).toEqual([]);
  });

  it('未知职业返回空数组', () => {
    const systems = ResourceSystemFactory.getManaReplacingSystems('mage');
    expect(systems).toEqual([]);
  });
});
