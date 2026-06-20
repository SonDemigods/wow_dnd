<template>
  <BasePopup :visible="visible" title="角色信息" @close="$emit('close')">
    <template #default>
      <div v-if="character" class="character-content">
        <!-- 角色信息和资源条 -->
        <div class="character-overview">
          <div class="character-basic">
            <div class="char-row">
              <BaseIcon :name="getRaceIcon(character.raceId)" gradient="gold" :size="24" />
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
            <ResourceBar icon="" iconName="health-normal" iconGradient="blood" name="HP" :current="currentHp" :max="maxHp" :percent="hpPercent" type="hp" />
            <ResourceBar icon="" iconName="magic-palm" iconGradient="mana" name="MP" :current="currentMp" :max="maxMp" :percent="mpPercent" type="mp" />
            <ResourceBar icon="" iconName="star-formation" iconGradient="gold" name="EXP" :current="currentExp" :max="maxExp" :percent="expPercent" type="exp" />
          </div>
        </div>

        <!-- 核心属性 -->
        <div class="attributes-section">
          <h3>核心属性</h3>
          <div class="core-attributes">
            <div class="core-attr-item" v-for="(value, key) in stats" :key="key">
              <BaseIcon :name="getAttrIcon(key).name" :gradient="getAttrIcon(key).gradient" :size="14" />
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
              <BaseIcon name="sword-clash" gradient="physical" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">物理攻击</div>
                <div class="secondary-value">{{ attributes.physicalAttack }}</div>
              </div>
            </div>
            <div class="secondary-item defense">
              <BaseIcon name="shield" gradient="earth" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">物理防御</div>
                <div class="secondary-value">{{ attributes.physicalDefense }}</div>
              </div>
            </div>
            <div class="secondary-item magic-attack">
              <BaseIcon name="magic-swirl" gradient="magic" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">魔法攻击</div>
                <div class="secondary-value">{{ attributes.magicAttack }}</div>
              </div>
            </div>
            <div class="secondary-item magic-defense">
              <BaseIcon name="magic-shield" gradient="magic" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">魔法防御</div>
                <div class="secondary-value">{{ attributes.magicDefense }}</div>
              </div>
            </div>
            <div class="secondary-item crit">
              <BaseIcon name="explosion-rays" gradient="crit" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">暴击率</div>
                <div class="secondary-value">{{ attributes.critChance }}%</div>
              </div>
            </div>
            <div class="secondary-item dodge">
              <BaseIcon name="dodge" gradient="dodge" :size="14" />
              <div class="secondary-info">
                <div class="secondary-label">闪避率</div>
                <div class="secondary-value">{{ attributes.dodgeChance }}%</div>
              </div>
            </div>
          </div>
          <div class="resource-stats">
            <div class="resource-item">
              <BaseIcon name="health-normal" gradient="blood" :size="16" />
              <span class="resource-label">最大HP</span>
              <span class="resource-value">{{ attributes.maxHp }}</span>
            </div>
            <div class="resource-item">
              <BaseIcon name="magic-palm" gradient="mana" :size="16" />
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
              :data-equip-slot="slot.key"
              :class="['equip-slot', { equipped: slot.equipment, selected: selectedSlot?.key === slot.key }, slot.equipment ? 'rarity-' + (slot.equipment?.rarity || 'common') : '']"
              @click="selectEquipment(slot)"
            >
              <template v-if="slot.equipment">
                <ItemIcon :icon="slot.equipment?.icon" :rarity="slot.equipment?.rarity" fallback="broadsword" size="lg" />
                <!-- <div class="slot-name">{{ slot.equipment.name }}</div> -->
              </template>
              <template v-else>
                <ItemIcon icon="" fallback="broadsword" size="lg" />
                <!-- <div class="slot-name empty">{{ slot.name }}</div> -->
              </template>
            </div>

            <!-- 防具槽 -->
            <div 
              v-for="slot in armorSlots" 
              :key="slot.key"
              :data-equip-slot="slot.key"
              :class="['equip-slot', { equipped: slot.equipment, selected: selectedSlot?.key === slot.key }, slot.equipment ? 'rarity-' + (slot.equipment?.rarity || 'common') : '']"
              @click="selectEquipment(slot)"
            >
              <template v-if="slot.equipment">
                <ItemIcon :icon="slot.equipment?.icon" :rarity="slot.equipment?.rarity" fallback="checked-shield" size="lg" />
                <!-- <div class="slot-name">{{ slot.equipment.name }}</div> -->
              </template>
              <template v-else>
                <ItemIcon icon="" fallback="checked-shield" size="lg" />
                <!-- <div class="slot-name empty">{{ slot.name }}</div> -->
              </template>
            </div>
          </div>

          <!-- 选中装备详情 -->
          <div v-if="selectedSlot" class="equipment-detail">
            <template v-if="selectedSlot.equipment">
              <div class="detail-header">
                <ItemIcon :icon="selectedSlot.equipment.icon" :rarity="selectedSlot.equipment.rarity" size="xl" />
                <div class="detail-info">
                  <h4 :class="selectedSlot.equipment.rarity">{{ selectedSlot.equipment.name }}</h4>
                  <span :class="['detail-rarity', selectedSlot.equipment.rarity]">{{ getRarityName(selectedSlot.equipment.rarity) }}</span>
                </div>
              </div>
              <p class="detail-desc">{{ selectedSlot.equipment.description }}</p>
              <div v-if="selectedSlot.equipment.bonus" class="detail-stats">
                <div v-for="(value, stat) in selectedSlot.equipment.bonus" :key="stat" class="stat-item">
                  <span class="stat-name">{{ getStatName(String(stat)) }}</span>
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
              <EmptyState icon="empty-box" gradient="metal" text="槽位为空" />
            </template>
          </div>
          <div v-else class="equipment-detail">
            <EmptyState icon="shield" text="点击装备槽位查看详情" />
          </div>
        </div>
      </div>
    </template>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 角色信息弹窗组件
 * @description 展示角色的完整属性面板，包括核心属性、次级属性、装备槽位和卸装操作
 */

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCharacterStore } from '@/modules/character';
import { useEquipmentStore } from '@/modules/equipment';
import { useBaseStore } from '@/modules/base';
import { eventBus, GameEvents } from '@/modules/bus/core';
import type { Stats, Attributes } from '@/modules/character/types';
import type { EquipmentSlot } from '@/modules/equipment/types';
import Tag from '../common/Tag.vue';
import BasePopup from '../common/BasePopup.vue';
import ResourceBar from '../common/ResourceBar.vue';
import ItemIcon from '../common/ItemIcon.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import EmptyState from '@/components/common/EmptyState.vue';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const characterStore = useCharacterStore();
const equipmentStore = useEquipmentStore();
const baseStore = useBaseStore();

