/**
 * @fileoverview 属性计算函数单元测试（迁移自 src/utils/calculations.test.ts）
 *
 * 覆盖 utils/calculations.ts 中的核心纯函数：
 * - calculateMaxHp / calculateMaxMana
 * - calculatePhysicalAttack / calculatePhysicalDefense
 * - calculateMagicAttack / calculateMagicDefense
 * - calculateCritChance / calculateDodgeChance（含上限校验）
 * - calculateMpBonus / calculateHealBonus
 * - calculateAllAttributes 聚合函数
 * - getExpForLevel 等级经验查询（含边界）
 *
 * 这些函数是角色战斗力的基础，任何公式错误都会直接影响游戏平衡。
 */
import { describe, it, expect } from 'vitest';
import {
  calculateMaxHp,
  calculateMaxMana,
  calculatePhysicalAttack,
  calculatePhysicalDefense,
  calculateMagicAttack,
  calculateMagicDefense,
  calculateCritChance,
  calculateDodgeChance,
  calculateMpBonus,
  calculateHealBonus,
  calculateAllAttributes,
  getExpForLevel,
} from '@/utils/calculations';
import type { Stats } from '@/modules/character/types';
import { MAX_LEVEL, LEVEL_EXP_REQUIREMENTS } from '@/config/character';

/** 构造测试用 Stats（全 10 的中庸属性） */
function makeStats(overrides: Partial<Stats> = {}): Stats {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...overrides };
}

describe('calculateMaxHp 最大生命值', () => {
  it('基础公式：100 + con * 10', () => {
    expect(calculateMaxHp(makeStats({ con: 10 }))).toBe(200);
  });

  it('体质越高生命值越高', () => {
    expect(calculateMaxHp(makeStats({ con: 20 }))).toBe(300);
  });

  it('体质为 0 时使用实际值', () => {
    const stats = makeStats({ con: 0 });
    expect(calculateMaxHp(stats)).toBe(100);
  });
});

describe('calculateMaxMana 最大魔法值', () => {
  it('基础公式：50 + int*5 + wis*3 + cha*2', () => {
    const stats = makeStats({ int: 10, wis: 10, cha: 10 });
    expect(calculateMaxMana(stats)).toBe(50 + 50 + 30 + 20);
  });

  it('智力对魔法值影响最大', () => {
    const highInt = calculateMaxMana(makeStats({ int: 30 }));
    const highWis = calculateMaxMana(makeStats({ wis: 30 }));
    expect(highInt).toBeGreaterThan(highWis);
  });
});

describe('calculatePhysicalAttack 物理攻击力', () => {
  it('基础公式：floor(str*2 + dex*0.5)', () => {
    const stats = makeStats({ str: 10, dex: 10 });
    expect(calculatePhysicalAttack(stats)).toBe(Math.floor(20 + 5));
  });

  it('力量对物攻影响大于敏捷', () => {
    const highStr = calculatePhysicalAttack(makeStats({ str: 30, dex: 10 }));
    const highDex = calculatePhysicalAttack(makeStats({ str: 10, dex: 30 }));
    expect(highStr).toBeGreaterThan(highDex);
  });
});

describe('calculatePhysicalDefense 物理防御力', () => {
  it('基础公式：floor(con*1.5 + dex*0.3)', () => {
    const stats = makeStats({ con: 10, dex: 10 });
    expect(calculatePhysicalDefense(stats)).toBe(Math.floor(15 + 3));
  });
});

describe('calculateMagicAttack 魔法攻击力', () => {
  it('基础公式：floor(int*2 + wis*0.5 + cha*0.3)', () => {
    const stats = makeStats({ int: 10, wis: 10, cha: 10 });
    expect(calculateMagicAttack(stats)).toBe(Math.floor(20 + 5 + 3));
  });
});

describe('calculateMagicDefense 魔法防御力', () => {
  it('基础公式：floor(wis*1.5 + int*0.5 + cha*0.3)', () => {
    const stats = makeStats({ wis: 10, int: 10, cha: 10 });
    expect(calculateMagicDefense(stats)).toBe(Math.floor(15 + 5 + 3));
  });
});

