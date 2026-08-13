<template>
  <BasePopup :visible="visible" title="背包" @close="$emit('close')">
    <template #header-extra>
      <div class="header-info">
        <div class="gold-display">
          <BaseIcon :name="COMMON_ICONS.gold" gradient="gold" :size="16" /> {{ gold }}
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
              <span>类型: {{ selectedEntry.info ? getItemDisplayName(selectedEntry.info) : '未知' }}</span>
              <span>数量: {{ selectedEntry.item.count }}</span>
              <span v-if="selectedEntry.info?.levelRequirement"
                >等级: {{ selectedEntry.info.levelRequirement }}</span
              >
            </div>
            <div v-if="selectedBonus.length" class="bonus-info">
              <div
                v-for="item in selectedBonus"
                :key="item.stat"
                class="bonus-item"
              >
                <span class="bonus-name">{{ getStatName(item.stat) }}</span>
                <span class="bonus-value">{{ item.value > 0 ? '+' : '' }}{{ item.value }}</span>
              </div>
            </div>
            <div v-if="selectedEffects.length" class="effect-list">
              <div v-for="(eff, i) in selectedEffects" :key="i" class="effect-info">
                <EffectTag :type="eff.type" />
                <span class="effect-value">{{ describeEffect(eff) }}</span>
              </div>
            </div>
            <div class="detail-actions">
              <button
                v-if="selectedEntry.info?.kind === 'consumable'"
                class="action-btn use"
                @click="useItem(selectedEntry.item.itemId)"
              >
                使用
              </button>
              <button
                v-if="selectedEntry.info?.kind === 'equipment'"
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
          <span class="slot-name">{{ SLOT_CONFIG[slot].name }}</span>
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
import { COMMON_ICONS } from '@/config/icons';
import { useInventoryStore } from '@/modules/inventory';
// P7-032 修复：缓存 store 引用，避免 computed 内重复 useInventoryStore() 调用
const inventoryStore = useInventoryStore();
import { useCharacterStore } from '@/modules/character';
import { useEquipmentStore } from '@/modules/equipment';
import { eventBus, GameEvents } from '@/modules/bus';
import { useToast } from '@/composables/useToast';
import { errorHandler } from '@/services/ErrorHandler';
import { useResponsiveGrid } from '@/composables/useResponsiveGrid';
import type {
  InventoryItem,
  Item,
  ItemEffect
} from '@/modules/inventory';
import type { Stats } from '@/modules/character';
import { SLOT_CONFIG, type EquipmentSlot, type EquipmentItem } from '@/modules/equipment';
import { getRarityName, describeEffect, getStatName } from '@/modules/item/descriptors';
import {
  getItemDisplayName,
  getItemCategory,
  CATEGORY_ORDER,
  CATEGORY_NAMES,
  type ItemCategory
} from '@/modules/item/typeRegistry';

interface ItemEntry {
  item: InventoryItem;
  info: Item | null;
}

// P3.1：槽位中文名直接复用 SLOT_CONFIG，避免重复维护 7 槽映射
// SLOT_CONFIG 定义于 slotRegistry.ts，包含 name/icon/group 三元数据

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

defineEmits<{
  (e: 'close'): void;
}>();

const characterStore = useCharacterStore();
const equipmentStore = useEquipmentStore();
const toast = useToast();
const gold = computed(() => characterStore.gold);

const selectedCategory = ref<'all' | ItemCategory>('all');
const selectedEntry = ref<ItemEntry | null>(null);

// 丢弃确认弹窗状态
const showDropConfirm = ref(false);
const pendingDropItemId = ref<string | null>(null);

// 装备槽位选择弹窗状态
const showSlotSelect = ref(false);
const availableSlots = ref<EquipmentSlot[]>([]);
const pendingEquipItem = ref<EquipmentItem | null>(null);

/** 直接从 Store 读取的响应式背包物品列表 */
const inventoryItems = computed(() => inventoryStore.inventory);

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

// P3.3：分类标签从 typeRegistry 的 CATEGORY_ORDER 派生（消耗品/装备/材料/其他），
// 替代旧版平铺 9 个 ItemType 的认知负担（plan.md U5）
const categories = [
  { id: 'all' as const, name: '全部' },
  ...CATEGORY_ORDER.map(cat => ({ id: cat, name: CATEGORY_NAMES[cat] }))
];

