<template>
  <BasePopup :visible="visible" :title="title || '提示'" max-width="400px" :show-close="false" :show-footer-close="false" @close="$emit('close')">
    <p class="alert-message">{{ message }}</p>

    <template #footer>
      <button class="popup-footer-btn confirm" @click="$emit('close')">确定</button>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 提示弹窗组件
 * @description 基于 BasePopup 的简单提示弹窗，用于显示信息类通知，仅包含关闭确认按钮
 */

import BasePopup from '../common/BasePopup.vue';

defineProps<{
  visible: boolean;
  title?: string;
  message: string;
}>();

defineEmits<{
  (e: 'close'): void;
}>();
</script>

<style lang="less" scoped>
.alert-message {
  .popup-message-text();
}
</style>
