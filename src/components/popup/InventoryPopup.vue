<template>
  <BasePopup :visible="visible" title="背包" @close="$emit('close')">
    <template #header-extra>
      <div class="header-info">
        <div class="gold-display">💰 {{ gold }}</div>
        <div class="inventory-count">{{ inventoryItems.length }} / {{ maxSlots }}</div>
      </div>
    </template>

    <template #default>
      <div class="inventory-content">
        <div class="category-tabs">
          <button 
            v-for="cat in categories" 
            :key="cat.id"
            :class="['tab-btn', { active: selectedCategory === cat.id }]"
            @click="selectCategory(cat.id)"
          >
            {{ cat.name }}
          </button>
        </div>

        <div class="inventory-grid">
          <div 
            v-for="(entry, idx) in displayItems" 
            :key="idx"
            :data-item-id="entry.item.itemId"
            :class="['item-slot', entry.info?.rarity, { equipped: isEquipped(entry.item.itemId), selected: selectedEntry?.item === entry.item }]"
            @click="selectItem(entry)"
          >
            <ItemIcon :icon="entry.info?.icon" :rarity="entry.info?.rarity" size="sm" />
            <span v-if="entry.item.count > 1" class="item-count">{{ entry.item.count }}</span>
          </div>
          <div 
            v-for="i in emptySlots" 
            :key="'empty-' + i"
            class="item-slot empty"
          >
          </div>
        </div>

        <div class="item-detail">
          <template v-if="selectedEntry">
            <div class="detail-header">
              <h3 :class="selectedEntry.info?.rarity">{{ selectedEntry.info?.name }}</h3>
              <span class="quality-badge">{{ getRarityName(selectedEntry.info?.rarity || 'common') }}</span>
            </div>
            <p class="detail-desc">{{ selectedEntry.info?.description }}</p>
            <div class="detail-info">
              <span>类型: {{ getTypeName(selectedEntry.info?.type || 'misc') }}</span>
              <span>数量: {{ selectedEntry.item.count }}</span>
              <span v-if="selectedEntry.info?.levelRequirement">等级: {{ selectedEntry.info.levelRequirement }}</span>
            </div>
            <div v-if="selectedEntry.info?.bonus" class="bonus-info">
              <div v-for="(value, stat) in selectedEntry.info?.bonus" :key="stat" class="bonus-item">
                <span class="bonus-name">{{ getStatName(stat) }}</span>
                <span class="bonus-value">+{{ value }}</span>
              </div>
            </div>
            <div v-if="selectedEntry.info?.effect" class="effect-info">
              <EffectTag :type="selectedEntry.info.effect.type" />
              <span class="effect-value">{{ getEffectValueText(selectedEntry.info.effect) }}</span>
            </div>
            <div class="detail-actions">
              <button 
                v-if="selectedEntry.info?.consumable"
                class="action-btn use"
                @click="useItem(selectedEntry.item.itemId)"
              >
                💊 使用
              </button>
              <button 
                v-if="isEquipment(selectedEntry.info?.type)"
                class="action-btn equip"
                @click="equipItem(selectedEntry.item.itemId)"
              >
                🛡️ {{ isEquipped(selectedEntry.item.itemId) ? '卸下' : '装备' }}
              </button>
              <button 
                class="action-btn drop"
                @click="dropItem(selectedEntry.item.itemId)"
              >
                🗑️ 丢弃
              </button>
            </div>
          </template>
          <div v-else class="detail-placeholder">
            <span class="placeholder-icon">📦</span>
            <span class="placeholder-text">点击物品查看详情</span>
          </div>
        </div>
      </div>
    </template>

    <template #footer>
      <button class="popup-footer-btn organize" @click="doOrganize">
        整理背包
      </button>
    </template>
  </BasePopup>

  <ConfirmPopup
    :visible="showDropConfirm"
    title="丢弃物品"
    :message="`确定要丢弃 ${selectedEntry?.info?.name || '此物品'} 吗？`"
    type="danger"
    @confirm="confirmDrop"
    @cancel="cancelDrop"
  />

  <!-- 装备槽位选择弹窗 -->
  <BasePopup :visible="showSlotSelect" title="选择装备位置" max-width="360px" @close="cancelSlotSelect">
    <div class="slot-select-content">
      <p class="slot-select-hint">为 {{ pendingEquipItem?.name }} 选择装备位置：</p>
      <div class="slot-options">
        <button
          v-for="slot in availableSlots"
          :key="slot"
          class="slot-option-btn"
          @click="selectEquipSlot(slot)"
        >
          <span class="slot-icon">{{ slot.startsWith('weapon') ? '⚔️' : '🛡️' }}</span>
          <span class="slot-name">{{ SLOT_NAMES[slot] }}</span>
        </button>
      </div>
    </div>
  </BasePopup>
