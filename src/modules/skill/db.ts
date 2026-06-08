/**
 * 技能模块数据层
 * 
 * 封装技能数据的 IndexedDB 操作，提供数据持久化能力
 */
import { db as gameDb, dbService } from '../data/core';
import type { Skill, SkillBar, SkillsData, SkillType } from './types';

/**
 * 技能数据存储接口
 */
export interface SkillDataStorage {
  characterId: string;
  skills: string;
  skillBar: string;
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
  type: string;
  effect: { type: string; value: number };
  unlockLevel: number;
  classRestriction: string | null;
}

/**
 * 技能数据层服务
 */
export class SkillsDbService {
  /**
   * 保存技能数据到数据库
   * @param data - 技能数据
   */
  async saveSkillsData(data: SkillsData): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_skills.put({
        characterId: data.characterId,
        skills: JSON.stringify(data.skills),
        skillBar: JSON.stringify(data.skillBar),
        currentClass: data.currentClass,
        updatedAt: data.updatedAt
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
      const data = await gameDb.char_skills.get(characterId) as unknown as SkillDataStorage | undefined;
      if (!data) {
        return this.getDefaultSkillsData(characterId);
      }
      
      let skills: Skill[] = [];
      let skillBar: SkillBar = { slots: [null, null, null, null] };
      
      try {
        skills = JSON.parse(data.skills as string);
      } catch {
        skills = [];
      }
      
      try {
        skillBar = JSON.parse(data.skillBar as string);
      } catch {
        skillBar = { slots: [null, null, null, null] };
      }
      
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
        classRestriction: classRestriction || null
      });
    });
  }

  /**
   * 获取技能模板
   * @param skillId - 技能ID
   * @returns 技能数据或null
   */
  async getSkillTemplate(skillId: string): Promise<Skill | null> {
    return dbService.withRetry(async () => {
      const data = await gameDb.config_skills.get(skillId) as unknown as SkillTemplateStorage | undefined;
      if (!data) return null;
      
      return {
        id: data.id,
        name: data.name,
        icon: data.icon,
        description: data.description,
        mpCost: data.mpCost,
        type: data.type as SkillType,
        effect: (data.effect || { type: 'physical_damage', value: 0 }) as Skill['effect'],
        unlockLevel: data.unlockLevel
      };
    });
  }

  /**
   * 获取所有技能模板
   * @returns 技能模板列表
   */
  async getAllSkillTemplates(): Promise<Skill[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_skills.toArray() as unknown as SkillTemplateStorage[];
      return items.map(data => ({
        id: data.id,
        name: data.name,
        icon: data.icon,
        description: data.description,
        mpCost: data.mpCost,
        type: data.type as SkillType,
        effect: (data.effect || { type: 'physical_damage', value: 0 }) as Skill['effect'],
        unlockLevel: data.unlockLevel
      }));
    });
  }

  /**
   * 根据职业获取技能模板
   * @param classId - 职业ID
   * @returns 技能模板列表
   */
  async getSkillTemplatesByClass(classId: string): Promise<Skill[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_skills.where('classRestriction').equals(classId).toArray() as unknown as SkillTemplateStorage[];
      return items.map(data => ({
        id: data.id,
        name: data.name,
        icon: data.icon,
        description: data.description,
        mpCost: data.mpCost,
        type: data.type as SkillType,
        effect: (data.effect || { type: 'physical_damage', value: 0 }) as Skill['effect'],
        unlockLevel: data.unlockLevel
      }));
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
