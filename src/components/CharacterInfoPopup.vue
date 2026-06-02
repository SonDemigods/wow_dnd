<template>
  <BasePopup :visible="visible" title="角色信息" @close="$emit('close')">
    <template #default>
      <div v-if="character">
        <!-- 角色信息和资源条 -->
        <div class="character-overview">
          <!-- 上面：角色基本信息 -->
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

          <!-- 下面：资源条 -->
          <div class="resource-bars">
            <div class="resource-item">
              <span class="resource-icon">❤️</span>
              <div class="resource-content">
                <div class="resource-header">
                  <span class="resource-name">HP</span>
                  <span class="resource-value">{{ currentHp }}/{{ maxHp }}</span>
                </div>
                <div class="resource-bar">
                  <div class="resource-fill hp-fill" :style="{ width: hpPercent + '%' }"></div>
                </div>
              </div>
            </div>
            <div class="resource-item">
              <span class="resource-icon">💧</span>
              <div class="resource-content">
                <div class="resource-header">
                  <span class="resource-name">MP</span>
                  <span class="resource-value">{{ currentMp }}/{{ maxMp }}</span>
                </div>
                <div class="resource-bar">
                  <div class="resource-fill mp-fill" :style="{ width: mpPercent + '%' }"></div>
                </div>
              </div>
            </div>
            <div class="resource-item">
              <span class="resource-icon">⭐</span>
              <div class="resource-content">
                <div class="resource-header">
                  <span class="resource-name">EXP</span>
                  <span class="resource-value">{{ currentExp }}/{{ maxExp }}</span>
                </div>
                <div class="resource-bar">
                  <div class="resource-fill exp-fill" :style="{ width: expPercent + '%' }"></div>
                </div>
              </div>
            </div>
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

        <!-- 装备 -->
        <div class="equipment-section">
          <h3>装备</h3>
          
          <!-- 武器 -->
          <div class="equipment-group">
            <div class="equipment-group-header">
              <span class="group-icon">🗡️</span>
              <span class="group-name">武器</span>
            </div>
            <div class="equipment-slots">
              <div 
                v-for="slot in weaponSlots" 
                :key="slot.key"
                class="equip-slot"
                :class="{ equipped: slot.equipment }"
                @click="selectEquipment(slot)"
              >
                <div class="slot-icon" v-if="slot.equipment">{{ getEquipIcon(slot.equipment.type) }}</div>
                <div class="slot-empty" v-else>{{ slot.name }}</div>
              </div>
            </div>
          </div>

          <!-- 防具 -->
          <div class="equipment-group">
            <div class="equipment-group-header">
              <span class="group-icon">🛡️</span>
              <span class="group-name">防具</span>
            </div>
            <div class="equipment-slots">
              <div 
                v-for="slot in armorSlots" 
                :key="slot.key"
                class="equip-slot"
                :class="{ equipped: slot.equipment }"
                @click="selectEquipment(slot)"
              >
                <div class="slot-icon" v-if="slot.equipment">{{ getEquipIcon(slot.equipment.type) }}</div>
                <div class="slot-empty" v-else>{{ slot.name }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <div v-if="selectedSlot && selectedSlot.equipment" class="selected-equipment">
        <div class="equip-header">
          <div class="equip-icon">{{ getEquipIcon(selectedSlot.equipment.type) }}</div>
          <div>
            <div class="equip-name">{{ selectedSlot.equipment.name }}</div>
            <div class="equip-quality" :class="selectedSlot.equipment.quality">
              {{ getQualityName(selectedSlot.equipment.quality) }}
            </div>
          </div>
        </div>
        <div class="equip-desc">{{ selectedSlot.equipment.description }}</div>
        <div class="equip-stats">
          <div v-for="(value, stat) in selectedSlot.equipment.attributes" :key="stat">
            {{ getStatName(stat) }} +{{ value }}
          </div>
        </div>
        <div class="equip-actions">
          <button class="action-btn unequip" @click="unequipItem(selectedSlot.key)">卸下</button>
        </div>
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { equipmentService } from '@/modules/equipment';
import { gameDataService } from '@/modules/gameData';
import type { FactionData, RaceData, ClassData, Stats, Attributes } from '@/modules/character/types';
import Tag from './Tag.vue';
import BasePopup from './BasePopup.vue';

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

const weaponSlots = computed(() => {
  const equipment = equipmentService.getEquipment();
  return [
    { key: 'weapon1', name: '武器1', equipment: equipment.weapon1 },
    { key: 'weapon2', name: '武器2', equipment: equipment.weapon2 }
  ];
});

const armorSlots = computed(() => {
  const equipment = equipmentService.getEquipment();
  return [
    { key: 'armor1', name: '防具1', equipment: equipment.armor1 },
    { key: 'armor2', name: '防具2', equipment: equipment.armor2 },
    { key: 'armor3', name: '防具3', equipment: equipment.armor3 },
    { key: 'armor4', name: '防具4', equipment: equipment.armor4 }
  ];
});
const selectedSlot = ref<any>(null);

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

const equipTypes: Record<string, string> = {
  weapon: '🗡️',
  offhand: '🛡️',
  head: '👑',
  chest: '👕',
  legs: '👖',
  feet: '👢',
  hands: '🧤',
  accessory: '💍'
};

const qualityNames: Record<string, string> = {
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
    physicalAttack: '物理攻击',
    physicalDefense: '物理防御',
    magicAttack: '魔法攻击',
    magicalAttack: '魔法攻击',
    magicalDefense: '魔法防御',
    magicDefense: '魔法防御',
    maxHp: '最大HP',
    maxMana: '最大MP',
    maxMp: '最大MP'
  };
  return statMap[stat] || stat;
}

