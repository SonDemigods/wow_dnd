<template>
  <BasePopup :visible="visible" title="背包" @close="$emit('close')">
    <template #header-extra>
      <div class="header-info">
        <div class="gold-display">
          <BaseIcon name="two-coins" gradient="gold" :size="16" /> {{ gold }}
        </div>
        <div class="inventory-count">
          {{ inventoryItems.length }} / {{ maxSlots }}
        </div>
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

        <div ref="gridContainerRef" class="inventory-grid">
          <RecycleScroller
            :items="gridData"
            :item-size="itemSize"
            :grid-items="gridItems"
            :item-secondary-size="itemSize"
            key-field="id"
            class="inventory-scroller"
          >
            <template #default="{ item }">
              <div
                v-if="item.type === 'item'"
                :data-item-id="item.entry.item.itemId"
                :class="[
                  'item-slot',
                  item.entry.info?.rarity,
                  {
                    equipped: isEquipped(item.entry.item.itemId),
                    selected: selectedEntry?.item === item.entry.item
                  }
                ]"
                @click="selectItem(item.entry)"
              >
                <ItemIcon
                  :icon="item.entry.info?.icon"
                  :rarity="item.entry.info?.rarity"
                  size="sm"
                />
                <span v-if="item.entry.item.count > 1" class="item-count">{{
                  item.entry.item.count
                }}</span>
              </div>
              <div v-else class="item-slot empty"></div>
            </template>
          </RecycleScroller>
        </div>

        <div class="item-detail">
          <template v-if="selectedEntry">
            <div class="detail-header">
              <h3 :class="selectedEntry.info?.rarity">
                {{ selectedEntry.info?.name }}
              </h3>
              <span class="quality-badge">{{
                getRarityName(selectedEntry.info?.rarity || 'common')
              }}</span>
            </div>
            <p class="detail-desc">{{ selectedEntry.info?.description }}</p>
            <div class="detail-info">
              <span
                >类型:
                {{ getTypeName(selectedEntry.info?.type || 'misc') }}</span
              >
              <span>数量: {{ selectedEntry.item.count }}</span>
              <span v-if="selectedEntry.info?.levelRequirement"
                >等级: {{ selectedEntry.info.levelRequirement }}</span
              >
            </div>
            <div v-if="selectedEntry.info?.bonus" class="bonus-info">
              <div
                v-for="(value, stat) in selectedEntry.info?.bonus"
                :key="stat"
                class="bonus-item"
              >
                <span class="bonus-name">{{ getStatName(stat) }}</span>
                <span class="bonus-value">+{{ value }}</span>
              </div>
            </div>
            <div v-if="selectedEntry.info?.effect" class="effect-info">
              <EffectTag :type="selectedEntry.info.effect.type" />
              <span class="effect-value">{{
                getEffectValueText(selectedEntry.info.effect)
              }}</span>
            </div>
            <div class="detail-actions">
              <button
                v-if="selectedEntry.info?.consumable"
                class="action-btn use"
                @click="useItem(selectedEntry.item.itemId)"
              >
                使用
              </button>
              <button
                v-if="isEquipment(selectedEntry.info?.type)"
                class="action-btn equip"
                @click="equipItem(selectedEntry.item.itemId)"
              >
                {{ isEquipped(selectedEntry.item.itemId) ? '卸下' : '装备' }}
              </button>
              <button
                class="action-btn drop"
                @click="dropItem(selectedEntry.item.itemId)"
              >
                丢弃
              </button>
            </div>
          </template>
          <EmptyState v-else icon="backpack" text="点击物品查看详情" />
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
  <BasePopup
    :visible="showSlotSelect"
    title="选择装备位置"
    max-width="360px"
    @close="cancelSlotSelect"
  >
    <div class="slot-select-content">
      <p class="slot-select-hint">
        为 {{ pendingEquipItem?.name }} 选择装备位置：
      </p>
      <div class="slot-options">
        <button
          v-for="slot in availableSlots"
          :key="slot"
          class="slot-option-btn"
          @click="selectEquipSlot(slot)"
        >
          <span class="slot-icon"
            ><BaseIcon :name="getSlotIcon(slot)" gradient="metal" :size="18"
          /></span>
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

