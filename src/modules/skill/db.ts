/**
 * 技能模块数据层
 * 
 * 封装技能数据的 IndexedDB 操作，提供数据持久化能力。
 * skills 字段仅存储技能 ID 数组，完整技能数据从 config_skills 模板表获取。
 */
import { db as gameDb, dbService } from '../data/core';
import type { Skill, SkillBar, SkillsData, SkillType, SkillTemplateStorage } from './types';
import { toRawData } from '../../utils';

/**
 * 技能数据层服务
 */
export class SkillsDbService {
  /**
   * 保存技能数据到数据库（原生存储，不做 JSON 序列化）
   * @param data - 技能数据
   */
  async saveSkillsData(data: SkillsData): Promise<void> {
    await dbService.withRetry(async () => {
      // JSON 序列化往返：去除 undefined 值，确保所有数据可被结构化克隆
      const clean = toRawData(data);
      await gameDb.char_skills.put({
        characterId: clean.characterId,
        skills: clean.skills,
        skillBar: clean.skillBar,
        currentClass: clean.currentClass,
        updatedAt: clean.updatedAt
      });
    });
  }

  /**
   * 获取技能数据
   * @param characterId - 角色ID
   * @returns 技能数据
   */
  async getSkillsData(characterId: string): Promise<SkillsData> {
    return dbService.withRetry(async () => {
      const data = await gameDb.char_skills.get(characterId) as SkillsData | undefined;
      if (!data) {
        return this.getDefaultSkillsData(characterId);
      }

      // skills 仅存 ID 数组，直接读取
      const skills: string[] = Array.isArray(data.skills) ? data.skills : [];
      const skillBar: SkillBar = (data.skillBar && Array.isArray(data.skillBar.slots))
        ? data.skillBar
        : { slots: [null, null, null, null] };

      return {
        characterId: data.characterId,
        skills,
        skillBar,
        currentClass: data.currentClass,
        updatedAt: data.updatedAt
      };
    });
  }

  /**
   * 获取默认技能数据
   */
  private getDefaultSkillsData(characterId: string): SkillsData {
    return {
      characterId,
      skills: [],
      skillBar: { slots: [null, null, null, null] },
      currentClass: null,
      updatedAt: Date.now()
    };
  }

  /**
   * 删除技能数据
   * @param characterId - 角色ID
   */
  async deleteSkillsData(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_skills.delete(characterId);
    });
  }

  /**
   * 保存技能模板到数据库
   * @param skill - 技能数据
   * @param classRestriction - 职业限制（可选）
   */
  async saveSkillTemplate(skill: Skill, classRestriction?: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_skills.put({
        id: skill.id,
        name: skill.name,
        icon: skill.icon,
        description: skill.description,
        mpCost: skill.mpCost,
        type: skill.type,
        effect: skill.effect,
        unlockLevel: skill.unlockLevel,
        classRestriction: classRestriction || null,
        targetType: skill.targetType || null,
        usableBy: skill.usableBy || 'player',
        cooldown: skill.cooldown ?? 0,
        buffs: skill.buffs || null
      });
    });
  }

  /**
   * 将数据库存储格式转换为 Skill 对象
   */
  private toSkill(data: SkillTemplateStorage): Skill {
    return {
      id: data.id,
      name: data.name,
      icon: data.icon,
      description: data.description,
      mpCost: data.mpCost,
      type: data.type,
      effect: data.effect || { type: 'physical_damage' as SkillType, value: 0 },
      unlockLevel: data.unlockLevel,
      targetType: data.targetType as Skill['targetType'] || undefined,
      usableBy: data.usableBy || 'player',
      cooldown: data.cooldown ?? 0,
      buffs: data.buffs ? data.buffs.map(b => ({ type: b.type, value: b.value, turns: b.turns })) : undefined
    };
  }

  /**
   * 获取技能模板
   * @param skillId - 技能ID
   * @returns 技能数据或null
   */
  async getSkillTemplate(skillId: string): Promise<Skill | null> {
    return dbService.withRetry(async () => {
      const data = await gameDb.config_skills.get(skillId) as SkillTemplateStorage | undefined;
      if (!data) return null;
      return this.toSkill(data);
    });
  }

  /**
   * 获取所有技能模板
   * @returns 技能模板列表
   */
  async getAllSkillTemplates(): Promise<Skill[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_skills.toArray() as SkillTemplateStorage[];
      return items.map(data => this.toSkill(data));
    });
  }

  /**
   * 根据职业获取技能模板
   * @param classId - 职业ID
   * @returns 技能模板列表
   */
  async getSkillTemplatesByClass(classId: string): Promise<Skill[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_skills.where('classRestriction').equals(classId).toArray() as SkillTemplateStorage[];
      return items.map(data => this.toSkill(data));
    });
  }

  /**
   * 获取怪物/首领技能模板（usableBy = 'enemy' 或 'both'）
   * @returns 怪物技能模板列表
   */
  async getMonsterSkillTemplates(): Promise<Skill[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_skills
        .where('usableBy')
        .anyOf('enemy', 'both')
        .toArray() as SkillTemplateStorage[];
      return items.map(data => this.toSkill(data));
    });
  }

  /**
   * 删除技能模板
   * @param skillId - 技能ID
   */
  async deleteSkillTemplate(skillId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_skills.delete(skillId);
    });
  }
}

/**
 * 技能数据层实例
 */
export const skillsDbService = new SkillsDbService();
