<!--
  @组件 BaseIcon
  @描述 通用游戏图标组件，基于 @iconify/vue + game-icons 图标集
         通过 CSS 渐变色实现多色效果。图标找不到时自动回退为问号图标。
  @使用 <BaseIcon name="sword-clash" gradient="warrior" :size="24" />
-->
<template>
  <Icon
    :icon="finalIcon"
    :width="size"
    :height="size"
    :color="singleColor"
    :style="gradientStyle"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';

/** 回退图标：问号 */
const FALLBACK_ICON = 'game-icons:uncertainty';

const props = withDefaults(defineProps<{
  /** 图标名（支持 'game-icons:xxx' 全名或 'xxx' 简写），空值自动回退为问号 */
  name?: string;
  /** 图标尺寸（像素） */
  size?: number;
  /** 渐变色键名（对应 --icon-grad-xxx CSS 变量），不传则使用单色（currentColor） */
  gradient?: string;
  /** 单色模式颜色（仅在无 gradient 时生效） */
  color?: string;
}>(), {
  size: 24,
});

/** 处理图标名：空值回退、自动补齐 game-icons: 前缀 */
const finalIcon = computed(() => {
  if (!props.name) return FALLBACK_ICON;
  if (props.name.includes(':')) return props.name;
  return `game-icons:${props.name}`;
});

/** 单色模式颜色 */
const singleColor = computed(() => {
  if (props.gradient) return undefined;
  return props.color;
});

/** 渐变色模式 */
const gradientStyle = computed(() => {
  if (!props.gradient) return {};
  return {
    background: `var(--icon-grad-${props.gradient})`,
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  };
});
</script>
