/**
 * @fileoverview 角色配置常量单元测试
 * @description 验证 @/config/character 中关键配置的数据完整性：
 * - LEVEL_EXP_REQUIREMENTS：等级覆盖完整（1..MAX_LEVEL）、单调递增、初始为 0
 * - STAT_NAMES：覆盖六大主属性、名称非空
 * - MAX_LEVEL / MAX_STAT：正整数
 * - 衍生属性公式系数：均为正数、上限为正整数
 *
 * 这些配置直接决定升级曲线与战斗力公式，错误会破坏游戏平衡。
 */
import { describe, it, expect } from 'vitest';
import {
  MAX_LEVEL,
  MAX_STAT,
  STAT_NAMES,
  LEVEL_EXP_REQUIREMENTS,
  HP_BASE,
  HP_CON_COEFFICIENT,
  MP_BASE,
  MP_INT_COEFFICIENT,
  MP_WIS_COEFFICIENT,
  MP_CHA_COEFFICIENT,
  PATTACK_STR_COEFFICIENT,
  PATTACK_DEX_COEFFICIENT,
  PDEF_CON_COEFFICIENT,
  PDEF_DEX_COEFFICIENT,
  MATTACK_INT_COEFFICIENT,
  MATTACK_WIS_COEFFICIENT,
  MATTACK_CHA_COEFFICIENT,
  MDEF_WIS_COEFFICIENT,
  MDEF_INT_COEFFICIENT,
  MDEF_CHA_COEFFICIENT,
  CRIT_CHANCE_CAP,
  CRIT_DEX_COEFFICIENT,
  DODGE_CHANCE_CAP,
  DODGE_DEX_COEFFICIENT,
  HEAL_WIS_COEFFICIENT,
  HEAL_CHA_COEFFICIENT,
} from '@/config/character';

describe('角色配置 - 基础常量', () => {
  it('MAX_LEVEL 为正整数', () => {
    expect(Number.isInteger(MAX_LEVEL)).toBe(true);
    expect(MAX_LEVEL).toBeGreaterThan(0);
  });

  it('MAX_STAT 为正整数', () => {
    expect(Number.isInteger(MAX_STAT)).toBe(true);
    expect(MAX_STAT).toBeGreaterThan(0);
  });
});

describe('STAT_NAMES 主属性名称映射', () => {
  const EXPECTED_STATS = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

  it('包含全部六大主属性键且无多余键', () => {
    for (const key of EXPECTED_STATS) {
      expect(STAT_NAMES).toHaveProperty(key);
    }
    expect(Object.keys(STAT_NAMES)).toHaveLength(EXPECTED_STATS.length);
  });

  it('所有属性名为非空字符串', () => {
    for (const key of EXPECTED_STATS) {
      expect(typeof STAT_NAMES[key]).toBe('string');
      expect(STAT_NAMES[key].length).toBeGreaterThan(0);
    }
  });
});

describe('LEVEL_EXP_REQUIREMENTS 升级经验表', () => {
  it('等级键完整覆盖 1 到 MAX_LEVEL 且无缺失/多余', () => {
    const keys = Object.keys(LEVEL_EXP_REQUIREMENTS).map(Number).sort((a, b) => a - b);
    expect(keys).toHaveLength(MAX_LEVEL);
    expect(keys[0]).toBe(1);
    expect(keys[keys.length - 1]).toBe(MAX_LEVEL);
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
      expect(LEVEL_EXP_REQUIREMENTS).toHaveProperty(String(lv));
    }
  });

  it('1 级所需经验为 0', () => {
    expect(LEVEL_EXP_REQUIREMENTS[1]).toBe(0);
  });

  it('经验值严格单调递增（2 级起）', () => {
    for (let lv = 2; lv <= MAX_LEVEL; lv++) {
      expect(LEVEL_EXP_REQUIREMENTS[lv]).toBeGreaterThan(LEVEL_EXP_REQUIREMENTS[lv - 1]);
    }
  });

  it('所有经验值为非负整数', () => {
    for (let lv = 1; lv <= MAX_LEVEL; lv++) {
      const exp = LEVEL_EXP_REQUIREMENTS[lv];
      expect(Number.isInteger(exp)).toBe(true);
      expect(exp).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('衍生属性公式系数', () => {
  it('基础值与系数均为正数', () => {
    const coefficients = [
      HP_BASE, HP_CON_COEFFICIENT,
      MP_BASE, MP_INT_COEFFICIENT, MP_WIS_COEFFICIENT, MP_CHA_COEFFICIENT,
      PATTACK_STR_COEFFICIENT, PATTACK_DEX_COEFFICIENT,
      PDEF_CON_COEFFICIENT, PDEF_DEX_COEFFICIENT,
      MATTACK_INT_COEFFICIENT, MATTACK_WIS_COEFFICIENT, MATTACK_CHA_COEFFICIENT,
      MDEF_WIS_COEFFICIENT, MDEF_INT_COEFFICIENT, MDEF_CHA_COEFFICIENT,
      CRIT_DEX_COEFFICIENT, DODGE_DEX_COEFFICIENT,
      HEAL_WIS_COEFFICIENT, HEAL_CHA_COEFFICIENT,
    ];
    for (const c of coefficients) {
      expect(c).toBeGreaterThan(0);
    }
  });

  it('暴击/闪避上限为正整数', () => {
    expect(Number.isInteger(CRIT_CHANCE_CAP)).toBe(true);
    expect(CRIT_CHANCE_CAP).toBeGreaterThan(0);
    expect(Number.isInteger(DODGE_CHANCE_CAP)).toBe(true);
    expect(DODGE_CHANCE_CAP).toBeGreaterThan(0);
  });
});
