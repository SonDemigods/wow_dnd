<!--
  @组件 EmptyState
  @描述 通用空状态占位组件，图标在上、文字在下
  @使用 <EmptyState icon="backpack" text="暂无物品" gradient="metal" />
-->
<template>
  <div class="empty-state">
    <BaseIcon :name="icon" :gradient="gradient" :size="size" />
    <span class="empty-state-text">{{ text }}</span>
  </div>
</template>

<script setup lang="ts">
import BaseIcon from '@/components/common/BaseIcon.vue';

withDefaults(defineProps<{
  /** 图标名 */
  icon: string;
  /** 占位文字 */
  text: string;
  /** 图标尺寸 */
  size?: number;
  /** 渐变 */
  gradient?: string;
}>(), {
  size: 32,
});
</script>

<style lang="less" scoped>
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: @spacing-lg;
  padding: 32px;
  background: @overlay-mid;
  border-radius: @radius-md;
  border: 2px dashed @popup-border-color;
}

.empty-state-text {
  color: @color-dodge;
  font-size: @font-md;
}
</style>
