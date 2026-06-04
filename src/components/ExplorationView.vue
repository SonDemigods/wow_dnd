<template>
  <div class="exploration-view">
    <!-- 探索网格区域 -->
    <div 
      class="exploration-grid-container"
      @mousedown="startDrag"
      @mousemove="onDrag"
      @mouseup="endDrag"
      @mouseleave="endDrag"
    >
      <div 
        class="grid-wrapper"
        :style="{ transform: `translate(${panX}px, ${panY}px)` }"
      >
        <div class="grid">
          <div 
            v-for="(row, y) in grid" 
            :key="y" 
            class="grid-row"
          >
            <div 
              v-for="(cell, x) in row"
              :key="x"
              :class="getCellClasses(cell)"
              @click="handleCellClick(cell)"
            >
              <span v-if="cell.explored" class="cell-icon">{{ getCellIcon(cell.type) }}</span>
              <span v-else class="cell-icon cell-hidden">?</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 探索进度 -->
    <div class="exploration-footer">
      <span class="exploration-progress">探索进度: {{ explorationProgress }}%</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { explorationService } from '@/modules/exploration';
import { useMapStore } from '@/modules/map';
import { eventBus, GameEvents } from '@/modules/bus/core';
import type { ExplorationCell } from '@/modules/exploration';

const mapStore = useMapStore();
const grid = ref<ExplorationCell[][]>([]);
const explorationComplete = ref(false);

// 拖动相关状态
const isDragging = ref(false);
const startX = ref(0);
const startY = ref(0);
const panX = ref(0);
const panY = ref(0);

const explorationProgress = computed(() => {
  if (!grid.value.length) return 0;
  let total = 0;
  let explored = 0;
  grid.value.forEach(row => {
    row.forEach(cell => {
      total++;
      if (cell.explored) explored++;
    });
  });
  return Math.round((explored / total) * 100);
});

const cellIcons: Record<string, string> = {
  empty: '○',
  monster: '⚔️',
  treasure: '📦',
  shop: '🏪',
  rest: '🏕️',
  boss: '👹',
  event: '📋',
  trap: '⚠️',
  start: '🏁',
  exit: '🚪',
  board: '📜'
};

function getCellIcon(type: string) {
  return cellIcons[type] || '○';
}

function getCellClasses(cell: ExplorationCell) {
  const classes = ['cell'];
  if (cell.explored) {
    classes.push('revealed');
    if (cell.type !== 'empty') {
      classes.push(cell.type);
    }
  } else if (cell.accessible) {
    classes.push('accessible');
  } else {
    classes.push('hidden');
  }
  return classes;
}

// 拖动功能
function startDrag(e: MouseEvent) {
  // 防止在格子上拖动时触发点击
  if ((e.target as HTMLElement).closest('.cell')) return;
  
  isDragging.value = true;
  startX.value = e.clientX - panX.value;
  startY.value = e.clientY - panY.value;
  e.preventDefault();
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return;
  panX.value = e.clientX - startX.value;
  panY.value = e.clientY - startY.value;
  e.preventDefault();
}

function endDrag() {
  isDragging.value = false;
}

function loadState() {
  const state = explorationService.getState();
  grid.value = state.grid.map(row => row.map(cell => ({ ...cell })));
  explorationComplete.value = state.explorationComplete;
}

function initExploration() {
  const currentLocation = mapStore.getCurrentLocation;
  const targetArea = currentLocation?.name || 'village';
  
  // 只有切换区域时才重新生成探索网格
  const currentAreaId = explorationService.getCurrentAreaId();
  if (currentAreaId !== targetArea) {
    explorationService.enterArea(targetArea);
  }
  loadState();
}

function handleCellClick(cell: ExplorationCell) {
  if (!cell.accessible) return;
  
  explorationService.revealGrid(cell.x, cell.y);
  loadState();
}

// 战斗/商店/任务结束后刷新网格
function onRefreshGrid() {
  loadState();
}