</template>

<script setup lang="ts">
/**
 * @fileoverview 背包弹窗组件
 * @description 展示角色背包物品网格，支持按分类筛选、整理堆叠、使用消耗品、装备武器/护甲到槽位及丢弃物品操作
 */

import { ref, computed, onMounted } from 'vue';
import BasePopup from '../common/BasePopup.vue';
import ConfirmPopup from '../common/ConfirmPopup.vue';
import ItemIcon from '../common/ItemIcon.vue';
import EffectTag from '../common/EffectTag.vue';
import { useInventoryStore } from '@/modules/inventory';
import { useCharacterStore } from '@/modules/character';
import { useEquipmentStore } from '@/modules/equipment';
import { eventBus, GameEvents } from '@/modules/bus/core';
import { useToast } from '@/composables/useToast';
import type { InventoryItem, Item, ItemType, ItemRarity, ItemEffect } from '@/modules/inventory';
import type { EquipmentSlot, EquipmentItem } from '@/modules/equipment/types';

interface ItemEntry {
  item: InventoryItem;
  info: Item | null;
}

// 槽位中文名称映射
const SLOT_NAMES: Record<EquipmentSlot, string> = {
  weapon1: '主手武器',
  weapon2: '副手武器',
  armor1: '护甲槽1',
  armor2: '护甲槽2',
  armor3: '护甲槽3',
  armor4: '护甲槽4'
};

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const characterStore = useCharacterStore();
const equipmentStore = useEquipmentStore();
const toast = useToast();
const gold = computed(() => characterStore.gold);

const selectedCategory = ref<'all' | ItemType>('all');
const selectedEntry = ref<ItemEntry | null>(null);

// 丢弃确认弹窗状态
const showDropConfirm = ref(false);
const pendingDropItemId = ref<string | null>(null);

// 装备槽位选择弹窗状态
const showSlotSelect = ref(false);
const availableSlots = ref<EquipmentSlot[]>([]);
const pendingEquipItem = ref<EquipmentItem | null>(null);

/** 直接从 Store 读取的响应式背包物品列表 */
const inventoryItems = computed(() => useInventoryStore().inventory);

/** 已装备物品ID集合，直接从装备 Store 响应式数据派生 */
const equippedItemIds = computed(() => {
  const ids = new Set<string>();
  Object.values(equipmentStore.equipment).forEach(e => {
    if (e) ids.add(e.item.id);
  });
  return ids;
});
const maxSlots = 50;

const categories = [
  { id: 'all' as const, name: '全部' },
  { id: 'potion' as const, name: '药水' },
  { id: 'scroll' as const, name: '卷轴' },
  { id: 'food' as const, name: '食物' },
  { id: 'material' as const, name: '材料' },
  { id: 'weapon' as const, name: '武器' },
  { id: 'armor' as const, name: '护甲' },
  { id: 'misc' as const, name: '杂项' }
];

const rarityNames: Record<ItemRarity, string> = {
  common: '普通',
  uncommon: '优秀',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说'
};

const typeNames: Record<ItemType, string> = {
  gold: '货币',
  potion: '药水',
  scroll: '卷轴',
  food: '食物',
  material: '材料',
  quest: '任务物品',
  weapon: '武器',
  armor: '护甲',
  misc: '杂项'
};

function getRarityName(rarity: ItemRarity) {
  return rarityNames[rarity] || rarity;
}

