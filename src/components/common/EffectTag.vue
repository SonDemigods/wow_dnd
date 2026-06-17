<template>
  <span class="effect-tag" :class="`effect-tag-${type}`">
    {{ typeName }}
  </span>
</template>

<script setup lang="ts">
/**
 * @fileoverview 效果类型标签组件
 * @description 纯展示组件，根据效果类型渲染带颜色的类型徽章。用于物品效果、技能类型等场景。
 */

import { computed } from 'vue';
import { useSkillDisplay } from '@/composables/useSkillDisplay';

const props = defineProps<{
  /** 效果类型（如 physical_damage、magic_damage、health_restore 等） */
  type: string;
}>();

const { getSkillTypeName } = useSkillDisplay();

const typeName = computed(() => getSkillTypeName(props.type));
</script>

<style scoped>
.effect-tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: bold;
  white-space: nowrap;
  display: inline-block;
}

/* 物理伤害 */
.effect-tag-physical_damage {
  background: rgba(255, 107, 107, 0.2);
  color: #ff6b6b;
}

/* 魔法伤害 */
.effect-tag-magic_damage {
  background: rgba(162, 155, 254, 0.2);
  color: #a29bfe;
}

/* 生命恢复 */
.effect-tag-health_restore {
  background: rgba(78, 205, 196, 0.2);
  color: #4ecdc4;
}

/* 法力恢复 */
.effect-tag-mana_restore {
  background: rgba(110, 155, 255, 0.15);
  color: #6e9bff;
}

/* 增益 */
.effect-tag-buff {
  background: rgba(76, 175, 80, 0.2);
  color: #4CAF50;
}

/* 减益 */
.effect-tag-debuff {
  background: rgba(255, 152, 0, 0.2);
  color: #ff9800;
}
</style>
