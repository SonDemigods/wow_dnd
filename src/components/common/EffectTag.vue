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

<style lang="less" scoped>
.effect-tag {
  .tag-base();
  display: inline-block;
}

/* 物理伤害 */
.effect-tag-physical_damage {
  background: @damage-physical-bg;
  color: @damage-physical;
}

/* 魔法伤害 */
.effect-tag-magic_damage {
  background: @damage-magic-bg;
  color: @damage-magic;
}

/* 生命恢复 */
.effect-tag-health_restore {
  background: @heal-hp-bg;
  color: @heal-hp;
}

/* 法力恢复 */
.effect-tag-mana_restore {
  background: @heal-mp-bg;
  color: @heal-mp;
}

/* 增益 */
.effect-tag-buff {
  background: @buff-bg;
  color: @buff-color;
}

/* 减益 */
.effect-tag-debuff {
  background: @debuff-bg;
  color: @debuff-color;
}
</style>