function getTypeName(type: ItemType) {
  return typeNames[type] || type;
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

/** 获取效果数值文本（用于 EffectTag 标签旁显示） */
function getEffectValueText(effect: ItemEffect): string {
  const { type, value } = effect;
  if (typeof value !== 'number') return '';
  switch (type) {
    case 'health_restore': return `恢复 ${value} 点`;
    case 'mana_restore': return `恢复 ${value} 点`;
    case 'physical_damage': return `伤害 ${value}`;
    case 'magic_damage': return `伤害 ${value}`;
    default: return `${value}`;
  }
}

function getEffectToast(info: Item): string {
  if (!info.effect) return `使用了 ${info.name}`;
  const { type, value } = info.effect;
  switch (type) {
    case 'health_restore': return `恢复了 ${value} 点生命值`;
    case 'mana_restore': return `恢复了 ${value} 点法力值`;
    case 'physical_damage':
    case 'magic_damage': return `造成了 ${value} 点伤害`;
    default: return `使用了 ${info.name}`;
  }
}

function isEquipment(type?: ItemType) {
  return type === 'weapon' || type === 'armor';
}

function isEquipped(itemId: string): boolean {
  if (!equippedItemIds.value.has(itemId)) return false;
  // 如果背包中仍有该物品的副本，说明存在未被装备的实例，不应显示为"已装备"
  // （所有副本都已装备时，物品不会出现在背包网格中，equipped 样式不会误显示）
  const stillInInventory = inventoryItems.value.some(i => i.itemId === itemId);
  return !stillInInventory;
}

const filteredItems = computed(() => {
  if (selectedCategory.value === 'all') return inventoryItems.value;
  return inventoryItems.value.filter(item => {
    const info = useInventoryStore().getItemInfo(item.itemId);
    return info?.type === selectedCategory.value;
  });
});

const displayItems = computed<ItemEntry[]>(() => {
  return filteredItems.value.map(item => ({
    item,
    info: useInventoryStore().getItemInfo(item.itemId)
  }));
});

const emptySlots = computed(() => {
  return Math.max(0, maxSlots - filteredItems.value.length);
});

function selectCategory(catId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'inventory_category' });
  selectedCategory.value = catId as 'all' | ItemType;
}

/**
 * 整理背包：自动堆叠相同物品并按品质、分类排序
 */
async function doOrganize() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'inventory_organize' });
  useInventoryStore().organizeInventory();
  await loadInventory();
  selectedEntry.value = null;
  toast.show({ message: '背包已整理', type: 'success', icon: '📋' });
}

function selectItem(entry: ItemEntry) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'inventory_select_item' });
  selectedEntry.value = entry;
}

/**
 * 查找物品索引，优先使用选中的那一组
 * 当背包中存在多组相同 itemId 的物品时，优先返回当前选中的位置
 */
function findSelectedOrFirstIndex(itemId: string): number {
  // 优先查找当前选中物品的位置
  if (selectedEntry.value && selectedEntry.value.item.itemId === itemId) {
    const idx = inventoryItems.value.findIndex(i => i.itemId === itemId && selectedEntry.value && i === selectedEntry.value.item);
    if (idx >= 0) return idx;
  }
  return inventoryItems.value.findIndex(i => i.itemId === itemId);
}

async function useItem(itemId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'inventory_use_item' });
  // 优先使用选中的那一组
  const index = findSelectedOrFirstIndex(itemId);
  if (index === -1) return;

  const invItem = inventoryItems.value[index];
  const info = useInventoryStore().getItemInfo(itemId);
  if (!info?.consumable) return;

  // 使用物品（内部处理HP/MP恢复和堆叠数量递减）
  const success = await useInventoryStore().useItemByIndex(index);
  if (!success) return;

  // 物品使用弹跳动画
  const slotEl = document.querySelector(`[data-item-id="${itemId}"]`) as HTMLElement;
  if (slotEl) {
    slotEl.style.animation = 'item-bounce 0.4s ease';
    slotEl.addEventListener('animationend', () => {
      slotEl.style.animation = '';
    }, { once: true });
  }

  toast.show({ message: getEffectToast(info), type: 'success', icon: '💊' });
  
  loadInventory();
  // 堆叠数归零时清除选中
  if (invItem.count <= 1) {
    selectedEntry.value = null;
  }
}

