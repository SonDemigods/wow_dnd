<!--
  @组件 BaseIcon
  @描述 通用游戏图标组件，基于 @iconify/vue + game-icons 图标集
         渐变色模式通过 loadIcon 加载 SVG 后注入 SVG linearGradient 实现。
         图标找不到时自动回退为问号图标。
  @使用 <BaseIcon name="sword-clash" gradient="warrior" :size="24" />
-->
<template>
  <svg
    v-if="gradientSvgBody"
    xmlns="http://www.w3.org/2000/svg"
    :width="size"
    :height="size"
    viewBox="0 0 512 512"
    v-html="gradientSvgBody"
  />
  <Icon
    v-else
    :icon="finalIcon"
    :width="size"
    :height="size"
    :color="color"
  />
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { Icon, loadIcon } from '@iconify/vue';

/** 回退图标：问号 */
const FALLBACK_ICON = 'game-icons:uncertainty';

const props = withDefaults(defineProps<{
  /** 图标名（支持 'game-icons:xxx' 全名或 'xxx' 简写），空值自动回退为问号 */
  name?: string;
  /** 图标尺寸（像素） */
  size?: number;
  /** 渐变色键名（对应 SVG grad-xxx linearGradient），不传则使用单色（currentColor） */
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

/** 渐变模式缓存的 SVG body */
const gradientSvgBody = ref('');
const lastLoadedIcon = ref('');

watch(
  [finalIcon, () => props.gradient],
  async ([icon, grad]) => {
    if (!grad || !icon) {
      gradientSvgBody.value = '';
      return;
    }
    if (icon === lastLoadedIcon.value && gradientSvgBody.value) return;
    lastLoadedIcon.value = icon;

    try {
      const data = await loadIcon(icon);
      if (!data) {
        gradientSvgBody.value = '';
        return;
      }
      // 将 currentColor 填充替换为 SVG 渐变引用，并注入 <defs>
      const defs = `<defs><linearGradient id="grad-current" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="var(--icon-grad-${grad}-start)"/><stop offset="100%" stop-color="var(--icon-grad-${grad}-end)"/></linearGradient></defs>`;
      const body = data.body.replace(
        /fill="currentColor"/g,
        'fill="url(#grad-current)"'
      );
      gradientSvgBody.value = defs + body;
    } catch {
      gradientSvgBody.value = '';
    }
  },
  { immediate: true }
);
</script>
