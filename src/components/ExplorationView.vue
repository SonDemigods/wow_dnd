<template>
  <div class="exploration-view">
    <!-- 未选择区域时的提示 -->
    <div v-if="!hasCurrentLocation" class="no-location-hint">
      <BaseIcon name="treasure-map" gradient="nature" :size="20" />
      <div class="hint-text">请先在地图上选择一个区域</div>
      <div class="hint-sub">点击地图标签，选择想要探索的区域后开始冒险</div>
    </div>

    <!-- 探索网格区域 -->
    <template v-else>
      <div 
        class="exploration-grid-container"
        @mousedown="startDrag"
        @mousemove="onDrag"
        @mouseup="endDrag"
        @mouseleave="endDrag"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
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
              :class="[...getCellClasses(cell, x, y), ...getWallClasses(cell)]"
              :data-x="x"
              :data-y="y"
            >
              <!-- 玩家位置标记（金色人物图标，叠加在原格图标之上） -->
              <BaseIcon v-if="isPlayerPosition(x, y)" name="player-token" gradient="gold" :size="24" class="player-marker" />
              <!-- 阶段四：封印门 Boss 格（sealed=true 且未解锁），无论 discovered/explored 都显示锁形图标 -->
              <BaseIcon v-else-if="isBossSealed(cell)" name="padlock" gradient="dragon" :size="20" class="sealed-icon" />
              <BaseIcon v-else-if="cell.explored" :name="getCellIcon(cell.type).name" :gradient="getCellIcon(cell.type).gradient" :size="20" />
              <!-- 阶段三：discovered 层模糊图标（问号/黑影），危险格由 .danger class 叠加警告色 -->
              <!-- 阶段四：discovered 陷阱格 hint=true 显示暗色裂纹图标（弱提示），其余显示模糊问号 -->
              <BaseIcon v-else-if="cell.discovered && cell.type === 'trap' && cell.hint" name="caltrops" gradient="shadow" :size="20" class="discovered-icon hint-icon" />
              <BaseIcon v-else-if="cell.discovered" name="uncertainty" gradient="shadow" :size="20" class="discovered-icon" />
              <BaseIcon v-else name="uncertainty" gradient="shadow" :size="20" />
            </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 探索进度 -->
      <div class="exploration-footer">
        <span class="exploration-progress">探索进度: {{ explorationProgress }}%</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 探索视图组件
 * @description 基于网格的探索玩法界面，支持拖拽平移探索地图、点击翻开格子触发战斗/商店/任务等交互事件
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useExplorationStore, isPassable, shouldShowEnemyAlert } from '@/modules/exploration';
import { useCharacterStore } from '@/modules/character';
import { useMapStore } from '@/modules/map';
import { useToast } from '@/composables/useToast';
import BaseIcon from '@/components/common/BaseIcon.vue';
import type { ExplorationCell } from '@/modules/exploration';

const explorationStore = useExplorationStore();
const characterStore = useCharacterStore();
const mapStore = useMapStore();
const toast = useToast();

/** 探索网格，直接从 Store 响应式数据派生 */
const grid = computed(() => {
  const currentLocation = mapStore.getCurrentLocation;
  if (!currentLocation) return [] as ExplorationCell[][];
  return explorationStore.state.grid;
});

const hasCurrentLocation = computed(() => !!mapStore.getCurrentLocation);

/** 玩家当前位置（阶段二：实体化移动） */
const playerPosition = computed(() => explorationStore.playerPosition);

/** 是否为玩家当前所在格 */
function isPlayerPosition(x: number, y: number): boolean {
  return playerPosition.value.x === x && playerPosition.value.y === y;
}

/**
 * 是否为可移动目标格（阶段二：4 邻域 + isPassable）
 * 战斗挂起时禁止移动，避免状态错乱
 */
function isMovableTarget(x: number, y: number): boolean {
  if (explorationStore.pendingBattleCell) return false;
  if (isPlayerPosition(x, y)) return false;
  return isPassable(grid.value, playerPosition.value, { x, y });
}

// ==================== 阶段四：封印门 / 陷阱线索 / 怪物索敌 ====================

