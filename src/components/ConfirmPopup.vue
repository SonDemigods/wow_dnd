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
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  box-sizing: border-box;
}

.popup-content {
  background: rgba(13, 17, 23, 0.98);
  border-radius: 12px;
  border: 2px solid #4a4a4a;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.confirm-popup {
  max-width: 400px;
  text-align: center;
}

.confirm-header {
  padding: 20px;
  border-bottom: 1px solid #4a4a4a;
}

.confirm-header h3 {
  margin: 0;
  color: #ffd700;
  font-size: 18px;
}

.confirm-body {
  padding: 24px 20px;
}

.confirm-body p {
  margin: 0;
  color: #ccc;
  font-size: 14px;
}

.confirm-footer {
  display: flex;
  gap: 12px;
  padding: 16px 20px;
  border-top: 1px solid #4a4a4a;
}

.confirm-btn {
  flex: 1;
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.confirm-btn.cancel {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.confirm-btn.cancel:hover {
  background: rgba(255, 255, 255, 0.2);
}

.confirm-btn.confirm {
  background: #ff4444;
  color: #fff;
}

.confirm-btn.confirm:hover {
  background: #cc0000;
}
</style>