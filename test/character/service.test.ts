/**
 * @fileoverview 角色模块 service 纯函数单元测试
 *
 * 覆盖范围：
 * 1. computeInitialStats / computeEffectiveStats —— 初始属性与有效属性计算（含 clamp）
 * 2. computeAttributes —— 衍生属性聚合
 * 3. isClassFactionCompatible —— 职业阵营兼容性
 * 4. createInitialCharacter —— 角色创建
 * 5. applyHpChange / applyMpChange / isDead —— HP/MP 变更与死亡判定
 * 6. applyExpGain / applyLevelUp —— 经验值与升级（含连升、满级）
 * 7. applyGoldChange / canAffordGold —— 金币变更
 * 8. computeBonusChange —— 加成变更（add/remove 边界差异）
 * 9. recalculateHpMp —— HP/MP 上限重算
 * 10. computeResurrection —— 复活
 */
import { describe, it, expect } from 'vitest';
import {
  generateCharacterId,
  computeInitialStats,
  computeEffectiveStats,
  computeAttributes,
  isClassFactionCompatible,
  createInitialCharacter,
  applyHpChange,
  applyMpChange,
  isDead,
  applyExpGain,
  applyLevelUp,
  applyGoldChange,
  canAffordGold,
  computeBonusChange,
  recalculateHpMp,
  computeResurrection,
  allocateStat,
  resetAllocatedStats,
  applyPotionBonus,
} from '@/modules/character/service';
import type { Character, Stats, RaceData, ClassData, CreateCharacterParams } from '@/modules/character/types';
import { MAX_LEVEL, MAX_STAT, POINTS_PER_LEVEL } from '@/config/character';
import { calculateMaxHp, calculateMaxMana, getExpForLevel } from '@/utils/calculations';

/** 构造测试用 Stats（全 10 的中庸属性） */
function makeStats(overrides: Partial<Stats> = {}): Stats {
  return { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10, ...overrides };
}

/** 构造测试用全 0 Stats（药剂层/升级层默认值） */
function makeZeroStats(overrides: Partial<Stats> = {}): Stats {
  return { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0, ...overrides };
}

/** 构造测试用 Character */
function makeCharacter(overrides: Partial<Character> = {}): Character {
  const stats = overrides.stats || makeStats();
  return {
    name: '测试角色',
    factionId: 'alliance',
    raceId: 'human',
    classId: 'warrior',
    level: 1,
    exp: 0,
    expToNextLevel: getExpForLevel(2),
    hp: calculateMaxHp(stats),
    maxHp: calculateMaxHp(stats),
    mana: calculateMaxMana(stats),
    maxMana: calculateMaxMana(stats),
    stats,
    // 四层属性默认值：药剂层/升级层全 0，无未分配点数
    potionStats: makeZeroStats(),
    allocatedStats: makeZeroStats(),
    unallocatedPoints: 0,
    gold: 100,
    ...overrides,
  };
}

/** 构造测试用 RaceData */
function makeRaceData(overrides: Partial<RaceData> = {}): RaceData {
  return {
    id: 'human',
    name: '人类',
    icon: 'game-icons:person',
    factionId: 'alliance',
    bonus: { str: 2, con: 2 },
    description: '人类种族',
    ...overrides,
  };
}

/** 构造测试用 ClassData */
function makeClassData(overrides: Partial<ClassData> = {}): ClassData {
  return {
    id: 'warrior',
    name: '战士',
    icon: 'game-icons:swordman',
    primaryStat: 'str',
    factionsIds: ['alliance', 'horde'],
    raceIds: ['human', 'dwarf'],
    description: '战士职业',
    color: '#c00',
    bonus: { str: 3, con: 2 },
    ...overrides,
  };
}

describe('generateCharacterId 角色ID生成', () => {
  it('生成以 char_ 为前缀的 ID', () => {
    const id = generateCharacterId();
    expect(id.startsWith('char_')).toBe(true);
  });

  it('多次生成返回不同 ID', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 50; i++) {
      ids.add(generateCharacterId());
    }
    expect(ids.size).toBe(50);
  });
});

