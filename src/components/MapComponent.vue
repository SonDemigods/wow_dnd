<template>
  <div class="map-component" :class="{ 'mobile': isMobile }">
    <!-- 标题栏 -->
    <div class="map-header">
      <h3 class="map-title">
        {{ currentLocation?.displayName || '世界地图' }}
      </h3>
      <div class="map-controls">
        <button 
          v-for="mode in mapModes" 
          :key="mode.id"
          :class="['mode-btn', { active: currentMode === mode.id }]"
          @click="setMode(mode.id)"
        >
          {{ mode.label }}
        </button>
      </div>
    </div>

    <!-- 地图区域 -->
    <div 
      class="map-container"
      ref="mapContainer"
      @click="handleMapClick"
    >
      <!-- 世界地图模式 -->
      <div v-if="currentMode === 'world'" class="world-map">
        <div 
          v-for="continent in continents" 
          :key="continent.name"
          class="continent-area"
          :style="{
            '--continent-color': continent.color,
            '--position': continent.position
          }"
          @click.stop="selectContinent(continent)"
        >
          <span class="continent-icon">{{ continent.icon }}</span>
          <span class="continent-name">{{ continent.name }}</span>
          <div class="continent-progress">
            {{ getContinentProgress(continent.name) }}%
          </div>
        </div>
      </div>

      <!-- 大陆/区域模式 -->
      <div v-else class="zone-map">
        <div 
          v-for="location in currentLocations" 
          :key="location.name"
          :class="['location-node', {
            'current': currentLocation?.name === location.name,
            'discovered': isLocationDiscovered(location.name),
            'selected': selectedLocation === location.name
          }]"
          :style="{
            left: `${location.mapX}%`,
            top: `${location.mapY}%`,
            '--faction-color': getFactionColor(location.faction)
          }"
          @click.stop="selectLocation(location)"
        >
          <span class="location-icon">{{ location.icon }}</span>
          <span v-if="showLocationNames" class="location-name">
            {{ location.displayName }}
          </span>
          <span 
            v-if="isLocationDiscovered(location.name)" 
            class="discovered-badge"
          >✓</span>
        </div>
      </div>
    </div>

    <!-- 地点详情面板 -->
    <div v-if="selectedLocationData" class="location-panel">
      <div class="panel-header">
        <span class="panel-icon">{{ selectedLocationData.icon }}</span>
        <span class="panel-title">{{ selectedLocationData.displayName }}</span>
        <button class="close-btn" @click="selectedLocation = null">×</button>
      </div>
      <div class="panel-content">
        <p class="panel-desc">{{ selectedLocationData.description }}</p>
        <div class="panel-stats">
          <div class="stat">
            <label>等级范围:</label>
            <span>{{ selectedLocationData.levelRange[0] }} - {{ selectedLocationData.levelRange[1] }}</span>
          </div>
          <div class="stat">
            <label>探索进度:</label>
            <span>{{ getLocationProgress(selectedLocation) }}%</span>
          </div>
          <div class="stat">
            <label>阵营:</label>
            <span>{{ getFactionLabel(selectedLocationData.faction) }}</span>
          </div>
        </div>
        <div class="panel-actions">
          <button class="action-btn" @click="navigateToLocation">
            🚶 前往此区域
          </button>
          <button 
            v-if="selectedLocationData" 
            :class="['action-btn', 'favorite-btn', { active: isFavorite }]"
            @click="toggleFavorite"
          >
            {{ isFavorite ? '⭐ 已收藏' : '☆ 收藏' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 底部状态栏 -->
    <div class="map-footer">
      <div class="exploration-progress">
        <span>探索进度: {{ totalProgress }}%</span>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${totalProgress}%` }"></div>
        </div>
      </div>
      <div class="toggle-names">
        <label>
          <input 
            type="checkbox" 
            v-model="showLocationNames"
          />
          显示地名
        </label>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * @fileoverview 地图组件
 * @description 地图显示、地点选择和探索进度展示
 * @module components/MapComponent
 */

import { ref, computed, onMounted } from 'vue'
import { useMapStore, useExplorationStore } from '../modules'
import { CONTINENTS, WORLD_LOCATIONS } from '../data'
import { useDevice } from '../composables/useDevice'

const { deviceInfo } = useDevice()
const isMobile = computed(() => deviceInfo.isMobile)

// 地图 Store
const mapStore = useMapStore()
const explorationStore = useExplorationStore()

// 本地状态
const selectedLocation = ref<string | null>(null)
const selectedContinent = ref<string | null>(null)
const showLocationNames = ref(true)

// 计算属性
const currentMode = computed(() => mapStore.currentMode)
const currentLocation = computed(() => mapStore.currentLocation)
const continents = computed(() => mapStore.getAllContinents())
const currentLocations = computed(() => {
  if (selectedContinent.value) {
    return mapStore.getLocationsByContinent(selectedContinent.value)
  }
  return Object.values(WORLD_LOCATIONS)
})
const selectedLocationData = computed(() => {
  if (selectedLocation.value) {
    return WORLD_LOCATIONS[selectedLocation.value]
  }
  return null
})
const totalProgress = computed(() => explorationStore.totalPercentage)
const isFavorite = computed(() => 
  selectedLocation.value ? mapStore.isFavorite(selectedLocation.value) : false
)

// 地图模式选项
const mapModes = [
  { id: 'world', label: '世界' },
  { id: 'continent', label: '大陆' }
]

// 方法
const setMode = (mode: any) => {
  mapStore.setMapMode(mode)
  if (mode === 'world') {
    selectedContinent.value = null
  }
}

const selectContinent = (continent: any) => {
  selectedContinent.value = continent.name.toLowerCase().replace(/\s/g, '_')
  mapStore.setMapMode('continent')
}

const selectLocation = (location: any) => {
  selectedLocation.value = location.name
  if (!explorationStore.isDiscovered(location.name)) {
    explorationStore.discoverLocation(location.name)
  }
}

const navigateToLocation = () => {
  if (selectedLocation.value) {
    mapStore.navigateTo(selectedLocation.value)
    explorationStore.exploreLocation(selectedLocation.value)
  }
}

const toggleFavorite = () => {
  if (selectedLocation.value) {
    if (isFavorite.value) {
      mapStore.removeFavorite(selectedLocation.value)
    } else {
      mapStore.addFavorite(selectedLocation.value)
    }
  }
}

const handleMapClick = () => {
  // 点击地图空白处清除选择
}

const isLocationDiscovered = (locationId: string) => {
  return explorationStore.isDiscovered(locationId)
}

const getContinentProgress = (continentName: string) => {
  const continentId = continentName.toLowerCase().replace(/\s/g, '_')
  const progress = explorationStore.getContinentExploration(continentId)
  return Math.round(
    (progress.locationsExplored / Math.max(1, progress.totalLocations)) * 100
  )
}

const getLocationProgress = (locationId: string) => {
  return explorationStore.getLocationExplorationPercentage(locationId)
}

const getFactionColor = (faction: string) => {
  const colors: Record<string, string> = {
    alliance: '#4080ff',
    horde: '#ff4400',
    neutral: '#ffd700'
  }
  return colors[faction] || colors.neutral
}

const getFactionLabel = (faction: string) => {
  const labels: Record<string, string> = {
    alliance: '联盟',
    horde: '部落',
    neutral: '中立'
  }
  return labels[faction] || '未知'
}

onMounted(() => {
  // 初始化时加载探索数据
  explorationStore.loadFromStorage()
})
</script>

<style scoped lang="less">
@import '../styles/variables.less';

.map-component {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
  position: relative;
}

.map-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 215, 0, 0.3);
}

.map-title {
  margin: 0;
  font-family: @font-display;
  color: @gold-primary;
  font-size: 1.2rem;
}

.map-controls {
  display: flex;
  gap: 8px;
}

.mode-btn {
  padding: 6px 12px;
  border: 1px solid rgba(255, 215, 0, 0.3);
  background: transparent;
  color: @text-muted;
  font-size: 0.85rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: @gold-primary;
    color: @gold-primary;
  }

  &.active {
    background: rgba(255, 215, 0, 0.15);
    border-color: @gold-primary;
    color: @gold-primary;
  }
}

.map-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: radial-gradient(circle at center, #1e3a5f 0%, #0d1b2a 100%);
}

/* 世界地图样式 */
.world-map {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 20px;
  padding: 40px;
  place-items: center;
}

.continent-area {
  width: 180px;
  height: 180px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid var(--continent-color, @gold-primary);
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s;

  &:hover {
    transform: scale(1.1);
    background: rgba(255, 255, 255, 0.1);
    box-shadow: 0 0 30px rgba(255, 215, 0, 0.3);
  }

  .continent-icon {
    font-size: 3rem;
  }

  .continent-name {
    color: @text-primary;
    font-size: 1rem;
    font-weight: bold;
  }

  .continent-progress {
    color: @gold-primary;
    font-size: 0.85rem;
    margin-top: 4px;
  }
}

/* 区域地图样式 */
.zone-map {
  width: 100%;
  height: 100%;
  position: relative;
}

.location-node {
  position: absolute;
  width: 50px;
  height: 50px;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  opacity: 0.4;
  border: 2px solid var(--faction-color, #666);
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);

  &.discovered {
    opacity: 1;
  }

  &.selected {
    transform: translate(-50%, -50%) scale(1.3);
    box-shadow: 0 0 20px var(--faction-color, @gold-primary);
    z-index: 10;
  }

  &:hover {
    transform: translate(-50%, -50%) scale(1.15);
  }

  .location-icon {
    font-size: 1.5rem;
  }

  .location-name {
    position: absolute;
    bottom: -24px;
    white-space: nowrap;
    color: @text-primary;
    font-size: 0.75rem;
    text-shadow: 0 1px 2px black;
  }

  .discovered-badge {
    position: absolute;
    top: -5px;
    right: -5px;
    width: 18px;
    height: 18px;
    background: @gold-primary;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.7rem;
    color: #000;
    font-weight: bold;
  }
}

/* 地点详情面板 */
.location-panel {
  position: absolute;
  right: 20px;
  top: 80px;
  width: 300px;
  max-height: calc(100% - 160px);
  background: rgba(10, 14, 39, 0.95);
  border: 2px solid @gold-primary;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 5px 30px rgba(0, 0, 0, 0.5);
}

.panel-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: linear-gradient(90deg, rgba(255, 215, 0, 0.2) 0%, transparent 100%);
  border-bottom: 1px solid rgba(255, 215, 0, 0.3);
}

.panel-icon {
  font-size: 2rem;
}

.panel-title {
  flex: 1;
  font-family: @font-display;
  color: @gold-primary;
  font-size: 1.1rem;
}

.close-btn {
  background: none;
  border: none;
  color: @text-muted;
  font-size: 1.5rem;
  cursor: pointer;
  line-height: 1;

  &:hover {
    color: #fff;
  }
}

.panel-content {
  padding: 16px;
  overflow-y: auto;
}

.panel-desc {
  color: @text-secondary;
  margin-bottom: 16px;
  line-height: 1.5;
}

.panel-stats {
  margin-bottom: 20px;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 8px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);

  label {
    color: @text-muted;
  }

  span {
    color: @text-primary;
  }
}

.panel-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-btn {
  padding: 10px 16px;
  border: 2px solid @gold-primary;
  background: rgba(255, 215, 0, 0.1);
  color: @gold-primary;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: rgba(255, 215, 0, 0.2);
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
  }

  &.favorite-btn.active {
    background: rgba(255, 215, 0, 0.25);
  }
}

/* 底部栏 */
.map-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.4);
  border-top: 1px solid rgba(255, 215, 0, 0.3);
}

.exploration-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  color: @text-primary;

  .progress-bar {
    width: 200px;
    height: 10px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 5px;
    overflow: hidden;

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, @gold-dark, @gold-primary, @gold-light);
      transition: width 0.5s;
    }
  }
}

.toggle-names label {
  color: @text-secondary;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
}

/* 移动端适配 */
.mobile .location-panel {
  right: 10px;
  left: 10px;
  width: auto;
  bottom: 80px;
  top: auto;
  max-height: 40%;
}

.mobile .continent-area {
  width: 140px;
  height: 140px;
}
</style>
