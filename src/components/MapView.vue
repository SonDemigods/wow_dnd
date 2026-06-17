<template>
  <div class="map-view">
    <!-- 地图显示区域 -->
    <div 
      class="map-container"
      ref="mapContainerRef"
      @mousedown="onMapMouseDown"
      @mousemove="onMapMouseMove"
      @mouseup="onMapMouseUp"
      @mouseleave="onMapMouseUp"
      @wheel.prevent="onMapWheel"
      @touchstart="onMapTouchStart"
      @touchmove="onMapTouchMove"
      @touchend="onMapTouchEnd"
      @touchcancel="onMapTouchEnd"
    >
      <div 
        class="world-map"
        :style="[mapSizeStyle, mapTransformStyle]"
      >
        <!-- 区域标记 -->
        <div 
          v-for="zone in zones" 
          :key="zone.id"
          :class="['zone-marker', zone.status, { 'is-current': zone.id === currentZoneId, 'high-risk': zone.requiredLevel >= 10 }]"
          :style="getMarkerStyle(zone.coordinates)"
          @click.stop="selectZone(zone)"
        >
          <div class="marker-icon">{{ zone.icon }}</div>
        </div>
      </div>

      <!-- 缩放控制 -->
      <div class="zoom-controls">
        <button class="zoom-btn" @click.stop="zoomIn" title="放大">+</button>
        <span class="zoom-level">{{ zoomLevel.toFixed(1) }}x</span>
        <button class="zoom-btn" @click.stop="zoomOut" title="缩小">-</button>
      </div>

      <!-- 区域信息面板 -->
      <div class="zone-info-panel">
        <template v-if="selectedZone">
          <div class="panel-header">
            <span class="panel-name">{{ selectedZone.name }}</span>
          </div>
          <div class="panel-body">
            <div class="panel-row">
              <span class="panel-label">等级</span>
              <span class="panel-value">{{ selectedZone.requiredLevel }}+</span>
            </div>
            <div class="panel-row">
              <span class="panel-label">状态</span>
              <span :class="['panel-value', 'status-' + selectedZone.status]">{{ getStatusText(selectedZone.status) }}</span>
            </div>
            <div class="panel-row">
              <span class="panel-label">描述</span>
              <span class="panel-desc">{{ selectedZone.description }}</span>
            </div>
          </div>
          <div class="panel-actions">
            <button 
              v-if="selectedZone.status !== 'locked'"
              class="panel-btn enter"
              @click.stop="onEnterZoneClick"
            >
              进入探索
            </button>
            <button 
              v-else
              class="panel-btn locked"
              disabled
            >
              未解锁
            </button>
          </div>
        </template>
        <template v-else>
          <div class="panel-header">
            <span class="panel-name">区域信息</span>
          </div>
          <div class="panel-body">
            <div class="panel-empty">点击地图上的标记查看详情</div>
          </div>
        </template>
      </div>
    </div>

    <!-- 确认弹窗 -->
    <ConfirmPopup
      :visible="showConfirm"
      title="切换区域"
      message="切换区域将清空当前探索进度，确定继续？"
      @confirm="onConfirmEnter"
      @cancel="showConfirm = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 地图视图组件
 * @description 世界地图交互界面，支持缩放和拖拽平移，点击区域标记查看详情并进入对应探索区域
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useMapStore } from '@/modules/map';
import { useCharacterStore } from '@/modules/character';
import { eventBus, GameEvents } from '@/modules/bus/core';
import type { MapZone, ZoneStatus } from '@/modules/map';
import ConfirmPopup from './common/ConfirmPopup.vue';
import worldBgImg from '@/images/worldBg.jpg';

const emit = defineEmits<{
  (e: 'enter-zone'): void;
}>();

const mapStore = useMapStore();
const characterStore = useCharacterStore();
/** 直接从 Store 读取的响应式区域列表，依赖角色等级自动刷新 */
const zones = computed(() => {
  if (!mapStore.initialized) return [];
  return mapStore.getZones(characterStore.level || 1);
});
const selectedZone = ref<MapZone | null>(null);
const showConfirm = ref(false);

// 地图容器引用
const mapContainerRef = ref<HTMLElement | null>(null);
// 动态计算的地图尺寸（保持宽高比适配容器）
const mapWidth = ref(0);
const mapHeight = ref(0);
let resizeObserver: ResizeObserver | null = null;

// 缩放和平移
const zoomLevel = ref(1);
const panX = ref(0);
const panY = ref(0);