const character = computed(() => characterStore.character);
const stats = computed<Stats>(() => characterStore.effectiveStats);
const attributes = computed<Attributes>(() => characterStore.attributes);

const factions = computed(() => baseStore.factions);
const races = computed(() => baseStore.races);
const classes = computed(() => baseStore.classes);

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

const weaponSlots = computed<SlotInfo[]>(() => [
  { key: 'weapon1', name: '主手武器', equipment: equipmentStore.equipment.weapon1?.item || null },
  { key: 'weapon2', name: '副手武器', equipment: equipmentStore.equipment.weapon2?.item || null }
]);

const armorSlots = computed<SlotInfo[]>(() => [
  { key: 'armor1', name: '护甲槽1', equipment: equipmentStore.equipment.armor1?.item || null },
  { key: 'armor2', name: '护甲槽2', equipment: equipmentStore.equipment.armor2?.item || null },
  { key: 'armor3', name: '护甲槽3', equipment: equipmentStore.equipment.armor3?.item || null },
  { key: 'armor4', name: '护甲槽4', equipment: equipmentStore.equipment.armor4?.item || null }
]);

const selectedSlot = ref<SlotInfo | null>(null);

const attrIcons: Record<string, { name: string; gradient: string }> = {
  str: { name: 'sword-clash', gradient: 'physical' },
  dex: { name: 'dodge', gradient: 'dodge' },
  con: { name: 'health-normal', gradient: 'blood' },
  int: { name: 'brain', gradient: 'magic' },
  wis: { name: 'eye-target', gradient: 'nature' },
  cha: { name: 'charm', gradient: 'gold' }
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
  await baseStore.loadAllData();
}

