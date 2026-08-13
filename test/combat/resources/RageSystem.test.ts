/**
 * @fileoverview 战士怒气资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 100、整数型）+ 可指定初始怒气
 * 2. generate 按 source 应用上限（attack=5/damaged=10/turn=1/skill=20/kill=10）
 * 3. 未知 source 回退到 amount 本身
 * 4. 事件钩子 onTurnStart/onAttack/onKill/onDamaged
 * 5. onDamaged 按伤害 10% 向下取整，上限 10
 * 6. 累加不超过 maxValue=100
 * 7. reset 恢复到初始怒气
 * 8. consume 正常工作
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RageSystem } from '@/modules/combat/resources/RageSystem';
import type { ResourceSource } from '@/modules/combat/resources/types';

describe('RageSystem 战士怒气', () => {
  let rage: RageSystem;

  beforeEach(() => {
    rage = new RageSystem(0);
  });

  it('默认配置：maxValue=100, initialValue=0, isInteger=true', () => {
    expect(rage.type).toBe('rage');
    expect(rage.maxValue).toBe(100);
    expect(rage.currentValue).toBe(0);
    expect(rage.isInteger).toBe(true);
  });

  it('可指定初始怒气', () => {
    const r = new RageSystem(30);
    expect(r.currentValue).toBe(30);
  });

  describe('generate — 按 source 应用上限', () => {
    it('attack 来源上限 5', () => {
      rage.generate(100, 'attack');
      expect(rage.currentValue).toBe(5);
    });

    it('damaged 来源上限 10', () => {
      rage.generate(100, 'damaged');
      expect(rage.currentValue).toBe(10);
    });

    it('turn 来源上限 1', () => {
      rage.generate(100, 'turn');
      expect(rage.currentValue).toBe(1);
    });

    it('skill 来源上限 20', () => {
      rage.generate(100, 'skill');
      expect(rage.currentValue).toBe(20);
    });

    it('kill 来源上限 10', () => {
      rage.generate(100, 'kill');
      expect(rage.currentValue).toBe(10);
    });

    it('未超过上限时按实际值生成', () => {
      rage.generate(3, 'attack');
      expect(rage.currentValue).toBe(3);
    });

    it('未知 source 时使用 amount 作为 cap（?? fallback 分支）', () => {
      // RAGE_CAPS 中不存在 'unknown'，?? 回退到 amount 本身
      rage.generate(8, 'unknown' as ResourceSource);
      expect(rage.currentValue).toBe(8);
    });

    it('多次生成累加，但单次不超过 cap', () => {
      rage.generate(100, 'attack'); // 5
      rage.generate(100, 'turn'); // +1 = 6
      expect(rage.currentValue).toBe(6);
    });

    it('累加不超过 maxValue=100', () => {
      for (let i = 0; i < 30; i++) {
        rage.generate(100, 'skill'); // 每次 +20
      }
      expect(rage.currentValue).toBe(100);
    });
  });

  describe('事件钩子', () => {
    it('onTurnStart 生成 1 怒气', () => {
      rage.onTurnStart();
      expect(rage.currentValue).toBe(1);
    });

    it('onAttack 生成 5 怒气', () => {
      rage.onAttack();
      expect(rage.currentValue).toBe(5);
    });

    it('onKill 生成 10 怒气', () => {
      rage.onKill();
      expect(rage.currentValue).toBe(10);
    });

    it('onDamaged 生成伤害的 10%（向下取整）', () => {
      rage.onDamaged(50);
      // floor(50 * 0.1) = 5, cap=10
      expect(rage.currentValue).toBe(5);
    });

    it('onDamaged 小数伤害向下取整', () => {
      rage.onDamaged(25);
      // floor(25 * 0.1) = floor(2.5) = 2
      expect(rage.currentValue).toBe(2);
    });

    it('onDamaged 上限 10（通过 damaged source cap）', () => {
      rage.onDamaged(200);
      // floor(200 * 0.1) = 20, 但 cap=10
      expect(rage.currentValue).toBe(10);
    });
  });

  it('reset 恢复到初始怒气', () => {
    const r = new RageSystem(20);
    r.generate(50, 'attack');
    r.reset();
    expect(r.currentValue).toBe(20);
  });

  it('consume 正常工作', () => {
    const r = new RageSystem(30);
    expect(r.consume(10)).toBe(true);
    expect(r.currentValue).toBe(20);
    expect(r.consume(100)).toBe(false);
  });
});
