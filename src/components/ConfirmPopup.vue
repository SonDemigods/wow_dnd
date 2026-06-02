<template>
  <BasePopup :visible="visible" :title="title || '确认'" max-width="400px" :show-close="false" :show-footer-close="false" @close="$emit('cancel')">
    <p class="confirm-message">{{ message }}</p>

    <template #footer>
      <button class="popup-footer-btn cancel" @click="$emit('cancel')">取消</button>
      <button class="popup-footer-btn confirm" @click="$emit('confirm')">确认</button>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
import BasePopup from './BasePopup.vue';

defineProps<{
  visible: boolean;
  title?: string;
  message: string;
}>();

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