function equipItem(itemId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'inventory_equip_item' });
  // 获取装备模板
  const equipTemplate = equipmentStore.getEquipmentTemplate(itemId);
  if (!equipTemplate) {
    toast.show({ message: '无法找到该装备的配置数据', type: 'warning' });
    return;
  }

  // 获取该装备可用的槽位
  const slots = equipTemplate.slots;
  if (!slots || slots.length === 0) {
    toast.show({ message: '该装备没有可用的槽位', type: 'warning' });
    return;
  }

  // 如果只有一个可用槽位，直接装备
  if (slots.length === 1) {
    doEquip(equipTemplate, slots[0]);
    return;
  }

  // 多个可用槽位时，弹出选择框
  pendingEquipItem.value = equipTemplate;
  availableSlots.value = slots;
  showSlotSelect.value = true;
}

async function doEquip(item: EquipmentItem, slot: EquipmentSlot) {
  const success = await equipmentStore.equipItem(slot, item);
  if (success) {
    // 装备槽填充动画（如果角色面板打开）
    const slotEl = document.querySelector(`[data-equip-slot="${slot}"]`) as HTMLElement;
    if (slotEl) {
      slotEl.classList.add('equip-anim-fill');
      slotEl.addEventListener('animationend', () => {
        slotEl.classList.remove('equip-anim-fill');
      }, { once: true });
    }
    // 从背包中移除该物品（优先移除选中的那一组）
    const index = findSelectedOrFirstIndex(item.id);
    if (index !== -1) {
      useInventoryStore().removeItemByIndex(index);
    }
    toast.show({ message: `已装备 ${item.name} 到 ${SLOT_NAMES[slot]}`, type: 'success', icon: '🛡️' });
    loadInventory();
    selectedEntry.value = null;
  } else {
    toast.show({ message: '装备失败，可能等级不足或槽位不匹配', type: 'warning' });
  }
  showSlotSelect.value = false;
  pendingEquipItem.value = null;
}

function selectEquipSlot(slot: EquipmentSlot) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'inventory_equip_slot' });
  if (pendingEquipItem.value) {
    doEquip(pendingEquipItem.value, slot);
  }
}

function cancelSlotSelect() {
  showSlotSelect.value = false;
  pendingEquipItem.value = null;
  availableSlots.value = [];
}

function dropItem(itemId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'inventory_drop_item' });
  pendingDropItemId.value = itemId;
  showDropConfirm.value = true;
}

function confirmDrop() {
  const itemId = pendingDropItemId.value;
  if (!itemId) return;
  
  const info = useInventoryStore().getItemInfo(itemId);
  // 优先丢弃选中的那一组
  const index = findSelectedOrFirstIndex(itemId);
  if (index !== -1) {
    useInventoryStore().removeItemByIndex(index);
    eventBus.emit(GameEvents.ITEM_DROPPED, { itemId });
    toast.show({ message: `已丢弃 ${info?.name || '物品'}`, type: 'info', icon: '🗑️' });
    loadInventory();
    selectedEntry.value = null;
  }
  
  showDropConfirm.value = false;
  pendingDropItemId.value = null;
}

function cancelDrop() {
  showDropConfirm.value = false;
  pendingDropItemId.value = null;
}

async function loadInventory() {
  await useInventoryStore().initialize(characterStore.currentCharacterId!);
  // 确保装备 Store 已初始化（装备模块需要从装备 Store 加载）
  if (characterStore.currentCharacterId) {
    await equipmentStore.initialize(characterStore.currentCharacterId);
  }
}

onMounted(() => {
  loadInventory();
});
</script>

<style scoped>
.inventory-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 14px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.gold-display {
  padding: 4px 10px;
  background: rgba(255, 215, 0, 0.15);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 4px;
  color: #ffd700;
  font-size: 13px;
  font-weight: bold;
}

.inventory-count {
  padding: 4px 10px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #888;
  font-size: 12px;
}

.inventory-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 14px;
}