/** 使用物品时的 toast 文案（委托 describeEffect 统一效果描述） */
function getEffectToast(info: Item): string {
  // P3.3：消耗品用 effects[] 表达多效果，非消耗品无使用效果
  if (info.kind === 'consumable' && info.effects.length > 0) {
    return info.effects.map(describeEffect).join('，');
  }
  return `使用了 ${info.name}`;
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

/** 根据槽位返回对应的图标名称（P3.1：复用 SLOT_CONFIG，替代旧版 startsWith 硬编码） */
function getSlotIcon(slot: EquipmentSlot): string {
  return SLOT_CONFIG[slot].icon;
}

const filteredItems = computed(() => {
  if (selectedCategory.value === 'all') return inventoryItems.value;
  // P3.3：用 getItemCategory（基于 kind+subtype）替代旧 info?.type 比较
  return inventoryItems.value.filter((item) => {
    const info = inventoryStore.getItemInfo(item.itemId);
    return info !== null && getItemCategory(info) === selectedCategory.value;
  });
});

const displayItems = computed<ItemEntry[]>(() => {
  return filteredItems.value.map((item) => ({
    item,
    info: inventoryStore.getItemInfo(item.itemId)
  }));
});

/**
 * 选中装备的属性加成列表（仅装备类物品有 bonus）
 * P3.3：bonus 下沉为 EquipmentItem 专有字段，需 kind 收窄后访问。
 * 按固定属性顺序输出非零项，支持负值显示。
 */
const selectedBonus = computed<Array<{ stat: keyof Stats; value: number }>>(() => {
  const info = selectedEntry.value?.info;
  if (!info || info.kind !== 'equipment') return [];
  return (Object.keys(info.bonus) as (keyof Stats)[])
    .filter(stat => {
      const v = info.bonus[stat];
      return v !== undefined && v !== 0;
    })
    .map(stat => ({ stat, value: info.bonus[stat] as number }));
});

/**
 * 选中物品的使用效果列表
 * P3.3：消耗品 effects 为必填数组，装备 effects 为可选（被动效果），其余类别无效果。
 */
const selectedEffects = computed<ItemEffect[]>(() => {
  const info = selectedEntry.value?.info;
  if (!info) return [];
  if (info.kind === 'consumable') return info.effects;
  if (info.kind === 'equipment') return info.effects ?? [];
  return [];
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
  selectedCategory.value = catId as 'all' | ItemCategory;
  // P12-022 修复：切换分类时清除已选中物品详情，避免操作不可见物品
  selectedEntry.value = null;
}

/**
 * 整理背包：自动堆叠相同物品并按品质、分类排序
 */
async function doOrganize() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'inventory_organize' });
  // P11-601 修复：await organizeInventory 完成后再 loadInventory，避免竞态条件
  await inventoryStore.organizeInventory();
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

  const info = inventoryStore.getItemInfo(itemId);
  // P3.3：consumable 下沉为判别字面量，用 kind 收窄替代旧 info.consumable 布尔
  if (!info || info.kind !== 'consumable') return;

  // 使用物品（内部处理HP/MP恢复和堆叠数量递减）
  const success = await inventoryStore.useItemByIndex(index);
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

  await loadInventory();
  // P10-028 修复：基于使用后的新数量判断是否清除选中，而非使用前旧的 invItem.count
  const updatedItem = inventoryItems.value.find(i => i.itemId === itemId);
  if (!updatedItem || updatedItem.count <= 0) {
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

  // P3.2：过滤掉被双手武器锁定的槽位（weapon1 双手时 weapon2 不可选）
  const usableSlots = slots.filter(slot => !equipmentStore.isSlotLocked(slot));
  if (usableSlots.length === 0) {
    toast.show({ message: '副手槽被双手武器占用，无法装备', type: 'warning' });
    return;
  }

  // 如果只有一个可用槽位，直接装备
  if (usableSlots.length === 1) {
    doEquip(equipTemplate, usableSlots[0]);
    return;
  }

  // 多个可用槽位时，弹出选择框
  pendingEquipItem.value = equipTemplate;
  availableSlots.value = usableSlots;
  showSlotSelect.value = true;
}

async function doEquip(item: EquipmentItem, slot: EquipmentSlot) {
  // P11-602 修复：用 try/finally 确保弹窗状态始终被清理
  try {
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
        message: `已装备 ${item.name} 到 ${SLOT_CONFIG[slot].name}`,
        type: 'success',
        icon: '🛡️'
      });
      await loadInventory();
      selectedEntry.value = null;
    } else {
      toast.show({
        message: '装备失败，可能等级不足或槽位不匹配',
        type: 'warning'
      });
    }
  } finally {
    showSlotSelect.value = false;
    pendingEquipItem.value = null;
  }
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

async function confirmDrop() {
  const itemId = pendingDropItemId.value;
  if (!itemId) return;

  const info = inventoryStore.getItemInfo(itemId);
  // 优先丢弃选中的那一组
  const index = findSelectedOrFirstIndex(itemId);
  if (index !== -1) {
    // P11-601 修复：await removeItemByIndex 完成后再 loadInventory，避免竞态条件
    await inventoryStore.removeItemByIndex(index);
    eventBus.emit(GameEvents.ITEM_DROPPED, { itemId });
    toast.show({
      message: `已丢弃 ${info?.name || '物品'}`,
      type: 'info',
      icon: '🗑️'
    });
    await loadInventory();
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
  // P8-029 修复：try/catch 包裹，catch 中 errorHandler.report + toast 提示
  try {
    const id = characterStore.currentCharacterId;
    if (!id) return;
    await inventoryStore.initialize(id);
    // 确保装备 Store 已初始化（装备模块需要从装备 Store 加载）
    await equipmentStore.initialize(id);
  } catch (e) {
    console.error('[InventoryPopup] loadInventory 失败:', e);
    errorHandler.report(e);
    toast.show({ message: '加载背包数据失败，请重试', type: 'danger' });
  }
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
  .custom-scrollbar();
  &::-webkit-scrollbar-thumb:hover {
    background: @color-dim-gray;
  }
}

/* RecycleScroller gridItems 模式下，每个条目 wrapper 由组件设置宽高，
   此处添加 padding 制造视觉间距（等效原 gap: @spacing-sm） */
.inventory-scroller :deep(.vue-recycle-scroller__item-view) {
  padding: 3px;
  box-sizing: border-box;
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

/* P3.3：多效果列表容器，每个效果一行 */
.effect-list {
  .flex-col();
  gap: @spacing-xs;
  margin-bottom: @spacing-md;
}

.effect-info {
  display: flex;
  align-items: center;
  gap: @spacing-md;
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
  .action-btn-base();
  padding: @spacing-md 14px;
  border: none;
  border-radius: @radius-sm;
  font-size: @font-base;
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
