/**
 * @fileoverview 影刃猎手灵魂资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 3、整数型）
 * 2. generate 按 source 差异化（仅 skill 生成，attack/kill/turn/damaged 不生成）
 * 3. consume 成功/失败
 * 4. reset 重置
 * 5. 累加不超过 maxValue=3
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { SoulSystem } from '@/modules/combat/resources/SoulSystem';

describe('SoulSystem 影刃猎手灵魂', () => {
  let soul: SoulSystem;

  beforeEach(() => {
    soul = new SoulSystem(0);
  });

  it('默认配置：maxValue=3, initialValue=0, isInteger=true', () => {
    expect(soul.type).toBe('soul');
    expect(soul.maxValue).toBe(3);
    expect(soul.currentValue).toBe(0);
    expect(soul.isInteger).toBe(true);
  });

  it('可指定初始灵魂值', () => {
    const s = new SoulSystem(2);
    expect(s.currentValue).toBe(2);
  });

  describe('generate — 按来源差异化', () => {
    it('skill 来源上限 3', () => {
      soul.generate(10, 'skill');
      expect(soul.currentValue).toBe(3);
    });

    it('attack 来源不生成灵魂', () => {
      soul.generate(10, 'attack');
      expect(soul.currentValue).toBe(0);
    });

    it('kill 来源不生成灵魂', () => {
      soul.generate(10, 'kill');
      expect(soul.currentValue).toBe(0);
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

    it('累加不超过 maxValue=3', () => {
      soul.generate(2, 'skill'); // 2
      soul.generate(2, 'skill'); // +2 → 4 → 裁剪到 3
      expect(soul.currentValue).toBe(3);
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
    s.generate(10, 'skill'); // 3
    s.reset();
    expect(s.currentValue).toBe(2);
  });

  it('不超过上限 3', () => {
    soul.generate(10, 'skill'); // 3
    soul.generate(10, 'skill'); // 3（上限）
    expect(soul.currentValue).toBe(3);
  });
});
