/**
 * @fileoverview 亡灵骑士符文资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 6、上限 6、整数型）
 * 2. 事件钩子 onTurnStart / onKill 恢复符文
 * 3. generate 按 source 差异化（attack 不生成）
 * 4. consume 成功/失败
 * 5. 累加不超过 maxValue=6
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RuneSystem } from '../../../src/modules/combat/resources/RuneSystem';

describe('RuneSystem 亡灵骑士符文', () => {
  let rune: RuneSystem;

  beforeEach(() => {
    rune = new RuneSystem(6);
  });

  it('默认配置：maxValue=6, initialValue=6, isInteger=true', () => {
    expect(rune.type).toBe('rune');
    expect(rune.maxValue).toBe(6);
    expect(rune.currentValue).toBe(6);
    expect(rune.isInteger).toBe(true);
  });

  it('可指定初始符文值', () => {
    const r = new RuneSystem(3);
    expect(r.currentValue).toBe(3);
  });

  describe('事件钩子', () => {
    it('onTurnStart 恢复 1 符文', () => {
      const r = new RuneSystem(3);
      r.onTurnStart();
      expect(r.currentValue).toBe(4);
    });

    it('onKill 恢复 1 符文', () => {
      const r = new RuneSystem(3);
      r.onKill();
      expect(r.currentValue).toBe(4);
    });

    it('满符文时 onTurnStart 不超过上限', () => {
      rune.onTurnStart();
      expect(rune.currentValue).toBe(6);
    });
  });

  describe('generate — 按来源差异化', () => {
    it('attack 来源不生成符文', () => {
      const r = new RuneSystem(0);
      r.generate(10, 'attack');
      expect(r.currentValue).toBe(0);
    });

    it('damaged 来源不生成符文', () => {
      const r = new RuneSystem(0);
      r.generate(10, 'damaged');
      expect(r.currentValue).toBe(0);
    });

    it('skill 来源不生成符文', () => {
      const r = new RuneSystem(0);
      r.generate(10, 'skill');
      expect(r.currentValue).toBe(0);
    });

    it('turn 来源上限 1', () => {
      const r = new RuneSystem(0);
      r.generate(10, 'turn');
      expect(r.currentValue).toBe(1);
    });

    it('kill 来源上限 1', () => {
      const r = new RuneSystem(0);
      r.generate(10, 'kill');
      expect(r.currentValue).toBe(1);
    });
  });

  it('consume 成功扣减', () => {
    expect(rune.consume(2)).toBe(true);
    expect(rune.currentValue).toBe(4);
  });

  it('consume 资源不足时返回 false 且不改变值', () => {
    const r = new RuneSystem(1);
    expect(r.consume(2)).toBe(false);
    expect(r.currentValue).toBe(1);
  });

  it('不超过上限 6', () => {
    const r = new RuneSystem(5);
    r.onTurnStart(); // 6
    r.onKill(); // 6（上限）
    expect(r.currentValue).toBe(6);
  });
});
