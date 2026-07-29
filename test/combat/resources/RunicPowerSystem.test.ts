/**
 * @fileoverview 亡灵骑士符能资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 100、整数型）
 * 2. 事件钩子 onAttack / onDamaged / onTurnStart / onKill
 * 3. onDamaged 按伤害 10% 生成（上限 10）
 * 4. consume 成功/失败
 * 5. reset 重置
 * 6. 累加不超过 maxValue=100
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RunicPowerSystem } from '../../../src/modules/combat/resources/RunicPowerSystem';

describe('RunicPowerSystem 亡灵骑士符能', () => {
  let runic: RunicPowerSystem;

  beforeEach(() => {
    runic = new RunicPowerSystem(0);
  });

  it('默认配置：maxValue=100, initialValue=0, isInteger=true', () => {
    expect(runic.type).toBe('runic_power');
    expect(runic.maxValue).toBe(100);
    expect(runic.currentValue).toBe(0);
    expect(runic.isInteger).toBe(true);
  });

  it('可指定初始符能值', () => {
    const r = new RunicPowerSystem(30);
    expect(r.currentValue).toBe(30);
  });

  describe('事件钩子', () => {
    it('onAttack 生成 5 符能', () => {
      runic.onAttack();
      expect(runic.currentValue).toBe(5);
    });

    it('onTurnStart 生成 3 符能', () => {
      runic.onTurnStart();
      expect(runic.currentValue).toBe(3);
    });

    it('onKill 生成 10 符能', () => {
      runic.onKill();
      expect(runic.currentValue).toBe(10);
    });

    it('onDamaged 生成伤害的 10%（向下取整）', () => {
      runic.onDamaged(50);
      // floor(50 * 0.1) = 5
      expect(runic.currentValue).toBe(5);
    });

    it('onDamaged 小数伤害向下取整', () => {
      runic.onDamaged(25);
      // floor(25 * 0.1) = floor(2.5) = 2
      expect(runic.currentValue).toBe(2);
    });

    it('onDamaged 上限 10（通过 damaged source cap）', () => {
      runic.onDamaged(200);
      // floor(200 * 0.1) = 20, 但 cap=10
      expect(runic.currentValue).toBe(10);
    });
  });

  it('consume 成功扣减', () => {
    const r = new RunicPowerSystem(30);
    expect(r.consume(10)).toBe(true);
    expect(r.currentValue).toBe(20);
  });

  it('consume 资源不足时返回 false 且不改变值', () => {
    const r = new RunicPowerSystem(5);
    expect(r.consume(10)).toBe(false);
    expect(r.currentValue).toBe(5);
  });

  it('reset 重置为初始值', () => {
    const r = new RunicPowerSystem(20);
    r.onAttack(); // 5
    r.reset();
    expect(r.currentValue).toBe(20);
  });

  it('不超过上限 100', () => {
    for (let i = 0; i < 30; i++) {
      runic.onKill(); // 每次 +10
    }
    expect(runic.currentValue).toBe(100);
  });

  it('未知来源时使用 amount 作为上限（?? 回退分支）', () => {
    runic.generate(50, 'invalid' as never);
    expect(runic.currentValue).toBe(50);
  });
});
