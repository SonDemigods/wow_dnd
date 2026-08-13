<template>
  <div class="exploration-view">
    <!-- 未选择区域时的提示 -->
    <div v-if="!hasCurrentLocation" class="no-location-hint">
      <BaseIcon :name="COMMON_ICONS.treasure" gradient="nature" :size="20" />
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
        @wheel.prevent="onWheel"
        @touchstart="onTouchStart"
        @touchmove="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
      >
        <div 
          class="grid-wrapper"
          :style="gridWrapperStyle"
        >
          <div class="grid iso-grid" :class="areaThemeClass" :style="isoGridStyle">
            <template v-for="(row, y) in grid" :key="y">
              <div
                v-for="(cell, x) in row"
                :key="x"
                :class="[...getCellClasses(cell, x, y), ...getWallClasses(cell)]"
                :data-x="x"
                :data-y="y"
                :style="getIsoStyle(x, y)"
              >
                <!-- 立体墙面层（只画 top 和 left） -->
                <div v-if="cell.walls?.top" class="wall-face wall-top"></div>
                <div v-if="cell.walls?.left" class="wall-face wall-left"></div>
                <!-- 瓦片顶面内容 -->
                <div class="cell-surface">
                  <!-- 玩家位置标记（金色人物图标） -->
                  <BaseIcon v-if="isPlayerPosition(x, y)" name="position-marker" gradient="gold" :size="20" class="player-marker" />
                  <!-- 可通行格：无图标，仅绿色呼吸背景 -->
                  <template v-else-if="cell.accessible && !cell.discovered && !cell.explored"></template>
                  <!-- 阶段四：封印门 Boss 格 -->
                  <BaseIcon v-else-if="isBossSealed(cell)" :name="COMMON_ICONS.padlock" gradient="dragon" :size="16" class="sealed-icon" />
                  <BaseIcon v-else-if="cell.explored" :name="getCellIcon(cell.type).name" :gradient="getCellIcon(cell.type).gradient" :size="16" />
                  <!-- 阶段三：discovered 层模糊图标 -->
                  <BaseIcon v-else-if="cell.discovered && cell.type === 'trap' && cell.hint" name="caltrops" gradient="shadow" :size="16" class="discovered-icon hint-icon" />
                  <BaseIcon v-else-if="cell.discovered" :name="COMMON_ICONS.uncertainty" gradient="shadow" :size="16" class="discovered-icon" />
                  <BaseIcon v-else :name="COMMON_ICONS.uncertainty" gradient="shadow" :size="16" />
                </div>
              </div>
            </template>
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
 *             等距 2.5D 渲染：每个格子按 isometric 坐标投影到屏幕绝对定位，clip-path 画菱形
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useExplorationStore, isPassable, shouldShowEnemyAlert } from '@/modules/exploration';
import { useCharacterStore } from '@/modules/character';
import { useMapStore } from '@/modules/map';
import { useToast } from '@/composables/useToast';
import BaseIcon from '@/components/common/BaseIcon.vue';
import { CELL_ICONS, CELL_ICON_FALLBACK, COMMON_ICONS } from '@/config/icons';
import { AREA_THEME_MAP, DEFAULT_AREA_THEME, type AreaTheme } from '@/config/exploration';
import { ISO_TILE_W, ISO_TILE_H } from '@/config/exploration';
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

/** 当前区域主题（C 层氛围强化） */
const currentAreaTheme = computed<AreaTheme>(() => {
  const areaId = explorationStore.currentAreaId;
  return AREA_THEME_MAP[areaId ?? ''] ?? DEFAULT_AREA_THEME;
});

/** 区域主题 class（驱动 CSS 变量切换） */
const areaThemeClass = computed(() => `theme-${currentAreaTheme.value.theme}`);

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

// ==================== 等距坐标投影 ====================

/** 网格尺寸（行/列数） */
const gridSize = computed(() => grid.value.length || 10);

/** 等距网格容器尺寸（菱形地图的外包围矩形） */
const isoGridStyle = computed(() => ({
  width: `${gridSize.value * ISO_TILE_W}px`,
  height: `${gridSize.value * ISO_TILE_H}px`,
}));

/**
 * 将网格坐标 (x, y) 投影到等距屏幕坐标
 * screenX = (x - y + gridSize - 1) * tileW / 2
 * screenY = (x + y) * tileH / 2
 */