onMounted(() => {
  initExploration();
  eventBus.on(GameEvents.COMBAT_END, onRefreshGrid);
  eventBus.on(GameEvents.SHOP_CLOSED, onRefreshGrid);
  eventBus.on(GameEvents.QUEST_COMPLETED, onRefreshGrid);
});

onUnmounted(() => {
  eventBus.off(GameEvents.COMBAT_END, onRefreshGrid);
  eventBus.off(GameEvents.SHOP_CLOSED, onRefreshGrid);
  eventBus.off(GameEvents.QUEST_COMPLETED, onRefreshGrid);
});
</script>

<style scoped>
.exploration-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a2e;
  border-radius: 12px;
  border: 2px solid #4a4a4a;
  overflow: hidden;
}

/* 探索网格区域 */
.exploration-grid-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.exploration-grid-container:active {
  cursor: grabbing;
}

.grid-wrapper {
  background: rgba(0, 0, 0, 0.5);
  padding: 12px;
  border-radius: 10px;
  border: 2px solid #555;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  transition: transform 0.1s ease-out;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.grid-row {
  display: flex;
  gap: 3px;
}

.cell {
  width: 52px;
  height: 52px;
  background: #2a2a3e;
  border: 1px solid #333;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
  flex-shrink: 0;
}

.cell:hover {
  border-color: #555;
  transform: scale(1.05);
}

/* 未探索格子 */
.cell.hidden {
  background: #1a1a2e;
  border-color: #2a2a3e;
  cursor: default;
}

.cell.hidden:hover {
  background: #1a1a2e;
  border-color: #2a2a3e;
  transform: none;
}

/* 可访问的未探索格子 */
.cell.accessible {
  background: #1a1a2e;
  border-color: #4a4a4a;
  cursor: pointer;
}

.cell.accessible:hover {
  background: #2a2a3e;
  border-color: #00d2d3;
  box-shadow: 0 0 8px rgba(0, 210, 211, 0.3);
}

/* 已揭示格子 */
.cell.revealed {
  background: #2a2a3e;
  border-color: #4a4a4a;
}

/* 营地 - 绿色高亮 */
.cell.rest {
  background: rgba(76, 175, 80, 0.3);
  border-color: #4CAF50;
}

/* 商店 - 蓝色高亮 */
.cell.shop {
  background: rgba(33, 150, 243, 0.3);
  border-color: #2196F3;
}

/* 任务看板 - 黄色高亮 */
.cell.event {
  background: rgba(255, 193, 7, 0.3);
  border-color: #FFC107;
}

/* 任务看板 - 青色高亮 */
.cell.board {
  background: rgba(0, 188, 212, 0.3);
  border-color: #00BCD4;
}

/* BOSS - 红色高亮 */
.cell.boss {
  background: rgba(244, 67, 54, 0.3);
  border-color: #F44336;
  animation: boss-pulse 1.5s infinite;
}

/* 怪物 - 橙色 */
.cell.monster {
  background: rgba(255, 152, 0, 0.3);
  border-color: #FF9800;
}

/* 物品 - 紫色 */
.cell.treasure {
  background: rgba(156, 39, 176, 0.3);
  border-color: #9C27B0;
}

/* 陷阱 - 红色 */
.cell.trap {
  background: rgba(244, 67, 54, 0.2);
  border-color: #F44336;
}

/* 空地 */
.cell.empty {
  background: #1a1a2e;
}

/* 起点 */
.cell.start {
  background: rgba(0, 210, 211, 0.2);
  border-color: #00d2d3;
}

.cell-icon {
  font-size: 24px;
}

.cell-hidden {
  color: #444;
  font-size: 20px;
}

@keyframes boss-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* 探索底部 */
.exploration-footer {
  padding: 10px 16px;
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid #333;
}

.exploration-progress {
  color: #00d2d3;
  font-size: 14px;
  font-weight: 500;
}

/* 响应式 - 移动端 */
@media (max-width: 768px) {
  .cell {
    width: 44px;
    height: 44px;
  }
  
  .cell-icon {
    font-size: 20px;
  }
  
  .cell-hidden {
    font-size: 16px;
  }
}
</style>
