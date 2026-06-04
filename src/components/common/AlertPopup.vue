<template>
  <BasePopup :visible="visible" :title="title || '提示'" max-width="400px" :show-close="false" :show-footer-close="false" @close="$emit('close')">
    <p class="alert-message">{{ message }}</p>

    <template #footer>
      <button class="popup-footer-btn confirm" @click="$emit('close')">确定</button>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
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

<style scoped>
.alert-message {
  margin: 0;
  color: #aaa;
  font-size: 14px;
  text-align: center;
}
</style>
