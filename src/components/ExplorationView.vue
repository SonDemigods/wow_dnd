<template>
  <div class="exploration-view">
    <div class="exploration-header">
      <h2>探索</h2>
      <div class="exploration-stats">
        <span>移动次数: {{ remainingMoves }}</span>
        <span>访问格子: {{ visitedCells }} / {{ totalCells }}</span>
        <span v-if="bossDefeated" class="boss-defeated">👑 BOSS已击败</span>
      </div>
    </div>

    <div v-if="!hasGrid" class="no-grid">
      <p>点击下方按钮开始探索</p>
      <button class="start-btn" @click="startExploration">开始探索</button>
    </div>

    <div v-else class="exploration-grid-container">
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
              <span v-if="cell.type !== 'empty'" class="cell-icon">{{ getCellIcon(cell.type) }}</span>
              <span v-if="cell.visited" class="visited-marker"></span>
            </div>
          </div>
        </div>
      </div>

      <div class="move-controls">
        <button 
          class="move-btn" 
          :disabled="!canMove('up')"
          @click="move('up')"
        >⬆️</button>
        <div class="horizontal-moves">
          <button 
            class="move-btn" 
            :disabled="!canMove('left')"
            @click="move('left')"
          >⬅️</button>
          <button 
            class="move-btn" 
            :disabled="!canMove('down')"
            @click="move('down')"
          >⬇️</button>
          <button 
            class="move-btn" 
            :disabled="!canMove('right')"
            @click="move('right')"
          >➡️</button>
        </div>
      </div>
    </div>

    <div v-if="currentEvent" class="event-modal">
      <div class="event-content">
        <h3>{{ currentEvent.title }}</h3>
        <p>{{ currentEvent.description }}</p>
        <div v-if="currentEvent.choices" class="event-choices">
          <button 
            v-for="choice in currentEvent.choices" 
            :key="choice.id"
            class="choice-btn"
            @click="handleChoice(choice.id)"
          >
            {{ choice.text }}
          </button>
        </div>
        <button v-else class="close-btn" @click="closeEvent">关闭</button>
      </div>
    </div>

    <div v-if="explorationComplete" class="complete-modal">
      <div class="complete-content">
        <h3>🎉 探索完成</h3>
        <p>恭喜你完成了本次探索</p>
        <button class="restart-btn" @click="startExploration">再次探索</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { explorationService } from '@/modules/exploration';
import type { ExplorationCell, ExplorationEvent } from '@/modules/exploration';

const grid = ref<ExplorationCell[][]>([]);
const playerPos = ref({ x: 0, y: 0 });
const visitedCells = ref(0);
const remainingMoves = ref(0);
const totalCells = ref(100);
const bossDefeated = ref(false);
const currentEvent = ref<ExplorationEvent | null>(null);
const explorationComplete = ref(false);

const hasGrid = computed(() => grid.value.length > 0);

const cellIcons: Record<string, string> = {
  empty: '',
  monster: '👹',
  treasure: '📦',
  shop: '🏪',
  rest: '🏕️',
  boss: '👑',
  event: '✨',
  start: '🚩',
  exit: '🚪'
};

function getCellIcon(type: string) {
  return cellIcons[type] || '';
}

function getCellClasses(cell: ExplorationCell) {
  const classes = ['cell'];
  if (cell.x === playerPos.value.x && cell.y === playerPos.value.y) {
    classes.push('player');
  }
  if (cell.explored) {
    classes.push('explored');
  }
  if (cell.accessible) {
    classes.push('accessible');
  }
  if (cell.type !== 'empty') {
    classes.push(cell.type);
  }
  return classes;
}

function loadState() {
  const state = explorationService.getState();
  grid.value = state.grid;
  playerPos.value = state.playerPosition;
  visitedCells.value = state.visitedCells;
  remainingMoves.value = state.remainingMoves;
  bossDefeated.value = state.bossDefeated;
  explorationComplete.value = state.explorationComplete;
}

