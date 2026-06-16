<template>
  <span class="skill-tags">
    <span class="skill-tag skill-tag-type" :class="`skill-tag-${skill.type}`">
      {{ getSkillTypeName(skill.type) }}
    </span>
    <span class="skill-tag skill-tag-cost">{{ skill.mpCost }} MP</span>
    <span v-if="skill.cooldown && skill.cooldown > 0" class="skill-tag skill-tag-cooldown">
      冷却 {{ skill.cooldown }} 回合
    </span>
    <span v-if="skill.targetType" class="skill-tag skill-tag-target">
      {{ getTargetTypeName(skill.targetType) }}
    </span>
  </span>
</template>

<script setup lang="ts">
/**
 * @fileoverview 技能标签组件
 * @description 统一展示技能的类型、MP消耗、冷却时间、目标类型等标签，供 SkillsPopup 和 CombatPopup 共用
 */

import type { Skill } from '@/modules/skill';
import { useSkillDisplay } from '@/composables/useSkillDisplay';

defineProps<{
  skill: Skill;
}>();

const { getSkillTypeName, getTargetTypeName } = useSkillDisplay();
</script>

<style scoped>
.skill-tags {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.skill-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  white-space: nowrap;
}

/* 技能类型标签 - 物理伤害 */
.skill-tag-type.skill-tag-physical_damage {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
}

/* 技能类型标签 - 魔法伤害 */
.skill-tag-type.skill-tag-magic_damage {
  background: rgba(162, 155, 254, 0.2);
  color: #a29bfe;
}

/* 技能类型标签 - 生命恢复 */
.skill-tag-type.skill-tag-health_restore {
  background: rgba(78, 205, 196, 0.2);
  color: #4ecdc4;
}

/* 技能类型标签 - 法力恢复 */
.skill-tag-type.skill-tag-mana_restore {
  background: rgba(110, 155, 255, 0.15);
  color: #6e9bff;
}

/* 技能类型标签 - 增益 */
.skill-tag-type.skill-tag-buff {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
}

/* 技能类型标签 - 减益 */
.skill-tag-type.skill-tag-debuff {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}

/* MP 消耗标签 */
.skill-tag-cost {
  background: rgba(110, 155, 255, 0.15);
  color: #6e9bff;
}

/* 冷却时间标签 */
.skill-tag-cooldown {
  background: rgba(255, 165, 0, 0.15);
  color: #ffa500;
}

/* 目标类型标签 */
.skill-tag-target {
  background: rgba(160, 100, 255, 0.15);
  color: #a064ff;
}
</style>
