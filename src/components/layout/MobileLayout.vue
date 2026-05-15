<template>
  <div class="mobile-layout">
    <!-- 顶部状态栏 -->
    <header class="mobile-header">
      <slot name="header">
        <div class="header-compact">
          <div class="player-info-compact">
            <span class="avatar">⚔️</span>
            <span class="level">Lv.{{ level }}</span>
          </div>
          <div class="resource-bars-compact">
            <div class="hp-bar">
              <div class="bar">
                <div class="fill" :style="{ width: hpPercent + '%' }"></div>
              </div>
              <span>{{ currentHp }}/{{ maxHp }}</span>
            </div>
            <div class="mp-bar">
              <div class="bar">
                <div class="fill" :style="{ width: mpPercent + '%' }"></div>
              </div>
              <span>{{ currentMp }}/{{ maxMp }}</span>
            </div>
          </div>
        </div>
      </slot>
    </header>

    <!-- 主内容区域 -->
    <main class="mobile-main">
      <slot name="center" />
    </main>

    <!-- 底部标签导航 -->
    <nav class="mobile-nav">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="['nav-tab', { active: activeTab === tab.id }]"
        @click="activeTab = tab.id"
      >
        <span class="icon">{{ tab.icon }}</span>
        <span class="label">{{ tab.label }}</span>
      </button>
    </nav>

    <!-- 标签内容面板 -->
    <div v-if="showTabPanel" class="tab-panel">
      <div v-show="activeTab === 'character'" class="tab-content">
        <slot name="character-info" />
      </div>
      <div v-show="activeTab === 'inventory'" class="tab-content">
        <slot name="inventory" />
      </div>
      <div v-show="activeTab === 'skills'" class="tab-content">
        <slot name="skills" />
      </div>
      <div v-show="activeTab === 'quests'" class="tab-content">
        <slot name="quests" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 移动端布局组件
 * @description 针对触控和小屏幕优化的单栏式布局
 * @module components/layout/MobileLayout
 */

import { ref, computed } from 'vue';

interface Tab {
  id: string;
  icon: string;
  label: string;
}

const tabs: Tab[] = [
  { id: 'character', icon: '👤', label: '角色' },
  { id: 'inventory', icon: '🎒', label: '背包' },
  { id: 'skills', icon: '⚡', label: '技能' },
  { id: 'quests', icon: '📜', label: '任务' },
];

interface Props {
  level?: number;
  currentHp?: number;
  maxHp?: number;
  currentMp?: number;
  maxMp?: number;
}

const props = withDefaults(defineProps<Props>(), {
  level: 1,
  currentHp: 100,
  maxHp: 100,
  currentMp: 50,
  maxMp: 50,
});

const activeTab = ref('character');
const showTabPanel = ref(true);

const hpPercent = computed(() => (props.currentHp / props.maxHp) * 100);
const mpPercent = computed(() => (props.currentMp / props.maxMp) * 100);
</script>

<style scoped lang="less">
@import '@/styles/variables.less';

.mobile-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: @bg-dark;
  position: relative;
}

.mobile-header {
  background: linear-gradient(90deg, @bg-darkest 0%, @bg-panel 100%);
  border-bottom: 2px solid @border-color;
  padding: 8px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  position: relative;
  z-index: 10;
}

.header-compact {
  display: flex;
  align-items: center;
  gap: 12px;
}

.player-info-compact {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  .avatar {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: linear-gradient(135deg, @primary-color 0%, @secondary-color 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
    border: 2px solid @gold-primary;
  }

  .level {
    color: @gold-light;
    font-size: 14px;
    font-weight: 600;
  }
}

.resource-bars-compact {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.hp-bar,
.mp-bar {
  display: flex;
  align-items: center;
  gap: 8px;

  .bar {
    flex: 1;
    height: 14px;
    background: @bg-dark;
    border-radius: 7px;
    overflow: hidden;
    border: 1px solid @border-color;

    .fill {
      height: 100%;
      transition: width 0.3s;
    }
  }

  span {
    color: @text-primary;
    font-size: 12px;
    min-width: 60px;
    text-align: right;
  }
}

.hp-bar .fill {
  background: linear-gradient(90deg, #ff4444 0%, #ff8888 100%);
}

.mp-bar .fill {
  background: linear-gradient(90deg, #4488ff 0%, #88ccff 100%);
}

.mobile-main {
  flex: 1;
  padding: 12px;
  overflow-y: auto;
  padding-bottom: 80px; /* 为底部导航留出空间 */
}

.mobile-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: linear-gradient(90deg, @bg-panel 0%, @bg-darkest 100%);
  border-top: 2px solid @border-color;
  display: flex;
  padding: 8px 0;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
  z-index: 100;
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px;
  background: transparent;
  border: none;
  color: @text-secondary;
  cursor: pointer;
  transition: all 0.2s;
  -webkit-tap-highlight-color: transparent;

  &.active {
    color: @gold-primary;
    background: rgba(201, 162, 39, 0.1);
  }

  .icon {
    font-size: 20px;
  }

  .label {
    font-size: 11px;
  }
}

.tab-panel {
  position: fixed;
  bottom: 70px;
  left: 0;
  right: 0;
  max-height: 60vh;
  background: @bg-panel;
  border-top: 2px solid @border-color;
  border-top-left-radius: 16px;
  border-top-right-radius: 16px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.4);
  z-index: 99;
  overflow: hidden;
  transition: transform 0.3s;
}

.tab-content {
  padding: 16px;
  overflow-y: auto;
  max-height: 60vh;
}
</style>