function startExploration() {
  explorationService.generateGrid();
  loadState();
}

function handleCellClick(cell: ExplorationCell) {
  if (!cell.accessible) return;
  
  const dx = cell.x - playerPos.value.x;
  const dy = cell.y - playerPos.value.y;
  
  if (Math.abs(dx) + Math.abs(dy) !== 1) return;

  if (dx === 1) move('right');
  else if (dx === -1) move('left');
  else if (dy === 1) move('down');
  else if (dy === -1) move('up');
}

function move(direction: 'up' | 'down' | 'left' | 'right') {
  const result = explorationService.movePlayer(direction);
  loadState();
  
  if (result.message) {
    alert(result.message);
  }
  
  if (result.rewards) {
    alert(`获得奖励�?{result.rewards.gold} 金币�?{result.rewards.exp} 经验值`);
  }
}

function canMove(direction: 'up' | 'down' | 'left' | 'right') {
  return explorationService.canMove(direction);
}

function handleChoice(choiceId: string) {
  const result = explorationService.handleEventChoice(choiceId);
  alert(result.message);
  closeEvent();
  loadState();
}

function closeEvent() {
  currentEvent.value = null;
}

onMounted(() => {
  loadState();
});
</script>

<style scoped>
.exploration-view {
  max-width: 600px;
  margin: 0 auto;
}

.exploration-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.exploration-header h2 {
  font-size: 24px;
  color: #ffd700;
}

.exploration-stats {
  display: flex;
  gap: 16px;
  color: #aaa;
  font-size: 14px;
}

.boss-defeated {
  color: #ffd700;
  font-weight: bold;
}

.no-grid {
  text-align: center;
  padding: 40px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  border: 2px dashed #4a4a4a;
}

.no-grid p {
  color: #888;
  margin-bottom: 20px;
}

.start-btn {
  padding: 12px 32px;
  background: linear-gradient(135deg, #4CAF50, #45a049);
  border: none;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
}

.exploration-grid-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.grid-wrapper {
  background: rgba(0, 0, 0, 0.5);
  padding: 16px;
  border-radius: 12px;
  border: 2px solid #4a4a4a;
}

.grid {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.grid-row {
  display: flex;
  gap: 4px;
}

.cell {
  width: 40px;
  height: 40px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.cell:hover {
  background: rgba(255, 255, 255, 0.1);
}

.cell.player {
  background: rgba(255, 215, 0, 0.3);
  border-color: #ffd700;
}

.cell.explored {
  background: rgba(255, 255, 255, 0.08);
}

.cell.accessible {
  border-color: #4CAF50;
}

.cell.monster {
  background: rgba(255, 0, 0, 0.2);
}

.cell.treasure {
  background: rgba(255, 215, 0, 0.2);
}

.cell.boss {
  background: rgba(128, 0, 128, 0.3);
  animation: boss-pulse 1s infinite;
}

.cell-icon {
  font-size: 20px;
}

.visited-marker {
  position: absolute;
  bottom: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  background: #4CAF50;
  border-radius: 50%;
}

@keyframes boss-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.move-controls {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.move-btn {
  width: 50px;
  height: 50px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  font-size: 24px;
  cursor: pointer;
  transition: all 0.3s;
}

.move-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
  border-color: #666;
}

.move-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.horizontal-moves {
  display: flex;
  gap: 8px;
}

.event-modal, .complete-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.event-content, .complete-content {
  background: rgba(0, 0, 0, 0.9);
  padding: 32px;
  border-radius: 12px;
  border: 2px solid #4a4a4a;
  max-width: 400px;
  text-align: center;
}

.event-content h3, .complete-content h3 {
  font-size: 24px;
  color: #ffd700;
  margin-bottom: 16px;
}

.event-content p, .complete-content p {
  color: #aaa;
  margin-bottom: 24px;
}

.event-choices {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.choice-btn, .close-btn, .restart-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.choice-btn {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.choice-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.close-btn {
  background: #666;
  color: #fff;
}

.restart-btn {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #fff;
}
</style>