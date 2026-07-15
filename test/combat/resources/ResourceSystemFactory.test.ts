/**
 * @fileoverview 资源系统工厂单元测试（新增职业）
 * @description 覆盖 ResourceSystemFactory 对以下职业的映射：
 * 1. paladin → [HolyPowerSystem]，replacesMana=false
 * 2. monk → [EnergySystem, ChiSystem]，replacesMana=true
 * 3. death_knight → [RunicPowerSystem, RuneSystem]，replacesMana=true
 * 4. demon_hunter → [FurySystem, SoulSystem]，replacesMana=true
 * 5. evoker → [EssenceSystem]，replacesMana=false
 */
import { describe, it, expect } from 'vitest';
import { ResourceSystemFactory } from '../../../src/modules/combat/resources/ResourceSystemFactory';

describe('ResourceSystemFactory 新增职业映射', () => {
  it('paladin 返回 [HolyPowerSystem]，replacesMana 为 false', () => {
    const systems = ResourceSystemFactory.create('paladin');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('holy_power');
    expect(systems[0].currentValue).toBe(0);
    expect(systems[0].maxValue).toBe(5);
    // 神圣为辅助资源，不替代 MP
    expect(ResourceSystemFactory.replacesMana('paladin')).toBe(false);
  });

  it('monk 返回 [EnergySystem, ChiSystem]，replacesMana 为 true', () => {
    const systems = ResourceSystemFactory.create('monk');
    expect(systems).toHaveLength(2);
    expect(systems[0].type).toBe('energy');
    expect(systems[0].currentValue).toBe(50);
    expect(systems[1].type).toBe('chi');
    expect(systems[1].currentValue).toBe(1);
    // 能量替代 MP
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
    // 符能替代 MP
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
    // 怒火替代 MP
    expect(ResourceSystemFactory.replacesMana('demon_hunter')).toBe(true);
  });

  it('evoker 返回 [EssenceSystem]，replacesMana 为 false', () => {
    const systems = ResourceSystemFactory.create('evoker');
    expect(systems).toHaveLength(1);
    expect(systems[0].type).toBe('essence');
    expect(systems[0].currentValue).toBe(1);
    expect(systems[0].maxValue).toBe(5);
    // 精华为辅助资源，不替代 MP
    expect(ResourceSystemFactory.replacesMana('evoker')).toBe(false);
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
