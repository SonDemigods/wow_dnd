<template>
  <div class="map-view">
    <div class="map-header">
      <h2>世界地图</h2>
    </div>

    <div class="map-container">
      <div class="world-map">
        <div 
          v-for="zone in zones" 
          :key="zone.id"
          :class="['zone-marker', zone.status]"
          :style="{ left: zone.coordinates.x + '%', top: zone.coordinates.y + '%' }"
          @click="selectZone(zone)"
        >
          <div class="zone-icon">{{ getZoneIcon(zone.icon) }}</div>
          <div class="zone-name">{{ zone.name }}</div>
          <div v-if="zone.status === 'locked'" class="lock-icon">🔒</div>
        </div>
        <div class="player-marker" :style="{ left: playerPos.x + '%', top: playerPos.y + '%' }">
          🧙
        </div>
      </div>
    </div>

    <div v-if="selectedZone" class="zone-detail">
      <h3>{{ selectedZone.name }}</h3>
      <p class="zone-desc">{{ selectedZone.description }}</p>
      <div class="zone-info">
        <div class="info-item">
          <span class="info-label">状态:</span>
          <span :class="['info-value', selectedZone.status]">{{ getStatusText(selectedZone.status) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">等级要求:</span>
          <span class="info-value">Lv.{{ selectedZone.requiredLevel }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">解锁费用:</span>
          <span class="info-value">💰 {{ selectedZone.requiredGold }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">奖励:</span>
          <span class="info-value">💰{{ selectedZone.rewards.gold }} ✨{{ selectedZone.rewards.exp }}</span>
        </div>
      </div>
      <div class="zone-actions">
        <button 
          v-if="selectedZone.status === 'locked'"
          :disabled="!canUnlock"
          class="action-btn unlock"
          @click="unlockZone"
        >
          解锁 ({{ selectedZone.requiredGold }} 金币)
        </button>
        <button 
          v-else-if="selectedZone.status !== 'completed'"
          class="action-btn enter"
          @click="enterZone"
        >
          进入探索
        </button>
        <button 
          v-else
          class="action-btn completed"
          disabled
        >
          已完成
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { mapService } from '@/modules/map.module';
import { characterService } from '@/modules/character.module';
import type { MapZone, ZoneStatus } from '@/modules/map.module';

const zones = ref<MapZone[]>([]);
const selectedZone = ref<MapZone | null>(null);
const playerPos = ref({ x: 35, y: 40 });

const playerLevel = computed(() => characterService.getLevel());
const playerGold = computed(() => characterService.getGold());

const canUnlock = computed(() => {
  if (!selectedZone.value) return false;
  return playerLevel.value >= selectedZone.value.requiredLevel && 
         playerGold.value >= selectedZone.value.requiredGold;
});

const zoneIcons: Record<string, string> = {
  castle: '🏰', fortress: '🏯', tree: '🌲', skull: '💀',
  anvil: '⚒️', totem: '🗿', ship: '🚢', moon: '🌙'
};

function getZoneIcon(icon: string) {
  return zoneIcons[icon] || '📍';
}

function getStatusText(status: ZoneStatus) {
  const texts: Record<ZoneStatus, string> = {
    locked: '未解锁',
    unlocked: '已解锁',
    completed: '已完成'
  };
  return texts[status];
}

function loadZones() {
  zones.value = mapService.getZones();
}

function selectZone(zone: MapZone) {
  selectedZone.value = zone;
}

function unlockZone() {
  if (!selectedZone.value || !canUnlock.value) return;
  
  const success = mapService.unlockZone(selectedZone.value.id);
  if (success) {
    loadZones();
    alert(`成功解锁 ${selectedZone.value.name}！`);
  } else {
    alert('解锁失败！');
  }
}

function enterZone() {
  if (!selectedZone.value) return;
  
  const success = mapService.enterZone(selectedZone.value.id);
  if (success) {
    alert(`进入 ${selectedZone.value.name}！`);
  } else {
    alert('无法进入该区域！');
  }
}

onMounted(() => {
  loadZones();
});
</script>

<style scoped>
.map-view {
  max-width: 800px;
  margin: 0 auto;
}

.map-header {
  text-align: center;
  margin-bottom: 20px;
}

.map-header h2 {
  font-size: 24px;
  color: #ffd700;
}

.map-container {
  position: relative;
  height: 400px;
  background: rgba(0, 0, 0, 0.5);
  border-radius: 12px;
  border: 2px solid #4a4a4a;
  overflow: hidden;
}

.world-map {
  position: relative;
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 50%, #1a472a 100%);
}

.zone-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  text-align: center;
  cursor: pointer;
  transition: transform 0.3s;
}

.zone-marker:hover {
  transform: translate(-50%, -50%) scale(1.1);
}

.zone-marker.locked {
  opacity: 0.5;
}

.zone-marker.unlocked {
  animation: pulse 2s infinite;
}

.zone-icon {
  font-size: 36px;
  display: block;
}

.zone-name {
  font-size: 12px;
  color: #fff;
  white-space: nowrap;
  background: rgba(0, 0, 0, 0.7);
  padding: 2px 6px;
  border-radius: 4px;
  margin-top: 4px;
}

.lock-icon {
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 16px;
}

.player-marker {
  position: absolute;
  transform: translate(-50%, -50%);
  font-size: 40px;
  animation: bounce 1s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes bounce {
  0%, 100% { transform: translate(-50%, -50%) translateY(0); }
  50% { transform: translate(-50%, -50%) translateY(-5px); }
}

.zone-detail {
  margin-top: 20px;
  padding: 20px;
  background: rgba(0, 0, 0, 0.7);
  border-radius: 12px;
  border: 2px solid #4a4a4a;
}

.zone-detail h3 {
  font-size: 20px;
  color: #ffd700;
  margin-bottom: 8px;
}

.zone-desc {
  color: #aaa;
  margin-bottom: 16px;
}

.zone-info {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}

.info-item {
  display: flex;
  gap: 8px;
}

.info-label {
  color: #888;
}

.info-value {
  color: #fff;
  font-weight: bold;
}

.info-value.locked {
  color: #ff4444;
}

.info-value.unlocked {
  color: #44ff44;
}

.info-value.completed {
  color: #ffd700;
}

.zone-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn.unlock {
  background: linear-gradient(135deg, #ffd700, #ff8c00);
  color: #000;
}

.action-btn.enter {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #fff;
}

.action-btn.completed {
  background: #666;
  color: #999;
  cursor: not-allowed;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.action-btn:disabled {
  opacity: 0.5;
}
</style>