function getRaceIcon(raceId: string) {
  const icon = races.value.find(r => r.id === raceId)?.icon;
  return icon || 'person';
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
  return attrIcons[key] || { name: 'uncertainty', gradient: 'shadow' };
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
  eventBus.emit(GameEvents.UI_CLICK, { source: 'equip_slot' });
}

async function unequipItem(slotKey: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'unequip_btn' });
  const result = await equipmentStore.unequipItem(slotKey as EquipmentSlot);
  if (result) {
    // 装备槽卸下动画
    const slotEl = document.querySelector(`[data-equip-slot="${slotKey}"]`) as HTMLElement;
    if (slotEl) {
      slotEl.classList.add('equip-anim-empty');
      slotEl.addEventListener('animationend', () => {
        slotEl.classList.remove('equip-anim-empty');
      }, { once: true });
    }
    selectedSlot.value = null;
  }
}



onMounted(async () => {
  await loadData();
  if (characterStore.currentCharacterId) {
    await equipmentStore.initialize(characterStore.currentCharacterId);
  }
});

onUnmounted(() => {
  eventBus.clearGroup('characterInfoPopup');
});
</script>

<style lang="less" scoped>
.character-content {
  .flex-col();
  gap: @spacing-3xl;
}

/* 角色信息和资源条概览 */
.character-overview {
  .flex-col();
  gap: @spacing-xl;
  padding: @spacing-xl;
  background: @white-05;
  border-radius: @radius-lg;
}

.character-basic {
  .flex-col();
  gap: @spacing-lg;
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
  .flex-center();
  background: @gold-bg-hover;
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  flex-shrink: 0;
}

.char-avatar-text {
  font-size: 40px;
  width: 52px;
  height: 52px;
  .flex-center();
  background: @gold-bg-hover;
  border: 2px solid rgba(255, 215, 0, 0.3);
  border-radius: 10px;
  flex-shrink: 0;
}

.char-main-info {
  .flex-col();
  gap: 2px;
}

.char-name {
  font-size: 22px;
  color: @text-primary;
  font-weight: @font-weight-bold;
  line-height: 1.2;
}

.char-level {
  font-size: @font-md;
  color: @accent-color;
  font-weight: @font-weight-bold;
  background: @gold-bg;
  padding: @spacing-2xs @spacing-md;
  border-radius: @radius-sm;
  display: inline-block;
  width: fit-content;
}

.char-details {
  display: flex;
  gap: @spacing-xs;
  flex-wrap: wrap;
}

.resource-bars {
  .flex-col();
  gap: @spacing-sm;
}

/* 核心属性 */
.attributes-section h3 {
  font-size: @font-md;
  color: @accent-color;
  margin-bottom: @spacing-lg;
  font-weight: @font-weight-bold;
}

.core-attributes {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: @spacing-md;
}

