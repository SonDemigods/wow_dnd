<template>
  <div class="resource-bar-wrapper">
    <span class="resource-icon" :class="type">{{ icon }}</span>
    <div class="resource-track">
      <!-- 填充层 -->
      <div class="resource-fill" :class="type" :style="{ width: percent + '%' }">
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
/* ===== 容器 ===== */
.resource-bar-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

/* ===== 图标 ===== */
.resource-icon {
  font-size: 15px;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.resource-icon.hp { color: #ff5252; }
.resource-icon.mp { color: #448aff; }
.resource-icon.exp { color: #ffb300; }

/* ===== 轨道主体 ===== */
.resource-track {
  flex: 1;
  height: 20px;
  background: rgba(0, 0, 0, 0.45);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

/* ===== 填充条 ===== */
.resource-fill {
  height: 100%;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 3px;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  overflow: hidden;
}

/* HP */
.resource-fill.hp {
  background: linear-gradient(90deg, #ff5252, #e53935);
  box-shadow: 0 0 8px rgba(255, 82, 82, 0.25);
}

/* MP */
.resource-fill.mp {
  background: linear-gradient(90deg, #448aff, #2962ff);
  box-shadow: 0 0 8px rgba(68, 138, 255, 0.25);
}

/* EXP */
.resource-fill.exp {
  background: linear-gradient(90deg, #ffb300, #ff8f00);
  box-shadow: 0 0 8px rgba(255, 179, 0, 0.25);
}

/* ===== 波浪层 ===== */
.wave-layer {
  position: absolute;
  top: -3px;
  left: -50%;
  width: 200%;
  height: 10px;
  border-radius: 40%;
  opacity: 0.3;
  pointer-events: none;
}

/* 慢速大浪 */
.wave-slow {
  animation: wave-drift 4s ease-in-out infinite;
}

.wave-slow.hp { background: rgba(255, 200, 200, 0.55); }
.wave-slow.mp { background: rgba(200, 220, 255, 0.5); }
.wave-slow.exp { background: rgba(255, 240, 200, 0.55); }

/* 快速细浪 */
.wave-fast {
  animation: wave-drift 2.5s ease-in-out infinite reverse;
  height: 6px;
  top: -1px;
  opacity: 0.22;
}

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

/* ===== 文字层 ===== */
.resource-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8px;
  z-index: 3;
}

.resource-label {
  font-size: 10px;
  color: #e0e0e0;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}

.resource-value {
  font-size: 10px;
  color: #e0e0e0;
  font-weight: 600;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}
</style>
