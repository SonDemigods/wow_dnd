<template>
  <div class="resource-bar-wrapper">
    <BaseIcon :name="iconName || icon" :gradient="iconGradient" :size="16" />
    <div class="resource-track">
      <!-- 填充层 -->
      <div class="resource-fill" :class="type" :style="{ width: Math.max(0, Math.min(100, percent)) + '%' }">
        <!-- 流体波浪层 1（慢速大浪） -->
        <div class="wave-layer wave-slow" :class="type"></div>
        <!-- 流体波浪层 2（快速细浪） -->
        <div class="wave-layer wave-fast" :class="type"></div>
        <!-- 粒子光点 -->
        <div class="particles">
          <span class="particle p1"></span>
          <span class="particle p2"></span>
          <span class="particle p3"></span>
        </div>
      </div>
      <!-- 文字层 -->
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
 * @description 通用资源进度条展示组件，用于显示 HP/MP/EXP 等资源的当前值、最大值和百分比，
 *              包含液态波浪、粒子光效、外发光等华丽视觉效果
 */

import BaseIcon from '@/components/common/BaseIcon.vue';

withDefaults(defineProps<{
  icon: string;
  iconName?: string;
  iconGradient?: string;
  name: string;
  current: number;
  max: number;
  percent: number;
  type?: string;
}>(), {
  type: 'hp'
});
</script>

<style lang="less" scoped>
/* ===== 容器 ===== */
.resource-bar-wrapper {
  display: flex;
  align-items: center;
  gap: @spacing-md;
  width: 100%;
}

/* ===== 图标 ===== */
.resource-icon {
  font-size: @font-base;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  .flex-center();
}

.resource-icon.hp { color: #ff5252; }
.resource-icon.mp { color: #448aff; }
.resource-icon.exp { color: #ffb300; }

/* ===== 共享结构（Mixin 生成） ===== */
.resource-bar-base();

/* ===== 填充条颜色变体 ===== */
.resource-fill.hp {
  background: linear-gradient(90deg, #ff5252, #e53935);
  box-shadow: 0 0 8px rgba(255, 82, 82, 0.25);
}

.resource-fill.mp {
  background: linear-gradient(90deg, #448aff, #2962ff);
  box-shadow: 0 0 8px rgba(68, 138, 255, 0.25);
}

.resource-fill.exp {
  background: linear-gradient(90deg, #ffb300, #ff8f00);
  box-shadow: 0 0 8px rgba(255, 179, 0, 0.25);
}

/* ===== 波浪颜色变体 ===== */
.wave-slow.hp { background: rgba(255, 200, 200, 0.55); }
.wave-slow.mp { background: rgba(200, 220, 255, 0.5); }
.wave-slow.exp { background: rgba(255, 240, 200, 0.55); }

.wave-fast.hp { background: rgba(255, 180, 180, 0.6); }
.wave-fast.mp { background: rgba(180, 200, 255, 0.6); }
.wave-fast.exp { background: rgba(255, 230, 180, 0.6); }

/* ===== 粒子光点 ===== */
.particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  width: 2px;
  height: 2px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.85);
  animation: particle-float 2s ease-in-out infinite;
}

.p1 { top: 25%; left: 30%; animation-delay: 0s;    animation-duration: 2.2s; }
.p2 { top: 55%; left: 55%; animation-delay: 0.6s;  animation-duration: 1.8s; }
.p3 { top: 35%; left: 75%; animation-delay: 1.2s;  animation-duration: 2.5s; }
</style>
