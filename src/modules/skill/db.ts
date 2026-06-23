/**
 * @fileoverview 技能模块数据层（IndexedDB 持久化封装）
 * @description 封装技能数据的 IndexedDB 操作，提供数据持久化能力。
 *              承担**本地数据库**与**内存模型**之间的转换职责。
 *
 * 数据架构说明：
 * - `char_skills` 表：存储角色的技能数据（仅存 ID 数组 + 技能栏配置）
 * - `config_skills` 表：存储技能模板（完整配置数据）
 * - skills 字段采用"存 ID + 运行时查模板"模式，避免数据冗余
 *
 * 类型转换流程：
 * ```
 * IndexedDB（原始数据）
 *   → as SkillTemplateStorage（类型断言，Dexie 返回 any）
 *   → toSkill()（存储格式 → 运行时格式）
 *   → Skill（业务层使用）
 * ```
 * @module skill
 */

import { db as gameDb, dbService } from '../data/core';
import type { Skill, SkillBar, SkillsData, SkillType, SkillTemplateStorage } from './types';
import { toRawData } from '../../utils';

/**
 * 技能数据层服务
 *
 * 封装所有技能相关的数据库操作，包括：
 * - 角色技能数据的增删改查（`char_skills` 表）
 * - 技能模板的增删改查（`config_skills` 表）
 * - 存储格式 → 运行时格式的类型转换
 *
 * 所有数据库操作通过 `dbService.withRetry` 包装，提供自动重试和错误处理。
 */
export class SkillsDbService {
  // ========================================================================
  // 角色技能数据（char_skills 表）
  // ========================================================================

