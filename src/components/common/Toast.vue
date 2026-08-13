<template>
  <Transition name="toast">
    <div v-if="visible" class="toast" :class="type">
      <span class="toast-icon">{{ icon }}</span>
      <span class="toast-message">{{ message }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * @fileoverview Toast 提示组件
 * @description 顶部浮动消息提示，支持 info/success/warning/danger 四种类型，带有进出场动画
 */

withDefaults(defineProps<{
  visible: boolean;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'danger';
  icon?: string;
}>(), {
  type: 'info',
  icon: ''
});
</script>

<style lang="less" scoped>
.toast {
  position: fixed;
  top: 120px;
  left: 50%;
  transform: translateX(-50%);
  padding: @spacing-xl 24px;
  border-radius: @radius-lg;
  color: @popup-text-color;
  font-size: @font-md;
  font-weight: @font-weight-bold;
  z-index: @z-toast;
  display: flex;
  align-items: center;
  gap: @spacing-md;
  pointer-events: none;
  box-shadow: @shadow-card;
}

.toast.info {
  background: rgba(0, 150, 255, 0.9);
}

.toast.success {
  background: rgba(76, 175, 80, 0.9);
}

.toast.warning {
  background: rgba(255, 152, 0, 0.9);
}

.toast.danger {
  background: rgba(255, 87, 34, 0.9);
}

.toast-icon {
  font-size: @font-lg;
}

.toast-enter-active {
  animation: toast-in 0.3s ease;
}

.toast-leave-active {
  animation: toast-out 0.3s ease;
}

</style>
