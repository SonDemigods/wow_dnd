/**
 * @fileoverview 技能施放 Composable（P3-155 拆分自 store.ts）
 * @description 提供技能施放逻辑和可用性检查。
 * @module skill/composables
 */
import { useCharacterStore } from '@/modules/character/store';
import { useTalentStore } from '@/modules/character/talents/store';
import { useLogStore } from '@/modules/log/store';
import { generateLogId } from '@/modules/log/service';
import { eventBus, GameEvents } from '@/modules/bus';
import { canCastSkill } from '../service';
import { calculateSkillDamage, calculateBuffValue } from '../service';
import type { SkillState } from './useSkillState';
import type { SkillUseResult, AppliedEffectInfo } from '../types';

export function useSkillCasting(state: SkillState) {
  const { skills, skillTemplates, cooldowns, isOnCooldown, getCooldownRemaining } = state;

  async function castSkill(
    skillId: string,
    skipAdventureLog: boolean = false,
    consumedAmount?: number
  ): Promise<SkillUseResult> {
    const characterStore = useCharacterStore();
    const charData = characterStore.getCharacterData();
    const skill = skills.value.find(s => s.id === skillId)
      || skillTemplates.value.get(skillId);

    if (!skill) {
      return { success: false, skillId, type: 'physical_damage', message: '技能不存在' };
    }

    if (!charData) {
      return { success: false, skillId, type: 'physical_damage', message: '未加载角色，无法施放技能' };
    }

    // P9-023 修复：构造完整 CanCastSkillOptions，传入冷却状态
    // 沉默校验由 combat store 的 playerAction 在调用 castSkill 前完成（defense-in-depth），
    // 此处传入 currentCooldown 使 canCastSkill 校验冷却，避免直接调用时跳过
    const castCheck = canCastSkill(skill, {
      currentMana: charData.mana,
      currentCooldown: getCooldownRemaining(skillId),
    });
    if (!castCheck.canCast) {
      return { success: false, skillId, type: skill.type, message: castCheck.reason };
    }

    if (isOnCooldown(skillId)) {
      return {
        success: false, skillId, type: skill.type,
        message: `技能冷却中（剩余 ${getCooldownRemaining(skillId)} 回合）`
      };
    }

    const mpCost = skill.mpCost ?? 0;
    if (mpCost > 0) {
      await characterStore.changeMp(-mpCost);
    }

    const damageValue = calculateSkillDamage(skill, characterStore.effectiveStats, consumedAmount);

    let damage: number | undefined;
    let heal: number | undefined;
    let appliedEffects: AppliedEffectInfo[] | undefined;

    switch (skill.type) {
      case 'physical_damage':
      case 'magic_damage': {
        const talentStore = useTalentStore();
        const enhanceValue = talentStore.effectSummary.skillEnhancements
          .filter(e => e.skillId === skill.id)
          .reduce((sum, e) => sum + e.value, 0);
        damage = enhanceValue > 0
          ? Math.floor(damageValue * (1 + enhanceValue))
          : damageValue;
        break;
      }
      case 'health_restore': {
        const talentStore = useTalentStore();
        const healingMultiplier = talentStore.effectSummary.healingMultiplier;
        heal = healingMultiplier > 0
          ? Math.floor(damageValue * (1 + healingMultiplier))
          : damageValue;
        break;
      }
      case 'mana_restore':
        await characterStore.changeMp(damageValue);
        // P9-078 修复：mana_restore 仍需设置 heal 字段以进入 usePlayerSkill 的 heal 分支并结束回合，
        // 但通过 type='mana_restore' 标记使 pipeline 跳过 receiveHeal（P8-007 已实现 isManaRestore 守卫）。
        // 此处保持 heal=damageValue 供 pipeline 显示 MP+ 蓝字，不会触发回血。
        heal = damageValue;
        break;
      case 'buff':
      case 'debuff':
        if (skill.buffs && skill.buffs.length > 0) {
          appliedEffects = skill.buffs.map(be => ({
            type: be.type,
            value: calculateBuffValue(be, characterStore.effectiveStats),
            turns: be.turns
          }));
        }
        break;
    }

    eventBus.emit(GameEvents.SKILL_CAST, { skill, success: true });

    if (!skipAdventureLog) {
      useLogStore().addLogEntry({
        id: generateLogId(), timestamp: Date.now(), type: 'skill',
        message: `施放了技能：${skill.name}`, icon: 'game-icons:lightning-storm'
      });
    }

    if (skill.cooldown && skill.cooldown > 0) {
      cooldowns.value[skillId] = skill.cooldown;
    }

    return { success: true, skillId, type: skill.type, damage, heal, appliedEffects, message: `使用了 ${skill.name}` };
  }

  function canUseSkill(skillId: string): boolean {
    const skill = state.getSkill(skillId);
    if (!skill) return false;

    const characterStore = useCharacterStore();
    if (skill.unlockLevel > characterStore.level) return false;

    const charData = characterStore.getCharacterData();
    if (!charData) return false;
    // P10-024 修复：传入冷却状态，与 castSkill 中的校验保持一致
    if (!canCastSkill(skill, {
      currentMana: charData.mana,
      currentCooldown: getCooldownRemaining(skillId),
    }).canCast) return false;

    return !isOnCooldown(skillId);
  }

  return { castSkill, canUseSkill };
}