/**
 * Boss 封印是否已解除（从 Store 读取，由 visitedCells >= BOSS_SEAL_REQUIRED_CELLS 推导）
 * 用于 UI 决定是否显示封印门图标与红色警告色。
 */
const bossSealBroken = computed(() => explorationStore.bossSealBroken);

/**
 * 判断 Boss 格是否处于封印状态（阶段四）
 * 仅当 cell.sealed=true 且封印未解除时显示锁形图标与封印色。
 */
function isBossSealed(cell: ExplorationCell): boolean {
  return cell.type === 'boss' && cell.sealed === true && !bossSealBroken.value;
}

/**
 * 判断 discovered 怪物格是否触发索敌警告（阶段四）
 * 委托 service.shouldShowEnemyAlert 纯函数：曼哈顿距离 ≤ ENEMY_ALERT_RANGE
 * 且怪物格已被发现但未击败。
 */
function isEnemyAlert(x: number, y: number): boolean {
  return shouldShowEnemyAlert(grid.value, { x, y }, playerPosition.value);
}

/**
 * 根据 walls 字段生成墙线 class（阶段二：墙体线条）
 * walls 缺失（旧存档）时不加墙线 class，视为全开放
 */
function getWallClasses(cell: ExplorationCell): string[] {
  if (!cell.walls) return [];
  const classes: string[] = [];
  if (cell.walls.top) classes.push('wall-top');
  if (cell.walls.right) classes.push('wall-right');
  if (cell.walls.bottom) classes.push('wall-bottom');
  if (cell.walls.left) classes.push('wall-left');
  return classes;
}

// 拖动相关状态
const isDragging = ref(false);
const hasDragged = ref(false);
const startX = ref(0);
const startY = ref(0);
const panX = ref(0);
const panY = ref(0);
const DRAG_THRESHOLD = 5; // 拖动阈值（像素）

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

const cellIcons: Record<string, { name: string; gradient: string }> = {
  empty: { name: 'plain-circle', gradient: 'metal' },
  monster: { name: 'sword-clash', gradient: 'physical' },
  treasure: { name: 'treasure-map', gradient: 'magic' },
  shop: { name: 'shop', gradient: 'gold' },
  rest: { name: 'campfire', gradient: 'heal' },
  boss: { name: 'dragon-head', gradient: 'dragon' },
  event: { name: 'perspective-dice-six', gradient: 'gold' },
  trap: { name: 'caltrops', gradient: 'debuff' },
  start: { name: 'entry-door', gradient: 'heal' },
  board: { name: 'notebook', gradient: 'gold' }
};

function getCellIcon(type: string) {
  return cellIcons[type] || { name: 'plain-circle', gradient: 'metal' };
}

/**
 * 判断是否为危险格（discovered 层叠加红色警告色轮廓）
 * monster/trap/boss 类型在 discovered 状态下显示警告色，其余为中性色
 */
function isDangerousCell(type: string): boolean {
  return type === 'monster' || type === 'trap' || type === 'boss';
}

function getCellClasses(cell: ExplorationCell, x: number, y: number) {
  const classes = ['cell'];
  // 玩家当前位置（金色描边，优先级最高）
  if (isPlayerPosition(x, y)) {
    classes.push('player-here');
  }
  // 可移动目标格（绿色虚线高亮，阶段二移动式交互）
  if (isMovableTarget(x, y)) {
    classes.push('movable');
  }
  // 阶段三：三层状态（互斥）
  if (cell.explored) {
    classes.push('revealed');
    // 阶段四：封印 Boss 格单独走 sealed 配色，不叠加 boss 类型色（避免 boss-pulse 动画冲突）
    if (isBossSealed(cell)) {
      classes.push('sealed');
    } else if (!cell.completed && cell.type !== 'empty') {
      // 已完成的事件褪色显示，未完成（如逃跑后）保留类型高亮色
      classes.push(cell.type);
    }
  } else if (cell.discovered) {
    // discovered 层：被视线扫到但未到达，模糊可见
    classes.push('discovered');
    // 阶段四：封印 Boss 格单独走 sealed 配色，不叠加 danger（避免红色冲突）
    if (isBossSealed(cell)) {
      classes.push('sealed');
    } else {
      // 危险格（monster/trap/boss）叠加红色警告色轮廓
      if (isDangerousCell(cell.type)) {
        classes.push('danger');
      }
      // 阶段四：discovered 陷阱格带 hint=true 时叠加线索 class（暗色裂纹图标）
      if (cell.type === 'trap' && cell.hint === true) {
        classes.push('hint');
      }
      // 阶段四：discovered 怪物格触发索敌警告时叠加强警告动画
      if (isEnemyAlert(x, y)) {
        classes.push('enemy-alert');
      }
    }
  } else if (cell.accessible) {
    classes.push('accessible');
  } else {
    classes.push('hidden');
  }
  return classes;
}

