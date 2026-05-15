<template>
  <Transition name="notification">
    <div v-if="message" class="notification">
      <span class="notification-icon">✨</span>
      <span class="notification-text">{{ message }}</span>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useGameStore } from '@/stores/game'

const gameStore = useGameStore()
const message = computed(() => gameStore.notification)
</script>

<style scoped lang="less">
@import '@/styles/variables.less';

.notification {
  position: fixed;
  top: 20px;
  right: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px 24px;
  border-radius: 12px;
  font-weight: 600;
  z-index: 10000;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 400px;
}

.notification-icon {
  font-size: 1.2rem;
}

.notification-text {
  font-size: 1rem;
}

.notification-enter-active,
.notification-leave-active {
  transition: all 0.3s ease;
}

.notification-enter-from,
.notification-leave-to {
  transform: translateX(100%);
  opacity: 0;
}
</style>
