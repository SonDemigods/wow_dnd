<template>
  <BasePopup :visible="visible" title="角色信息" @close="$emit('close')">
    <template #default>
      <div v-if="character" class="character-content">
        <!-- 角色信息和资源条 -->
        <div class="character-overview">
          <div class="character-basic">
            <div class="char-row">
              <div class="char-avatar">{{ getRaceIcon(character.raceId) }}</div>
              <div class="char-main-info">
                <div class="char-name">{{ character.name }}</div>
                <div class="char-level">Lv.{{ character.level }}</div>
              </div>
            </div>
            <div class="char-details">
              <Tag type="faction" :text="getFactionName(character.factionId)" :color="getFactionColor(character.factionId)" />
              <Tag type="race" :text="getRaceName(character.raceId)" />
              <Tag type="class" :text="getClassName(character.classId)" :color="getClassColor(character.classId)" />
            </div>
          </div>
          <div class="resource-bars">
            <ResourceBar icon="❤️" name="HP" :current="currentHp" :max="maxHp" :percent="hpPercent" type="hp" />
            <ResourceBar icon="💧" name="MP" :current="currentMp" :max="maxMp" :percent="mpPercent" type="mp" />
            <ResourceBar icon="⭐" name="EXP" :current="currentExp" :max="maxExp" :percent="expPercent" type="exp" />
          </div>
        </div>

        <!-- 核心属性 -->
        <div class="attributes-section">
          <h3>核心属性</h3>
          <div class="core-attributes">
            <div class="core-attr-item" v-for="(value, key) in stats" :key="key">
              <span class="core-attr-icon">{{ getAttrIcon(key) }}</span>
              <div class="core-attr-content">
                <span class="core-attr-name">{{ getAttrName(key) }}</span>
                <span class="core-attr-value">{{ value }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 次级属性 -->
        <div class="secondary-section">
          <h3>次级属性</h3>
          <div class="secondary-grid">
            <div class="secondary-item attack">
              <div class="secondary-icon">⚔️</div>
              <div class="secondary-info">
                <div class="secondary-label">物理攻击</div>
                <div class="secondary-value">{{ attributes.physicalAttack }}</div>
              </div>
            </div>
            <div class="secondary-item defense">
              <div class="secondary-icon">🛡️</div>
              <div class="secondary-info">
                <div class="secondary-label">物理防御</div>
                <div class="secondary-value">{{ attributes.physicalDefense }}</div>
              </div>
            </div>
            <div class="secondary-item magic-attack">
              <div class="secondary-icon">🌀</div>
              <div class="secondary-info">
                <div class="secondary-label">魔法攻击</div>
                <div class="secondary-value">{{ attributes.magicAttack }}</div>
              </div>
            </div>
            <div class="secondary-item magic-defense">
              <div class="secondary-icon">🔮</div>
              <div class="secondary-info">
                <div class="secondary-label">魔法防御</div>
                <div class="secondary-value">{{ attributes.magicDefense }}</div>
              </div>
            </div>
            <div class="secondary-item crit">
              <div class="secondary-icon">💥</div>
              <div class="secondary-info">
                <div class="secondary-label">暴击率</div>
                <div class="secondary-value">{{ attributes.critChance }}%</div>
              </div>
            </div>
            <div class="secondary-item dodge">
              <div class="secondary-icon">💨</div>
              <div class="secondary-info">
                <div class="secondary-label">闪避率</div>
                <div class="secondary-value">{{ attributes.dodgeChance }}%</div>
              </div>
            </div>
          </div>
          <div class="resource-stats">
            <div class="resource-item">
              <span class="resource-icon">❤️</span>
              <span class="resource-label">最大HP</span>
              <span class="resource-value">{{ attributes.maxHp }}</span>
            </div>
            <div class="resource-item">
              <span class="resource-icon">💧</span>
              <span class="resource-label">最大MP</span>
              <span class="resource-value">{{ attributes.maxMana }}</span>
            </div>
          </div>
        </div>

        <!-- 装备区域 -->
        <div class="equipment-section">
          <h3>装备</h3>
          
          <div class="equipment-grid">
            <!-- 武器槽 -->
            <div 
              v-for="slot in weaponSlots" 
              :key="slot.key"
              :class="['equip-slot', { equipped: slot.equipment, selected: selectedSlot?.key === slot.key }, slot.equipment ? 'rarity-' + slot.equipment.rarity : '']"
              @click="selectEquipment(slot)"
            >
              <template v-if="slot.equipment">
                <div class="slot-icon">{{ slot.equipment.icon || '⚔️' }}</div>
                <div class="slot-name">{{ slot.equipment.name }}</div>
              </template>
              <template v-else>
                <div class="slot-icon empty">⚔️</div>
                <div class="slot-name empty">{{ slot.name }}</div>
              </template>
            </div>

            <!-- 防具槽 -->
            <div 
              v-for="slot in armorSlots" 
              :key="slot.key"
              :class="['equip-slot', { equipped: slot.equipment, selected: selectedSlot?.key === slot.key }, slot.equipment ? 'rarity-' + slot.equipment.rarity : '']"
              @click="selectEquipment(slot)"
            >
              <template v-if="slot.equipment">
                <div class="slot-icon">{{ slot.equipment.icon || '🛡️' }}</div>
                <div class="slot-name">{{ slot.equipment.name }}</div>
              </template>
              <template v-else>
                <div class="slot-icon empty">🛡️</div>
                <div class="slot-name empty">{{ slot.name }}</div>
              </template>
            </div>
          </div>

          <!-- 选中装备详情 -->
          <div v-if="selectedSlot" class="equipment-detail">
            <template v-if="selectedSlot.equipment">
              <div class="detail-header">
                <div class="detail-icon">{{ selectedSlot.equipment.icon || '📦' }}</div>
                <div class="detail-info">
                  <h4 :class="selectedSlot.equipment.rarity">{{ selectedSlot.equipment.name }}</h4>
                  <span :class="['detail-rarity', selectedSlot.equipment.rarity]">{{ getRarityName(selectedSlot.equipment.rarity) }}</span>
                </div>
              </div>
              <p class="detail-desc">{{ selectedSlot.equipment.description }}</p>
              <div v-if="selectedSlot.equipment.bonus" class="detail-stats">
                <div v-for="(value, stat) in selectedSlot.equipment.bonus" :key="stat" class="stat-item">
                  <span class="stat-name">{{ getStatName(stat) }}</span>
                  <span class="stat-value">+{{ value }}</span>
                </div>
              </div>
              <div v-if="selectedSlot.equipment.levelRequirement" class="detail-requirement">
                需要等级: {{ selectedSlot.equipment.levelRequirement }}
              </div>
              <div class="detail-actions">
                <button class="action-btn unequip" @click="unequipItem(selectedSlot.key)">卸下装备</button>
              </div>
            </template>
            <template v-else>
              <div class="detail-placeholder">
                <span class="placeholder-icon">📦</span>
                <span class="placeholder-text">槽位为空</span>
              </div>
            </template>
          </div>
          <div v-else class="equipment-detail">
            <div class="detail-placeholder">
              <span class="placeholder-icon">🛡️</span>
              <span class="placeholder-text">点击装备槽位查看详情</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { equipmentService } from '@/modules/equipment';
import { gameDataService } from '@/modules/gameData';
import { eventBus, GameEvents } from '@/modules/bus/core';
import type { FactionData, RaceData, ClassData, Stats, Attributes } from '@/modules/character/types';
import type { EquipmentSlot } from '@/modules/equipment/types';
import Tag from '../common/Tag.vue';
import BasePopup from '../common/BasePopup.vue';
import ResourceBar from '../common/ResourceBar.vue';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const characterStore = useCharacterStore();

const character = computed(() => characterStore.character);
const stats = computed<Stats>(() => characterStore.stats);
const attributes = computed<Attributes>(() => characterStore.attributes);

const factions = ref<FactionData[]>([]);
const races = ref<RaceData[]>([]);
const classes = ref<ClassData[]>([]);

const currentHp = computed(() => characterStore.hp);
const maxHp = computed(() => characterStore.maxHp);
const currentMp = computed(() => characterStore.mana);
const maxMp = computed(() => characterStore.maxMana);
const currentExp = computed(() => characterStore.exp);
const maxExp = computed(() => characterStore.expToNextLevel);

const hpPercent = computed(() => characterStore.hpPercentage);
const mpPercent = computed(() => characterStore.manaPercentage);
const expPercent = computed(() => characterStore.expPercentage);

interface SlotInfo {
  key: EquipmentSlot;
  name: string;
  equipment: any;
}

const weaponSlots = ref<SlotInfo[]>([
  { key: 'weapon1', name: '主手武器', equipment: null },
  { key: 'weapon2', name: '副手武器', equipment: null }
]);

const armorSlots = ref<SlotInfo[]>([
  { key: 'armor1', name: '护甲槽1', equipment: null },
  { key: 'armor2', name: '护甲槽2', equipment: null },
  { key: 'armor3', name: '护甲槽3', equipment: null },
  { key: 'armor4', name: '护甲槽4', equipment: null }
]);

const selectedSlot = ref<SlotInfo | null>(null);

const attrIcons: Record<string, string> = {
  str: '⚔️',
  dex: '💨',
  con: '❤️',
  int: '🧠',
  wis: '🔍',
  cha: '💫'
};

const attrNames: Record<string, string> = {
  str: '力量',
  dex: '敏捷',
  con: '体质',
  int: '智力',
  wis: '感知',
  cha: '魅力'
};

const rarityNames: Record<string, string> = {
  common: '普通',
  uncommon: '优秀',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说'
};

async function loadData() {
  factions.value = await gameDataService.getAllFactions();
  races.value = await gameDataService.getAllRaces();
  classes.value = await gameDataService.getAllClasses();
}

function getRaceIcon(raceId: string) {
  return races.value.find(r => r.id === raceId)?.icon || '👤';
}

function getRaceName(raceId: string) {
  return races.value.find(r => r.id === raceId)?.name || '';
}

function getFactionName(factionId: string) {
  return factions.value.find(f => f.id === factionId)?.name || '';
}

function getFactionColor(factionId: string) {
  return factions.value.find(f => f.id === factionId)?.color || '#9d9d9d';
}

function getClassName(classId: string) {
  return classes.value.find(c => c.id === classId)?.name || '';
}

function getClassColor(classId: string) {
  return classes.value.find(c => c.id === classId)?.color || '#9d9d9d';
}

function getAttrIcon(key: string) {
  return attrIcons[key] || '📊';
}

function getAttrName(key: string) {
  return attrNames[key] || key;
}

function getStatName(stat: string) {
  const statMap: Record<string, string> = {
    str: '力量',
    dex: '敏捷',
    con: '体质',
    int: '智力',
    wis: '感知',
    cha: '魅力'
  };
  return statMap[stat] || stat;
}

function getRarityName(rarity: string) {
  return rarityNames[rarity] || '';
}

function selectEquipment(slot: SlotInfo) {
  selectedSlot.value = slot;
}

async function unequipItem(slotKey: string) {
  const result = await equipmentService.unequipItem(slotKey as EquipmentSlot);
  if (result) {
    selectedSlot.value = null;
    refreshEquipment();
  }
}

function refreshEquipment() {
  const equipment = equipmentService.getEquipment();
  weaponSlots.value = [
    { key: 'weapon1', name: '主手武器', equipment: equipment.weapon1?.item || null },
    { key: 'weapon2', name: '副手武器', equipment: equipment.weapon2?.item || null }
  ];
  armorSlots.value = [
    { key: 'armor1', name: '护甲槽1', equipment: equipment.armor1?.item || null },
    { key: 'armor2', name: '护甲槽2', equipment: equipment.armor2?.item || null },
    { key: 'armor3', name: '护甲槽3', equipment: equipment.armor3?.item || null },
    { key: 'armor4', name: '护甲槽4', equipment: equipment.armor4?.item || null }
  ];
}

onMounted(async () => {
  await loadData();
  await equipmentService.initialize();
  refreshEquipment();
  
  // 监听装备变化事件，实时刷新装备显示
  eventBus.onGroup('characterInfoPopup', GameEvents.EQUIPMENT_CHANGE, () => {
    refreshEquipment();
  });
});

onUnmounted(() => {
  eventBus.clearGroup('characterInfoPopup');
});
</script>

<style scoped>
.character-content {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

/* 角色信息和资源条概览 */
.character-overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.character-basic {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.char-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.char-avatar {
  font-size: 40px;
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 215, 0, 0.15);
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  flex-shrink: 0;
}

.char-main-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.char-name {
  font-size: 22px;
  color: #f0f0f0;
  font-weight: bold;
  line-height: 1.2;
}

.char-level {
  font-size: 14px;
  color: #ffd700;
  font-weight: bold;
  background: rgba(255, 215, 0, 0.1);
  padding: 2px 8px;
  border-radius: 4px;
  display: inline-block;
  width: fit-content;
}

.char-details {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.resource-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* 核心属性 */
.attributes-section h3 {
  font-size: 14px;
  color: #ffd700;
  margin-bottom: 10px;
  font-weight: bold;
}

.core-attributes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}

.core-attr-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.core-attr-icon {
  font-size: 20px;
}

.core-attr-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.core-attr-name {
  font-size: 13px;
  color: #ffd700;
  font-weight: 500;
}

.core-attr-value {
  font-size: 16px;
  color: #ffffff;
  font-weight: bold;
}

/* 次级属性 */
.secondary-section h3 {
  font-size: 14px;
  color: #ffd700;
  margin-bottom: 10px;
  font-weight: bold;
}

.secondary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.secondary-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border-left: 3px solid transparent;
}

.secondary-item.attack { border-left-color: #ff6b6b; }
.secondary-item.defense { border-left-color: #4ecdc4; }
.secondary-item.magic-attack { border-left-color: #a29bfe; }
.secondary-item.magic-defense { border-left-color: #fd79a8; }
.secondary-item.crit { border-left-color: #fdcb6e; }
.secondary-item.dodge { border-left-color: #74b9ff; }

.secondary-icon {
  font-size: 18px;
  flex-shrink: 0;
}

.secondary-info {
  flex: 1;
}

.secondary-label {
  font-size: 12px;
  color: #8b8b8b;
  margin-bottom: 2px;
}

.secondary-value {
  font-size: 14px;
  color: #f0f0f0;
  font-weight: bold;
}

.resource-stats {
  display: flex;
  gap: 8px;
}

.resource-stats .resource-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
}

.resource-stats .resource-icon {
  font-size: 12px;
}

.resource-stats .resource-label {
  font-size: 11px;
  color: #8b8b8b;
  flex: 1;
}

.resource-stats .resource-value {
  font-size: 12px;
  color: #f0f0f0;
  font-weight: bold;
}

/* 装备区域 */
.equipment-section h3 {
  font-size: 14px;
  color: #ffd700;
  margin-bottom: 10px;
  font-weight: bold;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}

.equip-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  padding: 12px 8px;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  min-height: 80px;
}

.equip-slot:hover {
  border-color: #666;
  background: rgba(255, 255, 255, 0.1);
}

.equip-slot.selected {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
}

.equip-slot.equipped {
  background: rgba(255, 255, 255, 0.08);
}

.equip-slot.rarity-common { border-color: #9d9d9d; }
.equip-slot.rarity-uncommon { border-color: #1eff00; }
.equip-slot.rarity-rare { border-color: #0070dd; }
.equip-slot.rarity-epic { border-color: #a335ee; }
.equip-slot.rarity-legendary { 
  border-color: #ff8000;
  box-shadow: 0 0 8px rgba(255, 128, 0, 0.4);
}

.slot-icon {
  font-size: 24px;
}

.slot-icon.empty {
  opacity: 0.5;
}

.slot-name {
  font-size: 10px;
  color: #f0f0f0;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.slot-name.empty {
  color: #666;
}

/* 装备详情 */
.equipment-detail {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid #4a4a4a;
  border-radius: 8px;
  padding: 14px;
}

.detail-header {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-bottom: 10px;
}

.detail-icon {
  font-size: 36px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
}

.detail-info {
  flex: 1;
}

.detail-info h4 {
  font-size: 16px;
  color: #f0f0f0;
  font-weight: bold;
  margin: 0 0 4px 0;
}

.detail-info h4.common { color: #ffffff; }
.detail-info h4.uncommon { color: #1eff00; }
.detail-info h4.rare { color: #0070dd; }
.detail-info h4.epic { color: #a335ee; }
.detail-info h4.legendary { color: #ff8000; }

.detail-rarity {
  font-size: 12px;
}

.detail-rarity.common { color: #9d9d9d; }
.detail-rarity.uncommon { color: #1eff00; }
.detail-rarity.rare { color: #0070dd; }
.detail-rarity.epic { color: #a335ee; }
.detail-rarity.legendary { color: #ff8000; }

.detail-desc {
  color: #aaa;
  font-size: 13px;
  margin: 8px 0;
}

.detail-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: rgba(76, 175, 80, 0.1);
  border-radius: 4px;
}

.stat-name {
  color: #8b8b8b;
  font-size: 13px;
}

.stat-value {
  color: #4CAF50;
  font-size: 13px;
  font-weight: bold;
}

.detail-requirement {
  color: #ffd700;
  font-size: 12px;
  margin-bottom: 10px;
  padding: 4px 8px;
  background: rgba(255, 215, 0, 0.1);
  border-radius: 4px;
  display: inline-block;
}

.detail-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
}

.action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.unequip {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: #fff;
}

.detail-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px;
}

.placeholder-icon {
  font-size: 32px;
  opacity: 0.5;
}

.placeholder-text {
  color: #666;
  font-size: 13px;
}
</style>
