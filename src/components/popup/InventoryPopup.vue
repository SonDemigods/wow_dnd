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
            @click="selectedCategory = cat.id"
          >
            {{ cat.name }}
          </button>
        </div>

        <div class="inventory-grid">
          <div 
            v-for="(entry, index) in displayItems" 
            :key="index"
            :class="['item-slot', entry.info?.rarity, { equipped: isEquipped(entry.item.itemId), selected: selectedIndex === index }]"
            @click="selectItem(entry, index)"
          >
            <span class="item-icon">{{ entry.info?.icon || '📦' }}</span>
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
              <div v-for="(value, stat) in selectedEntry.info.bonus" :key="stat" class="bonus-item">
                <span class="bonus-name">{{ getStatName(stat) }}</span>
                <span class="bonus-value">+{{ value }}</span>
              </div>
            </div>
            <div v-if="selectedEntry.info?.hpRestore" class="effect-info">
              <span>效果: 恢复{{ selectedEntry.info.hpRestore }}点生命值</span>
            </div>
            <div v-if="selectedEntry.info?.mpRestore" class="effect-info">
              <span>效果: 恢复{{ selectedEntry.info.mpRestore }}点法力值</span>
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
import { ref, computed, onMounted, onUnmounted } from 'vue';
import BasePopup from '../common/BasePopup.vue';
import ConfirmPopup from '../common/ConfirmPopup.vue';
import { inventoryService } from '@/modules/inventory';
import { useCharacterStore } from '@/modules/character';
import { equipmentService } from '@/modules/equipment/service';
import { eventBus, GameEvents } from '@/modules/bus/core';
import { useToast } from '@/composables/useToast';
import type { InventoryItem, Item, ItemType, ItemRarity } from '@/modules/inventory';
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
const toast = useToast();
const gold = computed(() => characterStore.gold);

const selectedCategory = ref<'all' | ItemType>('all');
const selectedEntry = ref<ItemEntry | null>(null);
const selectedIndex = ref<number>(-1);

// 丢弃确认弹窗状态
const showDropConfirm = ref(false);
const pendingDropItemId = ref<string | null>(null);

// 装备槽位选择弹窗状态
const showSlotSelect = ref(false);
const availableSlots = ref<EquipmentSlot[]>([]);
const pendingEquipItem = ref<EquipmentItem | null>(null);

const inventoryItems = ref<InventoryItem[]>([]);
const equippedItemIds = ref<Set<string>>(new Set());
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

function isEquipment(type?: ItemType) {
  return type === 'weapon' || type === 'armor';
}

function isEquipped(itemId: string) {
  return equippedItemIds.value.has(itemId);
}

const displayItems = computed<ItemEntry[]>(() => {
  return filteredItems.value.map(item => ({
    item,
    info: inventoryService.getItemInfo(item.itemId)
  }));
});

const filteredItems = computed(() => {
  if (selectedCategory.value === 'all') return inventoryItems.value;
  return inventoryItems.value.filter(item => {
    const info = inventoryService.getItemInfo(item.itemId);
    return info?.type === selectedCategory.value;
  });
});

const emptySlots = computed(() => {
  return Math.max(0, maxSlots - filteredItems.value.length);
});

function selectItem(entry: ItemEntry, index: number) {
  selectedEntry.value = entry;
  selectedIndex.value = index;
}

async function useItem(itemId: string) {
  const index = inventoryItems.value.findIndex(i => i.itemId === itemId);
  if (index === -1) return;

  const invItem = inventoryItems.value[index];
  const info = inventoryService.getItemInfo(itemId);
  if (!info?.consumable) return;

  // 使用物品（内部处理HP/MP恢复和堆叠数量递减）
  const success = await inventoryService.useItem(index);
  if (!success) return;

  if (info.hpRestore) {
    toast.show({ message: `使用 ${info.name}，恢复了 ${info.hpRestore} HP！`, type: 'success', icon: '💊' });
  } else if (info.mpRestore) {
    toast.show({ message: `使用 ${info.name}，恢复了 ${info.mpRestore} MP！`, type: 'success', icon: '💊' });
  } else {
    toast.show({ message: `使用了 ${info.name}`, type: 'success', icon: '💊' });
  }
  
  loadInventory();
  // 堆叠数归零时清除选中
  if (invItem.count <= 1) {
    selectedEntry.value = null;
    selectedIndex.value = -1;
  }
}