describe('computeInitialStats 初始属性计算', () => {
  it('基础值 10 + 种族加成 + 职业加成', () => {
    const raceBonus = { str: 2, con: 2 };
    const classBonus = { str: 3, con: 2 };
    const stats = computeInitialStats(raceBonus, classBonus);
    expect(stats.str).toBe(15); // 10 + 2 + 3
    expect(stats.con).toBe(14); // 10 + 2 + 2
    expect(stats.dex).toBe(10); // 10 + 0 + 0
    expect(stats.int).toBe(10);
  });

  it('无加成时全属性为 10', () => {
    const stats = computeInitialStats({}, {});
    expect(stats.str).toBe(10);
    expect(stats.dex).toBe(10);
    expect(stats.con).toBe(10);
    expect(stats.int).toBe(10);
    expect(stats.wis).toBe(10);
    expect(stats.cha).toBe(10);
  });

  it('属性值不超过 MAX_STAT (999)', () => {
    const stats = computeInitialStats({ str: 2000 }, { str: 2000 });
    expect(stats.str).toBe(MAX_STAT);
  });

  it('属性值不低于 1', () => {
    // 基础 10 + 负加成，clamp 到 1
    const stats = computeInitialStats({ str: -100 }, { str: -100 });
    expect(stats.str).toBe(1);
  });
});

