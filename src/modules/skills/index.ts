/**
 * @fileoverview 技能服务类
 * @description 提供技能管理、技能使用、冷却管理等核心功能
 * @module modules/skills/index
 */

import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { characterService } from '../character';
import { CLASS_ABILITIES } from '@/data';
import type { Skill, SkillCooldown } from './types';
import type {
  SkillCastEvent,
  SkillCooldownEvent,
  SkillReadyEvent,
  ISkillsService
} from './types';

/**
 * 技能状态管理Store
 */
export const useSkillsStore = defineStore('skills', () => {
  /** 已学习的技能列表 */
  const skills = ref<Skill[]>([]);
  /** 技能冷却表 */
  const cooldowns = ref<Map<string, number>>(new Map());
  /** 冷却更新定时器 */
  let cooldownTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * 获取指定技能
   */
  const getSkill = (id: string): Skill | null => {
    return skills.value.find(s => s.id === id) || null;
  };

  /**
   * 获取技能冷却状态
   */
  const getCooldown = (skillId: string): SkillCooldown | null => {
    const remaining = cooldowns.value.get(skillId);
    if (remaining === undefined) return null;
    
    const skill = getSkill(skillId);
    return {
      remaining,
      max: skill?.cooldown || 0,
    };
  };

  /**
   * 检查是否可以使用技能
   */
  const canUseSkill = (skillId: string): boolean => {
    const skill = getSkill(skillId);
    if (!skill) return false;

    // 检查冷却
    const cooldown = cooldowns.value.get(skillId);
    if (cooldown && cooldown > 0) return false;

    // 检查魔法值
    const charStore = characterService;
    // 这里需要访问到store实例的实际值，简化处理
    return true;
  };

  /**
   * 使用技能
   */
  const useSkill = (skillId: string): boolean => {
    const skill = getSkill(skillId);
    if (!skill) return false;

    if (!canUseSkill(skillId)) {
      const event: SkillCastEvent = { skill, success: false };
      eventBus.emit(GameEvents.SKILL_CAST, event);
      return false;
    }

    // 消耗魔法值
    characterService.addMp(-skill.mpCost);

    // 设置冷却
    if (skill.cooldown > 0) {
      cooldowns.value.set(skillId, skill.cooldown);
      const cdEvent: SkillCooldownEvent = {
        skillId,
        remaining: skill.cooldown,
      };
      eventBus.emit(GameEvents.SKILL_COOLDOWN, cdEvent);
    }

    // 触发技能效果
    applySkillEffect(skill);

    const event: SkillCastEvent = { skill, success: true };
    eventBus.emit(GameEvents.SKILL_CAST, event);

    return true;
  };

  /**
   * 应用技能效果
   */
  const applySkillEffect = (skill: Skill) => {
    // 这里根据技能类型应用不同效果
    if (skill.type === 'heal' && skill.heal) {
      characterService.addHp(skill.heal);
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'success',
        message: `使用了 ${skill.name}，恢复了 ${skill.heal} 点生命值`,
      });
    } else if (skill.type === 'attack' && skill.damage) {
      // 攻击技能在战斗模块处理
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'info',
        message: `使用了 ${skill.name}`,
      });
    }
  };

  /**
   * 学习技能
   */
  const learnSkill = (skill: Skill) => {
    if (skills.value.find(s => s.id === skill.id)) {
      return; // 已学习该技能
    }
    skills.value.push({ ...skill });
  };

  /**
   * 遗忘技能
   */
  const forgetSkill = (skillId: string) => {
    skills.value = skills.value.filter(s => s.id !== skillId);
    cooldowns.value.delete(skillId);
  };

  /**
   * 更新所有技能冷却
   */
  const updateCooldowns = () => {
    for (const [skillId, remaining] of cooldowns.value.entries()) {
      if (remaining > 0) {
        const newRemaining = remaining - 1;
        cooldowns.value.set(skillId, newRemaining);

        const event: SkillCooldownEvent = {
          skillId,
          remaining: newRemaining,
        };
        eventBus.emit(GameEvents.SKILL_COOLDOWN, event);

        if (newRemaining <= 0) {
          cooldowns.value.delete(skillId);
          const readyEvent: SkillReadyEvent = { skillId };
          eventBus.emit(GameEvents.SKILL_READY, readyEvent);
        }
      }
    }
  };

  /**
   * 初始化职业技能
   */
  const initClassSkills = (className: string) => {
    const abilities = CLASS_ABILITIES[className];
    if (abilities) {
      skills.value = abilities.map((ability, index) => ({
        id: `${className}_skill_${index}`,
        name: ability,
        icon: '⚡',
        type: index === 0 ? 'attack' : index === 1 ? 'heal' : 'buff',
        description: `${ability} 的描述`,
        mpCost: 10 + index * 5,
        cooldown: 2 + index,
        damage: index === 0 ? 20 : undefined,
        heal: index === 1 ? 30 : undefined,
      }));
    }
  };

  /**
   * 启动冷却计时器
   */
  const startCooldownTimer = () => {
    if (cooldownTimer) return;
    cooldownTimer = setInterval(updateCooldowns, 1000);
  };

  /**
   * 停止冷却计时器
   */
  const stopCooldownTimer = () => {
    if (cooldownTimer) {
      clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
  };

  /**
   * 重置技能状态
   */
  const reset = () => {
    skills.value = [];
    cooldowns.value.clear();
  };

  return {
    // 状态
    skills,
    cooldowns,
    // 方法
    getSkill,
    getCooldown,
    canUseSkill,
    useSkill,
    learnSkill,
    forgetSkill,
    updateCooldowns,
    initClassSkills,
    startCooldownTimer,
    stopCooldownTimer,
    reset,
  };
});

/**
 * 技能服务实现
 */
export const skillsService: ISkillsService = {
  getSkills: () => useSkillsStore().skills,
  getSkill: (id: string) => useSkillsStore().getSkill(id),
  getCooldown: (skillId: string) => useSkillsStore().getCooldown(skillId),
  canUseSkill: (skillId: string) => useSkillsStore().canUseSkill(skillId),
  useSkill: (skillId: string) => useSkillsStore().useSkill(skillId),
  learnSkill: (skill: Skill) => useSkillsStore().learnSkill(skill),
  forgetSkill: (skillId: string) => useSkillsStore().forgetSkill(skillId),
  updateCooldowns: () => useSkillsStore().updateCooldowns(),
  reset: () => useSkillsStore().reset(),
};
