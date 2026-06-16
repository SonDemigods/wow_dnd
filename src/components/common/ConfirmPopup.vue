<template>
  <BasePopup :visible="visible" :title="title || '确认'" max-width="400px" :show-close="false" :show-footer-close="false" @close="$emit('cancel')">
    <p class="confirm-message">{{ message }}</p>

    <template #footer>
      <button class="popup-footer-btn cancel" @click="onCancel">取消</button>
      <button :class="['popup-footer-btn', type === 'danger' ? 'danger' : 'confirm']" @click="onConfirm">确认</button>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 确认弹窗组件
 * @description 带确认/取消双按钮的二次确认弹窗，支持普通和危险两种类型样式
 */

import { eventBus, GameEvents } from '@/modules/bus/core';
import BasePopup from '../common/BasePopup.vue';

const props = withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  message: string;
  type?: 'normal' | 'danger';
  /** 操作标识，用于音效事件区分 */
  action?: string;
}>(), {
  type: 'normal',
  action: 'unknown'
});

const emit = defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
}>();

function onConfirm() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'confirm_ok' });
  eventBus.emit(GameEvents.CONFIRM_CONFIRMED, { action: props.action });
  emit('confirm');
}

function onCancel() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'confirm_cancel' });
  eventBus.emit(GameEvents.CONFIRM_CANCELED, { action: props.action });
  emit('cancel');
}
</script>

<style scoped>
.confirm-message {
  margin: 0;
  color: #aaa;
  font-size: 14px;
  text-align: center;
}
</style>