// 拖拽状态
const isDragging = ref(false);
const dragStartX = ref(0);
const dragStartY = ref(0);
const dragStartPanX = ref(0);
const dragStartPanY = ref(0);

// 当前区域ID（仅当玩家已通过"进入探索"明确选择区域后才不为空，避免首次进入时误高亮未选中的区域）
const currentZoneId = computed(() => {
  const currentLocation = mapStore.getCurrentLocation;
  if (currentLocation) {
    return currentLocation.id;
  }
  return '';
});

const mapTransformStyle = computed(() => ({
  transform: `translate(${panX.value}px, ${panY.value}px) scale(${zoomLevel.value})`,
  transformOrigin: '0 0',
  backgroundImage: `url(${worldBgImg})`,
  backgroundSize: 'cover',
  backgroundPosition: 'center'
}));

// 动态计算地图尺寸，保持宽高比适配容器
const mapSizeStyle = computed(() => ({
  width: mapWidth.value + 'px',
  height: mapHeight.value + 'px'
}));

function fitMapToContainer() {
  if (!mapContainerRef.value) return;
  const containerWidth = mapContainerRef.value.clientWidth;
  const containerHeight = mapContainerRef.value.clientHeight;
  const aspectRatio = 1201 / 800;

  // 优先按高度适配
  let w = containerHeight * aspectRatio;
  let h = containerHeight;

  // 若宽度超出容器，改为按宽度适配
  if (w > containerWidth) {
    w = containerWidth;
    h = containerWidth / aspectRatio;
  }

  mapWidth.value = w;
  mapHeight.value = h;
}

function getMarkerStyle(pos: { x: number; y: number }) {
  const counterScale = 1 / zoomLevel.value;
  return {
    left: pos.x + '%',
    top: pos.y + '%',
    transform: `translate(-50%, -50%) scale(${counterScale})`
  };
}

function getStatusText(status: ZoneStatus) {
  const texts: Record<ZoneStatus, string> = {
    locked: '未解锁',
    unlocked: '已解锁',
    completed: '已完成'
  };
  return texts[status];
}

function selectZone(zone: MapZone) {
  selectedZone.value = zone;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'map_zone' });
}

// 缩放控制
function zoomIn() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'map_zoom_in' });
  zoomLevel.value = Math.min(3, zoomLevel.value + 0.2);
}

function zoomOut() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'map_zoom_out' });
  zoomLevel.value = Math.max(0.5, zoomLevel.value - 0.2);
}

function onMapWheel(e: WheelEvent) {
  if (e.deltaY < 0) {
    zoomIn();
  } else {
    zoomOut();
  }
}

// 拖拽控制 - 鼠标事件
function onMapMouseDown(e: MouseEvent) {
  isDragging.value = true;
  dragStartX.value = e.clientX;
  dragStartY.value = e.clientY;
  dragStartPanX.value = panX.value;
  dragStartPanY.value = panY.value;
}

function onMapMouseMove(e: MouseEvent) {
  if (!isDragging.value) return;
  const dx = e.clientX - dragStartX.value;
  const dy = e.clientY - dragStartY.value;
  panX.value = dragStartPanX.value + dx;
  panY.value = dragStartPanY.value + dy;
}

function onMapMouseUp() {
  isDragging.value = false;
}

// 拖拽控制 - 触摸事件（移动端）
function onMapTouchStart(e: TouchEvent) {
  if (e.touches.length !== 1) return;
  const touch = e.touches[0];
  isDragging.value = true;
  dragStartX.value = touch.clientX;
  dragStartY.value = touch.clientY;
  dragStartPanX.value = panX.value;
  dragStartPanY.value = panY.value;
}

function onMapTouchMove(e: TouchEvent) {
  if (!isDragging.value || e.touches.length !== 1) return;
  e.preventDefault(); // 拖动时阻止页面滚动
  const touch = e.touches[0];
  const dx = touch.clientX - dragStartX.value;
  const dy = touch.clientY - dragStartY.value;
  panX.value = dragStartPanX.value + dx;
  panY.value = dragStartPanY.value + dy;
}

function onMapTouchEnd() {
  isDragging.value = false;
}

// 进入探索
function onEnterZoneClick() {
  if (!selectedZone.value) return;
  showConfirm.value = true;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'enter_zone_btn' });
}

function onConfirmEnter() {
  if (!selectedZone.value) return;
  const success = mapStore.enterZone(selectedZone.value.id);
  if (success) {
    showConfirm.value = false;
    emit('enter-zone');
  }
}

