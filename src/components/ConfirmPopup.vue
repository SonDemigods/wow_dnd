<template>
  <div v-if="visible" class="popup-overlay" @click.self="$emit('cancel')">
    <div class="popup-content confirm-popup">
      <div class="confirm-header">
        <h3>{{ title }}</h3>
      </div>
      <div class="confirm-body">
        <p>{{ message }}</p>
      </div>
      <div class="confirm-footer">
        <button class="confirm-btn cancel" @click="$emit('cancel')">取消</button>
        <button class="confirm-btn confirm" @click="$emit('confirm')">确认</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
.confirm-popup {
  max-width: 400px;
  text-align: center;
}

.confirm-btn.confirm {
  background: #ff4444;
  color: #fff;
}

.confirm-btn.confirm:hover {
  background: #cc0000;
}
</style>