/**
 * @fileoverview 亡灵骑士符能资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 0、上限 20、整数型）
 * 2. 事件钩子 onAttack / onDamaged / onTurnStart / onKill
 * 3. onDamaged 按伤害 10% 生成（上限 2）
 * 4. consume 成功/失败
 * 5. reset 重置
 * 6. 累加不超过 maxValue=20
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { RunicPowerSystem } from '@/modules/combat/resources/RunicPowerSystem';

describe('RunicPowerSystem 亡灵骑士符能', () => {
  let runic: RunicPowerSystem;

  beforeEach(() => {
    runic = new RunicPowerSystem(0);
  });

  it('默认配置：maxValue=20, initialValue=0, isInteger=true', () => {
    expect(runic.type).toBe('runic_power');
    expect(runic.maxValue).toBe(20);
    expect(runic.currentValue).toBe(0);
    expect(runic.isInteger).toBe(true);
  });

  it('可指定初始符能值', () => {
    const r = new RunicPowerSystem(15);
    expect(r.currentValue).toBe(15);
  });

  describe('事件钩子', () => {
    it('onAttack 生成 1 符能', () => {
      runic.onAttack();
      expect(runic.currentValue).toBe(1);
    });

    it('onTurnStart 生成 1 符能', () => {
      runic.onTurnStart();
      expect(runic.currentValue).toBe(1);
    });

    it('onKill 生成 2 符能', () => {
      runic.onKill();
      expect(runic.currentValue).toBe(2);
    });

    it('onDamaged 生成伤害的 10%（向下取整，受 cap 限制）', () => {
      runic.onDamaged(50);
      // floor(50 * 0.1) = 5, 但 damaged cap=2
      expect(runic.currentValue).toBe(2);
    });

    it('onDamaged 小数伤害向下取整（未达 cap）', () => {
      runic.onDamaged(15);
      // floor(15 * 0.1) = floor(1.5) = 1, cap=2 未触发
      expect(runic.currentValue).toBe(1);
    });

    it('onDamaged 上限 2（通过 damaged source cap）', () => {
      runic.onDamaged(200);
      // floor(200 * 0.1) = 20, 但 cap=2
      expect(runic.currentValue).toBe(2);
    });
  });

  it('consume 成功扣减', () => {
    const r = new RunicPowerSystem(15);
    expect(r.consume(10)).toBe(true);
    expect(r.currentValue).toBe(5);
  });

  it('consume 资源不足时返回 false 且不改变值', () => {
    const r = new RunicPowerSystem(5);
    expect(r.consume(10)).toBe(false);
    expect(r.currentValue).toBe(5);
  });

  it('reset 重置为初始值', () => {
    const r = new RunicPowerSystem(10);
    r.onAttack(); // 1
    r.reset();
    expect(r.currentValue).toBe(10);
  });

  it('不超过上限 20', () => {
    for (let i = 0; i < 30; i++) {
      runic.onKill(); // 每次 +2
    }
    expect(runic.currentValue).toBe(20);
  });

  it('未知来源时使用 amount 作为上限（?? 回退分支）', () => {
    runic.generate(50, 'invalid' as never);
    // amount=50 作为 cap，但 applyGeneration 受 maxValue=20 截断
    expect(runic.currentValue).toBe(20);
  });
});
