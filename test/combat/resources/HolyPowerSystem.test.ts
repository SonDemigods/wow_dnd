/**
 * @fileoverview 圣骑士神圣资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 5、整数型）
 * 2. generate 按 source 差异化生成（attack/damaged/skill 上限，turn/kill 不生成）
 * 3. 事件钩子 onAttack / onDamaged
 * 4. consume 成功/失败
 * 5. reset 重置为初始值
 * 6. 累加不超过 maxValue
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { HolyPowerSystem } from '@/modules/combat/resources/HolyPowerSystem';

describe('HolyPowerSystem 圣骑士神圣', () => {
  let holy: HolyPowerSystem;

  beforeEach(() => {
    holy = new HolyPowerSystem(0);
  });

  it('默认配置：maxValue=5, initialValue=0, isInteger=true', () => {
    expect(holy.type).toBe('holy_power');
    expect(holy.maxValue).toBe(5);
    expect(holy.currentValue).toBe(0);
    expect(holy.isInteger).toBe(true);
  });

  it('可指定初始神圣值', () => {
    const h = new HolyPowerSystem(2);
    expect(h.currentValue).toBe(2);
  });

  describe('generate — 按来源差异化', () => {
    it('attack 来源上限 1', () => {
      holy.generate(10, 'attack');
      expect(holy.currentValue).toBe(1);
    });

    it('damaged 来源上限 1', () => {
      holy.generate(10, 'damaged');
      expect(holy.currentValue).toBe(1);
    });

    it('skill 来源上限 3', () => {
      holy.generate(10, 'skill');
      expect(holy.currentValue).toBe(3);
    });

    it('turn 来源不生成神圣', () => {
      holy.generate(10, 'turn');
      expect(holy.currentValue).toBe(0);
    });

    it('kill 来源不生成神圣', () => {
      holy.generate(10, 'kill');
      expect(holy.currentValue).toBe(0);
    });

    it('未超过上限时按实际值生成', () => {
      holy.generate(2, 'skill');
      expect(holy.currentValue).toBe(2);
    });

    it('累加不超过 maxValue=5', () => {
      holy.generate(10, 'skill'); // 3
      holy.generate(10, 'skill'); // +3 → 6 → 裁剪到 5
      expect(holy.currentValue).toBe(5);
    });
  });

  describe('事件钩子', () => {
    it('onAttack 生成 1 神圣', () => {
      holy.onAttack();
      expect(holy.currentValue).toBe(1);
    });

    it('onDamaged 生成 1 神圣', () => {
      holy.onDamaged(50);
      expect(holy.currentValue).toBe(1);
    });

    it('多次 onAttack 累加上限', () => {
      holy.onAttack(); // 1
      holy.onAttack(); // 2
      holy.onAttack(); // 3
      holy.onAttack(); // 4
      holy.onAttack(); // 5
      holy.onAttack(); // 5（上限）
      expect(holy.currentValue).toBe(5);
    });
  });

  it('consume 成功扣减', () => {
    const h = new HolyPowerSystem(3);
    expect(h.consume(2)).toBe(true);
    expect(h.currentValue).toBe(1);
  });

  it('consume 资源不足时返回 false 且不改变值', () => {
    const h = new HolyPowerSystem(1);
    expect(h.consume(2)).toBe(false);
    expect(h.currentValue).toBe(1);
  });

  it('reset 重置为初始值', () => {
    const h = new HolyPowerSystem(2);
    h.generate(10, 'skill'); // 5
    h.reset();
    expect(h.currentValue).toBe(2);
  });

  it('不超过上限 5', () => {
    holy.generate(10, 'skill'); // 3
    holy.generate(10, 'attack'); // +1 = 4
    holy.generate(10, 'damaged'); // +1 = 5
    holy.generate(10, 'skill'); // +3 → 8 → 裁剪到 5
    expect(holy.currentValue).toBe(5);
  });
});