import { ref, computed, onMounted, onUnmounted } from 'vue';
import { RecycleScroller } from 'vue-virtual-scroller';
import BasePopup from '../common/BasePopup.vue';
import ConfirmPopup from '../common/ConfirmPopup.vue';
import ItemIcon from '../common/ItemIcon.vue';
import EffectTag from '../common/EffectTag.vue';
import EmptyState from '@/components/common/EmptyState.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import { useInventoryStore } from '@/modules/inventory';
import { useCharacterStore } from '@/modules/character';
import { useEquipmentStore } from '@/modules/equipment';
import { eventBus, GameEvents } from '@/modules/bus';
import { useToast } from '@/composables/useToast';
import { useResponsiveGrid } from '@/composables/useResponsiveGrid';
import type {
  InventoryItem,
  Item,
  ItemType,
  ItemRarity,
  ItemEffect
} from '@/modules/inventory';
import type { EquipmentSlot, EquipmentItem } from '@/modules/equipment';

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

// P2 BIZ-9 修复：跟踪待清理的 animationend 监听器，弹窗卸载时主动移除
// 避免 { once: true } 在动画未触发时残留（如弹窗快速关闭）
const pendingAnimCleanup: Array<{ el: HTMLElement; handler: EventListenerOrEventListenerObject }> = [];

/** 注册一次性 animationend 监听器并加入清理队列 */
function registerAnimCleanup(el: HTMLElement, handler: () => void): void {
  pendingAnimCleanup.push({ el, handler });
  el.addEventListener('animationend', handler, { once: true });
}

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
  Object.values(equipmentStore.equipment).forEach((e) => {
    if (e) ids.add(e.item.id);
  });
  return ids;
});
const maxSlots = 50;

/** 虚拟网格容器 ref，供 useResponsiveGrid 测量宽度计算列数 */
const gridContainerRef = ref<HTMLElement | null>(null);
const { gridItems, itemSize } = useResponsiveGrid(gridContainerRef, 48, 6);

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
    case 'health_restore':
      return `恢复 ${value} 点`;
    case 'mana_restore':
      return `恢复 ${value} 点`;
    case 'physical_damage':
      return `伤害 ${value}`;
    case 'magic_damage':
      return `伤害 ${value}`;
    default:
      return `${value}`;
  }
}

function getEffectToast(info: Item): string {
  if (!info.effect) return `使用了 ${info.name}`;
  const { type, value } = info.effect;
  switch (type) {
    case 'health_restore':
      return `恢复了 ${value} 点生命值`;
    case 'mana_restore':
      return `恢复了 ${value} 点法力值`;
    case 'physical_damage':
    case 'magic_damage':
      return `造成了 ${value} 点伤害`;
    default:
      return `使用了 ${info.name}`;
  }
}

function isEquipment(type?: ItemType) {
  return type === 'weapon' || type === 'armor';
}

function isEquipped(itemId: string): boolean {
  if (!equippedItemIds.value.has(itemId)) return false;
  // 如果背包中仍有该物品的副本，说明存在未被装备的实例，不应显示为"已装备"
  // （所有副本都已装备时，物品不会出现在背包网格中，equipped 样式不会误显示）
  const stillInInventory = inventoryItems.value.some(
    (i) => i.itemId === itemId
  );
  return !stillInInventory;
}

/** 根据槽位名称返回对应的图标名称 */
function getSlotIcon(slot: string) {
  return slot.startsWith('weapon') ? 'broadsword' : 'checked-shield';
}

const filteredItems = computed(() => {
  if (selectedCategory.value === 'all') return inventoryItems.value;
  return inventoryItems.value.filter((item) => {
    const info = useInventoryStore().getItemInfo(item.itemId);
    return info?.type === selectedCategory.value;
  });
});

const displayItems = computed<ItemEntry[]>(() => {
  return filteredItems.value.map((item) => ({
    item,
    info: useInventoryStore().getItemInfo(item.itemId)
  }));
});

const emptySlots = computed(() => {
  return Math.max(0, maxSlots - filteredItems.value.length);
});

