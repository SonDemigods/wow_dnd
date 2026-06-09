/**
 * 技能模块服务层
 * 
 * 提供技能管理的核心业务逻辑
 */
import type { ISkillsService, Skill, SkillBar, SkillType, SkillSlotIndex, SkillUseResult, SkillEffect, SkillValidationResult } from './types';
import { skillsDbService } from './db';
import { characterService } from '../character/service';
import { eventBus, GameEvents } from '../bus/core';
import { logService } from '../log/service';
/**
 * 技能服务实现类
 */
export class SkillsService implements ISkillsService {
  /** 技能列表 */
  private skills: Skill[] = [];
  
  /** 技能栏 */
  private skillBar: SkillBar = { slots: [null, null, null, null] };
  
  /** 当前角色ID */
  private characterId: string | null = null;
  
  /** 技能模板缓存 */
  private skillTemplates: Map<string, Skill> = new Map();

  /**
   * 初始化技能服务
   * @param characterId - 角色ID（可选，不传时自动从characterService获取）
   */
  async initialize(characterId?: string): Promise<void> {
    this.characterId = characterId || characterService.getCurrentCharacterId();
    if (this.characterId) {
      const data = await skillsDbService.getSkillsData(this.characterId);
      this.skills = data.skills;
      this.skillBar = data.skillBar;
    }
    await this.loadSkillTemplates();
    // 初始化时不自动装备新技能（仅添加技能到已学列表），避免覆盖用户手动卸下的技能
    this.checkLevelUnlocks(false);
  }

  /**
   * 加载技能模板
   */
  private async loadSkillTemplates(): Promise<void> {
    // 清除旧职业的模板缓存，防止跨职业技能污染
    this.skillTemplates.clear();
    const classId = characterService.getClass();
    if (classId) {
      const templates = await skillsDbService.getSkillTemplatesByClass(classId);
      templates.forEach(skill => {
        this.skillTemplates.set(skill.id, skill);
      });
    }
  }

  /**
   * 获取所有技能
   * @returns 技能列表
   */
  getSkills(): Skill[] {
    return [...this.skills];
  }

  /**
   * 根据ID获取技能
   * @param id - 技能ID
   * @returns 技能数据
   */
  getSkill(id: string): Skill | null {
    return this.skills.find(s => s.id === id) || this.skillTemplates.get(id) || null;
  }

  /**
   * 获取已装备的技能
   * @returns 已装备技能列表
   */
  getEquippedSkills(): Skill[] {
    const equipped: Skill[] = [];
    this.skillBar.slots.forEach(skillId => {
      if (skillId) {
        const skill = this.getSkill(skillId);
        if (skill) {
          equipped.push(skill);
        }
      }
    });
    return equipped;
  }

  /**
   * 获取已解锁的技能
   * @returns 已解锁技能列表
   */
  getUnlockedSkills(): Skill[] {
    return this.skills.filter(skill => {
      const characterLevel = characterService.getLevel();
      return skill.unlockLevel <= characterLevel;
    });
  }

  /**
   * 获取未解锁的技能
   * @returns 未解锁技能列表
   */
  getLockedSkills(): Skill[] {
    return this.skills.filter(skill => {
      const characterLevel = characterService.getLevel();
      return skill.unlockLevel > characterLevel;
    });
  }

  /**
   * 检查技能是否可以使用
   * @param skillId - 技能ID
   * @returns 是否可以使用
   */
  canUseSkill(skillId: string): boolean {
    const validation = this.validateSkillUse(skillId);
    return validation.canUse;
  }

  /**
   * 验证技能使用条件
   * @param skillId - 技能ID
   * @returns 验证结果
   */
  validateSkillUse(skillId: string): SkillValidationResult {
    const skill = this.getSkill(skillId);
    if (!skill) {
      return { canUse: false, failureReason: 'not_unlocked' };
    }

    // 检查是否已解锁
    const characterLevel = characterService.getLevel();
    if (skill.unlockLevel > characterLevel) {
      return { canUse: false, failureReason: 'not_unlocked' };
    }

    // 检查法力值
    const currentMp = characterService.getCharacterInfo().mana;
    if (currentMp < skill.mpCost) {
      return {
        canUse: false,
        failureReason: 'insufficient_mp',
        currentMp,
        requiredMp: skill.mpCost
      };
    }

    return { canUse: true };
  }