// 拖动功能 - 鼠标事件
const mouseDownTarget = ref<EventTarget | null>(null);
let rafId = 0;

function startDrag(e: MouseEvent) {
  isDragging.value = true;
  startX.value = e.clientX - panX.value;
  startY.value = e.clientY - panY.value;
  mouseDownTarget.value = e.target;
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return;
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(() => {
    const dx = e.clientX - (startX.value + panX.value);
    const dy = e.clientY - (startY.value + panY.value);
    // 移动超过阈值后才实际拖动
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      hasDragged.value = true;
      panX.value = e.clientX - startX.value;
      panY.value = e.clientY - startY.value;
    }
  });
  e.preventDefault();
}

function endDrag() {
  if (isDragging.value && !hasDragged.value) {
    // 未超过阈值，视为点击
    const target = mouseDownTarget.value as HTMLElement;
    const cellEl = target?.closest('.cell') as HTMLElement;
    if (cellEl) {
      const x = Number(cellEl.dataset.x);
      const y = Number(cellEl.dataset.y);
      if (!isNaN(x) && !isNaN(y) && grid.value[y]?.[x]) {
        handleCellClick(grid.value[y][x]);
      }
    }
  }
  isDragging.value = false;
  hasDragged.value = false;
  mouseDownTarget.value = null;
}

// 拖动功能 - 触摸事件（移动端）
let touchStartX = 0;
let touchStartY = 0;

function onTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1) return;
  
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
  isDragging.value = true;
  startX.value = touch.clientX - panX.value;
  startY.value = touch.clientY - panY.value;
}

function onTouchMove(e: TouchEvent) {
  if (!isDragging.value || e.touches.length !== 1) return;
  
  const touch = e.touches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  
  // 只有移动超过阈值才视为拖动
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
    // 仅当事件可取消时才阻止默认行为，避免控制台警告
    if (e.cancelable) {
      e.preventDefault(); // 拖动时阻止页面滚动
    }
    panX.value = touch.clientX - startX.value;
    panY.value = touch.clientY - startY.value;
  }
}

function onTouchEnd() {
  isDragging.value = false;
}

async function initExploration() {
  const currentLocation = mapStore.getCurrentLocation;
  
  // 未选择区域时无需操作（computed grid 会自动返回空数组）
  if (!currentLocation) {
    return;
  }
  
  const targetArea = currentLocation.id;
  
  // 只有切换区域时才重新生成探索网格
  const currentAreaId = explorationStore.currentAreaId;
  if (currentAreaId !== targetArea) {
    await explorationStore.enterArea(targetArea);
  }
}

async function handleCellClick(cell: ExplorationCell) {
    // 阶段四：封印 Boss 格点击提示——解锁前不触发战斗，toast 提示"封印尚未解除"
    // isBossSealed 判定 cell.sealed && !bossSealBroken（基于 visitedCells >= BOSS_SEAL_REQUIRED_CELLS）
    if (isBossSealed(cell)) {
      toast.show({
        message: '封印尚未解除，继续探索以解锁 Boss 挑战',
        type: 'warning',
        icon: 'game-icons:padlock',
        duration: 2500,
      });
      return;
    }
    // 阶段二：改为移动式交互，由 movePlayer 校验 4 邻域 + isPassable
    // movePlayer 内部处理驻留格（商店/任务板/营地）打开面板、战斗落点等逻辑
    await explorationStore.movePlayer(cell.x, cell.y);
  }

onMounted(async () => {
  // 确保探索服务已从数据库加载状态
  const characterId = characterStore.currentCharacterId;
  if (characterId) {
    await explorationStore.init(characterId);
  }

  initExploration();
});