.category-tabs {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.tab-btn {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-btn:hover {
  border-color: #666;
}

.tab-btn.active {
  background: rgba(0, 153, 255, 0.2);
  border-color: #0099ff;
  color: #0099ff;
}

.inventory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(48px, 1fr));
  gap: 6px;
  background: rgba(0, 0, 0, 0.5);
  padding: 10px;
  border-radius: 6px;
  border: 2px solid #4a4a4a;
  flex: 1;
  min-height: 0;
  max-height: 300px;
  overflow-y: auto;
  overflow-x: hidden;
  align-content: start;
}

.inventory-grid::-webkit-scrollbar {
  width: 6px;
}

.inventory-grid::-webkit-scrollbar-track {
  background: rgba(0, 0, 0, 0.3);
  border-radius: 3px;
}

.inventory-grid::-webkit-scrollbar-thumb {
  background: #4a4a4a;
  border-radius: 3px;
}

.inventory-grid::-webkit-scrollbar-thumb:hover {
  background: #666;
}

.item-slot {
  aspect-ratio: 1;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
  /* 物品入场动画 */
  animation: scaleIn 0.25s ease;
}

.item-slot:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.item-slot.empty {
  border: 2px dashed #4a4a4a;
  opacity: 0.3;
}

.item-slot.equipped {
  outline: 2px solid #4CAF50;
  outline-offset: -2px;
  background: rgba(76, 175, 80, 0.2);
}

.item-slot.selected {
  background: rgba(255, 215, 0, 0.25);
}


.item-count {
  position: absolute;
  bottom: 2px;
  right: 3px;
  font-size: 10px;
  color: #fff;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.item-detail {
  background: rgba(0, 0, 0, 0.7);
  border-radius: 6px;
  padding: 14px;
  border: 1px solid #4a4a4a;
  flex-shrink: 0;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-detail h3 {
  font-size: 16px;
  color: #fff;
  font-weight: bold;
  margin: 0;
}

.item-detail h3.common { color: #ffffff; }
.item-detail h3.uncommon { color: #1eff00; }
.item-detail h3.rare { color: #0070dd; }
.item-detail h3.epic { color: #a335ee; }
.item-detail h3.legendary { color: #ff8000; }

.quality-badge {
  padding: 3px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #888;
  font-size: 12px;
}

.detail-desc {
  color: #aaa;
  font-size: 13px;
  margin: 8px 0;
}

.detail-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
}

.placeholder-icon {
  font-size: 28px;
  opacity: 0.5;
}

.placeholder-text {
  color: #666;
  font-size: 14px;
}

.detail-info {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.detail-info span {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #888;
  font-size: 13px;
}

.bonus-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 8px;
}

.bonus-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 4px 8px;
  background: rgba(76, 175, 80, 0.1);
  border-radius: 4px;
}

.bonus-name {
  color: #8b8b8b;
  font-size: 13px;
}

.bonus-value {
  color: #4CAF50;
  font-size: 13px;
  font-weight: bold;
}

.effect-info {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.effect-info .effect-value {
  color: #ffd700;
  font-size: 13px;
  font-weight: bold;
}

.detail-actions {
  display: flex;
  gap: 10px;
  margin-top: 14px;
}

.action-btn {
  padding: 8px 14px;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.action-btn.use {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #fff;
}

.action-btn.equip {
  background: linear-gradient(135deg, #0099ff, #0066cc);
  color: #fff;
}

.action-btn.drop {
  background: linear-gradient(135deg, #ff4444, #cc0000);
  color: #fff;
}

.action-btn:hover {
  transform: translateY(-2px);
}

.slot-select-content {
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-items: center;
}

.slot-select-hint {
  color: #aaa;
  font-size: 14px;
  margin: 0;
}

.slot-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.slot-option-btn {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #4a4a4a;
  border-radius: 6px;
  color: #ccc;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.slot-option-btn:hover {
  background: rgba(0, 153, 255, 0.15);
  border-color: #0099ff;
  color: #fff;
}

.slot-icon {
  font-size: 18px;
}

.slot-name {
  font-weight: bold;
}
</style>