function getEquipIcon(type: string) {
  return equipTypes[type] || '📦';
}

function getQualityName(quality: string) {
  return qualityNames[quality] || '';
}

function selectEquipment(slot: any) {
  selectedSlot.value = slot;
}

function unequipItem(slotKey: string) {
  equipmentService.unequipItem(slotKey);
  selectedSlot.value = null;
}

onMounted(async () => {
  await loadData();
});
</script>

<style scoped>
/* 角色信息和资源条概览 */
.character-overview {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  margin-bottom: 16px;
}

/* 角色基本信息 */
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

/* 资源条 */
.resource-bars {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.resource-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.resource-icon {
  font-size: 14px;
  flex-shrink: 0;
  width: 20px;
  text-align: center;
}

.resource-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.resource-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.resource-name {
  font-size: 11px;
  color: #8b8b8b;
  font-weight: bold;
}

.resource-value {
  font-size: 11px;
  color: #f0f0f0;
  font-weight: bold;
}

.resource-bar {
  height: 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  overflow: hidden;
  position: relative;
}

.resource-fill {
  height: 100%;
  transition: width 0.3s ease;
  border-radius: 4px;
  position: relative;
}

.resource-fill::after {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
  animation: shimmer 2s infinite;
}

@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.hp-fill {
  background: linear-gradient(90deg, #ff6b6b, #ee5a5a, #d63031);
  box-shadow: 0 0 10px rgba(255, 107, 107, 0.5);
}

.mp-fill {
  background: linear-gradient(90deg, #74b9ff, #0984e3, #0652dd);
  box-shadow: 0 0 10px rgba(116, 185, 255, 0.5);
}

.exp-fill {
  background: linear-gradient(90deg, #fdcb6e, #f39c12, #e67e22);
  box-shadow: 0 0 10px rgba(253, 203, 110, 0.5);
}

/* 核心属性 */
.attributes-section {
  margin-bottom: 16px;
}

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
.secondary-section {
  margin-bottom: 16px;
}

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

.secondary-item.attack {
  border-left-color: #ff6b6b;
}

.secondary-item.defense {
  border-left-color: #4ecdc4;
}

.secondary-item.magic-attack {
  border-left-color: #a29bfe;
}

.secondary-item.magic-defense {
  border-left-color: #fd79a8;
}

.secondary-item.crit {
  border-left-color: #fdcb6e;
}

.secondary-item.dodge {
  border-left-color: #74b9ff;
}

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
.equipment-section {
  margin-bottom: 16px;
}

.equipment-section h3 {
  font-size: 14px;
  color: #ffd700;
  margin-bottom: 10px;
  font-weight: bold;
}

.equipment-group {
  margin-bottom: 14px;
}

.equipment-group:last-child {
  margin-bottom: 0;
}

.equipment-group-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.group-icon {
  font-size: 16px;
}

.group-name {
  font-size: 13px;
  color: #f0f0f0;
  font-weight: bold;
}

.equipment-slots {
  display: flex;
  gap: 8px;
}

.equip-slot {
  flex: 1;
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
}

.equip-slot:hover {
  border-color: #666;
  background: rgba(255, 255, 255, 0.1);
}

.equip-slot.equipped {
  border-color: #ffd700;
}

.slot-icon {
  font-size: 24px;
}

.slot-empty {
  color: #8b8b8b;
  font-size: 10px;
  text-align: center;
}

/* 选中装备信息 */
.selected-equipment {
  padding: 14px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 6px;
  border: 1px solid #4a4a4a;
  margin-bottom: 16px;
}

.equip-header {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 10px;
}

.equip-icon {
  font-size: 36px;
}

.equip-name {
  font-size: 16px;
  color: #f0f0f0;
  font-weight: bold;
  margin-bottom: 3px;
}

.equip-quality {
  font-size: 12px;
}

.equip-quality.common { color: #ffffff; }
.equip-quality.uncommon { color: #1eff00; }
.equip-quality.rare { color: #0070dd; }
.equip-quality.epic { color: #a335ee; }
.equip-quality.legendary { color: #ff8000; }

.equip-desc {
  color: #8b8b8b;
  font-size: 13px;
  margin-bottom: 10px;
}

.equip-stats {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-bottom: 14px;
}

.equip-stats div {
  color: #4CAF50;
  font-size: 13px;
}

.equip-actions {
  display: flex;
  gap: 8px;
}

.action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.unequip {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: #fff;
}

.action-btn:hover {
  transform: translateY(-2px);
}
</style>