  /**
   * 使用技能
   * @param skillId - 技能ID
   * @returns 使用结果
   */
  useSkill(skillId: string): SkillUseResult {
    const validation = this.validateSkillUse(skillId);
    if (!validation.canUse) {
      return {
        success: false,
        skillId,
        type: 'physical_damage',
        message: this.getFailureMessage(validation.failureReason)
      };
    }

    const skill = this.getSkill(skillId)!;
    
    // 消耗法力值
    eventBus.emit(GameEvents.CHARACTER_RECEIVE_MP, { amount: -skill.mpCost, source: '技能消耗' });
    
    // 计算技能效果
    const effect = this.calculateSkillEffect(skillId);
    
    // 应用技能效果
    let damage: number | undefined;
    let heal: number | undefined;
    
    switch (skill.type) {
      case 'physical_damage':
      case 'magic_damage':
        damage = effect.value;
        break;
      case 'health_restore':
        heal = effect.value;
        eventBus.emit(GameEvents.CHARACTER_RECEIVE_HEAL, { amount: effect.value, source: '技能治疗' });
        break;
      case 'mana_restore':
        eventBus.emit(GameEvents.CHARACTER_RECEIVE_MP, { amount: effect.value, source: '技能回复' });
        break;
    }
    
    // 触发事件
    eventBus.emit(GameEvents.SKILL_CAST, { skill, success: true });

    // 记录冒险日志
    logService.addLog({
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type: 'skill',
      message: `施放了技能：${skill.name}`,
      icon: '⚡'
    });
    
    return {
      success: true,
      skillId,
      type: skill.type,
      damage,
      heal,
      message: `使用了 ${skill.name}`
    };
  }

  /**
   * 获取失败原因消息
   * @param reason - 失败原因
   * @returns 消息
   */
  private getFailureMessage(reason?: string): string {
    switch (reason) {
      case 'not_unlocked':
        return '技能未解锁';
      case 'not_equipped':
        return '技能未装备';
      case 'insufficient_mp':
        return '法力不足';
      case 'not_in_combat':
        return '不在战斗中';
      default:
        return '无法使用技能';
    }
  }

  /**
   * 装备技能到指定槽位
   * @param skillId - 技能ID
   * @param slotIndex - 槽位索引
   * @returns 是否成功装备
   */
  equipSkill(skillId: string, slotIndex: SkillSlotIndex): boolean {
    // 检查技能是否存在且已解锁
    const skill = this.getSkill(skillId);
    if (!skill) {
      return false;
    }
    
    const characterLevel = characterService.getLevel();
    if (skill.unlockLevel > characterLevel) {
      return false;
    }
    
    // 如果技能不在已学习列表中，添加进去
    if (!this.skills.some(s => s.id === skillId)) {
      this.skills.push({ ...skill });
    }
    
    // 如果该槽位已有技能，先卸下
    const existingSkillId = this.skillBar.slots[slotIndex];
    if (existingSkillId) {
      this.unequipSkill(slotIndex);
    }
    
    // 装备新技能
    this.skillBar.slots[slotIndex] = skillId;
    
    // 保存
    this.save();
    
    // 触发事件
    eventBus.emit(GameEvents.SKILL_BAR_UPDATE, { skillId, slotIndex });
    
    return true;
  }

  /**
   * 卸下指定槽位的技能
   * @param slotIndex - 槽位索引
   * @returns 是否成功卸下
   */
  unequipSkill(slotIndex: SkillSlotIndex): boolean {
    if (!this.skillBar.slots[slotIndex]) {
      return false;
    }
    
    const skillId = this.skillBar.slots[slotIndex]!;
    this.skillBar.slots[slotIndex] = null;
    
    // 保存
    this.save();
    
    // 触发事件
    eventBus.emit(GameEvents.SKILL_BAR_UPDATE, { skillId, slotIndex });
    
    return true;
  }

  /**
   * 交换两个槽位的技能
   * @param slotIndex1 - 第一个槽位
   * @param slotIndex2 - 第二个槽位
   * @returns 是否成功交换
   */
  swapSkills(slotIndex1: SkillSlotIndex, slotIndex2: SkillSlotIndex): boolean {
    if (slotIndex1 === slotIndex2) {
      return false;
    }
    
    const temp = this.skillBar.slots[slotIndex1];
    this.skillBar.slots[slotIndex1] = this.skillBar.slots[slotIndex2];
    this.skillBar.slots[slotIndex2] = temp;
    
    // 保存
    this.save();
    
    // 触发事件
    eventBus.emit(GameEvents.SKILL_BAR_UPDATE, { slots: [...this.skillBar.slots] });
    
    return true;
  }

  /**
   * 根据类型获取技能
   * @param type - 技能类型
   * @returns 技能列表
   */
  getSkillsByType(type: SkillType): Skill[] {
    return this.skills.filter(skill => skill.type === type);
  }

