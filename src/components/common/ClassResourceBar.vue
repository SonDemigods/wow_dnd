<template>
  <div class="class-resource-bar-wrapper">
    <BaseIcon :name="resourceConfig.icon" :gradient="resourceConfig.gradient" :size="16" />
    <div class="resource-track">
      <!-- 填充层 -->
      <div class="resource-fill" :class="resourceSystem.type" :style="{ width: percent + '%' }">
        <div class="wave-layer wave-slow" :class="resourceSystem.type"></div>
        <div class="wave-layer wave-fast" :class="resourceSystem.type"></div>
      </div>
      <!-- 文字层 -->
      <div class="resource-text">
        <span class="resource-label">{{ resourceConfig.name }}</span>
        <span class="resource-value">{{ Math.floor(resourceSystem.currentValue) }}/{{ resourceSystem.maxValue }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 职业专属资源条组件
 * @description 在战斗界面显示职业专属资源（怒气/能量/连击点/灵魂碎片/真气等）。
 *              与通用 ResourceBar 的区别：支持整数型资源显示，内置各资源类型的颜色配置。
 */
import { computed } from 'vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import type { ResourceSystem, ResourceType } from '@/modules/combat/resources';

const props = defineProps<{
  resourceSystem: ResourceSystem;
}>();

/** 资源类型对应的显示配置 */
const RESOURCE_DISPLAY_CONFIG: Record<ResourceType, { name: string; icon: string; gradient: string }> = {
  rage: { name: '怒气', icon: 'game-icons:flame', gradient: 'physical' },
  energy: { name: '能量', icon: 'game-icons:lightning-bolt', gradient: 'gold' },
  combo_point: { name: '连击', icon: 'game-icons:archery-target', gradient: 'gold' },
  soul_shard: { name: '碎片', icon: 'game-icons:soul', gradient: 'debuff' },
  chi: { name: '真气', icon: 'game-icons:fist', gradient: 'heal' },
  mana: { name: '法力', icon: 'game-icons:magic-palm', gradient: 'mana' },
};

const resourceConfig = computed(() => {
  return RESOURCE_DISPLAY_CONFIG[props.resourceSystem.type] || RESOURCE_DISPLAY_CONFIG.mana;
});

const percent = computed(() => {
  const max = props.resourceSystem.maxValue;
  if (max === 0) return 0;
  return Math.max(0, Math.min(100, (props.resourceSystem.currentValue / max) * 100));
});
</script>

<style lang="less" scoped>
.class-resource-bar-wrapper {
  display: flex;
  align-items: center;
  gap: @spacing-md;
  width: 100%;
}

.resource-track {
  flex: 1;
  height: 18px;
  background: rgba(0, 0, 0, 0.45);
  border-radius: @radius-sm;
  overflow: hidden;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.resource-fill {
  height: 100%;
  transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: @radius-xs;
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  overflow: hidden;
}

/* 怒气 - 红色 */
.resource-fill.rage {
  background: linear-gradient(90deg, #ff4500, #cc3700);
  box-shadow: 0 0 8px rgba(255, 69, 0, 0.3);
}

/* 能量 - 黄色 */
.resource-fill.energy {
  background: linear-gradient(90deg, #ffd700, #ffaa00);
  box-shadow: 0 0 8px rgba(255, 215, 0, 0.3);
}

/* 连击点 - 橙色 */
.resource-fill.combo_point {
  background: linear-gradient(90deg, #ff8c00, #ff6500);
  box-shadow: 0 0 8px rgba(255, 140, 0, 0.3);
}

/* 灵魂碎片 - 紫色 */
.resource-fill.soul_shard {
  background: linear-gradient(90deg, #9370db, #7b1fa2);
  box-shadow: 0 0 8px rgba(147, 112, 219, 0.3);
}

/* 真气 - 青绿色 */
.resource-fill.chi {
  background: linear-gradient(90deg, #00ff96, #00b870);
  box-shadow: 0 0 8px rgba(0, 255, 150, 0.3);
}

/* 法力 - 蓝色（回退） */
.resource-fill.mana {
  background: linear-gradient(90deg, #448aff, #2962ff);
  box-shadow: 0 0 8px rgba(68, 138, 255, 0.25);
}

/* 波浪层 */
.wave-layer {
  position: absolute;
  top: -3px;
  left: -50%;
  width: 200%;
  height: 8px;
  border-radius: 40%;
  opacity: @opacity-disabled;
  pointer-events: none;
}

.wave-slow {
  animation: wave-drift 4s ease-in-out infinite;
}

.wave-slow.rage { background: rgba(255, 200, 200, 0.5); }
.wave-slow.energy { background: rgba(255, 240, 200, 0.5); }
.wave-slow.combo_point { background: rgba(255, 220, 180, 0.5); }
.wave-slow.soul_shard { background: rgba(220, 200, 255, 0.5); }
.wave-slow.chi { background: rgba(200, 255, 230, 0.5); }
.wave-slow.mana { background: rgba(200, 220, 255, 0.5); }

.wave-fast {
  animation: wave-drift 2.5s ease-in-out infinite reverse;
  height: 5px;
  top: -1px;
  opacity: 0.2;
}

@keyframes wave-drift {
  0%, 100% { transform: translateX(0) rotate(0deg); }
  50% { transform: translateX(25%) rotate(2deg); }
}

.resource-text {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 @spacing-md;
  z-index: 3;
}

.resource-label {
  font-size: @font-2xs;
  color: #e0e0e0;
  font-weight: @font-weight-semibold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}

.resource-value {
  font-size: @font-2xs;
  color: #e0e0e0;
  font-weight: @font-weight-semibold;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
}
</style>
