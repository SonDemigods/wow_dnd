/**
 * @fileoverview 猎人集中值资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 100、上限 100、整数型）
 * 2. 事件钩子 onTurnStart / onAttack
 * 3. generate 按 source 差异化（attack/damaged/turn/skill/kill 各自上限）
 * 4. consume 成功/失败
 * 5. reset 重置为初始值
 * 6. 累加不超过 maxValue=100
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FocusSystem } from '@/modules/combat/resources/FocusSystem';

describe('FocusSystem 猎人集中值', () => {
  let focus: FocusSystem;

  beforeEach(() => {
    focus = new FocusSystem(100);
  });

  it('默认配置：maxValue=100, initialValue=100, isInteger=true', () => {
    expect(focus.type).toBe('focus');
    expect(focus.maxValue).toBe(100);
    expect(focus.currentValue).toBe(100);
    expect(focus.isInteger).toBe(true);
  });

  it('默认构造参数 initialValue=100', () => {
    const f = new FocusSystem();
    expect(f.currentValue).toBe(100);
  });

  it('可指定初始集中值（如战斗中复活以半值开始）', () => {
    const f = new FocusSystem(50);
    expect(f.currentValue).toBe(50);
  });

  describe('事件钩子', () => {
    it('onTurnStart 回复 10 集中值', () => {
      const f = new FocusSystem(50);
      f.onTurnStart();
      expect(f.currentValue).toBe(60);
    });

    it('多次 onTurnStart 累加上限 100', () => {
      const f = new FocusSystem(85);
      f.onTurnStart(); // 95
      f.onTurnStart(); // 100（命中上限）
      f.onTurnStart(); // 100（裁剪）
      expect(f.currentValue).toBe(100);
    });

    it('onAttack 生成 5 集中值', () => {
      const f = new FocusSystem(50);
      f.onAttack();
      expect(f.currentValue).toBe(55);
    });
  });

  describe('generate — 按来源差异化', () => {
    it('attack 来源上限 5', () => {
      const f = new FocusSystem(0);
      f.generate(100, 'attack');
      expect(f.currentValue).toBe(5);
    });

    it('damaged 来源上限 3', () => {
      const f = new FocusSystem(0);
      f.generate(100, 'damaged');
      expect(f.currentValue).toBe(3);
    });

    it('turn 来源上限 10', () => {
      const f = new FocusSystem(0);
      f.generate(100, 'turn');
      expect(f.currentValue).toBe(10);
    });

    it('skill 来源上限 5', () => {
      const f = new FocusSystem(0);
      f.generate(100, 'skill');
      expect(f.currentValue).toBe(5);
    });

    it('kill 来源上限 10', () => {
      const f = new FocusSystem(0);
      f.generate(100, 'kill');
      expect(f.currentValue).toBe(10);
    });

    it('未超过上限时按实际值生成', () => {
      const f = new FocusSystem(0);
      f.generate(3, 'attack');
      expect(f.currentValue).toBe(3);
    });

    it('累加不超过 maxValue=100', () => {
      const f = new FocusSystem(95);
      f.generate(100, 'turn'); // 95 + 10 = 105 → 裁剪到 100
      expect(f.currentValue).toBe(100);
    });
  });

  it('consume 成功扣减', () => {
    const f = new FocusSystem(50);
    expect(f.consume(20)).toBe(true);
    expect(f.currentValue).toBe(30);
  });

  it('consume 资源不足时返回 false 且不改变值', () => {
    const f = new FocusSystem(10);
    expect(f.consume(20)).toBe(false);
    expect(f.currentValue).toBe(10);
  });

  it('reset 重置为初始值', () => {
    const f = new FocusSystem(80);
    f.consume(50); // 30
    f.reset();
    expect(f.currentValue).toBe(80);
  });

  it('不超过上限 100', () => {
    const f = new FocusSystem(95);
    f.onAttack(); // +5 → 100
    f.onTurnStart(); // +10 → 裁剪到 100
    expect(f.currentValue).toBe(100);
  });

  it('hasEnough 检查资源是否足够', () => {
    const f = new FocusSystem(30);
    expect(f.hasEnough(30)).toBe(true);
    expect(f.hasEnough(31)).toBe(false);
  });

  it('未知来源时使用 amount 作为上限（?? 回退分支）', () => {
    const f = new FocusSystem(0);
    // 传入未在 FOCUS_CAPS 中定义的来源，触发 ?? amount 回退
    f.generate(50, 'invalid' as never);
    expect(f.currentValue).toBe(50);
  });
});
