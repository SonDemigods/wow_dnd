/**
 * @fileoverview 潜行者能量资源系统单元测试
 * @description 覆盖：
 * 1. 默认配置（初始值 100、上限 100、整数型）
 * 2. generate 无 source cap，直接累加
 * 3. generate 不超过 maxValue=100
 * 4. onTurnStart 每回合回复 20 点
 * 5. 回合回复不超过上限
 * 6. reset 恢复到 100
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { EnergySystem } from '@/modules/combat/resources/EnergySystem';

describe('EnergySystem 潜行者能量', () => {
  let energy: EnergySystem;

  beforeEach(() => {
    energy = new EnergySystem(100);
  });

  it('默认配置：maxValue=100, initialValue=100, isInteger=true', () => {
    expect(energy.type).toBe('energy');
    expect(energy.maxValue).toBe(100);
    expect(energy.currentValue).toBe(100);
    expect(energy.isInteger).toBe(true);
  });

  it('generate 无 source cap，直接累加', () => {
    const e = new EnergySystem(0);
    e.generate(30, 'attack');
    expect(e.currentValue).toBe(30);
    e.generate(20, 'skill');
    expect(e.currentValue).toBe(50);
  });

  it('generate 不超过 maxValue=100', () => {
    energy.generate(100, 'attack');
    expect(energy.currentValue).toBe(100);
  });

  it('onTurnStart 每回合回复 20 点', () => {
    const e = new EnergySystem(0);
    e.onTurnStart();
    expect(e.currentValue).toBe(20);
    e.onTurnStart();
    expect(e.currentValue).toBe(40);
  });

  it('满能量时 onTurnStart 截断到上限', () => {
    energy.onTurnStart();
    expect(energy.currentValue).toBe(100);
  });

  it('reset 恢复到 100', () => {
    energy.consume(30);
    energy.reset();
    expect(energy.currentValue).toBe(100);
  });
});
