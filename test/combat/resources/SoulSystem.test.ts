/**
 * @fileoverview 影刃猎手灵魂资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 5、整数型）
 * 2. 事件钩子 onAttack / onKill
 * 3. generate 按 source 差异化（attack/kill/skill 生成，turn/damaged 不生成）
 * 4. consume 成功/失败
 * 5. reset 重置
 * 6. 累加不超过 maxValue=5
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SoulSystem } from '@/modules/combat/resources/SoulSystem';

describe('SoulSystem 影刃猎手灵魂', () => {
  let soul: SoulSystem;

  beforeEach(() => {
    soul = new SoulSystem(0);
  });

  it('默认配置：maxValue=5, initialValue=0, isInteger=true', () => {
    expect(soul.type).toBe('soul');
    expect(soul.maxValue).toBe(5);
    expect(soul.currentValue).toBe(0);
    expect(soul.isInteger).toBe(true);
  });

  it('可指定初始灵魂值', () => {
    const s = new SoulSystem(2);
    expect(s.currentValue).toBe(2);
  });

  describe('事件钩子', () => {
    it('onAttack 生成 1 灵魂', () => {
      soul.onAttack();
      expect(soul.currentValue).toBe(1);
    });

    it('onKill 生成 2 灵魂', () => {
      soul.onKill();
      expect(soul.currentValue).toBe(2);
    });

    it('多次 onAttack 累加上限', () => {
      soul.onAttack(); // 1
      soul.onAttack(); // 2
      soul.onAttack(); // 3
      soul.onAttack(); // 4
      soul.onAttack(); // 5
      soul.onAttack(); // 5（上限）
      expect(soul.currentValue).toBe(5);
    });
  });

  describe('generate — 按来源差异化', () => {
    it('attack 来源上限 1', () => {
      soul.generate(10, 'attack');
      expect(soul.currentValue).toBe(1);
    });

    it('kill 来源上限 2', () => {
      soul.generate(10, 'kill');
      expect(soul.currentValue).toBe(2);
    });

    it('skill 来源上限 2', () => {
      soul.generate(10, 'skill');
      expect(soul.currentValue).toBe(2);
    });

    it('turn 来源不生成灵魂', () => {
      soul.generate(10, 'turn');
      expect(soul.currentValue).toBe(0);
    });

    it('damaged 来源不生成灵魂', () => {
      soul.generate(10, 'damaged');
      expect(soul.currentValue).toBe(0);
    });

    it('未超过上限时按实际值生成', () => {
      soul.generate(1, 'skill');
      expect(soul.currentValue).toBe(1);
    });

    it('累加不超过 maxValue=5', () => {
      soul.generate(10, 'kill'); // 2
      soul.generate(10, 'skill'); // +2 = 4
      soul.generate(10, 'kill'); // +2 → 6 → 裁剪到 5
      expect(soul.currentValue).toBe(5);
    });
  });

  it('consume 成功扣减', () => {
    const s = new SoulSystem(3);
    expect(s.consume(2)).toBe(true);
    expect(s.currentValue).toBe(1);
  });

  it('consume 资源不足时返回 false 且不改变值', () => {
    const s = new SoulSystem(1);
    expect(s.consume(2)).toBe(false);
    expect(s.currentValue).toBe(1);
  });

  it('reset 重置为初始值', () => {
    const s = new SoulSystem(2);
    s.generate(10, 'skill'); // 4
    s.reset();
    expect(s.currentValue).toBe(2);
  });

  it('不超过上限 5', () => {
    soul.generate(10, 'kill'); // 2
    soul.generate(10, 'skill'); // +2 = 4
    soul.generate(10, 'attack'); // +1 = 5
    soul.generate(10, 'kill'); // +2 → 7 → 裁剪到 5
    expect(soul.currentValue).toBe(5);
  });
});
