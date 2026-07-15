/**
 * @fileoverview 龙脉术士精华资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 1、上限 5、整数型）
 * 2. 事件钩子 onTurnStart
 * 3. generate 按 source 差异化（turn/skill 生成，attack/damaged/kill 不生成）
 * 4. consume 成功/失败
 * 5. reset 重置为初始值 1
 * 6. 累加不超过 maxValue=5
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EssenceSystem } from '../../../src/modules/combat/resources/EssenceSystem';

describe('EssenceSystem 龙脉术士精华', () => {
  let essence: EssenceSystem;

  beforeEach(() => {
    essence = new EssenceSystem(1);
  });

  it('默认配置：maxValue=5, initialValue=1, isInteger=true', () => {
    expect(essence.type).toBe('essence');
    expect(essence.maxValue).toBe(5);
    expect(essence.currentValue).toBe(1);
    expect(essence.isInteger).toBe(true);
  });

  it('可指定初始精华值', () => {
    const e = new EssenceSystem(3);
    expect(e.currentValue).toBe(3);
  });

  describe('事件钩子', () => {
    it('onTurnStart 生成 1 精华', () => {
      essence.onTurnStart();
      expect(essence.currentValue).toBe(2);
    });

    it('多次 onTurnStart 累加上限', () => {
      essence.onTurnStart(); // 2
      essence.onTurnStart(); // 3
      essence.onTurnStart(); // 4
      essence.onTurnStart(); // 5
      essence.onTurnStart(); // 5（上限）
      expect(essence.currentValue).toBe(5);
    });
  });

  describe('generate — 按来源差异化', () => {
    it('turn 来源上限 1', () => {
      const e = new EssenceSystem(0);
      e.generate(10, 'turn');
      expect(e.currentValue).toBe(1);
    });

    it('skill 来源上限 2', () => {
      const e = new EssenceSystem(0);
      e.generate(10, 'skill');
      expect(e.currentValue).toBe(2);
    });

    it('attack 来源不生成精华', () => {
      essence.generate(10, 'attack');
      expect(essence.currentValue).toBe(1);
    });

    it('damaged 来源不生成精华', () => {
      essence.generate(10, 'damaged');
      expect(essence.currentValue).toBe(1);
    });

    it('kill 来源不生成精华', () => {
      essence.generate(10, 'kill');
      expect(essence.currentValue).toBe(1);
    });

    it('未超过上限时按实际值生成', () => {
      essence.generate(1, 'skill');
      expect(essence.currentValue).toBe(2);
    });

    it('累加不超过 maxValue=5', () => {
      essence.generate(10, 'skill'); // 1 + 2 = 3
      essence.generate(10, 'skill'); // +2 = 5
      essence.generate(10, 'turn'); // +1 → 6 → 裁剪到 5
      expect(essence.currentValue).toBe(5);
    });
  });

  it('consume 成功扣减', () => {
    const e = new EssenceSystem(3);
    expect(e.consume(2)).toBe(true);
    expect(e.currentValue).toBe(1);
  });

  it('consume 资源不足时返回 false 且不改变值', () => {
    const e = new EssenceSystem(1);
    expect(e.consume(2)).toBe(false);
    expect(e.currentValue).toBe(1);
  });

  it('reset 重置为初始值 1', () => {
    essence.generate(10, 'skill'); // 3
    essence.reset();
    expect(essence.currentValue).toBe(1);
  });

  it('不超过上限 5', () => {
    essence.generate(10, 'skill'); // 3
    essence.generate(10, 'turn'); // +1 = 4
    essence.generate(10, 'skill'); // +2 → 6 → 裁剪到 5
    essence.generate(10, 'turn'); // 5（上限）
    expect(essence.currentValue).toBe(5);
  });
});