function equipItem(itemId: string) {
  // 获取装备模板
  const equipTemplate = equipmentService.getEquipmentTemplate(itemId);
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
  const success = await equipmentService.equipItem(slot, item);
  if (success) {
    // 从背包中移除该物品
    const index = inventoryItems.value.findIndex(i => i.itemId === item.id);
    if (index !== -1) {
      inventoryService.removeItem(index);
    }
    toast.show({ message: `已装备 ${item.name} 到 ${SLOT_NAMES[slot]}`, type: 'success', icon: '🛡️' });
    loadInventory();
    selectedEntry.value = null;
    selectedIndex.value = -1;
  } else {
    toast.show({ message: '装备失败，可能等级不足或槽位不匹配', type: 'warning' });
  }
  showSlotSelect.value = false;
  pendingEquipItem.value = null;
}

function selectEquipSlot(slot: EquipmentSlot) {
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
  pendingDropItemId.value = itemId;
  showDropConfirm.value = true;
}

function confirmDrop() {
  const itemId = pendingDropItemId.value;
  if (!itemId) return;
  
  const info = inventoryService.getItemInfo(itemId);
  const index = inventoryItems.value.findIndex(i => i.itemId === itemId);
  if (index !== -1) {
    inventoryService.removeItem(index);
    toast.show({ message: `已丢弃 ${info?.name || '物品'}`, type: 'info', icon: '🗑️' });
    loadInventory();
    selectedEntry.value = null;
    selectedIndex.value = -1;
  }
  
  showDropConfirm.value = false;
  pendingDropItemId.value = null;
}

function cancelDrop() {
  showDropConfirm.value = false;
  pendingDropItemId.value = null;
}

async function loadInventory() {
  await inventoryService.initialize();
  // 确保装备服务已初始化（装备模板需要从装备服务加载）
  await equipmentService.initialize();
  inventoryItems.value = inventoryService.getInventory();
  // 加载已装备物品ID
  const equipped = await inventoryService.getEquipment();
  equippedItemIds.value = new Set(equipped.map(e => e.item.id));
}

onMounted(() => {
  loadInventory();
  // 监听背包变化事件，实时刷新
  eventBus.onGroup('inventoryPopup', GameEvents.INVENTORY_CHANGE, () => {
    loadInventory();
  });
});

onUnmounted(() => {
  eventBus.clearGroup('inventoryPopup');
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
  border: 2px solid #4a4a4a;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
  position: relative;
}

.item-slot:hover {
  background: rgba(255, 255, 255, 0.1);
  transform: translateY(-2px);
}

.item-slot.empty {
  border-style: dashed;
  opacity: 0.3;
}

.item-slot.common { border-color: #ffffff; }
.item-slot.uncommon { border-color: #1eff00; }
.item-slot.rare { border-color: #0070dd; }
.item-slot.epic { border-color: #a335ee; }
.item-slot.legendary { 
  border-color: #ff8000;
  animation: legendary-glow 2s infinite;
}

.item-slot.equipped {
  border-color: #4CAF50;
  background: rgba(76, 175, 80, 0.2);
}

.item-slot.selected {
  background: rgba(255, 215, 0, 0.25);
}

@keyframes legendary-glow {
  0%, 100% { box-shadow: 0 0 5px #ff8000; }
  50% { box-shadow: 0 0 20px #ff8000; }
}

.item-icon {
  font-size: 22px;
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

.effect-info span {
  color: #4CAF50;
  font-size: 13px;
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
