<template>
  <span class="skill-tags">
    <EffectTag :type="skill.type" />
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
 * @description 展示技能的类型（复用 EffectTag）、MP消耗、冷却时间、目标类型等标签
 */

import type { Skill } from '@/modules/skill';
import { useSkillDisplay } from '@/composables/useSkillDisplay';
import EffectTag from './EffectTag.vue';

defineProps<{
  skill: Skill;
}>();

const { getTargetTypeName } = useSkillDisplay();
</script>

<style lang="less" scoped>
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