onMounted(() => {

  if (mapContainerRef.value) {
    // 使用 ResizeObserver 监听容器尺寸变化，自动重新计算地图尺寸
    resizeObserver = new ResizeObserver(() => {
      fitMapToContainer();
    });
    resizeObserver.observe(mapContainerRef.value);
    // 兜底：rAF 后再次确保尺寸正确（处理部分浏览器 ResizeObserver 回调合并的情况）
    requestAnimationFrame(() => {
      fitMapToContainer();
    });
  }
});

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
    resizeObserver = null;
  }
});
</script>

<style lang="less" scoped>
.map-view {
  width: 100%;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-radius: 12px;
  border: 2px solid #4a4a4a;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  overflow: hidden;
}

.map-container {
  position: relative;
  flex: 1;
  min-height: 400px;
  background: #1a1a2e;
  border: none;
  overflow: hidden;
  cursor: grab;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.map-container:active {
  cursor: grabbing;
}

.world-map {
  position: relative;
  aspect-ratio: 1201 / 800;
  transition: transform 0.1s ease-out;
}

/* 区域标记 */
.zone-marker {
  position: absolute;
  cursor: pointer;
  z-index: 2;
}

.zone-marker:hover .marker-dot {
  transform: scale(1.2);
}

.marker-icon {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  border-radius: 50%;
  border: 2px solid;
  transition: transform 0.15s;
}

/* 未解锁 - 灰色边框，半透明 */
.zone-marker.locked .marker-icon {
  border-color: #666;
  background: rgba(0, 0, 0, 0.5);
  opacity: 0.5;
}

/* 已解锁 - 绿色边框 */
.zone-marker.unlocked .marker-icon {
  border-color: #00d2d3;
  background: rgba(0, 0, 0, 0.6);
  box-shadow: 0 0 8px rgba(0, 210, 211, 0.3);
}

/* 高风险 - 红色边框 */
.zone-marker.high-risk .marker-icon {
  border-color: #e94560;
  background: rgba(0, 0, 0, 0.6);
  box-shadow: 0 0 8px rgba(233, 69, 96, 0.3);
}

/* 当前位置 - 金色边框 */
.zone-marker.is-current .marker-icon {
  border-color: #ffd700;
  background: rgba(0, 0, 0, 0.6);
  box-shadow: 0 0 10px rgba(255, 215, 0, 0.4);
}

/* 缩放控制 */
.zoom-controls {
  position: absolute;
  top: 16px;
  right: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 8px;
  padding: 4px;
  z-index: 20;
}

.zoom-btn {
  width: 36px;
  height: 36px;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 20px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}

.zoom-btn:hover {
  background: rgba(255, 255, 255, 0.18);
}

.zoom-btn:active {
  background: rgba(255, 255, 255, 0.25);
}

.zoom-level {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  padding: 2px 0;
}

/* 区域信息面板 */
.zone-info-panel {
  position: absolute;
  bottom: 16px;
  right: 16px;
  width: 280px;
  background: rgba(0, 0, 0, 0.75);
  border-radius: 10px;
  z-index: 20;
  overflow: hidden;
  animation: panel-in 0.2s ease-out;
}

.panel-header {
  padding: 16px 20px 12px;
}

.panel-name {
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}

.panel-body {
  padding: 0 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.panel-row {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.panel-label {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.45);
  flex-shrink: 0;
  min-width: 36px;
}

.panel-value {
  font-size: 15px;
  color: #fff;
  font-weight: 500;
}

.panel-value.status-locked {
  color: rgba(255, 255, 255, 0.35);
}

.panel-value.status-unlocked {
  color: #58d68d;
}

.panel-value.status-completed {
  color: #f4d03f;
}

.panel-desc {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.55);
  line-height: 1.5;
}

.panel-empty {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.35);
  text-align: center;
  padding: 16px 0;
}

.panel-actions {
  padding: 0 20px 16px;
}

.panel-btn {
  width: 100%;
  padding: 12px 20px;
  border: none;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.panel-btn.enter {
  background: #ffd700;
  color: #1a1a2e;
}

.panel-btn.enter:hover {
  background: #ffe433;
}

.panel-btn.enter:active {
  background: #e6c200;
}

.panel-btn.locked {
  background: rgba(255, 255, 255, 0.1);
  color: #8b8b8b;
  cursor: not-allowed;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .map-container {
    min-height: 300px;
    border-radius: 0;
  }

  .zone-info-panel {
    width: calc(100% - 32px);
    bottom: 12px;
    right: 16px;
    left: 16px;
  }

  .zoom-controls {
    top: 12px;
    right: 12px;
  }
}
</style>
