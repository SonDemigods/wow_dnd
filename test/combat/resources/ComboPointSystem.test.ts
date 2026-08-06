/**
 * @fileoverview 潜行者连击点资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 6、整数型）
 * 2. generate 按来源差异化（仅 skill 生成，attack/kill/turn/damaged 不生成）
 * 3. consume 正常工作（终结技消耗）
 * 4. 累加不超过 maxValue=6
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ComboPointSystem } from '@/modules/combat/resources/ComboPointSystem';

describe('ComboPointSystem 潜行者连击点', () => {
  let cp: ComboPointSystem;

  beforeEach(() => {
    cp = new ComboPointSystem(0);
  });

  it('默认配置：maxValue=6, initialValue=0, isInteger=true', () => {
    expect(cp.type).toBe('combo_point');
    expect(cp.maxValue).toBe(6);
    expect(cp.currentValue).toBe(0);
    expect(cp.isInteger).toBe(true);
  });

  describe('generate — 按来源差异化', () => {
    it('skill 来源上限 6', () => {
      cp.generate(10, 'skill');
      expect(cp.currentValue).toBe(6);
    });

    it('attack 来源不生成连击点', () => {
      cp.generate(10, 'attack');
      expect(cp.currentValue).toBe(0);
    });

    it('kill 来源不生成连击点', () => {
      cp.generate(10, 'kill');
      expect(cp.currentValue).toBe(0);
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
      cp.generate(2, 'skill');
      expect(cp.currentValue).toBe(2);
    });

    it('累加不超过 maxValue=6', () => {
      cp.generate(10, 'skill'); // 6
      cp.generate(10, 'skill'); // +6 → 12 → 裁剪到 6
      expect(cp.currentValue).toBe(6);
    });
  });

  it('consume 正常工作（终结技消耗）', () => {
    const c = new ComboPointSystem(0);
    c.generate(10, 'skill'); // 6
    expect(c.consume(3)).toBe(true);
    expect(c.currentValue).toBe(3);
  });
});
