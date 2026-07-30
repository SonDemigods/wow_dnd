/**
 * @fileoverview 武僧真气资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 1、上限 5、整数型）
 * 2. generate 按来源差异化（attack=1/turn=1/skill=2 生成，damaged/kill 不生成）
 * 3. 事件钩子 onTurnStart/onAttack 生成 1 真气
 * 4. 多次攻击累加上限 5
 * 5. reset 恢复到 1
 * 6. 累加不超过 maxValue=5
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ChiSystem } from '@/modules/combat/resources/ChiSystem';

describe('ChiSystem 武僧真气', () => {
  let chi: ChiSystem;

  beforeEach(() => {
    chi = new ChiSystem(1);
  });

  it('默认配置：maxValue=5, initialValue=1, isInteger=true', () => {
    expect(chi.type).toBe('chi');
    expect(chi.maxValue).toBe(5);
    expect(chi.currentValue).toBe(1);
    expect(chi.isInteger).toBe(true);
  });

  describe('generate — 按来源差异化', () => {
    it('attack 来源上限 1', () => {
      chi.generate(10, 'attack');
      expect(chi.currentValue).toBe(2); // 1 + 1
    });

    it('turn 来源上限 1', () => {
      chi.generate(10, 'turn');
      expect(chi.currentValue).toBe(2); // 1 + 1
    });

    it('skill 来源上限 2', () => {
      chi.generate(10, 'skill');
      expect(chi.currentValue).toBe(3); // 1 + 2
    });

    it('damaged 来源不生成', () => {
      chi.generate(10, 'damaged');
      expect(chi.currentValue).toBe(1);
    });

    it('kill 来源不生成', () => {
      chi.generate(10, 'kill');
      expect(chi.currentValue).toBe(1);
    });

    it('累加不超过 maxValue=5', () => {
      chi.generate(10, 'skill'); // 3
      chi.generate(10, 'skill'); // 5
      chi.generate(10, 'skill'); // 5（上限）
      expect(chi.currentValue).toBe(5);
    });
  });

  describe('事件钩子', () => {
    it('onTurnStart 生成 1 真气', () => {
      chi.onTurnStart();
      expect(chi.currentValue).toBe(2);
    });

    it('onAttack 生成 1 真气', () => {
      chi.onAttack();
      expect(chi.currentValue).toBe(2);
    });

    it('多次攻击累加上限', () => {
      chi.onAttack(); // 2
      chi.onAttack(); // 3
      chi.onAttack(); // 4
      chi.onAttack(); // 5
      chi.onAttack(); // 5（上限）
      expect(chi.currentValue).toBe(5);
    });
  });

  it('reset 恢复到 1', () => {
    chi.generate(10, 'attack');
    chi.reset();
    expect(chi.currentValue).toBe(1);
  });
});
