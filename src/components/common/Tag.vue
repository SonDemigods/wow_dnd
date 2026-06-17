<template>
  <span 
    :class="['tag', `tag-${type}`]" 
    :style="customStyle"
  >
    {{ text }}
  </span>
</template>

<script setup lang="ts">
/**
 * @fileoverview 标签组件
 * @description 用于展示种族、职业、阵营的彩色标签，支持自定义颜色
 */

const props = defineProps<{
  text: string;
  type: 'race' | 'class' | 'faction';
  color?: string;
}>();

const customStyle = {
  '--tag-color': props.color || 'inherit'
};
</script>

<style lang="less" scoped>
.tag {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.3);
  color: #ffffff;
  min-width: 40px;
  max-width: 80px;
}

.tag-race {
  background: rgba(255, 255, 255, 0.2);
}

.tag-class {
  background: var(--tag-color, rgba(255, 255, 255, 0.3));
}

.tag-faction {
  background: var(--tag-color, rgba(255, 255, 255, 0.3));
}
</style>
