/**
 * @fileoverview 技能模块类型定义
 * @description 技能/法术系统的类型和接口定义
 * @module modules/skills/types
 */

/** 技能类型 */
export type SkillType = 'attack' | 'heal' | 'buff' | 'debuff' | 'utility';

/** 技能状态 */
export interface SkillCooldown {
  remaining: number;
  max: number;
}

/** 技能数据 */
export interface Skill {
  id: string;
  name: string;
  icon: string;
  type: SkillType;
  description: string;
  mpCost: number;
  cooldown: number;
  damage?: number;
  heal?: number;
  level?: number;
}

/** 技能使用事件 */
export interface SkillCastEvent {
  skill: Skill;
  success: boolean;
}

/** 技能冷却事件 */
export interface SkillCooldownEvent {
  skillId: string;
  remaining: number;
}

/** 技能就绪事件 */
export interface SkillReadyEvent {
  skillId: string;
}

/** 技能服务接口 */
export interface ISkillsService {
  getSkills(): Skill[];
  getSkill(id: string): Skill | null;
  getCooldown(skillId: string): SkillCooldown | null;
  canUseSkill(skillId: string): boolean;
  useSkill(skillId: string): boolean;
  learnSkill(skill: Skill): void;
  forgetSkill(skillId: string): void;
  updateCooldowns(): void;
  reset(): void;
}
