<template>
  <BasePopup :visible="visible" :title="title || '确认'" max-width="400px" :show-close="false" :show-footer-close="false" @close="$emit('cancel')">
    <p class="confirm-message">{{ message }}</p>

    <template #footer>
      <button class="popup-footer-btn cancel" @click="$emit('cancel')">取消</button>
      <button :class="['popup-footer-btn', type === 'danger' ? 'danger' : 'confirm']" @click="$emit('confirm')">确认</button>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 确认弹窗组件
 * @description 带确认/取消双按钮的二次确认弹窗，支持普通和危险两种类型样式
 */

import BasePopup from '../common/BasePopup.vue';

withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  message: string;
  type?: 'normal' | 'danger';
}>(), {
  type: 'normal'
});

defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();
</script>

<style scoped>
.confirm-message {
  margin: 0;
  color: #aaa;
  font-size: 14px;
  text-align: center;
}
</style>