.core-attr-item {
  display: flex;
  align-items: center;
  gap: @spacing-lg;
  padding: @spacing-md @spacing-xl;
  background: @white-05;
  border-radius: @radius-md;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.core-attr-icon {
  font-size: @font-2xl;
}

.core-attr-content {
  flex: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.core-attr-name {
  font-size: @font-base;
  color: @accent-color;
  font-weight: 500;
}

.core-attr-value {
  font-size: @font-lg;
  color: @popup-text-color;
  font-weight: @font-weight-bold;
}

/* 次级属性 */
.secondary-section h3 {
  font-size: @font-md;
  color: @accent-color;
  margin-bottom: @spacing-lg;
  font-weight: @font-weight-bold;
}

.secondary-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: @spacing-md;
  margin-bottom: @spacing-xl;
}

.secondary-item {
  display: flex;
  align-items: center;
  gap: @spacing-lg;
  padding: @spacing-lg @spacing-xl;
  background: @white-05;
  border-radius: @radius-md;
  border-left: 3px solid transparent;
}

.secondary-item.attack { border-left-color: @damage-physical; }
.secondary-item.defense { border-left-color: #4ecdc4; }
.secondary-item.magic-attack { border-left-color: #a29bfe; }
.secondary-item.magic-defense { border-left-color: #fd79a8; }
.secondary-item.crit { border-left-color: #fdcb6e; }
.secondary-item.dodge { border-left-color: #74b9ff; }

.secondary-icon {
  font-size: @font-xl;
  flex-shrink: 0;
}

.secondary-info {
  flex: 1;
}

.secondary-label {
  font-size: @font-sm;
  color: @text-secondary;
  margin-bottom: 2px;
}

.secondary-value {
  font-size: @font-md;
  color: @text-primary;
  font-weight: @font-weight-bold;
}

.resource-stats {
  display: flex;
  gap: @spacing-md;
}

.resource-stats .resource-item {
  flex: 1;
  display: flex;
  align-items: center;
  gap: @spacing-sm;
  padding: @spacing-sm @spacing-lg;
  background: @white-05;
  border-radius: @radius-md;
}

.resource-stats .resource-icon {
  font-size: @font-sm;
}

.resource-stats .resource-label {
  font-size: @font-xs;
  color: @text-secondary;
  flex: 1;
}

.resource-stats .resource-value {
  font-size: @font-sm;
  color: @text-primary;
  font-weight: @font-weight-bold;
}

/* 装备区域 */
.equipment-section h3 {
  font-size: @font-md;
  color: @accent-color;
  margin-bottom: @spacing-lg;
  font-weight: @font-weight-bold;
}

.equipment-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: @spacing-md;
  margin-bottom: @spacing-xl;
}

.equip-slot {
  .flex-col-center();
  justify-content: center;
  gap: @spacing-xs;
  padding: @spacing-md @spacing-md;
  background: @white-05;
  border-radius: @radius-lg;
  cursor: pointer;
  transition: all @transition-normal;
  min-height: 80px;
  aspect-ratio: 1;
}

.equip-slot.equip-anim-fill {
  animation: equip-slot-fill 0.6s ease;
}

.equip-slot.equip-anim-empty {
  animation: equip-slot-empty 0.6s ease;
}

.equip-slot:hover {
  background: @white-10;
}

.equip-slot.selected {
  background: @gold-bg-strong;
}

.equip-slot.equipped {
  background: rgba(255, 255, 255, 0.08);
}

.equip-slot.equipped.selected {
  background: @gold-bg-strong;
}

.slot-name {
  font-size: @font-2xs;
  color: @text-primary;
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.slot-name.empty {
  color: @color-dim-gray;
}

/* 装备详情 */
.equipment-detail {
  background: @overlay-light;
  border: @border-sm;
  border-radius: @radius-lg;
  padding: 14px;
}

.detail-header {
  display: flex;
  gap: @spacing-xl;
  align-items: center;
  margin-bottom: @spacing-lg;
}

.detail-info {
  flex: 1;
}

.detail-info h4 {
  font-size: @font-lg;
  color: @text-primary;
  font-weight: @font-weight-bold;
  margin: 0 0 @spacing-xs 0;
}

.detail-info h4.common { color: @popup-text-color; }
.detail-info h4.uncommon { color: #1eff00; }
.detail-info h4.rare { color: #0070dd; }
.detail-info h4.epic { color: #a335ee; }
.detail-info h4.legendary { color: #ff8000; }

.detail-rarity {
  font-size: @font-sm;
}

.detail-rarity.common { color: #9d9d9d; }
.detail-rarity.uncommon { color: #1eff00; }
.detail-rarity.rare { color: #0070dd; }
.detail-rarity.epic { color: #a335ee; }
.detail-rarity.legendary { color: #ff8000; }

.detail-desc {
  color: #aaa;
  font-size: @font-base;
  margin: @spacing-md 0;
}

.detail-stats {
  .flex-col();
  gap: @spacing-xs;
  margin-bottom: @spacing-lg;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: @spacing-xs @spacing-md;
  background: @green-bg;
  border-radius: @radius-sm;
}

.stat-name {
  color: @text-secondary;
  font-size: @font-base;
}

.stat-value {
  color: @heal-hp;
  font-size: @font-base;
  font-weight: @font-weight-bold;
}

.detail-requirement {
  color: @accent-color;
  font-size: @font-sm;
  margin-bottom: @spacing-lg;
  padding: @spacing-xs @spacing-md;
  background: @gold-bg;
  border-radius: @radius-sm;
  display: inline-block;
}

.detail-actions {
  display: flex;
  gap: @spacing-md;
  margin-top: @spacing-lg;
}

.action-btn {
  padding: @spacing-md @spacing-3xl;
  border: none;
  border-radius: @radius-sm;
  font-size: @font-base;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-quick;
}

.action-btn:hover {
  transform: translateY(-1px);
}

.unequip {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: @popup-text-color;
}


</style>
