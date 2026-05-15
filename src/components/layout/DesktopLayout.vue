<template>
  <div class="desktop-layout">
    <!-- 顶部状态栏 -->
    <header class="desktop-header">
      <slot name="header">
        <div class="header-content">
          <div class="player-info">
            <div class="avatar">⚔️</div>
            <div class="details">
              <div class="name">{{ characterName }}</div>
              <div class="level">Lv.{{ level }}</div>
            </div>
          </div>
          <div class="resource-bars">
            <div class="hp-bar">
              <span class="label">HP</span>
              <div class="bar">
                <div class="fill" :style="{ width: hpPercent + '%' }"></div>
              </div>
              <span class="value">{{ currentHp }}/{{ maxHp }}</span>
            </div>
            <div class="mp-bar">
              <span class="label">MP</span>
              <div class="bar">
                <div class="fill" :style="{ width: mpPercent + '%' }"></div>
              </div>
              <span class="value">{{ currentMp }}/{{ maxMp }}</span>
            </div>
            <div class="exp-bar">
              <span class="label">EXP</span>
              <div class="bar">
                <div class="fill" :style="{ width: expPercent + '%' }"></div>
              </div>
              <span class="value">{{ exp }}/{{ expToNext }}</span>
            </div>
          </div>
        </div>
      </slot>
    </header>

    <!-- 主内容区域 -->
    <div class="desktop-main">
      <!-- 左侧面板 -->
      <aside class="desktop-left">
        <slot name="left">
          <div class="panel character-panel">
            <h3>角色信息</h3>
            <div class="panel-content">
              <slot name="character-info" />
            </div>
          </div>
          <div class="panel skills-panel">
            <h3>技能</h3>
            <div class="panel-content">
              <slot name="skills" />
            </div>
          </div>
        </slot>
      </aside>

      <!-- 中央游戏区域 -->
      <main class="desktop-center">
        <slot name="center" />
      </main>

      <!-- 右侧面板 -->
      <aside class="desktop-right">
        <slot name="right">
          <div class="panel inventory-panel">
            <h3>背包</h3>
            <div class="panel-content">
              <slot name="inventory" />
            </div>
          </div>
          <div class="panel quests-panel">
            <h3>任务</h3>
            <div class="panel-content">
              <slot name="quests" />
            </div>
          </div>
        </slot>
      </aside>
    </div>

    <!-- 底部操作栏 -->
    <footer class="desktop-footer">
      <slot name="footer">
        <div class="action-buttons">
          <slot name="actions" />
        </div>
      </slot>
    </footer>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 桌面端布局组件
 * @description 针对大屏幕优化的三栏式布局，支持鼠标操作
 * @module components/layout/DesktopLayout
 */

import { computed } from 'vue';
import { useGameStore } from '@/stores/game';

interface Props {
  characterName?: string;
  level?: number;
  currentHp?: number;
  maxHp?: number;
  currentMp?: number;
  maxMp?: number;
  exp?: number;
  expToNext?: number;
}

const props = withDefaults(defineProps<Props>(), {
  characterName: '冒险者',
  level: 1,
  currentHp: 100,
  maxHp: 100,
  currentMp: 50,
  maxMp: 50,
  exp: 0,
  expToNext: 100,
});

const hpPercent = computed(() => (props.currentHp / props.maxHp) * 100);
const mpPercent = computed(() => (props.currentMp / props.maxMp) * 100);
const expPercent = computed(() => (props.exp / props.expToNext) * 100);
</script>

<style scoped lang="less">
@import '@/styles/variables.less';

.desktop-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: @bg-dark;
}

.desktop-header {
  background: linear-gradient(90deg, @bg-darkest 0%, @bg-panel 100%);
  border-bottom: 2px solid @border-color;
  padding: 12px 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 32px;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, @primary-color 0%, @secondary-color 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  border: 2px solid @gold-primary;
}

.details {
  .name {
    font-family: @font-display;
    color: @text-primary;
    font-size: 18px;
  }

  .level {
    color: @gold-light;
    font-size: 14px;
  }
}

.resource-bars {
  display: flex;
  gap: 24px;
  flex: 1;
}

.hp-bar,
.mp-bar,
.exp-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  max-width: 250px;

  .label {
    width: 40px;
    color: @text-secondary;
    font-weight: 600;
  }

  .bar {
    flex: 1;
    height: 20px;
    background: @bg-dark;
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid @border-color;

    .fill {
      height: 100%;
      transition: width 0.3s;
    }
  }

  .value {
    width: 70px;
    text-align: right;
    color: @text-primary;
    font-size: 14px;
  }
}

.hp-bar .fill {
  background: linear-gradient(90deg, #ff4444 0%, #ff8888 100%);
}

.mp-bar .fill {
  background: linear-gradient(90deg, #4488ff 0%, #88ccff 100%);
}

.exp-bar .fill {
  background: linear-gradient(90deg, @gold-primary 0%, @gold-light 100%);
}

.desktop-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}

.desktop-left,
.desktop-right {
  width: 280px;
  background: @bg-panel;
  border-right: 2px solid @border-color;
  padding: 16px;
  overflow-y: auto;
}

.desktop-right {
  border-right: none;
  border-left: 2px solid @border-color;
}

.desktop-center {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.panel {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid @border-color;
  border-radius: 8px;
  margin-bottom: 16px;

  h3 {
    font-family: @font-display;
    color: @gold-primary;
    padding: 12px;
    border-bottom: 1px solid @border-color;
    margin: 0;
    font-size: 16px;
  }

  .panel-content {
    padding: 12px;
  }
}

.desktop-footer {
  background: linear-gradient(90deg, @bg-panel 0%, @bg-darkest 100%);
  border-top: 2px solid @border-color;
  padding: 12px 24px;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.3);
}

.action-buttons {
  display: flex;
  gap: 12px;
  justify-content: center;
}
</style>
