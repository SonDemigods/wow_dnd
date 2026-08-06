/**
 * @fileoverview 武僧真气资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 3、整数型）
 * 2. generate 按来源差异化（仅 skill 生成，attack/turn/damaged/kill 不生成）
 * 3. reset 恢复到 0
 * 4. 累加不超过 maxValue=3
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { ChiSystem } from '@/modules/combat/resources/ChiSystem';

describe('ChiSystem 武僧真气', () => {
  let chi: ChiSystem;

  beforeEach(() => {
    chi = new ChiSystem(0);
  });

  it('默认配置：maxValue=3, initialValue=0, isInteger=true', () => {
    expect(chi.type).toBe('chi');
    expect(chi.maxValue).toBe(3);
    expect(chi.currentValue).toBe(0);
    expect(chi.isInteger).toBe(true);
  });

  describe('generate — 按来源差异化', () => {
    it('skill 来源上限 3', () => {
      chi.generate(10, 'skill');
      expect(chi.currentValue).toBe(3);
    });

    it('attack 来源不生成', () => {
      chi.generate(10, 'attack');
      expect(chi.currentValue).toBe(0);
    });

    it('turn 来源不生成', () => {
      chi.generate(10, 'turn');
      expect(chi.currentValue).toBe(0);
    });

    it('damaged 来源不生成', () => {
      chi.generate(10, 'damaged');
      expect(chi.currentValue).toBe(0);
    });

    it('kill 来源不生成', () => {
      chi.generate(10, 'kill');
      expect(chi.currentValue).toBe(0);
    });

    it('累加不超过 maxValue=3', () => {
      chi.generate(2, 'skill'); // 2
      chi.generate(2, 'skill'); // 3（裁剪到上限）
      expect(chi.currentValue).toBe(3);
    });
  });

  it('reset 恢复到 0', () => {
    chi.generate(10, 'skill');
    chi.reset();
    expect(chi.currentValue).toBe(0);
  });
});