function getIsoStyle(x: number, y: number): Record<string, string> {
  const left = (x - y + gridSize.value - 1) * ISO_TILE_W / 2;
  const top = (x + y) * ISO_TILE_H / 2;
  return {
    position: 'absolute',
    left: `${left}px`,
    top: `${top}px`,
    width: `${ISO_TILE_W}px`,
    height: `${ISO_TILE_H}px`,
  };
}

// ==================== 阶段四：封印门 / 陷阱线索 / 怪物索敌 ====================

/**
 * Boss 封印是否已解除（从 Store 读取，由 visitedCells >= BOSS_SEAL_REQUIRED_CELLS 推导）
 */
const bossSealBroken = computed(() => explorationStore.bossSealBroken);

/**
 * 判断 Boss 格是否处于封印状态（阶段四）
 */
function isBossSealed(cell: ExplorationCell): boolean {
  return cell.type === 'boss' && cell.sealed === true && !bossSealBroken.value;
}

/**
 * 判断 discovered 怪物格是否触发索敌警告（阶段四）
 */
function isEnemyAlert(x: number, y: number): boolean {
  return shouldShowEnemyAlert(grid.value, { x, y }, playerPosition.value);
}

/**
 * 根据 walls 字段生成墙线 class（只画 top 和 left，避免冗余重叠）
 */
