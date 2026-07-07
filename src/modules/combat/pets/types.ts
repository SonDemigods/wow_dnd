/**
 * @fileoverview 术士召唤系统类型定义（Phase 6.4）
 * @description 定义术士可召唤的 5 种恶魔：小鬼、虚空行者、魅魔、地狱犬、末日守卫。
 *              召唤消耗灵魂碎片，召唤物有独立 AI 和行动逻辑。
 * @module combat/pets
 */
import type { Stats } from '@/modules/character/types';

// ============================================================================
// 召唤物类型枚举
// ============================================================================

/**
 * 术士召唤物类型
 *
 * - `imp`：小鬼，远程法术输出，低生命高伤害
 * - `voidwalker`：虚空行者，坦克型，高生命高防御，可嘲讽
 * - `succubus`：魅魔，近战输出，可魅惑控制敌人
 * - `felhunter`：地狱犬，反制型，可驱散和沉默敌人
 * - `doomguard`：末日守卫，终极召唤，强力范围伤害
 */
export type WarlockPetType = 'imp' | 'voidwalker' | 'succubus' | 'felhunter' | 'doomguard';

// ============================================================================
// 召唤物定义接口
// ============================================================================

/**
 * 召唤物 AI 行为类型
 *
 * - `aggressive`：激进型，优先攻击生命最低的敌人
 * - `defensive`：防御型，优先攻击正在攻击主人的敌人
 * - `caster`：施法型，保持距离优先释放法术
 * - `controller`：控制型，优先释放控制技能
 * - `support`：辅助型，优先驱散/反制敌方施法者
 */
export type PetAIBehavior = 'aggressive' | 'defensive' | 'caster' | 'controller' | 'support';

/**
 * 召唤物基础属性接口
 *
 * 描述召唤物的基础属性值（不含等级加成）。
 *
 * @property {Stats} baseStats - 基础六维属性
 * @property {number} baseHp - 基础生命值
 * @property {number} baseDamage - 基础伤害值
 * @property {number} baseDefense - 基础防御值
 * @property {number} baseSpeed - 基础速度值
 */
export interface PetBaseAttributes {
  baseStats: Stats;
  baseHp: number;
  baseDamage: number;
  baseDefense: number;
  baseSpeed: number;
}

/**
 * 召唤物技能接口
 *
 * 描述召唤物可使用的技能，简化版技能结构（仅包含战斗所需字段）。
 *
 * @property {string} id - 技能 ID
 * @property {string} name - 技能名称
 * @property {string} description - 技能描述
 * @property {'attack' | 'debuff' | 'buff' | 'control' | 'heal'} category - 技能类别
 * @property {number} damageMultiplier - 伤害倍率（基于召唤物基础伤害）
 * @property {number} cooldown - 冷却回合数（0 表示每回合可用）
 * @property {number} priority - AI 选择优先级（数值越大越优先）
 */
export interface PetSkill {
  id: string;
  name: string;
  description: string;
  category: 'attack' | 'debuff' | 'buff' | 'control' | 'heal';
  damageMultiplier: number;
  cooldown: number;
  priority: number;
}

/**
 * 术士召唤物定义接口
 *
 * @property {WarlockPetType} id - 召唤物 ID
 * @property {string} name - 召唤物名称
 * @property {string} icon - 召唤物图标（Iconify 格式）
 * @property {string} description - 召唤物描述
 * @property {PetAIBehavior} aiBehavior - AI 行为类型
 * @property {PetBaseAttributes} attributes - 基础属性
 * @property {PetSkill[]} skills - 可用技能列表
 * @property {number} soulShardCost - 召唤所需灵魂碎片
 * @property {number} duration - 持续回合数（0 表示永久，直到被解散或死亡）
 */
export interface WarlockPet {
  id: WarlockPetType;
  name: string;
  icon: string;
  description: string;
  aiBehavior: PetAIBehavior;
  attributes: PetBaseAttributes;
  skills: PetSkill[];
  soulShardCost: number;
  duration: number;
}

// ============================================================================
// 召唤物运行时状态接口
// ============================================================================

/**
 * 召唤物运行时实例接口
 *
 * 召唤物在战斗中的实际状态，由 base 属性 + 等级加成计算得出。
 *
 * @property {string} instanceId - 实例唯一 ID（用于战斗中区分多个召唤物）
 * @property {WarlockPetType} petId - 召唤物类型 ID
 * @property {string} name - 显示名称
 * @property {number} level - 召唤物等级（通常等于术士等级）
 * @property {number} hp - 当前生命值
 * @property {number} maxHp - 最大生命值
 * @property {number} damage - 伤害值
 * @property {number} defense - 防御值
 * @property {number} speed - 速度值
 * @property {Stats} stats - 当前六维属性
 * @property {PetSkill[]} skills - 可用技能列表
 * @property {PetAIBehavior} aiBehavior - AI 行为类型
 * @property {number} durationRemaining - 持续剩余回合数
 * @property {Map<string, number>} skillCooldowns - 技能冷却映射（技能 ID → 剩余冷却）
 */
export interface PetInstance {
  instanceId: string;
  petId: WarlockPetType;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  damage: number;
  defense: number;
  speed: number;
  stats: Stats;
  skills: PetSkill[];
  aiBehavior: PetAIBehavior;
  durationRemaining: number;
  skillCooldowns: Map<string, number>;
}

/**
 * 召唤系统状态接口
 *
 * @property {PetInstance | null} activePet - 当前激活的召唤物（无则 null）
 * @property {WarlockPetType[]} unlockedPets - 已解锁的召唤物列表
 */
export interface PetSystemState {
  activePet: PetInstance | null;
  unlockedPets: WarlockPetType[];
}

// ============================================================================
// 召唤配置常量
// ============================================================================

/**
 * 召唤系统配置常量
 */
export const PET_SUMMON_CONFIG = {
  /** 每级生命值加成系数（每级 +5%） */
  hpGrowthPerLevel: 0.05,
  /** 每级伤害加成系数（每级 +3%） */
  damageGrowthPerLevel: 0.03,
  /** 每级防御加成系数（每级 +3%） */
  defenseGrowthPerLevel: 0.03,
  /** 每级属性加成值（每级 +1 点全属性） */
  statGrowthPerLevel: 1,
  /** 召唤消耗的回合数 */
  actionPointCost: 1,
  /** 实例 ID 前缀 */
  instanceIdPrefix: 'pet_',
} as const;

/**
 * AI 行为对应的目标选择优先级
 *
 * 用于 AI 在多个敌人中选择攻击目标的策略。
 */
export const PET_AI_TARGET_PRIORITY: Record<PetAIBehavior, string> = {
  aggressive: 'lowest_hp',
  defensive: 'attacking_master',
  caster: 'highest_hp',
  controller: 'caster_enemy',
  support: 'caster_enemy',
};
