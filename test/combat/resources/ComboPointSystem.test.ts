/**
 * @fileoverview 潜行者连击点资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 5、整数型）
 * 2. generate 按来源差异化（attack=1/kill=2/skill=3，turn/damaged 不生成）
 * 3. 事件钩子 onAttack/onKill
 * 4. 多次 onAttack 累加到上限 5
 * 5. reset 清空为 0（即使 initialValue 非零也清空，重写行为）
 * 6. consume 正常工作（终结技消耗）
 * 7. 累加不超过 maxValue=5
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ComboPointSystem } from '@/modules/combat/resources/ComboPointSystem';

describe('ComboPointSystem 潜行者连击点', () => {
  let cp: ComboPointSystem;

  beforeEach(() => {
    cp = new ComboPointSystem(0);
  });

  it('默认配置：maxValue=5, initialValue=0, isInteger=true', () => {
    expect(cp.type).toBe('combo_point');
    expect(cp.maxValue).toBe(5);
    expect(cp.currentValue).toBe(0);
    expect(cp.isInteger).toBe(true);
  });

  describe('generate — 按来源差异化', () => {
    it('attack 来源上限 1', () => {
      cp.generate(10, 'attack');
      expect(cp.currentValue).toBe(1);
    });

    it('kill 来源上限 2', () => {
      cp.generate(10, 'kill');
      expect(cp.currentValue).toBe(2);
    });

    it('skill 来源上限 3', () => {
      cp.generate(10, 'skill');
      expect(cp.currentValue).toBe(3);
    });

    it('turn 来源不生成连击点', () => {
      cp.generate(10, 'turn');
      expect(cp.currentValue).toBe(0);
    });

    it('damaged 来源不生成连击点', () => {
      cp.generate(10, 'damaged');
      expect(cp.currentValue).toBe(0);
    });

    it('未超过上限时按实际值生成', () => {
      cp.generate(1, 'attack');
      expect(cp.currentValue).toBe(1);
    });

    it('累加不超过 maxValue=5', () => {
      cp.generate(10, 'attack'); // 1
      cp.generate(10, 'kill'); // +2 = 3
      cp.generate(10, 'skill'); // +3 → 6 → 裁剪到 5
      expect(cp.currentValue).toBe(5);
    });
  });

  describe('事件钩子', () => {
    it('onAttack 生成 1 连击点', () => {
      cp.onAttack();
      expect(cp.currentValue).toBe(1);
    });

    it('onKill 生成 2 连击点', () => {
      cp.onKill();
      expect(cp.currentValue).toBe(2);
    });

    it('多次 onAttack 累加到上限', () => {
      cp.onAttack(); // 1
      cp.onAttack(); // 2
      cp.onAttack(); // 3
      cp.onAttack(); // 4
      cp.onAttack(); // 5
      cp.onAttack(); // 5（上限）
      expect(cp.currentValue).toBe(5);
    });
  });

  it('reset 清空为 0（即使 initialValue 非零也清空）', () => {
    const c = new ComboPointSystem(2);
    c.generate(10, 'attack'); // 1
    c.reset();
    expect(c.currentValue).toBe(0);
  });

  it('consume 正常工作（终结技消耗）', () => {
    const c = new ComboPointSystem(0);
    c.generate(10, 'skill'); // 3
    expect(c.consume(3)).toBe(true);
    expect(c.currentValue).toBe(0);
  });
});
