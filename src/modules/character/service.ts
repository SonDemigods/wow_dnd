/**
 * 角色模块服务层（纯逻辑函数）
 * 
 * 不持有任何内部状态，不直接操作数据库，不发射事件。
 * 所有业务逻辑均为纯函数，数据通过参数传入、通过返回值输出。
 * Store 层负责调用这些纯函数并管理响应式状态与持久化。
 */
import type { Character, Stats, Attributes, RaceData, ClassData, CreateCharacterParams, ExpGainResult } from './types';
import {
  calculateMaxHp,
  calculateMaxMana,
  calculatePhysicalAttack,
  calculatePhysicalDefense,
  calculateMagicAttack,
  calculateMagicDefense,
  calculateCritChance,
  calculateDodgeChance,
  calculateHpBonus,
  calculateMpBonus,
  calculateHealBonus,
  getExpForLevel
} from '@/utils/calculations';
import { MAX_LEVEL, MAX_STAT } from '@/config/character';

// ==================== ID 生成 ====================

/** 生成唯一角色ID */
export function generateCharacterId(): string {
  return `char_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ==================== 属性计算 ====================

/** 根据种族和职业加成计算初始六大属性 */
export function computeInitialStats(raceBonus: Partial<Stats>, classBonus: Partial<Stats>): Stats {
  return {
    str: clampStat(10 + (raceBonus.str || 0) + (classBonus.str || 0)),
    dex: clampStat(10 + (raceBonus.dex || 0) + (classBonus.dex || 0)),
    con: clampStat(10 + (raceBonus.con || 0) + (classBonus.con || 0)),
    int: clampStat(10 + (raceBonus.int || 0) + (classBonus.int || 0)),
    wis: clampStat(10 + (raceBonus.wis || 0) + (classBonus.wis || 0)),
    cha: clampStat(10 + (raceBonus.cha || 0) + (classBonus.cha || 0))
  };
}

/** 将属性值限制在 [1, MAX_STAT] 范围内 */
function clampStat(value: number): number {
  return Math.min(MAX_STAT, Math.max(1, value));
}

/** 计算合併 bonus、种族加成、职业加成后的最终核心属性 */
export function computeEffectiveStats(baseStats: Stats, bonusStats: Partial<Stats>): Stats {
  return {
    str: clampStat(baseStats.str + (bonusStats.str || 0)),
    dex: clampStat(baseStats.dex + (bonusStats.dex || 0)),
    con: clampStat(baseStats.con + (bonusStats.con || 0)),
    int: clampStat(baseStats.int + (bonusStats.int || 0)),
    wis: clampStat(baseStats.wis + (bonusStats.wis || 0)),
    cha: clampStat(baseStats.cha + (bonusStats.cha || 0))
  };
}

/** 计算衍生属性 */
export function computeAttributes(stats: Stats): Attributes {
  return {
    maxHp: calculateMaxHp(stats),
    maxMana: calculateMaxMana(stats),
    physicalAttack: calculatePhysicalAttack(stats),
    physicalDefense: calculatePhysicalDefense(stats),
    magicAttack: calculateMagicAttack(stats),
    magicDefense: calculateMagicDefense(stats),
    critChance: calculateCritChance(stats),
    dodgeChance: calculateDodgeChance(stats),
    hpBonus: calculateHpBonus(stats),
    mpBonus: calculateMpBonus(stats),
    healBonus: calculateHealBonus(stats)
  };
}

// ==================== 角色创建 ====================

/** 创建初始角色（纯函数） */
export function createInitialCharacter(params: CreateCharacterParams, raceData: RaceData, classData: ClassData): Character {
  const raceBonus = raceData?.bonus || {};
  const classBonus = classData?.bonus || {};
  const baseStats = computeInitialStats(raceBonus, classBonus);

  return {
    name: params.name,
    factionId: params.factionId,
    raceId: params.raceId,
    classId: params.classId,
    level: 1,
    exp: 0,
    expToNextLevel: getExpForLevel(2),
    hp: calculateMaxHp(baseStats),
    maxHp: calculateMaxHp(baseStats),
    mana: calculateMaxMana(baseStats),
    maxMana: calculateMaxMana(baseStats),
    stats: baseStats,
    gold: 50
  };
}

// ==================== 生命值 / 法力值 ====================

/** 计算 HP 变更后的角色数据（返回新对象，不修改原对象） */
export function applyHpChange(character: Character, amount: number): Character {
  const newHp = Math.min(character.maxHp, Math.max(0, character.hp + amount));
  return { ...character, hp: newHp };
}

/** 计算 MP 变更后的角色数据 */
export function applyMpChange(character: Character, amount: number): Character {
  const newMana = Math.min(character.maxMana, Math.max(0, character.mana + amount));
  return { ...character, mana: newMana };
}

/** 判断角色是否死亡 */
export function isDead(character: Character): boolean {
  return character.hp <= 0;
}

// ==================== 经验值与升级 ====================

/** 计算经验值增益后的角色数据（含升级判定） */
export function applyExpGain(character: Character, amount: number): ExpGainResult {
  if (amount <= 0) return { character, leveledUp: false, levelsGained: 0, newLevel: character.level };

  let newExp = character.exp + amount;
  let newLevel = character.level;
  let levelsGained = 0;
  let mutableChar = { ...character };

  while (newLevel < MAX_LEVEL && newExp >= mutableChar.expToNextLevel) {
    newExp -= mutableChar.expToNextLevel;
    newLevel++;
    levelsGained++;
    mutableChar = applyLevelUp(mutableChar, newLevel);
  }

  if (newLevel >= MAX_LEVEL) {
    newExp = 0;
  }

  mutableChar.exp = newExp;
  mutableChar.level = newLevel;

  return {
    character: mutableChar,
    leveledUp: levelsGained > 0,
    levelsGained,
    newLevel
  };
}

/** 计算升级后的角色数据（每级全属性+1，HP/MP 重新计算并回满） */
export function applyLevelUp(character: Character, newLevel: number): Character {
  const updatedStats: Stats = {
    str: clampStat(character.stats.str + 1),
    dex: clampStat(character.stats.dex + 1),
    con: clampStat(character.stats.con + 1),
    int: clampStat(character.stats.int + 1),
    wis: clampStat(character.stats.wis + 1),
    cha: clampStat(character.stats.cha + 1)
  };

  const newMaxHp = calculateMaxHp(updatedStats);
  const newMaxMana = calculateMaxMana(updatedStats);

  return {
    ...character,
    level: newLevel,
    stats: updatedStats,
    maxHp: newMaxHp,
    hp: newMaxHp,
    maxMana: newMaxMana,
    mana: newMaxMana,
    expToNextLevel: getExpForLevel(newLevel + 1)
  };
}

// ==================== 金币 ====================

/** 计算金币变更后的角色数据 */
export function applyGoldChange(character: Character, amount: number): Character {
  return { ...character, gold: character.gold + amount };
}

/** 检查是否有足够金币 */
export function canAffordGold(character: Character, amount: number): boolean {
  return amount > 0 && character.gold >= amount;
}

// ==================== 属性加成 ====================

/** 计算加成变更后的 bonusStats */
export function computeBonusChange(currentBonus: Partial<Stats>, delta: Partial<Stats>, isAdd: boolean): Partial<Stats> {
  const result = { ...currentBonus };
  const keys = Object.keys(delta) as (keyof Stats)[];
  for (const key of keys) {
    const current = result[key] || 0;
    const change = delta[key] || 0;
    result[key] = isAdd
      ? clampStat(current + change)
      : Math.max(0, current - change);
  }
  return result;
}

/** 重新计算基础属性（变更种族/职业时使用） */
export function recalculateBaseStats(raceBonus: Partial<Stats>, classBonus: Partial<Stats>): Stats {
  return computeInitialStats(raceBonus, classBonus);
}

/** 根据有效 stats 重新计算 HP/MP 上限并修正当前值 */
export function recalculateHpMp(character: Character, effectiveStats: Stats): Character {
  const newMaxHp = calculateMaxHp(effectiveStats);
  const newMaxMana = calculateMaxMana(effectiveStats);
  return {
    ...character,
    maxHp: newMaxHp,
    hp: Math.min(character.hp, newMaxHp),
    maxMana: newMaxMana,
    mana: Math.min(character.mana, newMaxMana)
  };
}

// ==================== 死亡与复活 ====================

/** 计算复活后的角色数据 */
export function computeResurrection(character: Character): Character {
  return {
    ...character,
    exp: 0,
    hp: Math.floor(character.maxHp * 0.5),
    mana: Math.floor(character.maxMana * 0.5)
  };
}

// ==================== 默认值 ====================

/** 获取默认角色数据（用于未登录时的占位显示） */
export function getDefaultCharacter(): Character {
  return {
    name: '',
    factionId: 'neutral',
    raceId: 'human',
    classId: 'warrior',
    level: 1,
    exp: 0,
    expToNextLevel: 100,
    hp: 100,
    maxHp: 100,
    mana: 50,
    maxMana: 50,
    stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    gold: 0
  };
}
