/**
 * @fileoverview 技能模块类型定义
 * @description 包含技能类型、技能数据、技能栏、技能服务等相关类型定义
 */

import type { EffectType } from '../combat/effects';

/**
 * 技能类型枚举
 * - physical_damage: 物理伤害技能
 * - magic_damage: 魔法伤害技能
 * - health_restore: 生命恢复技能
 * - mana_restore: 法力恢复技能
 * - buff: 增益技能（对自身/友方施加正面效果）
 * - debuff: 减益技能（对敌人施加负面效果）
 */
export type SkillType =
  | 'physical_damage'
  | 'magic_damage'
  | 'health_restore'
  | 'mana_restore'
  | 'buff'
  | 'debuff';

/**
 * 技能槽位索引类型
 * 技能栏中4个槽位的索引范围（0-3）
 */
export type SkillSlotIndex = 0 | 1 | 2 | 3;

/**
 * 技能效果接口
 * 描述技能效果的详细参数
 * @property {SkillType} type - 技能类型
 * @property {number} value - 基础效果值
 * @property {number} [coefficient] - 系数（用于计算实际效果）
 */
export interface SkillEffect {
  type: SkillType;
  value: number;
  coefficient?: number;
}

/**
 * 技能 Buff/Debuff 效果配置
 * @property {EffectType} type - 效果类型（如 attack_up、poison、shield 等）
 * @property {number} value - 效果基础值
 * @property {number} turns - 持续回合数
 */
export interface SkillBuffEffect {
  /** 效果类型（引用 combat/effects 中的 EffectType） */
  type: EffectType;
  /** 效果基础值（攻击/防御变化点数、护盾量、DoT 伤害等） */
  value: number;
  /** 持续回合数 */
  turns: number;
}

/**
 * 技能数据接口
 * 完整的技能信息，包含静态属性和运行时状态
 * @property {string} id - 技能ID
 * @property {string} name - 技能名称
 * @property {string} icon - 技能图标
 * @property {string} description - 技能描述
 * @property {number} mpCost - 法力消耗
 * @property {SkillType} type - 技能类型
 * @property {SkillEffect} effect - 技能效果
 * @property {number} unlockLevel - 解锁等级
 */
export interface Skill {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: SkillType;
  effect: SkillEffect;
  unlockLevel: number;
  /** 冷却回合数，0=无冷却 */
  cooldown?: number;
  /** 可使用此技能的角色类型，默认仅玩家 */
  usableBy?: 'player' | 'enemy' | 'both';
  /** 技能目标类型 */
  targetType?: 'single' | 'all_enemies' | 'self' | 'ally';
  /** Buff/Debuff 效果列表（仅 buff/debuff 类型技能使用） */
  buffs?: SkillBuffEffect[];
}

/** 技能施放应用的效果记录 */
export interface AppliedEffectInfo {
  /** 效果类型 */
  type: EffectType;
  /** 效果数值 */
  value: number;
  /** 持续回合数 */
  turns: number;
}

/**
 * 技能使用结果接口
 * 技能使用后的返回结果
 * @property {boolean} success - 是否成功
 * @property {string} skillId - 技能ID
 * @property {SkillType} type - 技能类型
 * @property {number} [damage] - 造成的伤害
 * @property {number} [heal] - 生命恢复量
 * @property {string} message - 结果消息
 * @property {AppliedEffectInfo[]} [appliedEffects] - 施加的效果列表（buff/debuff 技能时返回）
 */
export interface SkillUseResult {
  success: boolean;
  skillId: string;
  type: SkillType;
  damage?: number;
  heal?: number;
  message: string;
  /** 施加的效果列表（buff/debuff 技能使用后返回） */
  appliedEffects?: AppliedEffectInfo[];
}

/**
 * 技能栏配置接口
 * 管理玩家当前装备的4个技能
 * @property {[string | null, string | null, string | null, string | null]} slots - 技能槽位（4个），存储技能ID或null
 */
export interface SkillBar {
  slots: [string | null, string | null, string | null, string | null];
}

/**
 * 技能模块存储数据接口
 * @property {string} characterId - 角色ID
 * @property {string[]} skills - 已学技能 ID 列表（仅存 ID，完整数据从 config_skills 模板获取）
 * @property {SkillBar} skillBar - 技能栏配置
 * @property {string | null} currentClass - 当前职业
 * @property {number} updatedAt - 更新时间戳
 */
export interface SkillsData {
  characterId: string;
  skills: string[];
  skillBar: SkillBar;
  currentClass: string | null;
  updatedAt: number;
}

/**
 * 技能模板存储接口
 */
export interface SkillTemplateStorage {
  id: string;
  name: string;
  icon: string;
  description: string;
  mpCost: number;
  type: SkillType;
  effect: { type: SkillType; value: number; coefficient?: number };
  unlockLevel: number;
  classRestriction: string | null;
  targetType?: string;
  /** 可使用此技能的角色类型 */
  usableBy?: 'player' | 'enemy' | 'both';
  /** 冷却回合数 */
  cooldown?: number;
  /** Buff/Debuff 效果列表 */
  buffs?: SkillBuffEffect[];
}
