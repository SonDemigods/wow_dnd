/**
 * 角色模块服务层（纯逻辑函数）
 * 
 * 不持有任何内部状态，不直接操作数据库，不发射事件。
 * 所有业务逻辑均为纯函数，数据通过参数传入、通过返回值输出。
 * Store 层负责调用这些纯函数并管理响应式状态与持久化。
 */
import type { Character, Stats, Attributes, RaceData, ClassData, CreateCharacterParams, ExpGainResult, FactionType, RaceType } from './types';
import {
  calculateMaxHp,
  calculateMaxMana,
  calculatePhysicalAttack,
  calculatePhysicalDefense,
  calculateMagicAttack,
  calculateMagicDefense,
  calculateCritChance,
  calculateDodgeChance,
  calculateHealBonus,
  getExpForLevel
} from '@/utils/calculations';
import { MAX_LEVEL, MAX_STAT, POINTS_PER_LEVEL, BASE_STAT_VALUE, DEATH_EXP_RETENTION_RATIO, RESURRECT_HP_RATIO, RESURRECT_MP_RATIO } from '@/config/character';
import { generateId } from '@/utils/db-helpers';
import { getMountOptionById, MOUNT_TIERS } from '@/data/config_mounts';

// ==================== ID 生成 ====================

/** 生成唯一角色ID（格式：char_时间戳_随机串，如 char_1704067200000_a3b9f2c1d） */
export function generateCharacterId(): string {
  return generateId('char');
}

// ==================== 属性计算 ====================

/** 根据种族和职业加成计算初始六大属性（基础值固定为 BASE_STAT_VALUE，加成叠加后 clamp 到 [1, MAX_STAT]） */
export function computeInitialStats(raceBonus: Partial<Stats>, classBonus: Partial<Stats>): Stats {
  return {
    str: clampStat(BASE_STAT_VALUE + (raceBonus.str || 0) + (classBonus.str || 0)),
    dex: clampStat(BASE_STAT_VALUE + (raceBonus.dex || 0) + (classBonus.dex || 0)),
    con: clampStat(BASE_STAT_VALUE + (raceBonus.con || 0) + (classBonus.con || 0)),
    int: clampStat(BASE_STAT_VALUE + (raceBonus.int || 0) + (classBonus.int || 0)),
    wis: clampStat(BASE_STAT_VALUE + (raceBonus.wis || 0) + (classBonus.wis || 0)),
    cha: clampStat(BASE_STAT_VALUE + (raceBonus.cha || 0) + (classBonus.cha || 0))
  };
}

/** 将属性值限制在 [1, MAX_STAT] 范围内 */
function clampStat(value: number): number {
  return Math.min(MAX_STAT, Math.max(1, value));
}

/**
 * 计算四层叠加后的最终核心属性
 *
 * 四层属性模型（见 plan.md §3.1）：
 *   最终属性 = clamp(
 *     基础层(baseStats: 10 + 种族 + 职业)
 *     + 药剂层(potionStats, 不可重置)
 *     + 升级层(allocatedStats, 可重置)
 *     + 装备/天赋层(bonusStats)
 *   , [1, MAX_STAT])
 *
 * 破坏性变更说明：原签名为 (baseStats, bonusStats)，重构为四层签名后所有调用方
 * （store.ts 的 effectiveStats computed / applyBonus / removeBonus / setRace / setClass / reset
 * 以及 useItem 中的药剂分支）需同步更新。影响面仅限 character 模块内部与 inventory.useItem。
 *
 * @param baseStats - 基础层（10 + 种族 + 职业，不含等级加成）
 * @param potionStats - 药剂层（永久叠加，不可重置）
 * @param allocatedStats - 升级层（玩家自由分配，可重置）
 * @param bonusStats - 装备/天赋层（外部加成）
 */
