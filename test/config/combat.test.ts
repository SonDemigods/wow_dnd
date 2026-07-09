/**
 * @fileoverview 战斗配置常量单元测试
 * @description 验证 @/config/combat 中可调参数的取值范围合理性：
 * - 伤害计算参数：系数在 (0, 1]、随机范围为正整数
 * - 逃跑判定参数：概率在 [0, 1] 区间
 * - Boss 出场延迟：正整数毫秒
 *
 * 这些参数从 pipeline/service/store 中提取集中管理，取值越界会导致伤害/逃跑计算异常。
 */
import { describe, it, expect } from 'vitest';
import {
  DAMAGE_BASE_COEFFICIENT,
  DAMAGE_RANDOM_RANGE,
  DEFENSE_REDUCTION_COEFFICIENT,
  FLEE_BASE_CHANCE,
  FLEE_DEX_COEFFICIENT,
  BOSS_INTRO_DELAY,
} from '@/config/combat';

describe('战斗配置 - 伤害计算参数', () => {
  it('DAMAGE_BASE_COEFFICIENT 为 (0, 1] 区间的小数', () => {
    expect(DAMAGE_BASE_COEFFICIENT).toBeGreaterThan(0);
    expect(DAMAGE_BASE_COEFFICIENT).toBeLessThanOrEqual(1);
  });

  it('DAMAGE_RANDOM_RANGE 为正整数', () => {
    expect(Number.isInteger(DAMAGE_RANDOM_RANGE)).toBe(true);
    expect(DAMAGE_RANDOM_RANGE).toBeGreaterThan(0);
  });

  it('DEFENSE_REDUCTION_COEFFICIENT 为 (0, 1] 区间的小数', () => {
    expect(DEFENSE_REDUCTION_COEFFICIENT).toBeGreaterThan(0);
    expect(DEFENSE_REDUCTION_COEFFICIENT).toBeLessThanOrEqual(1);
  });
});

describe('战斗配置 - 逃跑判定参数', () => {
  it('FLEE_BASE_CHANCE 在 [0, 1] 区间', () => {
    expect(FLEE_BASE_CHANCE).toBeGreaterThanOrEqual(0);
    expect(FLEE_BASE_CHANCE).toBeLessThanOrEqual(1);
  });

  it('FLEE_DEX_COEFFICIENT 在 (0, 1) 区间', () => {
    expect(FLEE_DEX_COEFFICIENT).toBeGreaterThan(0);
    expect(FLEE_DEX_COEFFICIENT).toBeLessThan(1);
  });
});

describe('战斗配置 - Boss 出场参数', () => {
  it('BOSS_INTRO_DELAY 为正整数（毫秒）', () => {
    expect(Number.isInteger(BOSS_INTRO_DELAY)).toBe(true);
    expect(BOSS_INTRO_DELAY).toBeGreaterThan(0);
  });
});
