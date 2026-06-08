<template>
  <div class="resource-bar-wrapper">
    <span class="resource-icon">{{ icon }}</span>
    <div class="resource-track">
      <div class="resource-fill" :class="type" :style="{ width: percent + '%' }"></div>
      <div class="resource-text">
        <span class="resource-label">{{ name }}</span>
        <span class="resource-value">{{ current }}/{{ max }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 资源条组件
 * @description 通用资源进度条展示组件，用于显示 HP/MP/EXP 等资源的当前值、最大值和百分比
 */

withDefaults(defineProps<{
  icon: string;
  name: string;
  current: number;
  max: number;
  percent: number;
  type?: string;
}>(), {
  type: 'hp'
});
</script>

<style scoped>
.resource-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 6px;
}

.resource-icon {
  font-size: 14px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.resource-track {
  flex: 1;
  height: 20px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.resource-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
  position: absolute;
  top: 0;
  left: 0;
}

.resource-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.resource-fill.hp {
  background: linear-gradient(90deg, #ff6b6b, #ee5a5a, #d63031);
  box-shadow: 0 0 10px rgba(255, 107, 107, 0.5);
}

.resource-fill.mp {
  background: linear-gradient(90deg, #74b9ff, #0984e3, #0652dd);
  box-shadow: 0 0 10px rgba(116, 185, 255, 0.5);
}

.resource-fill.exp {
  background: linear-gradient(90deg, #fdcb6e, #f39c12, #e67e22);
  box-shadow: 0 0 10px rgba(253, 203, 110, 0.5);
}

.resource-text {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  z-index: 1;
}

.resource-label {
  font-size: 11px;
  color: #fff;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.resource-value {
  font-size: 11px;
  color: #fff;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}
</style>