export function computeEffectiveStats(
  baseStats: Stats,
  potionStats: Stats,
  allocatedStats: Stats,
  bonusStats: Partial<Stats>
): Stats {
  return {
    str: clampStat(baseStats.str + potionStats.str + allocatedStats.str + (bonusStats.str || 0)),
    dex: clampStat(baseStats.dex + potionStats.dex + allocatedStats.dex + (bonusStats.dex || 0)),
    con: clampStat(baseStats.con + potionStats.con + allocatedStats.con + (bonusStats.con || 0)),
    int: clampStat(baseStats.int + potionStats.int + allocatedStats.int + (bonusStats.int || 0)),
    wis: clampStat(baseStats.wis + potionStats.wis + allocatedStats.wis + (bonusStats.wis || 0)),
    cha: clampStat(baseStats.cha + potionStats.cha + allocatedStats.cha + (bonusStats.cha || 0))
  };
}

/** 计算衍生属性 */
export function computeAttributes(stats: Stats, primaryStat: keyof Stats = 'dex'): Attributes {
  return {
    maxHp: calculateMaxHp(stats),
    maxMana: calculateMaxMana(stats),
    physicalAttack: calculatePhysicalAttack(stats),
    physicalDefense: calculatePhysicalDefense(stats),
    magicAttack: calculateMagicAttack(stats),
    magicDefense: calculateMagicDefense(stats),
    critChance: calculateCritChance(stats, primaryStat),
    dodgeChance: calculateDodgeChance(stats),
    healBonus: calculateHealBonus(stats)
  };
}

// ==================== 角色创建 ====================

/**
 * 校验职业与阵营的兼容性
 * 所选职业的 factionsIds 必须包含所选阵营 ID（如 death_knight 不对 neutral 开放、evoker 仅对 neutral 开放）
 * @param classData - 职业数据
 * @param factionId - 所选阵营 ID
 * @returns true 表示兼容，false 表示不兼容
 */
export function isClassFactionCompatible(classData: ClassData, factionId: FactionType): boolean {
  return classData.factionsIds.includes(factionId);
}

/**
 * 校验种族与阵营的兼容性
 * 所选种族的 factionId 必须等于当前角色阵营 ID（如 alliance 角色不可切到 horde 种族 orc）
 * @param raceData - 种族数据
 * @param factionId - 所选阵营 ID
 * @returns true 表示兼容，false 表示不兼容
 *
 * P3-100 修复：setRace 入口校验，与 createCharacter 中已有的 isClassFactionCompatible 对齐。
 * 数据依据：RaceData.factionId（种族归属阵营，见 types.ts:190）。
 */
export function isRaceFactionCompatible(raceData: RaceData, factionId: FactionType): boolean {
  return raceData.factionId === factionId;
}

/**
 * 校验职业与种族的兼容性
 * 所选职业的 raceIds 必须包含当前角色种族 ID（空数组表示无限制，对所有种族开放）
 * @param classData - 职业数据
 * @param raceId - 所选种族 ID
 * @returns true 表示兼容，false 表示不兼容
 *
 * P3-100 修复：setClass 入口校验。ClassData.raceIds 为空数组时表示无种族限制（如 warrior 对所有种族开放）；
 * 非空数组时表示有种族限制（如 demon_hunter 仅对 night_elf/blood_elf 开放）。
 */
export function isClassRaceCompatible(classData: ClassData, raceId: RaceType): boolean {
  return classData.raceIds.length === 0 || classData.raceIds.includes(raceId);
}

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
    // 四层属性模型：1 级角色无药剂、无升级分配、无未分配点数
    potionStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    allocatedStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    unallocatedPoints: 0,
    gold: 50,
    // 坐骑配置：5 档全 null（1 级仅解锁 common 档选择权，但初始不预选任何方向）
    mountChoices: [null, null, null, null, null],
    // 天赋分配：初始为空（10 级前无天赋点）
    talentAllocations: {}
  };
}

// ==================== HP / MP 通用资源变更 ====================

