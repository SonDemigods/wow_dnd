/**
 * @fileoverview 龙脉术士精华资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 3、整数型）
 * 2. generate 按 source 差异化（仅 skill 生成，attack/damaged/kill/turn 不生成）
 * 3. consume 成功/失败
 * 4. reset 重置为初始值 0
 * 5. 累加不超过 maxValue=3
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EssenceSystem } from '@/modules/combat/resources/EssenceSystem';

describe('EssenceSystem 龙脉术士精华', () => {
  let essence: EssenceSystem;

  beforeEach(() => {
    essence = new EssenceSystem(0);
  });

  it('默认配置：maxValue=3, initialValue=0, isInteger=true', () => {
    expect(essence.type).toBe('essence');
    expect(essence.maxValue).toBe(3);
    expect(essence.currentValue).toBe(0);
    expect(essence.isInteger).toBe(true);
  });

  it('可指定初始精华值', () => {
    const e = new EssenceSystem(2);
    expect(e.currentValue).toBe(2);
  });

  describe('generate — 按来源差异化', () => {
    it('skill 来源上限 3', () => {
      essence.generate(10, 'skill');
      expect(essence.currentValue).toBe(3);
    });

    it('attack 来源不生成精华', () => {
      essence.generate(10, 'attack');
      expect(essence.currentValue).toBe(0);
    });

    it('damaged 来源不生成精华', () => {
      essence.generate(10, 'damaged');
      expect(essence.currentValue).toBe(0);
    });

    it('kill 来源不生成精华', () => {
      essence.generate(10, 'kill');
      expect(essence.currentValue).toBe(0);
    });

    it('turn 来源不生成精华', () => {
      essence.generate(10, 'turn');
      expect(essence.currentValue).toBe(0);
    });

    it('未超过上限时按实际值生成', () => {
      essence.generate(1, 'skill');
      expect(essence.currentValue).toBe(1);
    });

    it('累加不超过 maxValue=3', () => {
      essence.generate(2, 'skill'); // 2
      essence.generate(2, 'skill'); // +2 → 4 → 裁剪到 3
      expect(essence.currentValue).toBe(3);
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

  it('reset 重置为初始值 0', () => {
    essence.generate(10, 'skill'); // 3
    essence.reset();
    expect(essence.currentValue).toBe(0);
  });

  it('不超过上限 3', () => {
    essence.generate(10, 'skill'); // 3
    essence.generate(10, 'skill'); // 3（上限）
    expect(essence.currentValue).toBe(3);
  });
});