  /**
   * 保存技能数据到数据库
   *
   * 将 Store 中的运行时状态持久化到 `char_skills` 表。
   * 使用 `toRawData` 去除 `undefined` 值，确保数据可被结构化克隆。
   *
   * @param data - 技能数据（skills 仅存 ID 数组）
   *
   * @remarks 此方法的调用方会先触发 `persist()`，同步 skills 与 skillBar 到数据库
   */
  async saveSkillsData(data: SkillsData): Promise<void> {
    await dbService.withRetry(async () => {
      // JSON 序列化往返：去除 undefined 值，确保所有数据可被结构化克隆（IndexedDB 要求）
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
   *
   * 从 `char_skills` 表读取角色技能数据，包含防御性校验和默认值回退。
   *
   * 防御性处理：
   * - 记录不存在 → 返回默认空数据
   * - `skills` 不是数组 → 回退为空数组
   * - `skillBar.slots` 不是数组 → 回退为全空槽位
   *
   * @param characterId - 角色 ID（主键）
   * @returns 经过校验和修复的技能数据
   */
  async getSkillsData(characterId: string): Promise<SkillsData> {
    return dbService.withRetry(async () => {
      const data = await gameDb.char_skills.get(characterId) as SkillsData | undefined;
      if (!data) {
        return this.getDefaultSkillsData(characterId);
      }

      // 防御性校验：`skills` 字段可能因数据损坏而变为非数组
      const skills: string[] = Array.isArray(data.skills) ? data.skills : [];
      // 防御性校验：`skillBar.slots` 可能因旧版本数据格式不兼容
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
   * 获取默认技能数据（新角色初始化用）
   *
   * 返回一个"白板"状态：无已学技能、全空技能栏、无职业。
   *
   * @param characterId - 角色 ID
   * @returns 默认的空技能数据
   */
  private getDefaultSkillsData(characterId: string): SkillsData {
    return {
      characterId,
      skills: [],
      // 4 个槽位全部为空
      skillBar: { slots: [null, null, null, null] },
      currentClass: null,
      updatedAt: Date.now()
    };
  }

  /**
   * 删除技能数据
   *
   * @param characterId - 角色 ID
   */
  async deleteSkillsData(characterId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.char_skills.delete(characterId);
    });
  }

  // ========================================================================
  // 技能模板（config_skills 表）
  // ========================================================================

  /**
   * 保存技能模板到数据库
   *
   * 将运行时 `Skill` 对象转换为 `SkillTemplateStorage` 格式后存入 `config_skills` 表。
   *
   * @param skill - 技能数据（运行时格式）
   * @param classRestriction - 职业限制（可选，null = 无限制）
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
   * 将数据库存储格式（`SkillTemplateStorage`）转换为运行时 `Skill` 对象
   *
   * 这是数据层的核心类型转换方法，处理以下转换：
   * - `targetType` string → `'single' | 'all_enemies' | 'self' | 'ally' | undefined`（类型收窄）
   * - `cooldown` 0 → 保持 0（无冷却的语义约定）
   * - `buffs` null → undefined（统一可选字段语义）
   * - `effect` 缺失 → 默认物理伤害回退（防御性处理）
   *
   * @param data - 从 IndexedDB 读取的原始模板数据
   * @returns 运行时 `Skill` 对象
   *
   * @remarks 此方法中的 `as` 类型断言是必要的，因为 Dexie 表的泛型声明为 `any`，
   *          无法在编译时保证数据库字段类型。类型收窄在此方法中集中处理，
   *          确保上层使用方完全类型安全。
   */
  private toSkill(data: SkillTemplateStorage): Skill {
    return {
      id: data.id,
      name: data.name,
      icon: data.icon,
      description: data.description,
      mpCost: data.mpCost,
      type: data.type,
      // 防御性回退：effect 缺失时默认为物理伤害
      effect: data.effect || { type: 'physical_damage' as SkillType, value: 0 },
      unlockLevel: data.unlockLevel,
      // targetType 类型收窄：DB 中为 string，运行时为字面量联合类型
      targetType: data.targetType as Skill['targetType'] || undefined,
      usableBy: data.usableBy || 'player',
      cooldown: data.cooldown ?? 0,
      // buffs 浅拷贝：防止引用共享导致的意外修改
      buffs: data.buffs ? data.buffs.map(b => ({ type: b.type, value: b.value, turns: b.turns })) : undefined
    };
  }

  /**
   * 获取单个技能模板
   *
   * @param skillId - 技能 ID
   * @returns 技能对象或 null（不存在时）
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
   *
   * @returns 全部技能模板的 `Skill` 对象数组
   */
  async getAllSkillTemplates(): Promise<Skill[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_skills.toArray() as SkillTemplateStorage[];
      return items.map(data => this.toSkill(data));
    });
  }

  /**
   * 根据职业获取技能模板
   *
   * 使用 Dexie 的 `where().equals()` 进行索引查询，
   * 按 `classRestriction` 字段过滤属于指定职业的技能模板。
   *
   * @param classId - 职业 ID（如 `warrior`、`mage`）
   * @returns 该职业可用的技能模板列表
   *
   * @see loadTemplatesForClass Store 中调用此方法加载职业模板缓存
   */
  async getSkillTemplatesByClass(classId: string): Promise<Skill[]> {
    return dbService.withRetry(async () => {
      const items = await gameDb.config_skills.where('classRestriction').equals(classId).toArray() as SkillTemplateStorage[];
      return items.map(data => this.toSkill(data));
    });
  }

  /**
   * 获取怪物/首领技能模板
   *
   * 查询 `usableBy` 为 `'enemy'` 或 `'both'` 的技能模板。
   * 这些技能仅供敌人 AI 使用，不会被玩家学习或出现在玩家技能列表中。
   *
   * @returns 怪物/首领可用的技能模板列表
   *
   * @see loadMonsterSkillTemplates Store 中调用此方法加载怪物技能缓存
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
   *
   * @param skillId - 要删除的技能 ID
   */
  async deleteSkillTemplate(skillId: string): Promise<void> {
    await dbService.withRetry(async () => {
      await gameDb.config_skills.delete(skillId);
    });
  }
}

/**
 * 技能数据层单例实例
 *
 * 全局唯一，由 Store 层持有引用，确保数据库操作一致性。
 */
export const skillsDbService = new SkillsDbService();