/**
 * 通用资源变更函数，统一处理 HP 和 MP 的增减
 * 确保新值在 [0, maxValue] 范围内，返回新对象不修改原对象
 * @param character - 当前角色数据
 * @param amount - 变更量（正数为增加，负数为减少）
 * @param resourceKey - 当前值字段名
 * @param maxKey - 最大值字段名
 */
function applyResourceChange(
  character: Character,
  amount: number,
  resourceKey: 'hp' | 'mana',
  maxKey: 'maxHp' | 'maxMana'
): Character {
  const newValue = Math.min(character[maxKey], Math.max(0, character[resourceKey] + amount));
  return { ...character, [resourceKey]: newValue };
}

/** 计算 HP 变更后的角色数据 */
export function applyHpChange(character: Character, amount: number): Character {
  return applyResourceChange(character, amount, 'hp', 'maxHp');
}

/** 计算 MP 变更后的角色数据 */
export function applyMpChange(character: Character, amount: number): Character {
  return applyResourceChange(character, amount, 'mana', 'maxMana');
}

/** 判断角色是否死亡 */
export function isDead(character: Character): boolean {
  return character.hp <= 0;
}

// ==================== 经验值与升级 ====================

/** 计算经验值增益后的角色数据（含升级判定）
 * 升级逻辑：逐级消耗经验值，每级全属性+1 并回满 HP/MP，直到经验值不足以升级或达到 MAX_LEVEL */
