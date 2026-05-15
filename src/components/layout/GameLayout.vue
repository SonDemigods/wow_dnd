<template>
  <div :class="['game-layout', deviceClass]">
    <!-- 桌面端布局 -->
    <DesktopLayout v-if="deviceInfo.isDesktop">
      <slot />
    </DesktopLayout>

    <!-- 移动端布局 -->
    <MobileLayout v-else>
      <slot />
    </MobileLayout>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 游戏主布局组件
 * @description 根据设备类型自动选择桌面端或移动端布局
 * @module components/layout/GameLayout
 */

import DesktopLayout from './DesktopLayout.vue';
import MobileLayout from './MobileLayout.vue';
import { useResponsive } from '@/composables/useDevice';

const { deviceInfo, getDeviceClass } = useResponsive();
const deviceClass = getDeviceClass();
</script>

<style scoped lang="less">
.game-layout {
  width: 100%;
  height: 100%;
  min-height: 100vh;
}

/* 设备特定样式可以在这里添加 */
</style>