// P2-68 修复：组件卸载时清理 rafId，避免卸载后回调执行导致错误
onUnmounted(() => {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
});
</script>

<style lang="less" scoped>
.exploration-view {
  .flex-col();
  height: 100%;
  background: @primary-bg;
  border-radius: @radius-xl;
  border: @border-card;
  overflow: hidden;
}

/* 探索网格区域 */
.exploration-grid-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: @spacing-xl;
  overflow: hidden;
  cursor: grab;
  user-select: none;
}

.exploration-grid-container:active {
  cursor: grabbing;
}

.grid-wrapper {
  background: rgba(0, 0, 0, 0.5);
  padding: @spacing-xl;
  border-radius: 10px;
  border: 2px solid @color-mid-gray;
  box-shadow: @shadow-card;
  transition: transform 0.1s ease-out;
}

.grid {
  .flex-col();
  gap: 3px;
}

.grid-row {
  display: flex;
  gap: 3px;
}

.cell {
  width: 52px;
  height: 52px;
  background: @bg-mid-dark;
  border: 1px solid @color-dark-line;
  border-radius: @radius-md;
  .flex-center();
  cursor: pointer;
  transition: all @transition-quick;
  flex-shrink: 0;
}

.cell:hover {
  border-color: @color-mid-gray;
  transform: scale(1.05);
}

/* 未探索格子 */
.cell.hidden {
  background: @primary-bg;
  border-color: @bg-mid-dark;
  cursor: default;
}

.cell.hidden:hover {
  background: @primary-bg;
  border-color: @bg-mid-dark;
  transform: none;
}

/* 可访问的未探索格子 */
.cell.accessible {
  background: @primary-bg;
  border-color: @popup-border-color;
  cursor: pointer;
}

.cell.accessible:hover {
  background: @bg-mid-dark;
  border-color: @color-ally;
  box-shadow: 0 0 8px rgba(0, 210, 211, 0.3);
}

/* 阶段三：discovered 层 - 被视线扫到但未到达，模糊可见 */
.cell.discovered {
  background: @bg-mid-dark;
  border-color: @color-dark-line;
}

.cell.discovered .discovered-icon {
  opacity: 0.45;
  filter: blur(1px);
}

/* 危险格（monster/trap/boss）discovered 时叠加红色警告色轮廓 */
.cell.discovered.danger {
  border-color: #F44336;
  box-shadow: 0 0 6px rgba(244, 67, 54, 0.3);
}

.cell.discovered.danger .discovered-icon {
  opacity: 0.7;
  filter: drop-shadow(0 0 3px rgba(244, 67, 54, 0.5));
}

/* ===== 阶段四：封印门 / 陷阱线索 / 怪物索敌警告 ===== */

/* 封印门：sealed Boss 格（discovered 或 explored 状态下未解锁）
   深红封印色 + 紫黑封印光环，区别于普通 Boss 的红色脉动 */
.cell.sealed {
  background: rgba(40, 0, 0, 0.6);
  border-color: #8B0000;
  box-shadow: 0 0 8px rgba(139, 0, 0, 0.6), inset 0 0 6px rgba(0, 0, 0, 0.4);
}

.cell.sealed .sealed-icon {
  filter: drop-shadow(0 0 4px rgba(139, 0, 0, 0.8));
  animation: sealed-pulse 2s ease-in-out infinite;
}

@keyframes sealed-pulse {
  0%, 100% { opacity: 0.85; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.08); }
}

/* 陷阱线索：discovered hint trap 格显示暗色裂纹图标（弱提示）
   不叠加红色警告色，保留"可疑但不明确"的视觉张力 */
.cell.discovered.hint .hint-icon {
  opacity: 0.55;
  filter: drop-shadow(0 0 2px rgba(120, 60, 0, 0.6));
}

.cell.discovered.hint {
  border-color: #6D4C41;
  box-shadow: 0 0 4px rgba(109, 76, 65, 0.4);
}

/* 怪物索敌警告：discovered monster 格玩家进入 ENEMY_ALERT_RANGE 时
   叠加红色跳动强警告动画，提示玩家近身风险 */