export function applyExpGain(character: Character, amount: number): ExpGainResult {
  if (amount <= 0) return { character, leveledUp: false, levelsGained: 0, newLevel: character.level };

  let newExp = character.exp + amount;
  let newLevel = character.level;
  let levelsGained = 0;
  let mutableChar = { ...character };

  // 逐级升级循环：每次消耗一级经验值，连升多级时全属性叠加增长
  while (newLevel < MAX_LEVEL && newExp >= mutableChar.expToNextLevel) {
    newExp -= mutableChar.expToNextLevel;
    newLevel++;
    levelsGained++;
    mutableChar = applyLevelUp(mutableChar, newLevel);
  }

  // 达到满级后不再累积经验值
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

/**
 * 计算升级后的角色数据
 *
 * 四层属性模型变更（见 plan.md §3.4）：
 * - 不再自动全属性 +1（移除 stats.str + 1 等 6 行）
 * - 改为 unallocatedPoints += POINTS_PER_LEVEL，玩家自由分配
 * - 因 con/int 不再自动增长，maxHp/maxMana 不变；但升级本身仍回满 HP/MP 作为升级奖励
 *
 * @param character - 当前角色数据
 * @param newLevel - 升级后的等级
 */
export function applyLevelUp(character: Character, newLevel: number): Character {
  return {
    ...character,
    level: newLevel,
    unallocatedPoints: character.unallocatedPoints + POINTS_PER_LEVEL,
    // con/int 未自动增长，maxHp/maxMana 不变；升级奖励：回满 HP/MP
    hp: character.maxHp,
    mana: character.maxMana,
    expToNextLevel: getExpForLevel(newLevel + 1)
  };
}

// ==================== 金币 ====================

/** 计算金币变更后的角色数据 */
export function applyGoldChange(character: Character, amount: number): Character {
  return { ...character, gold: Math.max(0, character.gold + amount) };
}

/** 检查是否有足够金币 */
export function canAffordGold(character: Character, amount: number): boolean {
  return amount > 0 && character.gold >= amount;
}

// ==================== 属性加成 ====================

/** 将加成值限制在 [0, MAX_STAT] 范围内（加成的下界为 0，允许完全移除加成） */
function clampBonus(value: number): number {
  return Math.min(MAX_STAT, Math.max(0, value));
}

/** 计算加成变更后的 bonusStats
 * P9-079 修复：isAdd 与 isRemove 统一使用 clampBonus（下界 0），避免零值加成被 clampStat 强制变为 1
 * 原逻辑 isAdd=true 时使用 clampStat（下界 1），导致零值加成（如装备 bonus 中某属性为 0）被错误提升为 1
 */
export function computeBonusChange(currentBonus: Partial<Stats>, delta: Partial<Stats>, isAdd: boolean): Partial<Stats> {
  const result = { ...currentBonus };
  // P3 TS-17 审计决策（2026-07-31）：Object.keys 返回 string[]，TS 语言限制无法静态推断为 (keyof Stats)[]。
  // delta 类型为 Partial<Stats>，键已由类型保证为 keyof Stats，断言是合理 workaround。
  const keys = Object.keys(delta) as (keyof Stats)[];
  for (const key of keys) {
    const current = result[key] || 0;
    const change = delta[key] || 0;
    // P9-079 修复：加成值统一使用 clampBonus（下界 0），零值加成不再被强制变为 1
    result[key] = isAdd
      ? clampBonus(current + change)
      : clampBonus(current - change);
  }
  return result;
}

/** 根据有效 stats 重新计算 HP/MP 上限并修正当前值（上限变化时，当前值不超新上限） */
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

// ==================== 坐骑配置 ====================
// 坐骑系统纯函数（plan.md §3.3）：仅计算 bonus 与解锁状态，不修改 character 也不持久化。
// 应用 bonus 由 Store Action（setMountChoice/resetMountChoices）通过 applyBonus/removeBonus 完成。

/**
 * 计算当前坐骑配置的总加成
 *
 * 遍历 mountChoices 数组，对每个非 null 的方向 ID 查询其 bonus 并累加。
 * 无效 ID 静默跳过（防御性：配置表变更后旧存档可能残留失效 ID）。
 *
 * @param choices - 5 档选择的方向 ID 数组（null 表示未选）
 * @returns 累加后的 Partial<Stats>；全 null 时返回空对象 {}（applyBonus/removeBonus 对空对象无副作用）
 */
export function computeMountBonus(choices: (string | null)[]): Partial<Stats> {
  const result: Partial<Stats> = {};
  for (const optionId of choices) {
    if (!optionId) continue;
    const option = getMountOptionById(optionId);
    if (!option) continue;
    // Object.keys 返回 string[]，TS 语言限制无法静态推断为 (keyof Stats)[]。
    // option.bonus 类型为 Partial<Stats>，键已由类型保证为 keyof Stats，断言是合理 workaround。
    const keys = Object.keys(option.bonus) as (keyof Stats)[];
    for (const key of keys) {
      result[key] = (result[key] ?? 0) + (option.bonus[key] ?? 0);
    }
  }
  return result;
}

/**
 * 获取当前已解锁的档位索引列表
 *
 * 解锁规则（plan.md §2.1）：档位 i 在 level >= i*5 时解锁
 * - 0 级索引：1 级解锁（普通）
 * - 1 级索引：5 级解锁（优秀）
 * - 2 级索引：10 级解锁（稀有）
 * - 3 级索引：15 级解锁（史诗）
 * - 4 级索引：20 级解锁（传说）
 *
 * @param level - 角色当前等级
 * @returns 已解锁的档位索引升序数组（如 12 级返回 [0, 1, 2]）
 */
export function getUnlockedTiers(level: number): number[] {
  return MOUNT_TIERS.filter(t => level >= t.unlockLevel).map(t => t.index);
}

/**
 * 判断指定档位是否已解锁
 *
 * @param tierIndex - 档位索引（0-4）
 * @param level - 角色当前等级
 * @returns true 表示已解锁
 */
export function isTierUnlocked(tierIndex: number, level: number): boolean {
  const tierMeta = MOUNT_TIERS[tierIndex];
  if (!tierMeta) return false;
  return level >= tierMeta.unlockLevel;
}

// ==================== 四层属性：升级分配与药剂层 ====================
// 三个纯函数均只更新对应层级字段，不在此重算 HP/MP 上限。
// HP/MP 重算由 Store Action 统一调用 recalculateHpMp 处理（含装备/天赋 bonusStats），
// 避免纯函数层与 store 层重复 recalc 导致语义混乱。

/**
 * 分配 1 点升级点数到指定属性（纯函数）
 *
 * 行为：
 * - `unallocatedPoints <= 0` 时返回原 character 不变（点数不足）
 * - 否则 allocatedStats[stat]++（受 clampStat 限制 [1, MAX_STAT]），unallocatedPoints--
 * - 不重算 HP/MP：若 stat 为 con/int/wis，由 Store Action 调用 recalculateHpMp
 *
 * 边界：allocatedStats[stat] 已达 MAX_STAT 时仍消耗点数（clampStat 兜底），上层应校验。
 *
 * @param character - 当前角色数据
 * @param stat - 目标属性键
 */
export function allocateStat(character: Character, stat: keyof Stats): Character {
  if (character.unallocatedPoints <= 0) return character;
  return {
    ...character,
    allocatedStats: {
      ...character.allocatedStats,
      [stat]: clampStat(character.allocatedStats[stat] + 1)
    },
    unallocatedPoints: character.unallocatedPoints - 1
  };
}

/**
 * 重置升级层已分配点数（完全免费，纯函数）
 *
 * 行为：
 * - 将 allocatedStats 全部归零
 * - 已分配总量回收至 unallocatedPoints（玩家可重新分配）
 * - 不重算 HP/MP：con/int/wis 可能变化，由 Store Action 调用 recalculateHpMp
 *
 * 不可逆性说明：本函数仅重置升级层（allocatedStats），不影响药剂层（potionStats）。
 *
 * @param character - 当前角色数据
 */
export function resetAllocatedStats(character: Character): Character {
  const spent = Object.values(character.allocatedStats).reduce((a, b) => a + b, 0);
  return {
    ...character,
    allocatedStats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    unallocatedPoints: character.unallocatedPoints + spent
  };
}

/**
 * 将药剂属性加成永久叠加到药剂层（纯函数，不可逆）
 *
 * 行为：
 * - 遍历 delta，将每个属性叠加到 potionStats（受 clampStat 限制）
 * - 不提供对应的 removePotionBonus，确保药剂层永久不可重置
 * - 不重算 HP/MP：若 delta 含 con/int/wis，由 Store Action 调用 recalculateHpMp
 *
 * @param character - 当前角色数据
 * @param delta - 药剂提供的属性加成（如 { str: 1 }）
 */
export function applyPotionBonus(character: Character, delta: Partial<Stats>): Character {
  const newPotionStats = { ...character.potionStats };
  // Object.keys 返回 string[]，TS 语言限制无法静态推断为 (keyof Stats)[]。
  // delta 类型为 Partial<Stats>，键已由类型保证为 keyof Stats，断言是合理 workaround。
  (Object.keys(delta) as (keyof Stats)[]).forEach(key => {
    newPotionStats[key] = clampStat(newPotionStats[key] + (delta[key] || 0));
  });
  return { ...character, potionStats: newPotionStats };
}

// ==================== 死亡与复活 ====================

/** 计算复活后的角色数据（损失部分本级经验，HP/MP 恢复至 50%） */
export function computeResurrection(character: Character): Character {
  return {
    ...character,
    exp: Math.floor(character.exp * DEATH_EXP_RETENTION_RATIO),
    // P1-23 修复：确保复活后至少 1 HP，避免 maxHp 极低时复活为 0 HP 立即死亡形成无限循环
    // P7-011：比例值提取为配置常量
    hp: Math.max(1, Math.floor(character.maxHp * RESURRECT_HP_RATIO)),
    mana: Math.max(1, Math.floor(character.maxMana * RESURRECT_MP_RATIO))
  };
}