/** RecycleScroller 渲染数据：合并物品槽位与空槽位，每个条目带唯一 id 供 keyField 使用 */
const gridData = computed(() => {
  const items = displayItems.value.map((entry, idx) => ({
    id: `item-${entry.item.itemId}-${idx}`,
    type: 'item' as const,
    entry,
  }));
  const empties = Array.from({ length: emptySlots.value }, (_, i) => ({
    id: `empty-${i}`,
    type: 'empty' as const,
  }));
  return [...items, ...empties];
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
    const idx = inventoryItems.value.findIndex(
      (i) =>
        i.itemId === itemId &&
        selectedEntry.value &&
        i === selectedEntry.value.item
    );
    if (idx >= 0) return idx;
  }
  return inventoryItems.value.findIndex((i) => i.itemId === itemId);
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
  // P3 TS-13 修复：使用 instanceof 守卫收窄 HTMLElement 类型，替代 as 断言
  const slotElRaw = document.querySelector(`[data-item-id="${itemId}"]`);
  if (slotElRaw instanceof HTMLElement) {
    slotElRaw.style.animation = 'item-bounce 0.4s ease';
    // P2 BIZ-9 修复：使用 registerAnimCleanup 跟踪监听器，弹窗卸载时主动清理
    registerAnimCleanup(slotElRaw, () => {
      slotElRaw.style.animation = '';
    });
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
    // P3 TS-13 修复：使用 instanceof 守卫收窄 HTMLElement 类型，替代 as 断言
    const slotElRaw = document.querySelector(`[data-equip-slot="${slot}"]`);
    if (slotElRaw instanceof HTMLElement) {
      slotElRaw.classList.add('equip-anim-fill');
      // P2 BIZ-9 修复：使用 registerAnimCleanup 跟踪监听器，弹窗卸载时主动清理
      registerAnimCleanup(slotElRaw, () => {
        slotElRaw.classList.remove('equip-anim-fill');
      });
    }
    toast.show({
      message: `已装备 ${item.name} 到 ${SLOT_NAMES[slot]}`,
      type: 'success',
      icon: '🛡️'
    });
    loadInventory();
    selectedEntry.value = null;
  } else {
    toast.show({
      message: '装备失败，可能等级不足或槽位不匹配',
      type: 'warning'
    });
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
    toast.show({
      message: `已丢弃 ${info?.name || '物品'}`,
      type: 'info',
      icon: '🗑️'
    });
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
  const id = characterStore.currentCharacterId;
  if (!id) return;
  await useInventoryStore().initialize(id);
  // 确保装备 Store 已初始化（装备模块需要从装备 Store 加载）
  await equipmentStore.initialize(id);
}

onMounted(() => {
  loadInventory();
});

// P2 BIZ-9 修复：弹窗卸载时主动清理未触发的 animationend 监听器
onUnmounted(() => {
  pendingAnimCleanup.forEach(({ el, handler }) => {
    el.removeEventListener('animationend', handler);
  });
  pendingAnimCleanup.length = 0;
});
</script>

<style lang="less" scoped>
.inventory-content {
  .flex-col();
  height: 100%;
  gap: 14px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: @spacing-xl;
}

.gold-display {
  padding: @spacing-xs 10px;
  background: @gold-bg-hover;
  border: @border-gold;
  border-radius: @radius-sm;
  color: @accent-color;
  font-size: @font-base;
  font-weight: @font-weight-bold;
}

.inventory-count {
  padding: @spacing-xs 10px;
  background: @white-10;
  border-radius: @radius-sm;
  color: @color-dodge;
  font-size: @font-sm;
}

.inventory-content {
  .flex-col();
  height: 100%;
  gap: 14px;
}

.category-tabs {
  display: flex;
  gap: @spacing-sm;
  flex-wrap: wrap;
  flex-shrink: 0;
}

.tab-btn {
  padding: @spacing-sm 14px;
  background: @white-05;
  border: @border-sm;
  border-radius: @radius-sm;
  color: @color-dodge;
  font-size: @font-base;
  cursor: pointer;
  transition: all @transition-normal;
}

.tab-btn:hover {
  border-color: @color-dim-gray;
}

.tab-btn.active {
  background: rgba(0, 153, 255, 0.2);
  border-color: @skill-blue;
  color: @skill-blue;
}

.inventory-grid {
  background: @overlay-mid;
  padding: @spacing-lg;
  border-radius: @radius-md;
  border: @border-card;
  flex: 1;
  min-height: 0;
}

.inventory-scroller {
  max-height: 280px;
}

/* RecycleScroller gridItems 模式下，每个条目 wrapper 由组件设置宽高，
   此处添加 padding 制造视觉间距（等效原 gap: @spacing-sm） */
.inventory-scroller :deep(.vue-recycle-scroller__item-view) {
  padding: 3px;
  box-sizing: border-box;
}

.inventory-scroller::-webkit-scrollbar {
  width: 6px;
}

.inventory-scroller::-webkit-scrollbar-track {
  background: @overlay-light;
  border-radius: @radius-xs;
}

.inventory-scroller::-webkit-scrollbar-thumb {
  background: @popup-border-color;
  border-radius: @radius-xs;
}

.inventory-scroller::-webkit-scrollbar-thumb:hover {
  background: @color-dim-gray;
}

.item-slot {
  width: 100%;
  height: 100%;
  background: @white-05;
  border-radius: @radius-sm;
  .flex-center();
  cursor: pointer;
  transition: all @transition-normal;
  position: relative;
  box-sizing: border-box;
  /* 物品入场动画 */
  animation: scaleIn 0.25s ease;
}

.item-slot:hover {
  background: @white-10;
  transform: translateY(-2px);
}

.item-slot.empty {
  border: @border-dashed;
  opacity: 0.3;
}

.item-slot.equipped {
  outline: 2px solid @heal-hp;
  outline-offset: -2px;
  background: rgba(76, 175, 80, 0.2);
}

.item-slot.selected {
  background: @gold-bg-strong;
}

.item-count {
  position: absolute;
  bottom: 2px;
  right: 3px;
  font-size: @font-2xs;
  color: @popup-text-color;
  font-weight: @font-weight-bold;
  text-shadow: 1px 1px 2px @overlay-heavy;
}

.item-detail {
  background: @overlay-deep;
  border-radius: @radius-md;
  padding: 14px;
  border: @border-sm;
  flex-shrink: 0;
}

.detail-header {
  .flex-between();
  margin-bottom: @spacing-md;
}

.item-detail h3 {
  font-size: @font-lg;
  color: @popup-text-color;
  font-weight: @font-weight-bold;
  margin: 0;
}

.item-detail h3.common {
  color: @popup-text-color;
}
.item-detail h3.uncommon {
  color: #1eff00;
}
.item-detail h3.rare {
  color: #0070dd;
}
.item-detail h3.epic {
  color: #a335ee;
}
.item-detail h3.legendary {
  color: #ff8000;
}

.quality-badge {
  padding: 3px @spacing-md;
  background: @white-10;
  border-radius: @radius-sm;
  color: @color-dodge;
  font-size: @font-sm;
}

.detail-desc {
  color: #aaa;
  font-size: @font-base;
  margin: @spacing-md 0;
}

.detail-info {
  display: flex;
  gap: @spacing-xl;
  margin-bottom: @spacing-md;
}

.detail-info span {
  padding: @spacing-xs @spacing-md;
  background: @white-10;
  border-radius: @radius-sm;
  color: @color-dodge;
  font-size: @font-base;
}

.bonus-info {
  .flex-col();
  gap: @spacing-xs;
  margin-bottom: @spacing-md;
}

.bonus-item {
  .flex-between();
  padding: @spacing-xs @spacing-md;
  background: @green-bg;
  border-radius: @radius-sm;
}

.bonus-name {
  color: @text-secondary;
  font-size: @font-base;
}

.bonus-value {
  color: @heal-hp;
  font-size: @font-base;
  font-weight: @font-weight-bold;
}

.effect-info {
  display: flex;
  align-items: center;
  gap: @spacing-md;
  margin-bottom: @spacing-md;
}

.effect-info .effect-value {
  color: @accent-color;
  font-size: @font-base;
  font-weight: @font-weight-bold;
}

.detail-actions {
  display: flex;
  gap: @spacing-lg;
  margin-top: 14px;
}

.action-btn {
  padding: @spacing-md 14px;
  border: none;
  border-radius: @radius-sm;
  font-size: @font-base;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-normal;
}

.action-btn.use {
  background: linear-gradient(135deg, @heal-hp, #45a049);
  color: @popup-text-color;
}

.action-btn.equip {
  background: linear-gradient(135deg, @skill-blue, #0066cc);
  color: @popup-text-color;
}

.action-btn.drop {
  background: linear-gradient(135deg, #ff4444, #cc0000);
  color: @popup-text-color;
}

.action-btn:hover {
  transform: translateY(-2px);
}

.slot-select-content {
  .flex-col();
  gap: 14px;
  align-items: center;
}

.slot-select-hint {
  color: #aaa;
  font-size: @font-md;
  margin: 0;
}

.slot-options {
  .flex-col();
  gap: @spacing-md;
  width: 100%;
}

.slot-option-btn {
  display: flex;
  align-items: center;
  gap: @spacing-lg;
  padding: @spacing-lg @spacing-3xl;
  background: @white-05;
  border: @border-sm;
  border-radius: @radius-md;
  color: #ccc;
  font-size: @font-md;
  cursor: pointer;
  transition: all @transition-quick;
}

.slot-option-btn:hover {
  background: rgba(0, 153, 255, 0.15);
  border-color: @skill-blue;
  color: @popup-text-color;
}

.slot-icon {
  font-size: @font-xl;
}

.slot-name {
  font-weight: @font-weight-bold;
}
</style>