.cell.discovered.enemy-alert {
  border-color: #FF1744;
  box-shadow: 0 0 10px rgba(255, 23, 68, 0.7), inset 0 0 6px rgba(255, 23, 68, 0.3);
  animation: enemy-alert-shake 0.6s ease-in-out infinite;
}

.cell.discovered.enemy-alert .discovered-icon {
  opacity: 0.9;
  filter: drop-shadow(0 0 4px rgba(255, 23, 68, 0.8));
}

@keyframes enemy-alert-shake {
  0%, 100% { transform: translate(0, 0); }
  25% { transform: translate(-1px, 0); }
  75% { transform: translate(1px, 0); }
}

/* 已揭示格子 */
.cell.revealed {
  background: @bg-mid-dark;
  border-color: @popup-border-color;
}

/* 营地 - 绿色高亮 */
.cell.rest {
  background: rgba(76, 175, 80, 0.3);
  border-color: @heal-hp;
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
  background: @primary-bg;
}

/* 起点 */
.cell.start {
  background: rgba(0, 210, 211, 0.2);
  border-color: @color-ally;
}

/* ===== 阶段二：玩家位置 / 移动高亮 / 墙线 ===== */

/* 玩家当前位置 - 金色描边 + 光晕 */
.cell.player-here {
  border-color: @accent-color;
  box-shadow: 0 0 12px rgba(255, 215, 0, 0.6), inset 0 0 8px rgba(255, 215, 0, 0.2);
  z-index: @z-base;
}

.cell.player-here:hover {
  border-color: @accent-color;
  transform: scale(1.05);
}

/* 玩家位置标记图标 - 轻微浮动动画 */
.player-marker {
  animation: player-bob 1.2s ease-in-out infinite;
  filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.8));
}

@keyframes player-bob {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-2px); }
}

/* 可移动目标格 - 绿色虚线高亮 */
.cell.movable {
  border-color: @heal-hp;
  border-style: dashed;
  cursor: pointer;
  animation: movable-pulse 1.5s ease-in-out infinite;
}

.cell.movable:hover {
  background: @green-bg-hover;
  border-color: @heal-hp;
  box-shadow: 0 0 8px rgba(76, 175, 80, 0.4);
  transform: scale(1.05);
}

@keyframes movable-pulse {
  0%, 100% { box-shadow: 0 0 4px rgba(76, 175, 80, 0.2); }
  50% { box-shadow: 0 0 10px rgba(76, 175, 80, 0.5); }
}

/* 墙体线条 - 比格线亮一档，加粗显眼 */
.cell.wall-top { border-top: 3px solid @color-mid-gray; }
.cell.wall-right { border-right: 3px solid @color-mid-gray; }
.cell.wall-bottom { border-bottom: 3px solid @color-mid-gray; }
.cell.wall-left { border-left: 3px solid @color-mid-gray; }

/* 墙线在玩家位置/移动高亮上仍保留（墙是结构，优先级最高） */
.cell.player-here.wall-top,
.cell.movable.wall-top { border-top: 3px solid @color-mid-gray; }
.cell.player-here.wall-right,
.cell.movable.wall-right { border-right: 3px solid @color-mid-gray; }
.cell.player-here.wall-bottom,
.cell.movable.wall-bottom { border-bottom: 3px solid @color-mid-gray; }
.cell.player-here.wall-left,
.cell.movable.wall-left { border-left: 3px solid @color-mid-gray; }

.cell-icon {
  font-size: @font-4xl;
}

.cell-hidden {
  color: #444;
  font-size: @font-2xl;
}

/* 探索底部 */
.exploration-footer {
  padding: @spacing-lg @spacing-3xl;
  text-align: center;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid @color-dark-line;
}

.exploration-progress {
  color: @color-ally;
  font-size: @font-md;
  font-weight: @font-weight-normal;
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

/* 未选择区域时的提示 */
.no-location-hint {
  flex: 1;
  .flex-col-center();
  gap: 16px;
  padding: 40px 20px;
  text-align: center;
}

.hint-icon {
  font-size: 64px;
  opacity: 0.6;
}

.hint-text {
  font-size: @font-2xl;
  color: @text-secondary;
  font-weight: @font-weight-semibold;
}

.hint-sub {
  font-size: @font-md;
  color: @color-mid-gray;
  max-width: 280px;
  line-height: 1.6;
}
</style>
