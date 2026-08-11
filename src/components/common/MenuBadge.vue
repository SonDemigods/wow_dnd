<template>
  <Transition name="badge-pop">
    <span
      v-if="visible"
      :class="['menu-badge', { 'badge-dot': !hasNumber, [`badge-${variant}`]: true }]"
    >
      <template v-if="hasNumber">{{ displayValue }}</template>
    </span>
  </Transition>
</template>

<script setup lang="ts">
/**
 * @fileoverview 菜单角标徽章组件
 * @description 底部导航按钮的状态指示器：支持数字徽章与红点徽章两种形态。
 *              数字徽章用于可量化状态（未分配点数、任务数），红点用于布尔状态（可解锁、背包满）。
 */
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  /** 徽章数值；>0 显示数字，0 不显示。设为 -1 时显示纯红点 */
  count?: number;
  /** 显示变体：info(蓝)/success(绿)/warning(橙)/danger(红) */
  variant?: 'info' | 'success' | 'warning' | 'danger';
  /** 数字显示上限，超过显示 `max+` */
  max?: number;
}>(), {
  count: 0,
  variant: 'danger',
  max: 99,
});

const hasNumber = computed(() => props.count > 0);
const visible = computed(() => props.count !== 0);
const displayValue = computed(() => {
  if (props.count < 0) return '';
  return props.count > props.max ? `${props.max}+` : String(props.count);
});
</script>

<style lang="less" scoped>
.menu-badge {
  position: absolute;
  top: -2px;
  right: -2px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  font-size: @font-2xs;
  font-weight: @font-weight-bold;
  line-height: 16px;
  text-align: center;
  color: #fff;
  border: 1.5px solid @secondary-bg;
  pointer-events: none;
  z-index: @z-dropdown;
  display: flex;
  align-items: center;
  justify-content: center;
}

.badge-dot {
  min-width: 8px;
  width: 8px;
  height: 8px;
  padding: 0;
  border-radius: 50%;
  top: 0;
  right: 0;
}

.badge-info { background: @skill-blue; }
.badge-success { background: @success-color; }
.badge-warning { background: @warning-color; }
.badge-danger { background: @danger-color; }

.badge-pop-enter-active {
  transition: transform 0.2s ease, opacity 0.2s ease;
}
.badge-pop-leave-active {
  transition: opacity 0.15s ease;
}
.badge-pop-enter-from {
  transform: scale(0);
  opacity: 0;
}
.badge-pop-leave-to {
  opacity: 0;
}
</style>
