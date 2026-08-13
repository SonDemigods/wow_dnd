/**
 * @fileoverview 影刃猎手怒火资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 100、整数型）
 * 2. 事件钩子 onAttack / onDamaged / onTurnStart / onKill
 * 3. onDamaged 按伤害 15% 生成（上限 15）
 * 4. consume 成功/失败
 * 5. reset 重置
 * 6. 累加不超过 maxValue=100
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { FurySystem } from '@/modules/combat/resources/FurySystem';

describe('FurySystem 影刃猎手怒火', () => {
  let fury: FurySystem;

  beforeEach(() => {
    fury = new FurySystem(0);
  });

  it('默认配置：maxValue=100, initialValue=0, isInteger=true', () => {
    expect(fury.type).toBe('fury');
    expect(fury.maxValue).toBe(100);
    expect(fury.currentValue).toBe(0);
    expect(fury.isInteger).toBe(true);
  });

  it('可指定初始怒火值', () => {
    const f = new FurySystem(30);
    expect(f.currentValue).toBe(30);
  });

  describe('事件钩子', () => {
    it('onAttack 生成 5 怒火', () => {
      fury.onAttack();
      expect(fury.currentValue).toBe(5);
    });

    it('onTurnStart 生成 2 怒火', () => {
      fury.onTurnStart();
      expect(fury.currentValue).toBe(2);
    });

    it('onKill 生成 20 怒火', () => {
      fury.onKill();
      expect(fury.currentValue).toBe(20);
    });

    it('onDamaged 生成伤害的 15%（向下取整）', () => {
      fury.onDamaged(100);
      // floor(100 * 0.15) = 15
      expect(fury.currentValue).toBe(15);
    });

    it('onDamaged 小数伤害向下取整', () => {
      fury.onDamaged(50);
      // floor(50 * 0.15) = floor(7.5) = 7
      expect(fury.currentValue).toBe(7);
    });

    it('onDamaged 上限 15（通过 damaged source cap）', () => {
      fury.onDamaged(200);
      // floor(200 * 0.15) = 30, 但 cap=15
      expect(fury.currentValue).toBe(15);
    });
  });

  it('consume 成功扣减', () => {
    const f = new FurySystem(30);
    expect(f.consume(10)).toBe(true);
    expect(f.currentValue).toBe(20);
  });

  it('consume 资源不足时返回 false 且不改变值', () => {
    const f = new FurySystem(5);
    expect(f.consume(10)).toBe(false);
    expect(f.currentValue).toBe(5);
  });

  it('reset 重置为初始值', () => {
    const f = new FurySystem(20);
    f.onAttack(); // 5
    f.reset();
    expect(f.currentValue).toBe(20);
  });

  it('不超过上限 100', () => {
    for (let i = 0; i < 10; i++) {
      fury.onKill(); // 每次 +20
    }
    expect(fury.currentValue).toBe(100);
  });

  it('未知来源时使用 amount 作为上限（?? 回退分支）', () => {
    fury.generate(50, 'invalid' as never);
    expect(fury.currentValue).toBe(50);
  });
});
