/**
 * @fileoverview 角色生命周期服务
 * @description 收口角色创建/删除流程中的跨模块持久化逻辑，消除 character/store.ts 对
 *              6 个模块 DbService 的直接依赖（CHR-4 修复）。
 *
 * ## 职责边界
 *
 * - **输入**：characterId、classId 等标识参数
 * - **输出**：无返回值或布尔结果
 * - **内部**：聚合调用 skill/inventory/equipment/exploration/log/quest 各模块 DbService
 * - **不负责**：角色本模块数据持久化（由 characterDbService 负责）、事件通知（由 Store 负责）
 *
 * ## 设计原则
 *
 * - 服务层是"无状态"的协调者，不持有业务数据，仅聚合跨模块调用
 * - 遵循五层架构：Store 层不直接访问其他模块 DbService，通过本服务收口
 * - 所有 DbService 操作通过 index.ts 公共入口引用，不深入对方 db.ts 内部文件
 *
 * @module services
 */
import { skillsDbService } from '@/modules/skill';
import { inventoryDbService } from '@/modules/inventory';
import { equipmentDbService } from '@/modules/equipment';
import { explorationDbService } from '@/modules/exploration';
import { adventureLogDbService } from '@/modules/log';
import { questDbService } from '@/modules/quest';
import type { Skill, SkillBar } from '@/modules/skill/types';

/**
 * 角色生命周期服务
 *
 * 将角色创建时的技能初始化、删除时的级联清理统一收口，
 * 消除 character Store 对 6 个模块 DbService 的直接依赖。
 */
export class CharacterLifecycleService {
  // ========================================================================
  // 角色创建：初始化关联数据
  // ========================================================================

  /**
   * 初始化角色技能数据
   *
   * 收口 createCharacter 中的跨模块持久化：
   * 1. 按职业查询技能模板（unlockLevel ≤ 1 的技能默认已学）
   * 2. 填充 4 格技能栏（前 4 个已学技能自动装备）
   * 3. 持久化到 char_skills 表
   *
   * @param characterId - 角色 ID
   * @param classId - 职业 ID
   * @returns 初始化的技能数据（供 Store 同步内存状态）
   *
   * @see skillsDbService.getSkillTemplatesByClass
   * @see skillsDbService.saveSkillsData
   */
  async initializeCharacterSkills(
    characterId: string,
    classId: string
  ): Promise<{ skills: Skill[]; skillBar: SkillBar }> {
    // 1. 查询职业技能模板
    const classAbilities = await skillsDbService.getSkillTemplatesByClass(classId);
    const skills: Skill[] = classAbilities
      .filter(skill => skill.unlockLevel <= 1)
      .map(skill => ({ ...skill }));

    // 2. 填充技能栏（前 4 个已学技能自动装备）
    const skillBar: SkillBar = { slots: [null, null, null, null] };
    skills.forEach((skill, index) => {
      if (index < 4) skillBar.slots[index] = skill.id;
    });

    // 3. 持久化到数据库
    await skillsDbService.saveSkillsData({
      characterId,
      skills: skills.map(s => s.id),
      skillBar,
      currentClass: classId,
      updatedAt: Date.now()
    });

    return { skills, skillBar };
  }

  // ========================================================================
  // 角色删除：级联清理关联数据
  // ========================================================================

  /**
   * 级联删除角色所有关联数据
   *
   * 收口 deleteCharacter 中的跨模块清理：
   * 并行删除 6 个模块的角色关联数据，确保无孤儿数据残留。
   *
   * 删除范围：
   * - skill：char_skills 表
   * - inventory：char_inventory 表
   * - equipment：char_equipment 表
   * - exploration：char_exploration 表
   * - log：runtime_adventureLogs 表
   * - quest：char_quests 表
   *
   * @param characterId - 角色 ID
   *
   * @remarks 使用 Promise.all 并行执行以提升性能；
   *          各模块 DbService 已内置 withRetry 重试机制，无需在本层额外处理
   */
  async cascadeDeleteCharacter(characterId: string): Promise<void> {
    await Promise.all([
      skillsDbService.deleteSkillsData(characterId),
      inventoryDbService.deleteInventory(characterId),
      equipmentDbService.deleteEquipment(characterId),
      explorationDbService.deleteExplorationData(characterId),
      adventureLogDbService.deleteAdventureLog(characterId),
      questDbService.deleteCharacterQuests(characterId),
    ]);
  }
}

/** 角色生命周期服务单例 */
export const characterLifecycleService = new CharacterLifecycleService();
