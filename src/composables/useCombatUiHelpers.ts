/**
 * @fileoverview 战斗 UI 辅助 Composable（P3-163 拆分自 CombatPopup.vue）
 * @description 封装战斗界面中纯展示性质的辅助函数，包括技能消耗文本、效果图标、伤害类型样式等。
 *              这些函数不依赖 DOM refs，仅依赖 combatStore / characterStore 数据。
 * @module composables
 */
import { useCombatStore } from '@/modules/combat';
import { useCharacterStore } from '@/modules/character';
import { useSkillDisplay } from '@/composables/useSkillDisplay';
import { describeEffect } from '@/modules/item/descriptors';
import type { Skill } from '@/modules/skill';
import type { Item } from '@/modules/inventory';
import type { CombatLog } from '@/modules/combat';

const RESOURCE_TYPE_NAMES: Record<string, string> = {
  rage: '怒气', energy: '能量', combo_point: '连击点', chi: '真气',
  holy_power: '圣能', runic_power: '符文', soul_shard: '灵魂碎片',
  focus: '集中', fury: '怒火', soul: '灵魂', essence: '精华',
  mana: '法力',
};

const EFFECT_ICONS: Record<string, string> = {
  poison: 'skull-poison', burn: 'flame', stun: 'stun-glow', freeze: 'snowflake', silence: 'silenced',
  shield: 'shield', attack_up: 'sword-clash', attack_down: 'sword-clash', defense_up: 'shield',
  defense_down: 'shield', speed_up: 'dodge', speed_down: 'turtle', regen: 'regeneration',
  thorn: 'cactus', vulnerable: 'heart-organ',
};

export function useCombatUiHelpers() {
  const combatStore = useCombatStore();
  const characterStore = useCharacterStore();
  const { getSkillEffectBrief, getTargetTypeName } = useSkillDisplay();

  function getSkillCostText(skill: Skill): string {
    if (skill.resourceType && skill.resourceCost) {
      return `${skill.resourceCost} ${RESOURCE_TYPE_NAMES[skill.resourceType] || ''}`;
    }
    return `${skill.mpCost ?? 0} MP`;
  }

  function canCastSkill(skill: Skill): boolean {
    if (characterStore.mana < (skill.mpCost ?? 0)) return false;
    if (skill.resourceType && skill.resourceCost) {
      const sys = combatStore.resourceSystems.find(s => s.type === skill.resourceType);
      if (sys && !sys.hasEnough(skill.resourceCost)) return false;
    }
    return true;
  }

  function getHpPercent(e: { hp: number; maxHp: number }): number {
    return Math.max(0, Math.min(100, (e.hp / e.maxHp) * 100));
  }

  function getEnemiesInSlot(row: 'front' | 'back', col: number) {
    const positions = combatStore.enemyPositions;
    return combatStore.enemies.filter(e => {
      const pos = positions[e.id];
      return pos && pos.row === row && pos.col === col;
    });
  }

  function getEnemyEffects(enemyId: string) {
    return combatStore.enemyEffects[enemyId]?.effects || [];
  }

  function getEnemyEffectCount(enemyId: string): number {
    return getEnemyEffects(enemyId).length;
  }

  function buildItemDescription(info: Item): string {
    if (info.kind === 'consumable' && info.effects.length > 0) {
      return info.effects.map(describeEffect).join('，');
    }
    return info.description || '';
  }

  function getSkillEffectText(skill: Skill): string {
    return getSkillEffectBrief(skill, characterStore.effectiveStats);
  }

  function getTargetTypeText(targetType?: 'single' | 'all_enemies' | 'self' | 'ally'): string {
    if (!targetType || targetType === 'single') return '';
    return getTargetTypeName(targetType);
  }

  function getDamageTypeClass(log: CombatLog): string {
    if (log.eventType === 'combat_skill_cast') return 'magic-damage';
    if (log.eventType === 'combat_critical') return 'crit-damage';
    return 'physical-damage';
  }

  function getDamageTypeIcon(log: CombatLog): string {
    if (log.eventType === 'combat_skill_cast') return 'magic-swirl';
    if (log.eventType === 'combat_critical') return 'sword-clash';
    return 'pointy-sword';
  }

  function isBuffEffect(type: string): boolean {
    return ['shield', 'attack_up', 'defense_up', 'speed_up', 'regen'].includes(type);
  }

  function isDebuffEffect(type: string): boolean {
    return ['poison', 'burn', 'stun', 'freeze', 'silence', 'attack_down', 'defense_down', 'speed_down', 'vulnerable'].includes(type);
  }

  function formatEffectValue(type: string, value: number): string {
    if (isBuffEffect(type)) return `+${value}`;
    if (isDebuffEffect(type)) return `+${value}`;
    return `${value}`;
  }

  function getEffectIcon(type: string): string {
    return EFFECT_ICONS[type] || 'game-icons:sparkles';
  }

  return {
    getSkillCostText, canCastSkill, getHpPercent,
    getEnemiesInSlot, getEnemyEffects, getEnemyEffectCount,
    buildItemDescription, getSkillEffectText, getTargetTypeText,
    getDamageTypeClass, getDamageTypeIcon,
    isBuffEffect, isDebuffEffect, formatEffectValue, getEffectIcon,
  };
}