  /**
   * 计算技能效果
   * @param skillId - 技能ID
   * @returns 技能效果
   */
  calculateSkillEffect(skillId: string): SkillEffect {
    const skill = this.getSkill(skillId);
    if (!skill) {
      return { type: 'physical_damage', value: 0 };
    }
    
    const effect = { ...skill.effect };
    const stats = characterService.getStats();
    
    // 根据技能类型和角色属性计算实际效果
    switch (skill.type) {
      case 'physical_damage':
        // 物理伤害 = 基础值 + 力量 * 系数
        effect.value = Math.floor(skill.effect.value + stats.str * (skill.effect.coefficient || 0.5));
        break;
      case 'magic_damage':
        // 魔法伤害 = 基础值 + 智力 * 系数
        effect.value = Math.floor(skill.effect.value + stats.int * (skill.effect.coefficient || 0.5));
        break;
      case 'health_restore':
        // 治疗量 = 基础值 + 智慧 * 系数
        effect.value = Math.floor(skill.effect.value + stats.wis * (skill.effect.coefficient || 0.3));
        break;
      case 'mana_restore':
        // 法力回复 = 基础值 + 智力 * 系数
        effect.value = Math.floor(skill.effect.value + stats.int * (skill.effect.coefficient || 0.3));
        break;
    }
    
    return effect;
  }

  /**
   * 检查等级解锁
   * @param shouldAutoEquip - 是否自动装备新技能到空槽位（首次解锁时传 true，初始化加载时传 false）
   */
  checkLevelUnlocks(shouldAutoEquip: boolean = true): void {
    const characterLevel = characterService.getLevel();
    const currentClass = characterService.getClass();
    if (!currentClass) return;

    // 从已加载的技能模板中获取当前职业的技能
    const classAbilities = Array.from(this.skillTemplates.values());

    let hasNewSkills = false;

    // 检查是否有新技能可以解锁
    classAbilities.forEach(template => {
      const exists = this.skills.some(s => s.id === template.id);
      if (!exists && template.unlockLevel <= characterLevel) {
        // 解锁新技能
        this.skills.push({ ...template });
        hasNewSkills = true;

        // 仅在首次解锁时自动装备新技能（用户主动升级的场景）
        if (shouldAutoEquip) {
          const emptySlot = this.skillBar.slots.findIndex(s => s === null);
          if (emptySlot !== -1) {
            this.skillBar.slots[emptySlot] = template.id;
          }
        }

        // 触发事件
        eventBus.emit(GameEvents.SKILL_LEARNED, { skill: template });

        // 记录冒险日志
        logService.addLog({
          id: logService.generateLogId(),
          timestamp: Date.now(),
          type: 'skill',
          message: `学会了新技能：${template.name}！`,
          icon: '📖'
        });
      }
    });

    // 保存
    if (hasNewSkills) {
      this.save();
    }
  }

  /**
   * 重置技能数据
   */
  reset(): void {
    this.skills = [];
    this.skillBar = { slots: [null, null, null, null] };
    this.save();
  }

  /**
   * 添加技能模板
   * @param skill - 技能数据
   */
  addSkillTemplate(skill: Skill): void {
    this.skillTemplates.set(skill.id, skill);
    skillsDbService.saveSkillTemplate(skill);
  }

  /**
   * 删除技能模板
   * @param skillId - 技能ID
   */
  removeSkillTemplate(skillId: string): void {
    this.skillTemplates.delete(skillId);
    skillsDbService.deleteSkillTemplate(skillId);
  }

  /**
   * 设置当前角色
   * @param characterId - 角色ID
   */
  async setCharacter(characterId: string): Promise<void> {
    this.characterId = characterId;
    this.skills = [];
    this.skillBar = { slots: [null, null, null, null] };
    await this.initialize(characterId);
  }

  /**
   * 获取技能栏
   * @returns 技能栏
   */
  getSkillBar(): SkillBar {
    return { ...this.skillBar };
  }

  /**
   * 获取技能模板
   * @param skillId - 技能ID
   * @returns 技能数据或null
   */
  getSkillTemplate(skillId: string): Skill | null {
    return this.skillTemplates.get(skillId) || null;
  }

  /**
   * 获取所有技能模板
   * @returns 技能模板列表
   */
  getAllSkillTemplates(): Skill[] {
    return Array.from(this.skillTemplates.values());
  }

  /**
   * 保存技能数据
   */
  private save(): void {
    if (this.characterId) {
      skillsDbService.saveSkillsData({
        characterId: this.characterId,
        skills: this.skills,
        skillBar: this.skillBar,
        currentClass: characterService.getClass(),
        updatedAt: Date.now()
      });
    }
  }
}

/**
 * 技能服务实例
 */
export const skillsService = new SkillsService();