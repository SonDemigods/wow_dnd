<template>
  <div class="exploration-view">
    <!-- 探索网格区域 -->
    <div class="exploration-grid-container">
      <div class="grid-wrapper">
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
import { ref, computed, onMounted } from 'vue';
import { explorationService } from '@/modules/exploration';
import { useMapStore } from '@/modules/map';
import type { ExplorationCell } from '@/modules/exploration';

const mapStore = useMapStore();
const grid = ref<ExplorationCell[][]>([]);
const explorationComplete = ref(false);

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
  exit: '🚪'
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

function loadState() {
  const state = explorationService.getState();
  grid.value = state.grid.map(row => row.map(cell => ({ ...cell })));
  explorationComplete.value = state.explorationComplete;
}

function initExploration() {
  const currentLocation = mapStore.getCurrentLocation;
  if (currentLocation) {
    explorationService.enterArea(currentLocation.name);
  } else {
    explorationService.enterArea('village');
  }
  loadState();
}

function handleCellClick(cell: ExplorationCell) {
  if (!cell.accessible) return;
  
  explorationService.revealGrid(cell.x, cell.y);
  loadState();
}

onMounted(() => {
  initExploration();
});
</script>

<style scoped>
.exploration-view {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #1a1a2e;
}

/* 探索网格区域 */
.exploration-grid-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
}

.grid-wrapper {
  background: rgba(0, 0, 0, 0.5);
  padding: 10px;
  border-radius: 8px;
  border: 1px solid #333;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.grid-row {
  display: flex;
  gap: 2px;
}

.cell {
  width: 50px;
  height: 50px;
  background: #2a2a3e;
  border: 1px solid #333;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.cell:hover {
  border-color: #555;
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
  font-size: 22px;
}

.cell-hidden {
  color: #333;
  font-size: 18px;
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
    width: calc((100vw - 60px) / 10);
    height: calc((100vw - 60px) / 10);
  }
  
  .cell-icon {
    font-size: 18px;
  }
}
</style>