describe('calculateCritChance 暴击率', () => {
  it('基础公式：min(50, floor(primaryStat*0.5))', () => {
    expect(calculateCritChance(makeStats({ str: 10 }), 'str')).toBe(5);
  });

  it('暴击率上限为 50%', () => {
    expect(calculateCritChance(makeStats({ str: 200 }), 'str')).toBe(50);
  });

  it('低主属性时暴击率较低', () => {
    expect(calculateCritChance(makeStats({ str: 4 }), 'str')).toBe(2);
  });

  it('不同 primaryStat 推导不同暴击率', () => {
    const stats = makeStats({ str: 20, int: 30 });
    expect(calculateCritChance(stats, 'str')).toBe(10);
    expect(calculateCritChance(stats, 'int')).toBe(15);
  });
});

describe('calculateDodgeChance 闪避率', () => {
  it('基础公式：min(30, floor(dex*0.3))', () => {
    expect(calculateDodgeChance(makeStats({ dex: 10 }))).toBe(3);
  });

  it('闪避率上限为 30%', () => {
    expect(calculateDodgeChance(makeStats({ dex: 200 }))).toBe(30);
  });
});

describe('calculateMpBonus 每级MP加成', () => {
  it('公式：int + wis + cha', () => {
    const stats = makeStats({ int: 10, wis: 10, cha: 10 });
    expect(calculateMpBonus(stats)).toBe(30);
  });
});

describe('calculateHealBonus 生命恢复加成', () => {
  it('公式：floor(wis*0.1 + cha*0.05)', () => {
    const stats = makeStats({ wis: 10, cha: 10 });
    expect(calculateHealBonus(stats)).toBe(Math.floor(1 + 0.5));
  });
});

describe('calculateAllAttributes 聚合计算', () => {
  it('返回所有衍生属性字段', () => {
    const stats = makeStats();
    const result = calculateAllAttributes(stats, 'dex');
    expect(result).toHaveProperty('physicalAttack');
    expect(result).toHaveProperty('physicalDefense');
    expect(result).toHaveProperty('magicAttack');
    expect(result).toHaveProperty('magicDefense');
    expect(result).toHaveProperty('critChance');
    expect(result).toHaveProperty('dodgeChance');
    expect(result).toHaveProperty('maxHp');
    expect(result).toHaveProperty('maxMana');
    expect(result).toHaveProperty('healBonus');
    expect(result).toHaveProperty('mpBonus');
  });

  it('聚合结果与单独调用一致', () => {
    const stats = makeStats({ str: 20, dex: 15, con: 18, int: 12, wis: 14, cha: 8 });
    const primaryStat = 'dex';
    const all = calculateAllAttributes(stats, primaryStat);
    expect(all.maxHp).toBe(calculateMaxHp(stats));
    expect(all.maxMana).toBe(calculateMaxMana(stats));
    expect(all.physicalAttack).toBe(calculatePhysicalAttack(stats));
    expect(all.physicalDefense).toBe(calculatePhysicalDefense(stats));
    expect(all.magicAttack).toBe(calculateMagicAttack(stats));
    expect(all.magicDefense).toBe(calculateMagicDefense(stats));
    expect(all.critChance).toBe(calculateCritChance(stats, primaryStat));
    expect(all.dodgeChance).toBe(calculateDodgeChance(stats));
  });
});

describe('getExpForLevel 等级经验查询', () => {
  it('level <= 1 时返回 0', () => {
    expect(getExpForLevel(1)).toBe(0);
    expect(getExpForLevel(0)).toBe(0);
    expect(getExpForLevel(-1)).toBe(0);
  });

  it('正常等级返回 LEVEL_EXP_REQUIREMENTS 中的值', () => {
    expect(getExpForLevel(2)).toBe(LEVEL_EXP_REQUIREMENTS[2]);
    expect(getExpForLevel(10)).toBe(LEVEL_EXP_REQUIREMENTS[10]);
  });

  it('超过 MAX_LEVEL 时返回 MAX_LEVEL 的经验值', () => {
    expect(getExpForLevel(MAX_LEVEL + 1)).toBe(LEVEL_EXP_REQUIREMENTS[MAX_LEVEL]);
    expect(getExpForLevel(9999)).toBe(LEVEL_EXP_REQUIREMENTS[MAX_LEVEL]);
  });

  it('刚好 MAX_LEVEL 返回对应值', () => {
    expect(getExpForLevel(MAX_LEVEL)).toBe(LEVEL_EXP_REQUIREMENTS[MAX_LEVEL]);
  });

  it('非整数等级（表中不存在）触发 || 0 回退返回 0', () => {
    expect(getExpForLevel(2.5)).toBe(0);
  });
});
