/**
 * @fileoverview 技能模块状态层（P3-155 拆分自 store.ts）
 * @description 持有所有技能相关的响应式状态、计算属性、持久化逻辑和初始化流程。
 *              其他 composable（learning/casting/bar）通过此模块返回的 state 对象读写共享状态。
 * @module skill/composables
 */
import { ref, computed, shallowRef, triggerRef } from 'vue';
import type { Skill, SkillBar, SkillType, SkillSlotIndex } from '../types';
import { skillsDbService } from '../db';
import { errorReporter } from '@/utils/errorReport';
import { eventBus, GameEvents } from '@/modules/bus';
import { useCharacterStore } from '@/modules/character/store';
import { useLogStore } from '@/modules/log/store';
import { generateLogId } from '@/modules/log/service';
import { useGameStore } from '@/modules/game';

/** 技能类型 → 中文名称映射表 */
const SKILL_TYPE_NAMES: Record<SkillType, string> = {
  physical_damage: '物理伤害',
  magic_damage: '魔法伤害',
  health_restore: '生命恢复',
  mana_restore: '法力恢复',
  buff: '增益',
  debuff: '减益'
};

export function useSkillState() {
  // ==================== 响应式状态 ====================

  const skills = ref<Skill[]>([]);
  const skillBar = ref<SkillBar>({ slots: [null, null, null, null] });
  const skillTemplates = shallowRef<Map<string, Skill>>(new Map());
  const monsterSkillTemplates = shallowRef<Map<string, Skill>>(new Map());
  const gameStore = useGameStore();
  const currentCharacterId = computed<string | null>(() => gameStore.currentCharacterId);
  const isLoading = ref(false);
  const cooldowns = ref<Record<string, number>>({});

  // ==================== 计算属性 ====================

  const unlockedSkills = computed(() => {
    const characterStore = useCharacterStore();
    return skills.value.filter(s => s.unlockLevel <= characterStore.level);
  });

  const lockedSkills = computed(() => {
    const characterStore = useCharacterStore();
    return skills.value.filter(s => s.unlockLevel > characterStore.level);
  });

  const equippedSkills = computed(() => {
    return skillBar.value.slots.map(skillId => {
      if (!skillId) return null;
      return skills.value.find(s => s.id === skillId) || null;
    });
  });

  const skillBarSlots = computed(() => {
    return skillBar.value.slots.map((skillId, index) => {
      const skill = skillId ? skills.value.find(s => s.id === skillId) : null;
      return { index: index as SkillSlotIndex, skillId, skill, isEmpty: !skillId };
    });
  });

  const skillCountByType = computed(() => {
    const counts: Record<SkillType, number> = {
      physical_damage: 0, magic_damage: 0, health_restore: 0,
      mana_restore: 0, buff: 0, debuff: 0
    };
    skills.value.forEach(skill => { counts[skill.type]++; });
    return counts;
  });

  // ==================== 持久化 ====================

  async function persist(): Promise<void> {
    const characterStore = useCharacterStore();
    const charId = currentCharacterId.value || characterStore.getCharacterId();
    if (!charId) return;

    try {
      await skillsDbService.saveSkillsData({
        characterId: charId,
        skills: skills.value.map(s => s.id),
        skillBar: skillBar.value,
        currentClass: characterStore.classId,
        updatedAt: Date.now()
      });
    } catch (err) {
      errorReporter.report(err, 'manual', {
        context: '技能数据持久化失败，UI 与 DB 状态可能不一致',
        characterId: charId, skillCount: skills.value.length,
      });
    }
  }

  // ==================== 日志辅助 ====================

  function logSkillLearned(skill: Skill): void {
    eventBus.emit(GameEvents.SKILL_LEARNED, { skill });
    useLogStore().addLogEntry({
      id: generateLogId(), timestamp: Date.now(), type: 'skill',
      message: `学会了新技能：${skill.name}！`, icon: 'game-icons:spell-book'
    });
  }

  // ==================== 模板加载 ====================

  async function loadTemplatesTo(
    templateMap: typeof skillTemplates,
    fetcher: () => Promise<Skill[]>
  ): Promise<void> {
    const templates = await fetcher();
    const newMap = new Map<string, Skill>();
    templates.forEach(skill => newMap.set(skill.id, skill));
    templateMap.value = newMap;
  }

  async function loadTemplatesForClass(classId: string): Promise<void> {
    if (!classId) {
      skillTemplates.value = new Map();
      return;
    }
    await loadTemplatesTo(skillTemplates, () => skillsDbService.getSkillTemplatesByClass(classId));
  }

  async function loadMonsterSkillTemplates(): Promise<void> {
    await loadTemplatesTo(monsterSkillTemplates, () => skillsDbService.getMonsterSkillTemplates());
  }

  // ==================== 初始化 ====================

  async function initialize(characterId?: string): Promise<void> {
    isLoading.value = true;
    try {
      const characterStore = useCharacterStore();
      const charId = characterId || characterStore.getCharacterId();
      if (!charId) {
        return;
      }

      await loadTemplatesForClass(characterStore.classId);
      await loadMonsterSkillTemplates();

      const data = await skillsDbService.getSkillsData(charId);
      skillBar.value = data.skillBar;

      skills.value = data.skills
        .map(id => skillTemplates.value.get(id))
        .filter((s): s is Skill => s !== undefined);
    } finally {
      // P8-202 修复：无论 DB 读取成功或失败，finally 确保 isLoading 复位，避免永久 loading
      isLoading.value = false;
    }
  }

  // ==================== 查询 ====================

  function getSkill(skillId: string): Skill | null {
    return skills.value.find(s => s.id === skillId)
      || skillTemplates.value.get(skillId)
      || monsterSkillTemplates.value.get(skillId)
      || null;
  }

  function getAvailableSkills(): Skill[] {
    return unlockedSkills.value;
  }

  function getSkillsByType(type: SkillType): Skill[] {
    return skills.value.filter(s => s.type === type);
  }

  // ==================== 模板管理 ====================

  async function addSkillTemplate(skill: Skill): Promise<void> {
    skillTemplates.value.set(skill.id, skill);
    triggerRef(skillTemplates);
    // P8-203 修复：捕获 DB 写入失败，记录错误但不回滚内存（保持简单）
    try {
      await skillsDbService.saveSkillTemplate(skill);
    } catch (err) {
      errorReporter.report(err, 'manual', {
        context: 'addSkillTemplate DB 写入失败，UI 与 DB 状态可能不一致',
        skillId: skill.id,
      });
    }
  }

  async function removeSkillTemplate(skillId: string): Promise<void> {
    skillTemplates.value.delete(skillId);
    triggerRef(skillTemplates);
    // P8-203 修复：捕获 DB 写入失败，记录错误但不回滚内存（保持简单）
    try {
      await skillsDbService.deleteSkillTemplate(skillId);
    } catch (err) {
      errorReporter.report(err, 'manual', {
        context: 'removeSkillTemplate DB 写入失败，UI 与 DB 状态可能不一致',
        skillId,
      });
    }
  }

  async function getSkillTemplatesByClass(classId: string): Promise<Skill[]> {
    return await skillsDbService.getSkillTemplatesByClass(classId);
  }

  // ==================== 重置 ====================

  async function reset(): Promise<void> {
    skills.value = [];
    skillBar.value = { slots: [null, null, null, null] };
    skillTemplates.value = new Map();
    monsterSkillTemplates.value = new Map();
    cooldowns.value = {};
    // P9-084 修复：reset 不持久化空数据，避免覆盖有效存档
    // reset 仅清空内存状态，下次 initialize 时从 DB 重新加载
  }

  // ==================== 冷却管理 ====================

  function tickCooldowns(): void {
    const newCooldowns: Record<string, number> = {};
    for (const key of Object.keys(cooldowns.value)) {
      const remaining = cooldowns.value[key];
      if (remaining > 0) {
        const next = remaining - 1;
        // P8-201 修复：仅保留 next>0 的键写回，删除 else 分支（不再保留 remaining<=0 的键）
        if (next > 0) newCooldowns[key] = next;
      }
    }
    cooldowns.value = newCooldowns;
  }

  function resetCooldowns(): void {
    cooldowns.value = {};
  }

  function isOnCooldown(skillId: string): boolean {
    return (cooldowns.value[skillId] || 0) > 0;
  }

  function getCooldownRemaining(skillId: string): number {
    return cooldowns.value[skillId] || 0;
  }

  return {
    // 状态
    skills, skillBar, skillTemplates, monsterSkillTemplates,
    currentCharacterId, isLoading, cooldowns,
    // 计算属性
    unlockedSkills, lockedSkills, equippedSkills, skillBarSlots, skillCountByType,
    // 持久化 & 日志
    persist, logSkillLearned,
    // 模板加载
    loadTemplatesForClass, loadMonsterSkillTemplates, getSkillTemplatesByClass,
    addSkillTemplate, removeSkillTemplate,
    // 初始化 & 重置
    initialize, reset,
    // 查询
    getSkill, getAvailableSkills, getSkillsByType,
    // 冷却
    tickCooldowns, resetCooldowns, isOnCooldown, getCooldownRemaining,
    // 常量
    SKILL_TYPE_NAMES,
  };
}

export type SkillState = ReturnType<typeof useSkillState>;