describe('computeEffectiveStats 有效属性计算', () => {
  it('四层叠加：baseStats + potionStats + allocatedStats + bonusStats', () => {
    const base = makeStats({ str: 15, con: 12 });
    const potion = makeZeroStats({ str: 2 });
    const allocated = makeZeroStats({ dex: 3 });
    const bonus = { str: 5 };
    const effective = computeEffectiveStats(base, potion, allocated, bonus);
    expect(effective.str).toBe(22); // 15 + 2 + 0 + 5
    expect(effective.dex).toBe(13); // 10 + 0 + 3 + 0
    expect(effective.con).toBe(12); // 12 + 0 + 0 + 0
  });

  it('不超过 MAX_STAT', () => {
    const base = makeStats({ str: 990 });
    const potion = makeZeroStats({ str: 5 });
    const allocated = makeZeroStats({ str: 5 });
    const bonus = { str: 50 };
    expect(computeEffectiveStats(base, potion, allocated, bonus).str).toBe(MAX_STAT);
  });

  it('不低于 1', () => {
    const base = makeStats({ str: 2 });
    const potion = makeZeroStats();
    const allocated = makeZeroStats();
    const bonus = { str: -100 };
    expect(computeEffectiveStats(base, potion, allocated, bonus).str).toBe(1);
  });

  it('不修改原始 baseStats（返回新对象）', () => {
    const base = makeStats({ str: 10 });
    computeEffectiveStats(base, makeZeroStats(), makeZeroStats(), { str: 5 });
    expect(base.str).toBe(10);
  });

  it('各层独立加和（验证四层分离）', () => {
    const base = makeStats({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    const potion = makeZeroStats({ str: 1, dex: 1, con: 1, int: 1, wis: 1, cha: 1 });
    const allocated = makeZeroStats({ str: 2, dex: 2, con: 2, int: 2, wis: 2, cha: 2 });
    const bonus = { str: 3, dex: 3, con: 3, int: 3, wis: 3, cha: 3 };
    const effective = computeEffectiveStats(base, potion, allocated, bonus);
    // 每层独立贡献：10 + 1 + 2 + 3 = 16
    expect(effective.str).toBe(16);
    expect(effective.dex).toBe(16);
    expect(effective.con).toBe(16);
    expect(effective.int).toBe(16);
    expect(effective.wis).toBe(16);
    expect(effective.cha).toBe(16);
  });
});

describe('computeAttributes 衍生属性聚合', () => {
  it('返回全部衍生属性字段', () => {
    const attrs = computeAttributes(makeStats());
    expect(attrs).toHaveProperty('maxHp');
    expect(attrs).toHaveProperty('maxMana');
    expect(attrs).toHaveProperty('physicalAttack');
    expect(attrs).toHaveProperty('physicalDefense');
    expect(attrs).toHaveProperty('magicAttack');
    expect(attrs).toHaveProperty('magicDefense');
    expect(attrs).toHaveProperty('critChance');
    expect(attrs).toHaveProperty('dodgeChance');
    expect(attrs).toHaveProperty('hpBonus');
    expect(attrs).toHaveProperty('mpBonus');
    expect(attrs).toHaveProperty('healBonus');
  });

  it('与底层计算函数结果一致', () => {
    const stats = makeStats({ str: 20, dex: 15, con: 18, int: 12, wis: 14, cha: 8 });
    const attrs = computeAttributes(stats);
    expect(attrs.maxHp).toBe(calculateMaxHp(stats));
    expect(attrs.maxMana).toBe(calculateMaxMana(stats));
  });
});

describe('isClassFactionCompatible 职业阵营兼容性', () => {
  it('职业 factionsIds 包含所选阵营时兼容', () => {
    const cls = makeClassData({ factionsIds: ['alliance', 'horde'] });
    expect(isClassFactionCompatible(cls, 'alliance')).toBe(true);
    expect(isClassFactionCompatible(cls, 'horde')).toBe(true);
  });

  it('职业 factionsIds 不包含所选阵营时不兼容', () => {
    const cls = makeClassData({ factionsIds: ['alliance'] });
    expect(isClassFactionCompatible(cls, 'horde')).toBe(false);
    expect(isClassFactionCompatible(cls, 'neutral')).toBe(false);
  });

  it('空 factionsIds 表示无限制（实际 includes 返回 false）', () => {
    const cls = makeClassData({ factionsIds: [] });
    // 空数组时任何阵营都不在列表中 → 不兼容
    expect(isClassFactionCompatible(cls, 'alliance')).toBe(false);
  });
});

describe('createInitialCharacter 角色创建', () => {
  it('生成 1 级角色，初始经验 0', () => {
    const params: CreateCharacterParams = {
      name: '英雄',
      factionId: 'alliance',
      raceId: 'human',
      classId: 'warrior',
    };
    const char = createInitialCharacter(params, makeRaceData(), makeClassData());
    expect(char.name).toBe('英雄');
    expect(char.level).toBe(1);
    expect(char.exp).toBe(0);
    expect(char.expToNextLevel).toBe(getExpForLevel(2));
  });

  it('初始 HP/MP 等于 maxHp/maxMana（满血满蓝）', () => {
    const char = createInitialCharacter(
      { name: 'x', factionId: 'alliance', raceId: 'human', classId: 'warrior' },
      makeRaceData(),
      makeClassData()
    );
    expect(char.hp).toBe(char.maxHp);
    expect(char.mana).toBe(char.maxMana);
  });

  it('初始金币为 50', () => {
    const char = createInitialCharacter(
      { name: 'x', factionId: 'alliance', raceId: 'human', classId: 'warrior' },
      makeRaceData(),
      makeClassData()
    );
    expect(char.gold).toBe(50);
  });

  it('应用种族与职业加成到初始属性', () => {
    const char = createInitialCharacter(
      { name: 'x', factionId: 'alliance', raceId: 'human', classId: 'warrior' },
      makeRaceData({ bonus: { str: 5 } }),
      makeClassData({ bonus: { str: 3 } })
    );
    // 10 + 5 + 3 = 18
    expect(char.stats.str).toBe(18);
  });

  it('raceData 无 bonus 时不报错', () => {
    const char = createInitialCharacter(
      { name: 'x', factionId: 'alliance', raceId: 'human', classId: 'warrior' },
      makeRaceData({ bonus: undefined }),
      makeClassData({ bonus: undefined })
    );
    expect(char.stats.str).toBe(10);
  });
});

describe('applyHpChange / applyMpChange HP/MP 变更', () => {
  it('增加 HP 不超过 maxHp', () => {
    const char = makeCharacter({ hp: 100, maxHp: 200 });
    const result = applyHpChange(char, 150);
    expect(result.hp).toBe(200);
  });

  it('减少 HP 不低于 0', () => {
    const char = makeCharacter({ hp: 50, maxHp: 200 });
    const result = applyHpChange(char, -100);
    expect(result.hp).toBe(0);
  });

  it('增加 MP 不超过 maxMana', () => {
    const char = makeCharacter({ mana: 30, maxMana: 100 });
    const result = applyMpChange(char, 80);
    expect(result.mana).toBe(100);
  });

  it('减少 MP 不低于 0', () => {
    const char = makeCharacter({ mana: 20, maxMana: 100 });
    const result = applyMpChange(char, -50);
    expect(result.mana).toBe(0);
  });

  it('不修改原始角色对象（返回新对象）', () => {
    const char = makeCharacter({ hp: 100, maxHp: 200 });
    applyHpChange(char, 50);
    expect(char.hp).toBe(100);
  });

  it('HP 精确变更（未触边界）', () => {
    const char = makeCharacter({ hp: 100, maxHp: 200 });
    expect(applyHpChange(char, 30).hp).toBe(130);
    expect(applyHpChange(char, -40).hp).toBe(60);
  });
});

describe('isDead 死亡判定', () => {
  it('HP <= 0 时死亡', () => {
    expect(isDead(makeCharacter({ hp: 0 }))).toBe(true);
    expect(isDead(makeCharacter({ hp: -10 }))).toBe(true);
  });

  it('HP > 0 时存活', () => {
    expect(isDead(makeCharacter({ hp: 1 }))).toBe(false);
    expect(isDead(makeCharacter({ hp: 100 }))).toBe(false);
  });
});

describe('applyLevelUp 升级', () => {
  it('等级提升到指定等级', () => {
    const char = makeCharacter({ level: 1 });
    const result = applyLevelUp(char, 2);
    expect(result.level).toBe(2);
  });

  it('每级累加 POINTS_PER_LEVEL 点未分配点数（不再自动 +1 全属性）', () => {
    // 四层属性模型（plan.md §3.4）：升级不再 stats.str + 1，改为 unallocatedPoints += POINTS_PER_LEVEL
    const char = makeCharacter({ stats: makeStats({ str: 10, dex: 10 }), unallocatedPoints: 0 });
    const result = applyLevelUp(char, 2);
    // stats 不变（玩家通过 allocateStat 自由分配）
    expect(result.stats.str).toBe(10);
    expect(result.stats.dex).toBe(10);
    // 未分配点数累加 POINTS_PER_LEVEL（=3）
    expect(result.unallocatedPoints).toBe(POINTS_PER_LEVEL);
  });

  it('升级后 HP/MP 回满', () => {
    const char = makeCharacter({ hp: 10, mana: 5 });
    const result = applyLevelUp(char, 2);
    expect(result.hp).toBe(result.maxHp);
    expect(result.mana).toBe(result.maxMana);
  });

  it('升级后 maxHp/maxMana 不变（con/int 不再自动增长）', () => {
    // 四层属性模型变更：因 con/int 未自动涨，maxHp/maxMana 维持升级前的值
    const char = makeCharacter({ stats: makeStats({ con: 10, int: 10 }) });
    const result = applyLevelUp(char, 2);
    expect(result.maxHp).toBe(char.maxHp);
    expect(result.maxMana).toBe(char.maxMana);
  });

  it('升级后 expToNextLevel 更新为下一级所需', () => {
    const char = makeCharacter({ level: 1 });
    const result = applyLevelUp(char, 2);
    expect(result.expToNextLevel).toBe(getExpForLevel(3));
  });

  it('属性不超过 MAX_STAT（升级层通过 allocateStat 单独 clamp，applyLevelUp 不动 stats）', () => {
    const char = makeCharacter({ stats: makeStats({ str: MAX_STAT }) });
    const result = applyLevelUp(char, 2);
    expect(result.stats.str).toBe(MAX_STAT);
  });
});

describe('applyExpGain 经验值增益', () => {
  it('经验值不足升级时仅累加经验', () => {
    const char = makeCharacter({ level: 1, exp: 0, expToNextLevel: getExpForLevel(2) });
    const result = applyExpGain(char, 50);
    expect(result.leveledUp).toBe(false);
    expect(result.levelsGained).toBe(0);
    expect(result.newLevel).toBe(1);
    expect(result.character.exp).toBe(50);
  });

  it('经验值满足时升级', () => {
    const char = makeCharacter({ level: 1, exp: 0, expToNextLevel: getExpForLevel(2) });
    // 升到 2 级需要 100 经验
    const result = applyExpGain(char, 100);
    expect(result.leveledUp).toBe(true);
    expect(result.levelsGained).toBe(1);
    expect(result.newLevel).toBe(2);
  });

  it('一次经验可连升多级', () => {
    const char = makeCharacter({ level: 1, exp: 0, expToNextLevel: getExpForLevel(2) });
    // 给予足够升多级的经验
    const result = applyExpGain(char, 500);
    expect(result.levelsGained).toBeGreaterThan(1);
    expect(result.newLevel).toBeGreaterThan(2);
  });

  it('达到 MAX_LEVEL 后不再升级，经验清零', () => {
    const char = makeCharacter({
      level: MAX_LEVEL - 1,
      exp: 0,
      expToNextLevel: getExpForLevel(MAX_LEVEL),
    });
    const result = applyExpGain(char, 999999);
    expect(result.newLevel).toBe(MAX_LEVEL);
    expect(result.character.exp).toBe(0);
  });

  it('amount <= 0 时直接返回原角色，不升级', () => {
    const char = makeCharacter({ level: 1, exp: 50 });
    const r1 = applyExpGain(char, 0);
    const r2 = applyExpGain(char, -10);
    expect(r1.leveledUp).toBe(false);
    expect(r2.leveledUp).toBe(false);
    expect(r1.character.exp).toBe(50);
    expect(r2.character.exp).toBe(50);
  });

  it('升级后剩余经验正确（扣除升级消耗）', () => {
    const char = makeCharacter({ level: 1, exp: 0, expToNextLevel: getExpForLevel(2) });
    // 给 150 经验，升 1 级消耗 100，剩余 50
    const result = applyExpGain(char, 150);
    expect(result.levelsGained).toBe(1);
    expect(result.character.exp).toBe(50);
  });
});

describe('applyGoldChange / canAffordGold 金币', () => {
  it('增加金币', () => {
    const char = makeCharacter({ gold: 100 });
    expect(applyGoldChange(char, 50).gold).toBe(150);
  });

  it('减少金币（可为负数）', () => {
    const char = makeCharacter({ gold: 100 });
    expect(applyGoldChange(char, -30).gold).toBe(70);
  });

  it('canAffordGold 金额充足且为正数时返回 true', () => {
    expect(canAffordGold(makeCharacter({ gold: 100 }), 50)).toBe(true);
    expect(canAffordGold(makeCharacter({ gold: 100 }), 100)).toBe(true);
  });

  it('canAffordGold 金额不足时返回 false', () => {
    expect(canAffordGold(makeCharacter({ gold: 100 }), 150)).toBe(false);
  });

  it('canAffordGold 金额非正数时返回 false', () => {
    expect(canAffordGold(makeCharacter({ gold: 100 }), 0)).toBe(false);
    expect(canAffordGold(makeCharacter({ gold: 100 }), -10)).toBe(false);
  });
});

describe('computeBonusChange 加成变更', () => {
  it('isAdd=true 时叠加加成', () => {
    const current = { str: 5 };
    const delta = { str: 3, dex: 2 };
    const result = computeBonusChange(current, delta, true);
    expect(result.str).toBe(8);
    expect(result.dex).toBe(2);
  });

  it('isAdd=false 时扣减加成', () => {
    const current = { str: 10, dex: 5 };
    const delta = { str: 3 };
    const result = computeBonusChange(current, delta, false);
    expect(result.str).toBe(7);
    expect(result.dex).toBe(5); // 未变
  });

  it('isAdd=false 时下界为 0（允许完全移除）', () => {
    const current = { str: 2 };
    const delta = { str: 10 };
    const result = computeBonusChange(current, delta, false);
    expect(result.str).toBe(0);
  });

  it('isAdd=true 时下界为 1（clampStat）', () => {
    const current = { str: 0 };
    const delta = { str: -10 };
    // isAdd=true 使用 clampStat，下界 1
    const result = computeBonusChange(current, delta, true);
    expect(result.str).toBe(1);
  });

  it('加成不超过 MAX_STAT', () => {
    const current = { str: 990 };
    const delta = { str: 100 };
    const result = computeBonusChange(current, delta, true);
    expect(result.str).toBe(MAX_STAT);
  });
});

describe('recalculateHpMp HP/MP 重算', () => {
  it('根据新属性重算 maxHp/maxMana', () => {
    const char = makeCharacter({ stats: makeStats({ con: 10, int: 10 }) });
    const newStats = makeStats({ con: 20, int: 20 });
    const result = recalculateHpMp(char, newStats);
    expect(result.maxHp).toBe(calculateMaxHp(newStats));
    expect(result.maxMana).toBe(calculateMaxMana(newStats));
  });

  it('当前 HP 超过新 maxHp 时截断', () => {
    const char = makeCharacter({ hp: 500, maxHp: 500, stats: makeStats({ con: 40 }) });
    const newStats = makeStats({ con: 10 }); // 新 maxHp = 200
    const result = recalculateHpMp(char, newStats);
    expect(result.hp).toBe(result.maxHp);
  });

  it('当前 HP 未超过新 maxHp 时保持不变', () => {
    const char = makeCharacter({ hp: 100, maxHp: 200, stats: makeStats({ con: 10 }) });
    const newStats = makeStats({ con: 20 }); // 新 maxHp = 300
    const result = recalculateHpMp(char, newStats);
    expect(result.hp).toBe(100);
    expect(result.maxHp).toBe(300);
  });
});

describe('computeResurrection 复活', () => {
  it('HP/MP 恢复至 50%', () => {
    const char = makeCharacter({ hp: 0, mana: 0, maxHp: 200, maxMana: 100 });
    const result = computeResurrection(char);
    expect(result.hp).toBe(100); // 200 * 0.5
    expect(result.mana).toBe(50); // 100 * 0.5
  });

  it('经验值清空', () => {
    const char = makeCharacter({ exp: 999 });
    const result = computeResurrection(char);
    expect(result.exp).toBe(0);
  });

  it('向下取整处理奇数上限', () => {
    const char = makeCharacter({ maxHp: 201, maxMana: 101 });
    const result = computeResurrection(char);
    expect(result.hp).toBe(100); // Math.floor(201 * 0.5)
    expect(result.mana).toBe(50); // Math.floor(101 * 0.5)
  });
});

// ============================================================
// 补充覆盖：|| 兜底分支（bonusStats/delta 字段为 0 或 undefined）
// ============================================================

describe('|| 兜底分支覆盖', () => {
  it('computeEffectiveStats: bonusStats.str 为 0 时走 || 0 兜底', () => {
    // Arrange：bonusStats.str = 0 → falsy → 走 || 0 分支
    const base = makeStats({ str: 10 });
    const bonus = { str: 0 };
    // Act
    const effective = computeEffectiveStats(base, makeZeroStats(), makeZeroStats(), bonus);
    // Assert：10 + 0 = 10
    expect(effective.str).toBe(10);
  });

  it('computeEffectiveStats: bonusStats 所有字段为 0 时全部走 || 0 兜底', () => {
    // Arrange：所有字段为 0 → 全部 falsy → 走 || 0 分支
    const base = makeStats({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 });
    const bonus = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    // Act
    const effective = computeEffectiveStats(base, makeZeroStats(), makeZeroStats(), bonus);
    // Assert：所有属性保持原值
    expect(effective.str).toBe(10);
    expect(effective.dex).toBe(10);
    expect(effective.con).toBe(10);
    expect(effective.int).toBe(10);
    expect(effective.wis).toBe(10);
    expect(effective.cha).toBe(10);
  });

  it('computeBonusChange: delta[key] 为 0 时走 || 0 兜底', () => {
    // Arrange：delta.str = 0 → falsy → 走 || 0 分支
    const current = { str: 5 };
    const delta = { str: 0 };
    // Act
    const result = computeBonusChange(current, delta, true);
    // Assert：clampStat(5 + 0) = 5（加成不变）
    expect(result.str).toBe(5);
  });

  it('computeBonusChange: delta[key] 为 0 且 isAdd=false 时走 || 0 兜底', () => {
    // Arrange：delta.str = 0 → falsy → 走 || 0 分支
    const current = { str: 8 };
    const delta = { str: 0 };
    // Act
    const result = computeBonusChange(current, delta, false);
    // Assert：clampBonus(8 - 0) = 8（加成不变）
    expect(result.str).toBe(8);
  });
});
