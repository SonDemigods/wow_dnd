/**
 * @fileoverview 术士召唤系统纯函数服务层（Phase 6.4）
 * @description 提供召唤物属性计算、召唤校验、AI 行动选择等纯函数。
 *              不持有状态、不调用 DB、不发射事件，可独立进行单元测试。
 * @module combat/pets
 */
import type {
  PetInstance,
  PetSkill,
  PetSystemState,
  WarlockPet,
  WarlockPetType,
} from './types';
import { PET_SUMMON_CONFIG } from './types';
import { DEFAULT_UNLOCKED_PETS, getPetByType } from './warlockPets';
import type { Stats } from '@/modules/character/types';

// ============================================================
// 召唤物实例创建与属性计算
// ============================================================

/**
 * 生成召唤物实例的唯一 ID
 *
 * @returns 形如 `pet_xxxxxxxx` 的唯一 ID
 */
export function generatePetInstanceId(): string {
  return `${PET_SUMMON_CONFIG.instanceIdPrefix}${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 根据等级计算召唤物的实际属性
 *
 * 召唤物属性 = 基础属性 × (1 + 等级加成系数 × 等级)
 * 属性加成包含：生命、伤害、防御和六维属性
 *
 * @param petType - 召唤物类型
 * @param level - 召唤物等级（等于术士等级）
 * @returns 计算后的实例属性
 */
export function calculatePetAttributes(
  petType: WarlockPetType,
  level: number
): {
  maxHp: number;
  damage: number;
  defense: number;
  speed: number;
  stats: Stats;
} {
  const pet = getPetByType(petType);
  const attrs = pet.attributes;

  // 等级加成系数（level 1 时为 0，level 10 时为 9×系数）
  const levelBonus = Math.max(0, level - 1);

  // 生命值：基础 + 基础 × (5% × 等级加成)
  const maxHp = Math.floor(
    attrs.baseHp * (1 + PET_SUMMON_CONFIG.hpGrowthPerLevel * levelBonus)
  );

  // 伤害值：基础 + 基础 × (3% × 等级加成)
  const damage = Math.floor(
    attrs.baseDamage * (1 + PET_SUMMON_CONFIG.damageGrowthPerLevel * levelBonus)
  );

  // 防御值：基础 + 基础 × (3% × 等级加成)
  const defense = Math.floor(
    attrs.baseDefense * (1 + PET_SUMMON_CONFIG.defenseGrowthPerLevel * levelBonus)
  );

  // 速度值：不随等级变化（保持召唤物特色）
  const speed = attrs.baseSpeed;

  // 六维属性：基础 + 等级加成值 × 等级加成
  const statGrowth = PET_SUMMON_CONFIG.statGrowthPerLevel * levelBonus;
  const stats: Stats = {
    str: attrs.baseStats.str + statGrowth,
    dex: attrs.baseStats.dex + statGrowth,
    con: attrs.baseStats.con + statGrowth,
    int: attrs.baseStats.int + statGrowth,
    wis: attrs.baseStats.wis + statGrowth,
    cha: attrs.baseStats.cha + statGrowth,
  };

  return { maxHp, damage, defense, speed, stats };
}

/**
 * 创建召唤物实例
 *
 * 根据召唤物定义和术士等级创建运行时实例。
 *
 * @param petType - 召唤物类型
 * @param level - 召唤物等级
 * @returns 召唤物实例
 */
export function createPetInstance(petType: WarlockPetType, level: number): PetInstance {
  const pet = getPetByType(petType);
  const attrs = calculatePetAttributes(petType, level);

  // 初始化技能冷却映射（所有技能初始冷却为 0）
  const skillCooldowns = new Map<string, number>();
  for (const skill of pet.skills) {
    skillCooldowns.set(skill.id, 0);
  }

  return {
    instanceId: generatePetInstanceId(),
    petId: petType,
    name: pet.name,
    level,
    hp: attrs.maxHp,
    maxHp: attrs.maxHp,
    damage: attrs.damage,
    defense: attrs.defense,
    speed: attrs.speed,
    stats: attrs.stats,
    skills: [...pet.skills],
    aiBehavior: pet.aiBehavior,
    durationRemaining: pet.duration,
    skillCooldowns,
  };
}

// ============================================================
// 召唤校验
// ============================================================

/**
 * 检查是否可以召唤指定召唤物
 *
 * 校验项：
 * 1. 召唤物必须已解锁
 * 2. 灵魂碎片必须足够
 * 3. 当前没有其他激活的召唤物（一次只能有一个召唤物）
 *
 * @param petType - 目标召唤物
 * @param state - 当前召唤系统状态
 * @param soulShards - 当前灵魂碎片数量
 * @returns 校验结果
 */
export function canSummonPet(
  petType: WarlockPetType,
  state: PetSystemState,
  soulShards: number
): { canSummon: boolean; reason: string } {
  // 1. 检查是否已解锁
  if (!state.unlockedPets.includes(petType)) {
    return { canSummon: false, reason: '该召唤物尚未解锁' };
  }

  // 2. 检查灵魂碎片是否足够
  const pet = getPetByType(petType);
  if (soulShards < pet.soulShardCost) {
    return {
      canSummon: false,
      reason: `灵魂碎片不足（需要 ${pet.soulShardCost}，当前 ${soulShards}）`,
    };
  }

  // 3. 检查是否已有激活的召唤物
  if (state.activePet !== null) {
    return { canSummon: false, reason: '已有激活的召唤物，请先解散' };
  }

  return { canSummon: true, reason: '' };
}

/**
 * 检查是否可以解散当前召唤物
 *
 * @param state - 当前召唤系统状态
 * @returns 校验结果
 */
export function canDismissPet(
  state: PetSystemState
): { canDismiss: boolean; reason: string } {
  if (state.activePet === null) {
    return { canDismiss: false, reason: '当前没有激活的召唤物' };
  }
  return { canDismiss: true, reason: '' };
}

// ============================================================
// 召唤与解散（纯函数，返回新状态）
// ============================================================

/**
 * 执行召唤（纯函数，返回新状态）
 *
 * 注意：此函数不检查可召唤性，调用方应先调用 canSummonPet。
 * 此函数也不消耗灵魂碎片，由调用方负责。
 *
 * @param state - 当前召唤系统状态
 * @param petType - 目标召唤物
 * @param level - 召唤物等级
 * @returns 新的召唤系统状态
 */
export function summonPet(
  state: PetSystemState,
  petType: WarlockPetType,
  level: number
): PetSystemState {
  const instance = createPetInstance(petType, level);
  return {
    ...state,
    activePet: instance,
  };
}

/**
 * 执行解散（纯函数，返回新状态）
 *
 * @param state - 当前召唤系统状态
 * @returns 新的召唤系统状态
 */
export function dismissPet(state: PetSystemState): PetSystemState {
  return {
    ...state,
    activePet: null,
  };
}

// ============================================================
// 召唤物战斗逻辑
// ============================================================

/**
 * 计算召唤物技能伤害
 *
 * @param pet - 召唤物实例
 * @param skill - 使用的技能
 * @returns 伤害值（向下取整）
 */
export function calculatePetSkillDamage(pet: PetInstance, skill: PetSkill): number {
  return Math.floor(pet.damage * skill.damageMultiplier);
}

/**
 * 召唤物受到伤害
 *
 * 返回受到伤害后的实例（不可变更新）。
 *
 * @param pet - 召唤物实例
 * @param damage - 原始伤害值（已扣除防御）
 * @returns 更新后的实例
 */
export function damagePet(pet: PetInstance, damage: number): PetInstance {
  const actualDamage = Math.max(0, damage);
  const newHp = Math.max(0, pet.hp - actualDamage);
  return { ...pet, hp: newHp };
}

/**
 * 召唤物恢复生命
 *
 * @param pet - 召唤物实例
 * @param heal - 治疗量
 * @returns 更新后的实例
 */
export function healPet(pet: PetInstance, heal: number): PetInstance {
  const newHp = Math.min(pet.maxHp, pet.hp + heal);
  return { ...pet, hp: newHp };
}

/**
 * 检查召唤物是否死亡
 *
 * @param pet - 召唤物实例
 * @returns 是否死亡
 */
export function isPetDead(pet: PetInstance): boolean {
  return pet.hp <= 0;
}

// ============================================================
// 技能冷却管理
// ============================================================

/**
 * 检查技能是否可用（冷却完毕）
 *
 * @param pet - 召唤物实例
 * @param skillId - 技能 ID
 * @returns 是否可用
 */
export function isSkillReady(pet: PetInstance, skillId: string): boolean {
  const cooldown = pet.skillCooldowns.get(skillId) ?? 0;
  return cooldown <= 0;
}

/**
 * 获取召唤物所有可用技能（冷却完毕）
 *
 * @param pet - 召唤物实例
 * @returns 可用技能列表
 */
export function getReadySkills(pet: PetInstance): PetSkill[] {
  return pet.skills.filter(skill => isSkillReady(pet, skill.id));
}

/**
 * 使用技能后设置冷却（返回新实例）
 *
 * @param pet - 召唤物实例
 * @param skillId - 使用的技能 ID
 * @returns 更新后的实例
 */
export function setSkillCooldown(pet: PetInstance, skillId: string): PetInstance {
  const skill = pet.skills.find(s => s.id === skillId);
  if (!skill) return pet;

  const newCooldowns = new Map(pet.skillCooldowns);
  newCooldowns.set(skillId, skill.cooldown);
  return { ...pet, skillCooldowns: newCooldowns };
}

/**
 * 回合结束时减少所有技能冷却（返回新实例）
 *
 * @param pet - 召唤物实例
 * @returns 更新后的实例
 */
export function tickSkillCooldowns(pet: PetInstance): PetInstance {
  const newCooldowns = new Map<string, number>();
  for (const [skillId, cooldown] of pet.skillCooldowns) {
    newCooldowns.set(skillId, Math.max(0, cooldown - 1));
  }
  return { ...pet, skillCooldowns: newCooldowns };
}

// ============================================================
// 召唤物 AI 行动逻辑
// ============================================================

/**
 * AI 选择行动
 *
 * 根据召唤物的 AI 行为类型，从可用技能中选择优先级最高的技能。
 * 如果没有可用技能，则使用默认攻击（damageMultiplier=1.0）。
 *
 * @param pet - 召唤物实例
 * @returns 选择的技能
 */
export function selectPetAction(pet: PetInstance): PetSkill {
  const readySkills = getReadySkills(pet);
  if (readySkills.length === 0) {
    // 无可用技能时返回默认攻击
    return {
      id: 'basic_attack',
      name: '普通攻击',
      description: '召唤物的普通攻击',
      category: 'attack',
      damageMultiplier: 1.0,
      cooldown: 0,
      priority: 0,
    };
  }

  // 按优先级降序排列，选择最高优先级
  const sorted = [...readySkills].sort((a, b) => b.priority - a.priority);
  return sorted[0];
}

// ============================================================
// 状态管理
// ============================================================

/**
 * 创建初始召唤系统状态
 *
 * 默认无激活召唤物，已解锁小鬼和虚空行者。
 *
 * @returns 初始召唤系统状态
 */
export function createInitialPetState(): PetSystemState {
  return {
    activePet: null,
    unlockedPets: [...DEFAULT_UNLOCKED_PETS],
  };
}

/**
 * 解锁新召唤物（纯函数，返回新状态）
 *
 * @param state - 当前状态
 * @param petType - 要解锁的召唤物
 * @returns 新状态
 */
export function unlockPet(
  state: PetSystemState,
  petType: WarlockPetType
): PetSystemState {
  if (state.unlockedPets.includes(petType)) return state;
  return {
    ...state,
    unlockedPets: [...state.unlockedPets, petType],
  };
}

/**
 * 回合结束时更新召唤物状态
 *
 * 1. 减少技能冷却
 * 2. 减少持续时间（如果有）
 * 3. 检查召唤物是否过期或死亡
 *
 * @param state - 当前召唤系统状态
 * @returns 更新后的状态
 */
export function tickPetTurn(state: PetSystemState): PetSystemState {
  if (state.activePet === null) return state;

  const pet = state.activePet;

  // 召唤物已死亡
  if (isPetDead(pet)) {
    return { ...state, activePet: null };
  }

  // 减少技能冷却
  let newPet = tickSkillCooldowns(pet);

  // 减少持续时间（duration=0 表示永久，不减少）
  if (newPet.durationRemaining > 0) {
    newPet = { ...newPet, durationRemaining: newPet.durationRemaining - 1 };
    // 持续时间到期
    if (newPet.durationRemaining <= 0) {
      return { ...state, activePet: null };
    }
  }

  return { ...state, activePet: newPet };
}

/**
 * 获取当前召唤物定义
 *
 * @param state - 召唤系统状态
 * @returns 召唤物定义（无激活召唤物时返回 null）
 */
export function getActivePetDefinition(state: PetSystemState): WarlockPet | null {
  if (state.activePet === null) return null;
  return getPetByType(state.activePet.petId);
}

/**
 * 获取当前激活召唤物的灵魂碎片消耗
 *
 * @param state - 召唤系统状态
 * @returns 灵魂碎片消耗（无激活召唤物时返回 0）
 */
export function getActivePetSoulShardCost(state: PetSystemState): number {
  const def = getActivePetDefinition(state);
  return def?.soulShardCost ?? 0;
}
