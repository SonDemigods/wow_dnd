/**
 * 技能模块状态管理（Store 核心架构）
 * 
 * Store 是技能数据的唯一持有者，所有响应式状态集中管理。
 * Action 负责编排：调用 Service 纯函数 → 更新 Store 状态 → 调用 DB 持久化 → 通知其他模块。
 * 
 * 跨模块通信：直接调用 useCharacterStore() 的 Action，不再通过 EventBus 传递数据变更事件。
 * 仅保留 SKILL_CAST、SKILL_LEARNED 等 UI 动画/音效事件。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Skill, SkillBar, SkillType, SkillSlotIndex, SkillUseResult } from './types';
import { skillsDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';
import { useCharacterStore } from '../character/store';
import { useLogStore } from '../log/store';
import { generateLogId } from '../log/service';
import {
  calculateSkillDamage,
  checkManaCost,
  canLearnSkill,
  validateSkillBarSlot,
  canCastSkill
} from './service';

/**
 * 技能类型名称映射
 */
const SKILL_TYPE_NAMES: Record<SkillType, string> = {
  physical_damage: '物理伤害',
  magic_damage: '魔法伤害',
  health_restore: '治疗',
  mana_restore: '法力回复'
};

/**
 * 技能状态存储
 */
export const useSkillsStore = defineStore('skills', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================

  /** 已学技能列表 */
  const skills = ref<Skill[]>([]);

  /** 技能栏（4 个槽位） */
  const skillBar = ref<SkillBar>({ slots: [null, null, null, null] });

  /** 技能模板缓存（key: skillId） */
  const skillTemplates = ref<Map<string, Skill>>(new Map());

  /** 当前角色 ID */
  const currentCharacterId = ref<string | null>(null);

  /** 加载状态 */
  const isLoading = ref(false);

  /** 技能冷却状态（key=skillId, value=剩余冷却回合数） */
  const cooldowns = ref<Record<string, number>>({});

  // ==================== 计算属性 ====================

  /** 已解锁技能（角色等级足够） */
  const unlockedSkills = computed(() => {
    const characterStore = useCharacterStore();
    const characterLevel = characterStore.level;
    return skills.value.filter(s => s.unlockLevel <= characterLevel);
  });

  /** 未解锁技能 */
  const lockedSkills = computed(() => {
    const characterStore = useCharacterStore();
    const characterLevel = characterStore.level;
    return skills.value.filter(s => s.unlockLevel > characterLevel);
  });

  /** 已装备技能（技能栏中的技能对象） */
  const equippedSkills = computed(() => {
    return skillBar.value.slots.map(skillId => {
      if (!skillId) return null;
      return skills.value.find(s => s.id === skillId) || null;
    });
  });

  /** 技能栏槽位详细信息 */
  const skillBarSlots = computed(() => {
    return skillBar.value.slots.map((skillId, index) => {
      const skill = skillId ? skills.value.find(s => s.id === skillId) : null;
      return {
        index: index as SkillSlotIndex,
        skillId,
        skill,
        isEmpty: !skillId
      };
    });
  });

  /** 按类型统计技能数量 */
  const skillCountByType = computed(() => {
    const counts: Record<SkillType, number> = {
      physical_damage: 0,
      magic_damage: 0,
      health_restore: 0,
      mana_restore: 0
    };

    skills.value.forEach(skill => {
      counts[skill.type]++;
    });

    return counts;
  });

  // ==================== 内部辅助：持久化 ====================

  /**
   * 保存技能数据到数据库
   */
  async function persist(): Promise<void> {
    const characterStore = useCharacterStore();
    const charId = currentCharacterId.value || characterStore.getCharacterId();
    if (!charId) return;

    await skillsDbService.saveSkillsData({
      characterId: charId,
      skills: skills.value,
      skillBar: skillBar.value,
      currentClass: characterStore.classId,
      updatedAt: Date.now()
    });
  }

  // ==================== Action：初始化 ====================

  /**
   * 初始化技能模块
   * 从 DB 加载技能和技能栏，加载职业模板
   * @param characterId - 角色 ID（可选，不传时自动从 characterStore 获取）
   */
  async function initialize(characterId?: string): Promise<void> {
    isLoading.value = true;

    const characterStore = useCharacterStore();
    const charId = characterId || characterStore.getCharacterId();
    if (!charId) {
      isLoading.value = false;
      return;
    }

    currentCharacterId.value = charId;

    // 1. 从 DB 加载技能数据
    const data = await skillsDbService.getSkillsData(charId);
    skills.value = data.skills;
    skillBar.value = data.skillBar;

    // 2. 加载技能模板
    await loadTemplatesForClass(characterStore.classId);

    // 3. 初始化时不自动装备新技能（仅添加技能到已学列表），避免覆盖用户手动卸下的技能
    checkLevelUnlocks(false);

    isLoading.value = false;
  }

  // ==================== Action：学习技能 ====================

  /**
   * 学习新技能
   * @param skillId - 技能 ID
   * @returns 是否成功
   */
  async function learnSkill(skillId: string): Promise<boolean> {
    const template = skillTemplates.value.get(skillId);
    if (!template) return false;

    const characterStore = useCharacterStore();
    if (!canLearnSkill(template, characterStore.level, skills.value)) {
      return false;
    }

    // 添加技能
    skills.value.push({ ...template });

    // 自动装备到空槽位
    const emptySlot = skillBar.value.slots.findIndex(s => s === null);
    if (emptySlot !== -1) {
      skillBar.value.slots[emptySlot] = skillId;
    }

    // 持久化
    await persist();

    // 通知 UI（动画 + 音效）
    eventBus.emit(GameEvents.SKILL_LEARNED, { skill: template });

    // 记录冒险日志
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'skill',
      message: `学会了新技能：${template.name}！`,
      icon: '📖'
    });

    return true;
  }

  // ==================== Action：施放技能 ====================

  /**
   * 施放技能
   * @param skillId - 技能 ID
   * @returns 使用结果
   */
  async function castSkill(skillId: string): Promise<SkillUseResult> {
    const characterStore = useCharacterStore();
    const charData = characterStore.getCharacterData();
    const skill = skills.value.find(s => s.id === skillId)
      || skillTemplates.value.get(skillId);

    if (!skill) {
      return {
        success: false,
        skillId,
        type: 'physical_damage',
        message: '技能不存在'
      };
    }

    // 1. 校验技能是否可施放
    const castCheck = canCastSkill(skill, charData?.mana || 0);
    if (!castCheck.canCast) {
      return {
        success: false,
        skillId,
        type: skill.type,
        message: castCheck.reason
      };
    }

    // 2. 消耗法力值 → 直接调用 characterStore Action
    await characterStore.changeMp(-skill.mpCost);

    // 3. 计算技能效果
    const damageValue = calculateSkillDamage(skill, characterStore.effectiveStats);

    // 4. 应用技能效果
    let damage: number | undefined;
    let heal: number | undefined;

    switch (skill.type) {
      case 'physical_damage':
      case 'magic_damage':
        damage = damageValue;
        break;
      case 'health_restore':
        heal = damageValue;
        // 治疗 → 直接调用 characterStore Action
        await characterStore.receiveHeal(damageValue);
        break;
      case 'mana_restore':
        // 法力回复 → 直接调用 characterStore Action
        await characterStore.changeMp(damageValue);
        break;
    }

    // 5. 通知 UI（动画 + 音效）
    eventBus.emit(GameEvents.SKILL_CAST, { skill, success: true });

    // 6. 记录冒险日志
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'skill',
      message: `施放了技能：${skill.name}`,
      icon: '⚡'
    });

    // 7. 记录冷却（如果技能有冷却）
    if (skill && skill.cooldown && skill.cooldown > 0) {
      cooldowns.value[skillId] = skill.cooldown;
    }

    return {
      success: true,
      skillId,
      type: skill.type,
      damage,
      heal,
      message: `使用了 ${skill.name}`
    };
  }

  // ==================== Action：装备技能 ====================

  /**
   * 装备技能到指定槽位
   * @param skillId - 技能 ID
   * @param slotIndex - 槽位索引
   * @returns 是否成功
   */
  async function equipSkill(skillId: string, slotIndex: SkillSlotIndex): Promise<boolean> {
    // 校验槽位有效性
    if (!validateSkillBarSlot(skillBar.value, slotIndex)) {
      return false;
    }

    // 查找技能（已学列表或模板）
    const skill = skills.value.find(s => s.id === skillId)
      || skillTemplates.value.get(skillId);
    if (!skill) return false;

    // 检查是否已解锁
    const characterStore = useCharacterStore();
    if (skill.unlockLevel > characterStore.level) {
      return false;
    }

    // 如果技能不在已学列表中，添加进去
    if (!skills.value.some(s => s.id === skillId)) {
      skills.value.push({ ...skill });
    }

    // 如果该槽位已有技能，先卸下
    const existingSkillId = skillBar.value.slots[slotIndex];
    if (existingSkillId) {
      skillBar.value.slots[slotIndex] = null;
    }

    // 装备新技能
    skillBar.value.slots[slotIndex] = skillId;

    // 持久化
    await persist();

    return true;
  }

  // ==================== Action：卸下技能 ====================

  /**
   * 卸下指定技能（按技能 ID 查找槽位）
   * @param skillId - 技能 ID
   * @returns 是否成功
   */
  async function unequipSkill(skillId: string): Promise<boolean> {
    const slotIndex = skillBar.value.slots.findIndex(s => s === skillId);
    if (slotIndex === -1) return false;

    skillBar.value.slots[slotIndex] = null;

    // 持久化
    await persist();

    return true;
  }

  // ==================== Action：交换技能槽位 ====================

  /**
   * 交换两个槽位的技能
   * @param slotIndex1 - 第一个槽位
   * @param slotIndex2 - 第二个槽位
   * @returns 是否成功
   */
  async function swapSkills(slotIndex1: SkillSlotIndex, slotIndex2: SkillSlotIndex): Promise<boolean> {
    if (slotIndex1 === slotIndex2) return false;

    const temp = skillBar.value.slots[slotIndex1];
    skillBar.value.slots[slotIndex1] = skillBar.value.slots[slotIndex2];
    skillBar.value.slots[slotIndex2] = temp;

    // 持久化
    await persist();

    return true;
  }

  // ==================== Action：查询技能 ====================

  /**
   * 根据 ID 获取技能数据（纯查询，不产生副作用）
   * @param skillId - 技能 ID
   * @returns 技能数据或 null
   */
  function getSkill(skillId: string): Skill | null {
    return skills.value.find(s => s.id === skillId)
      || skillTemplates.value.get(skillId)
      || null;
  }

  /**
   * 获取可用技能列表（已解锁的技能，纯查询）
   * @returns 可用技能列表
   */
  function getAvailableSkills(): Skill[] {
    const characterStore = useCharacterStore();
    const characterLevel = characterStore.level;
    return skills.value.filter(s => s.unlockLevel <= characterLevel);
  }

  /**
   * 根据类型获取技能
   * @param type - 技能类型
   * @returns 技能列表
   */
  function getSkillsByType(type: SkillType): Skill[] {
    return skills.value.filter(s => s.type === type);
  }

  /**
   * 检查技能是否可以使用
   * @param skillId - 技能 ID
   * @returns 是否可以使用
   */
  function canUseSkill(skillId: string): boolean {
    const skill = getSkill(skillId);
    if (!skill) return false;

    const characterStore = useCharacterStore();
    const characterLevel = characterStore.level;
    if (skill.unlockLevel > characterLevel) return false;

    const charData = characterStore.getCharacterData();
    return checkManaCost(skill, charData?.mana || 0);
  }

  // ==================== Action：加载模板 ====================

  /**
   * 加载指定职业的技能模板到缓存
   * @param classId - 职业 ID
   */
  async function loadTemplatesForClass(classId: string): Promise<void> {
    // 清除旧缓存
    skillTemplates.value.clear();

    if (!classId) return;

    const templates = await skillsDbService.getSkillTemplatesByClass(classId);
    const newMap = new Map<string, Skill>();
    templates.forEach(skill => {
      newMap.set(skill.id, skill);
    });
    skillTemplates.value = newMap;
  }

  // ==================== Action：获取职业技能模板 ====================

  /**
   * 获取指定职业的技能模板列表
   * 直接查询 DB，不修改 Store 内部状态
   * @param classId - 职业 ID
   * @returns 技能模板数组
   */
  async function getSkillTemplatesByClass(classId: string): Promise<Skill[]> {
    return await skillsDbService.getSkillTemplatesByClass(classId);
  }

  // ==================== Action：等级解锁检查 ====================

  /**
   * 检查等级解锁
   * @param shouldAutoEquip - 是否自动装备新技能到空槽位
   */
  async function checkLevelUnlocks(shouldAutoEquip: boolean = true): Promise<void> {
    const characterStore = useCharacterStore();
    const characterLevel = characterStore.level;

    let hasNewSkills = false;

    // 遍历模板，检查是否有新技能可以解锁
    skillTemplates.value.forEach(template => {
      const exists = skills.value.some(s => s.id === template.id);
      if (!exists && template.unlockLevel <= characterLevel) {
        // 解锁新技能
        skills.value.push({ ...template });
        hasNewSkills = true;

        // 仅在首次解锁时自动装备
        if (shouldAutoEquip) {
          const emptySlot = skillBar.value.slots.findIndex(s => s === null);
          if (emptySlot !== -1) {
            skillBar.value.slots[emptySlot] = template.id;
          }
        }

        // 通知 UI（动画 + 音效）
        eventBus.emit(GameEvents.SKILL_LEARNED, { skill: template });

        // 记录冒险日志
        useLogStore().addLogEntry({
          id: generateLogId(),
          timestamp: Date.now(),
          type: 'skill',
          message: `学会了新技能：${template.name}！`,
          icon: '📖'
        });
      }
    });

    // 持久化
    if (hasNewSkills) {
      await persist();
    }
  }

  // ==================== Action：模板管理 ====================

  /**
   * 添加技能模板
   * @param skill - 技能数据
   */
  async function addSkillTemplate(skill: Skill): Promise<void> {
    skillTemplates.value.set(skill.id, skill);
    await skillsDbService.saveSkillTemplate(skill);
  }

  /**
   * 删除技能模板
   * @param skillId - 技能 ID
   */
  async function removeSkillTemplate(skillId: string): Promise<void> {
    skillTemplates.value.delete(skillId);
    await skillsDbService.deleteSkillTemplate(skillId);
  }

  // ==================== Action：冷却管理 ====================

  /**
   * 减少所有冷却回合数（每回合结束时调用）
   */
  function tickCooldowns(): void {
    for (const key of Object.keys(cooldowns.value)) {
      if (cooldowns.value[key] > 0) {
        cooldowns.value[key]--;
        if (cooldowns.value[key] === 0) {
          delete cooldowns.value[key];
        }
      }
    }
  }

  /**
   * 检查技能是否在冷却中
   * @param skillId - 技能 ID
   * @returns 是否在冷却中
   */
  function isOnCooldown(skillId: string): boolean {
    return (cooldowns.value[skillId] || 0) > 0;
  }

  /**
   * 获取冷却剩余回合数
   * @param skillId - 技能 ID
   * @returns 剩余冷却回合数
   */
  function getCooldownRemaining(skillId: string): number {
    return cooldowns.value[skillId] || 0;
  }

  // ==================== Action：重置 ====================

  /**
   * 重置技能数据
   */
  async function reset(): Promise<void> {
    skills.value = [];
    skillBar.value = { slots: [null, null, null, null] };
    skillTemplates.value.clear();
    cooldowns.value = {};
    currentCharacterId.value = null;
    await persist();
  }

  // ==================== 生命周期 ====================

  /**
   * 清理资源
   */
  function dispose(): void {
    // 在新架构下，Store 之间通过直接调用 Action 通信，
    // 不再通过 EventBus 监听数据变更事件，无需清理事件监听器。
  }

  // ==================== 导出 ====================

  return {
    // 状态
    skills,
    skillBar,
    skillTemplates,
    currentCharacterId,
    isLoading,
    cooldowns,

    // 计算属性
    unlockedSkills,
    lockedSkills,
    equippedSkills,
    skillBarSlots,
    skillCountByType,

    // Action
    initialize,
    learnSkill,
    castSkill,
    equipSkill,
    unequipSkill,
    swapSkills,
    getSkill,
    getAvailableSkills,
    getSkillsByType,
    canUseSkill,
    loadTemplatesForClass,
    getSkillTemplatesByClass,
    checkLevelUnlocks,
    addSkillTemplate,
    removeSkillTemplate,
    reset,
    dispose,

    // 冷却管理
    tickCooldowns,
    isOnCooldown,
    getCooldownRemaining,

    // 常量
    SKILL_TYPE_NAMES
  };
});