function getWallClasses(cell: ExplorationCell): string[] {
  if (!cell.walls) return [];
  const classes: string[] = [];
  if (cell.walls.top) classes.push('wall-top');
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

// ==================== 缩放 ====================

const ZOOM_MIN = 0.3;
const ZOOM_MAX = 2.5;
const ZOOM_STEP = 0.1;
const zoom = ref(1);

/** grid-wrapper 样式：平移 + 缩放 */
const gridWrapperStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoom.value})`,
}));

/** PC 端滚轮缩放 */
function onWheel(e: WheelEvent) {
  const delta = e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP;
  zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom.value + delta));
}

// ==================== 双指缩放（移动端） ====================

/** 双指缩放状态 */
let pinchStartDist = 0;
let pinchStartZoom = 1;

/** 两指间距离 */
function touchDistance(t1: Touch, t2: Touch): number {
  const dx = t1.clientX - t2.clientX;
  const dy = t1.clientY - t2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}

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

const cellIcons = CELL_ICONS;

function getCellIcon(type: string) {
  return cellIcons[type] || CELL_ICON_FALLBACK;
}

/**
 * 判断是否为危险格（discovered 层叠加红色警告色轮廓）
 */
function isDangerousCell(type: string): boolean {
  return type === 'monster' || type === 'trap' || type === 'boss';
}

function getCellClasses(cell: ExplorationCell, x: number, y: number) {
  const classes = ['cell', 'iso-cell'];
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
    // P11-600 修复：阈值仅用于判定 drag vs click，一旦 hasDragged 为 true 就持续更新 pan
    const dx = e.clientX - (startX.value + panX.value);
    const dy = e.clientY - (startY.value + panY.value);
    if (!hasDragged.value) {
      if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
        hasDragged.value = true;
      } else {
        return;
      }
    }
    panX.value = e.clientX - startX.value;
    panY.value = e.clientY - startY.value;
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

// 拖动功能 - 触摸事件（移动端，支持单指拖动 + 双指缩放）
let touchStartX = 0;
let touchStartY = 0;
let touchStartTarget: EventTarget | null = null;

function onTouchStart(e: TouchEvent) {
  if (e.touches.length === 1) {
    // 单指：准备拖动
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTarget = e.target;
    isDragging.value = true;
    startX.value = touch.clientX - panX.value;
    startY.value = touch.clientY - panY.value;
  } else if (e.touches.length === 2) {
    // 双指：准备缩放
    isDragging.value = false; // 停止单指拖动
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    pinchStartDist = touchDistance(t1, t2);
    pinchStartZoom = zoom.value;
  }
}

function onTouchMove(e: TouchEvent) {
  if (e.touches.length === 2) {
    // 双指缩放
    if (e.cancelable) e.preventDefault();
    const t1 = e.touches[0];
    const t2 = e.touches[1];
    const dist = touchDistance(t1, t2);
    if (pinchStartDist > 0) {
      const ratio = dist / pinchStartDist;
      zoom.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pinchStartZoom * ratio));
    }
    return;
  }

  if (!isDragging.value || e.touches.length !== 1) return;
  
  const touch = e.touches[0];
  const dx = touch.clientX - touchStartX;
  const dy = touch.clientY - touchStartY;
  
  // 只有移动超过阈值才视为拖动
  if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
    if (e.cancelable) {
      e.preventDefault(); // 拖动时阻止页面滚动
    }
    hasDragged.value = true;
    panX.value = touch.clientX - startX.value;
    panY.value = touch.clientY - startY.value;
  }
}

function onTouchEnd() {
  // P5-004 修复：触摸结束时若未拖动，视为点击（与鼠标 endDrag 逻辑一致）
  if (isDragging.value && !hasDragged.value) {
    const target = touchStartTarget as HTMLElement;
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
  touchStartTarget = null;
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
    try {
      await explorationStore.movePlayer(cell.x, cell.y);
    } catch (err) {
      console.error('[ExplorationView] handleCellClick 失败:', err);
      toast.show({ message: '移动失败，请重试', type: 'danger' });
    }
  }

onMounted(async () => {
  // P5-017 修复：包裹 try/catch，避免初始化失败导致未捕获 rejection
  try {
    const characterId = characterStore.currentCharacterId;
    if (characterId) {
      await explorationStore.init(characterId);
    }
    await initExploration();
  } catch (err) {
    console.error('[ExplorationView] 初始化失败:', err);
    toast.show({ message: '探索初始化失败', type: 'danger' });
  }
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
  background: @overlay-mid;
  padding: @spacing-xl;
  border-radius: 10px;
  border: 2px solid @color-mid-gray;
  box-shadow: @shadow-card;
  transition: transform 0.08s ease-out;
  // CSS 变量默认值（由区域主题 class 覆盖）
  --tile-surface: @bg-mid-dark;
  --wall-tone: @color-mid-gray;
  --vignette: 0.4;
  // 正方形容器，等距菱形地图居中
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ===== 区域主题 CSS 变量 ===== */
.theme-forest    { --tile-surface: #2d4a2d; --wall-tone: #4a5a3a; --vignette: 0.3; --tile-texture: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.15' numOctaves='3' seed='1'/%3E%3CfeColorMatrix values='0 0 0 0 0.18 0 0 0 0 0.29 0 0 0 0 0.18 0 0 0 0.4 0'/%3E%3C/filter%3E%3Crect width='52' height='52' filter='url(%23n)'/%3E%3C/svg%3E"); }
.theme-coast     { --tile-surface: #1a3a4a; --wall-tone: #3a4a5a; --vignette: 0.4; --tile-texture: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.08' numOctaves='2' seed='2'/%3E%3CfeColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.23 0 0 0 0 0.29 0 0 0 0.35 0'/%3E%3C/filter%3E%3Crect width='52' height='52' filter='url(%23n)'/%3E%3C/svg%3E"); }
.theme-wasteland { --tile-surface: #4a3a20; --wall-tone: #6a5a3a; --vignette: 0.45; --tile-texture: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.25' numOctaves='4' seed='3'/%3E%3CfeColorMatrix values='0 0 0 0 0.29 0 0 0 0 0.23 0 0 0 0 0.13 0 0 0 0.3 0'/%3E%3C/filter%3E%3Crect width='52' height='52' filter='url(%23n)'/%3E%3C/svg%3E"); }
.theme-mountain  { --tile-surface: #3a3530; --wall-tone: #5a4a3a; --vignette: 0.45; --tile-texture: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.3' numOctaves='4' seed='4'/%3E%3CfeColorMatrix values='0 0 0 0 0.23 0 0 0 0 0.21 0 0 0 0 0.19 0 0 0 0.35 0'/%3E%3C/filter%3E%3Crect width='52' height='52' filter='url(%23n)'/%3E%3C/svg%3E"); }
.theme-corrupt   { --tile-surface: #2a2030; --wall-tone: #4a3a5a; --vignette: 0.6; --tile-texture: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.2' numOctaves='3' seed='5'/%3E%3CfeColorMatrix values='0 0 0 0 0.16 0 0 0 0 0.13 0 0 0 0 0.19 0 0 0 0.4 0'/%3E%3C/filter%3E%3Crect width='52' height='52' filter='url(%23n)'/%3E%3C/svg%3E"); }
.theme-plains    { --tile-surface: #3a4a30; --wall-tone: #5a6a4a; --vignette: 0.3; --tile-texture: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.12' numOctaves='2' seed='6'/%3E%3CfeColorMatrix values='0 0 0 0 0.23 0 0 0 0 0.29 0 0 0 0 0.19 0 0 0 0.3 0'/%3E%3C/filter%3E%3Crect width='52' height='52' filter='url(%23n)'/%3E%3C/svg%3E"); }
.theme-jungle    { --tile-surface: #1a4a1a; --wall-tone: #3a6a3a; --vignette: 0.45; --tile-texture: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.18' numOctaves='3' seed='7'/%3E%3CfeColorMatrix values='0 0 0 0 0.1 0 0 0 0 0.29 0 0 0 0 0.1 0 0 0 0.4 0'/%3E%3C/filter%3E%3Crect width='52' height='52' filter='url(%23n)'/%3E%3C/svg%3E"); }
.theme-volcanic  { --tile-surface: #3a1510; --wall-tone: #5a2a1a; --vignette: 0.7; --tile-texture: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.35' numOctaves='4' seed='8'/%3E%3CfeColorMatrix values='0 0 0 0 0.23 0 0 0 0 0.08 0 0 0 0 0.06 0 0 0 0.45 0'/%3E%3C/filter%3E%3Crect width='52' height='52' filter='url(%23n)'/%3E%3C/svg%3E"); }
.theme-frozen    { --tile-surface: #3d4a5a; --wall-tone: #5a6a7a; --vignette: 0.6; --tile-texture: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.4' numOctaves='2' seed='9'/%3E%3CfeColorMatrix values='0 0 0 0 0.24 0 0 0 0 0.29 0 0 0 0 0.35 0 0 0 0.3 0'/%3E%3C/filter%3E%3Crect width='52' height='52' filter='url(%23n)'/%3E%3C/svg%3E"); }
.theme-hive      { --tile-surface: #2a2515; --wall-tone: #4a3a2a; --vignette: 0.65; --tile-texture: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='52' height='52'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.22' numOctaves='3' seed='10'/%3E%3CfeColorMatrix values='0 0 0 0 0.16 0 0 0 0 0.15 0 0 0 0 0.08 0 0 0 0.4 0'/%3E%3C/filter%3E%3Crect width='52' height='52' filter='url(%23n)'/%3E%3C/svg%3E"); }
.theme-generic   { --tile-surface: #2a2a3e; --wall-tone: #555555; --vignette: 0.4; --tile-texture: none; }

/* ===== 等距网格容器（绝对定位菱形布局） ===== */
.iso-grid {
  position: relative;
}

/* 网格底座厚度（等距 2.5D 厚度感） */
.iso-grid::after {
  content: '';
  position: absolute;
  inset: 0;
  z-index: 0;
  background: var(--tile-surface);
  clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
  transform: translateY(10px);
  filter: blur(4px);
  opacity: 0.6;
}

/* ===== 等距单元格 ===== */
.iso-cell {
  position: absolute;
  cursor: pointer;
  transition: filter 0.3s ease-out;
}

.iso-cell:hover {
  filter: brightness(1.2);
  z-index: @z-base;
}

/* 瓦片顶面 — 全尺寸菱形（无边框线，墙由 wall-face 独立绘制） */
.cell-surface {
  position: absolute;
  inset: 0;
  background: var(--tile-surface);
  clip-path: path('M 26 0 L 52 13 L 26 26 L 0 13 Z');
  .flex-center();
  z-index: 2;
  overflow: hidden;
}

/* 菱形边框底层 — 仅填充，无边框线（墙由 wall-face 独立绘制） */
.iso-cell::before {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--tile-surface);
  clip-path: path('M 26 0 L 52 13 L 26 26 L 0 13 Z');
  z-index: 1;
  pointer-events: none;
  filter: drop-shadow(0 0 2px rgba(255, 255, 255, 0.1));
}

/* ===== 立体墙面（只画 top 和 left，2px 细线 + 发光）
 * 等距投影：x→右上, y→左下
 *   walls.top  (dy=-1) → 菱形右上边 Top(26,0)→Right(52,13)
 *   walls.left (dx=-1) → 菱形左上边 Left(0,13)→Top(26,0)
 * 法向量 (sin26.57°, cos26.57°) ≈ (0.447, 0.894)，2px 偏移 ≈ (1, 2) */
.wall-face {
  position: absolute;
  z-index: 3;
  pointer-events: none;
  inset: 0;
  background: var(--wall-tone);
  filter: drop-shadow(0 0 3px var(--wall-tone));
}

/* wall-top: 右上边 Top(26,0)→Right(52,13)，法向偏移 (-1,+2) */
.wall-face.wall-top {
  clip-path: path('M 26 0 L 52 13 L 51 15 L 25 2 Z');
}

/* wall-left: 左上边 Left(0,13)→Top(26,0)，法向偏移 (+1,-2) */
.wall-face.wall-left {
  clip-path: path('M 0 13 L 26 0 L 27 2 L 1 15 Z');
}

/* ===== 未探索格子 ===== */
.cell.hidden .cell-surface {
  background: @primary-bg;
}

.cell.hidden {
  cursor: default;
}

/* 可访问的未探索格子 — 菱形背景变绿，无呼吸（与危险呼吸区分） */
.cell.accessible .cell-surface {
  background: rgba(76, 175, 80, 0.35);
}

.cell.accessible:hover .cell-surface {
  background: rgba(76, 175, 80, 0.5);
}

/* ===== discovered 层 ===== */
.cell.discovered .cell-surface {
  background:
    radial-gradient(circle, transparent 40%, rgba(0, 0, 0, var(--vignette)) 100%),
    var(--tile-surface);
}

.cell.discovered .discovered-icon {
  opacity: 0.45;
  filter: blur(1px);
}

/* 危险格 */
.cell.discovered.danger .cell-surface {
  background:
    radial-gradient(circle, rgba(244, 67, 54, 0.2), transparent 60%),
    var(--tile-surface);
  animation: danger-breathe 1.5s ease-in-out infinite;
}

@keyframes danger-breathe {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.3); }
}

/* 危险+可移动 — 绿色底 + 红色呼吸叠加 */
.cell.movable.discovered.danger .cell-surface {
  background:
    radial-gradient(circle, rgba(244, 67, 54, 0.2), transparent 60%),
    rgba(76, 175, 80, 0.35);
  animation: danger-breathe 1.5s ease-in-out infinite;
}

.cell.discovered.danger .discovered-icon {
  opacity: 0.7;
  filter: drop-shadow(0 0 3px rgba(244, 67, 54, 0.5));
}

/* ===== 封印门 / 陷阱线索 / 怪物索敌 ===== */

.cell.sealed .cell-surface {
  background: rgba(40, 0, 0, 0.7);
}

.cell.sealed .sealed-icon {
  filter: drop-shadow(0 0 4px rgba(139, 0, 0, 0.8));
  animation: sealed-pulse 2s ease-in-out infinite;
}

@keyframes sealed-pulse {
  0%, 100% { opacity: 0.85; }
  50% { opacity: 1; }
}

/* 陷阱线索 */
.cell.discovered.hint .cell-surface {
  background:
    radial-gradient(circle, rgba(109, 76, 65, 0.2), transparent 60%),
    var(--tile-surface);
}

.cell.discovered.hint .hint-icon {
  opacity: 0.55;
  filter: drop-shadow(0 0 2px rgba(120, 60, 0, 0.6));
}

/* 怪物索敌警告 */
.cell.discovered.enemy-alert .cell-surface {
  background:
    radial-gradient(circle, rgba(255, 23, 68, 0.3), transparent 50%),
    var(--tile-surface);
  animation: enemy-alert-glow 0.6s ease-in-out infinite alternate;
}

.cell.discovered.enemy-alert .discovered-icon {
  opacity: 0.9;
  filter: drop-shadow(0 0 4px rgba(255, 23, 68, 0.8));
}

@keyframes enemy-alert-glow {
  0% { filter: brightness(0.8); }
  100% { filter: brightness(1.3); }
}

/* ===== 已揭示格子（叠加地形纹理 + 光照） ===== */
.cell.revealed .cell-surface {
  background:
    var(--tile-texture, none),
    var(--tile-surface);
  background-blend-mode: overlay, normal;
}

/* 营地 - 篝火投射 */
.cell.rest .cell-surface {
  background:
    var(--tile-texture, none),
    radial-gradient(circle, rgba(255, 152, 0, 0.5), transparent 60%),
    var(--tile-surface);
  background-blend-mode: overlay, normal, normal;
}

/* 商店 */
.cell.shop .cell-surface {
  background:
    var(--tile-texture, none),
    radial-gradient(circle, rgba(33, 150, 243, 0.4), transparent 60%),
    var(--tile-surface);
  background-blend-mode: overlay, normal, normal;
}

/* 随机事件 */
.cell.event .cell-surface {
  background:
    var(--tile-texture, none),
    radial-gradient(circle, rgba(255, 193, 7, 0.4), transparent 60%),
    var(--tile-surface);
  background-blend-mode: overlay, normal, normal;
}

/* 任务看板 */
.cell.board .cell-surface {
  background:
    var(--tile-texture, none),
    radial-gradient(circle, rgba(0, 188, 212, 0.4), transparent 60%),
    var(--tile-surface);
  background-blend-mode: overlay, normal, normal;
}

/* BOSS - 地面血色脉动 */
.cell.boss .cell-surface {
  background:
    var(--tile-texture, none),
    radial-gradient(circle, rgba(244, 67, 54, 0.4), transparent 60%),
    var(--tile-surface);
  background-blend-mode: overlay, normal, normal;
  animation: boss-pulse 1.5s infinite;
}

@keyframes boss-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.4); }
}

/* 怪物 */
.cell.monster .cell-surface {
  background:
    var(--tile-texture, none),
    radial-gradient(circle, rgba(255, 152, 0, 0.4), transparent 60%),
    var(--tile-surface);
  background-blend-mode: overlay, normal, normal;
}

/* 物品 */
.cell.treasure .cell-surface {
  background:
    var(--tile-texture, none),
    radial-gradient(circle, rgba(156, 39, 176, 0.4), transparent 60%),
    var(--tile-surface);
  background-blend-mode: overlay, normal, normal;
}

/* 陷阱 */
.cell.trap .cell-surface {
  background:
    var(--tile-texture, none),
    radial-gradient(circle, rgba(244, 67, 54, 0.3), transparent 60%),
    var(--tile-surface);
  background-blend-mode: overlay, normal, normal;
}

/* 空地 */
.cell.empty .cell-surface {
  background:
    var(--tile-texture, none),
    var(--tile-surface);
  background-blend-mode: overlay, normal;
}

/* 起点 */
.cell.start .cell-surface {
  background:
    var(--tile-texture, none),
    radial-gradient(circle, rgba(0, 210, 211, 0.3), transparent 60%),
    var(--tile-surface);
  background-blend-mode: overlay, normal, normal;
}

/* ===== 玩家位置 / 移动高亮 ===== */

/* 玩家当前位置 - 金色光斑 */
.cell.player-here {
  z-index: @z-base;
}

.cell.player-here .cell-surface {
  background:
    var(--tile-texture, none),
    radial-gradient(circle at 50% 30%, rgba(255, 215, 0, 0.35), transparent 70%),
    var(--tile-surface);
  background-blend-mode: overlay, normal, normal;
}

/* 玩家位置标记图标 - 浮动动画 */
.player-marker {
  animation: player-bob 1.2s ease-in-out infinite;
  filter: drop-shadow(0 0 4px rgba(255, 215, 0, 0.8));
  z-index: 3;
  position: relative;
}

@keyframes player-bob {
  0%, 100% { opacity: 0.9; }
  50% { opacity: 1; }
}

.cell.movable .cell-surface {
  background: rgba(76, 175, 80, 0.35);
}

.cell.movable:hover .cell-surface {
  background: rgba(76, 175, 80, 0.5);
}

@keyframes movable-pulse {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(1.3); }
}

/* ===== 降级：尊重用户动画偏好 ===== */
@media (prefers-reduced-motion: reduce) {
  .iso-cell,
  .cell-surface,
  .player-marker,
  .cell.sealed .sealed-icon,
  .cell.boss .cell-surface,
  .cell.discovered.danger .cell-surface,
  .cell.movable.discovered.danger .cell-surface,
  .cell.discovered.enemy-alert .cell-surface {
    animation: none !important;
    transition: none !important;
  }
}

/* ===== 探索底部 ===== */
.exploration-footer {
  padding: @spacing-lg @spacing-3xl;
  text-align: center;
  background: @overlay-light;
  border-top: 1px solid @color-dark-line;
}

.exploration-progress {
  color: @color-ally;
  font-size: @font-md;
  font-weight: @font-weight-normal;
}

/* ===== 未选择区域时的提示 ===== */
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
