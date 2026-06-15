<template>
  <BasePopup :visible="visible" :title="shopName || '商店'" @close="$emit('close')">
    <template #header-extra>
      <div class="header-info">
        <span class="gold-display">💰 {{ gold }}</span>
      </div>
    </template>

    <template #default>
      <div class="shop-content">
        <!-- 买卖标签 -->
        <div class="shop-tabs">
          <button
            :class="['tab-btn', { active: currentTab === 'buy' }]"
          @click="switchTab('buy')"
          >
            购买
          </button>
          <button
            :class="['tab-btn', { active: currentTab === 'sell' }]"
          @click="switchTab('sell')"
          >
            出售
          </button>
        </div>

        <!-- 分类筛选 -->
        <div class="category-tabs">
          <button
            v-for="cat in categories"
            :key="cat.id"
            :class="['cat-btn', { active: selectedCategory === cat.id }]"
            @click="selectShopCategory(cat.id)"
          >
            {{ cat.name }}
          </button>
        </div>

        <!-- 购买标签：商店物品列表 -->
        <div v-if="currentTab === 'buy'" class="item-list">
          <div
            v-for="(entry, index) in displayShopItems"
            :key="entry.id"
            :class="['item-card', entry.quality, { selected: buySelectedIndex === index }]"
            @click="selectBuyItem(entry, index)"
          >
            <div class="card-icon">{{ getItemIcon(entry.icon) }}</div>
            <div class="card-info">
              <div class="card-name">{{ entry.name }}</div>
              <div class="card-desc">{{ entry.description }}</div>
              <div v-if="entry.quantity > 0" class="card-quantity">库存: {{ entry.quantity }}</div>
            </div>
            <div class="card-price">💰 {{ entry.price }}</div>
          </div>
        </div>

        <!-- 出售标签：背包物品列表 -->
        <div v-else class="item-list">
          <div
            v-for="(entry, index) in displaySellItems"
            :key="index"
            :class="['item-card', entry.info?.rarity, { selected: sellSelectedIndex === index }]"
            @click="selectSellItem(entry, index)"
          >
            <div class="card-icon">{{ getItemIcon(entry.info?.icon || '') }}</div>
            <div class="card-info">
              <div class="card-name">{{ entry.info?.name }}</div>
              <div class="card-desc">{{ entry.info?.description }}</div>
              <div class="card-count">数量: {{ entry.item.count }}</div>
            </div>
            <div class="card-price">💰 {{ getSellPrice(entry.item.itemId) }}</div>
          </div>
        </div>

        <!-- 物品详情面板 -->
        <div class="item-detail">
          <!-- 购买详情 -->
          <template v-if="currentTab === 'buy' && selectedBuyEntry">
            <div class="detail-header">
              <h3 :class="selectedBuyEntry.quality">{{ selectedBuyEntry.name }}</h3>
              <span class="quality-badge">{{ getRarityName(selectedBuyEntry.quality) }}</span>
            </div>
            <p class="detail-desc">{{ selectedBuyEntry.description }}</p>
            <div class="detail-info">
              <span>类型: {{ getTypeName(selectedBuyEntry.type) }}</span>
              <span>单价: 💰 {{ selectedBuyEntry.price }}</span>
            </div>
            <div v-if="selectedBuyEntry.effect" class="effect-info">
              <span>{{ getEffectText(selectedBuyEntry.effect) }}</span>
            </div>
            <div class="detail-actions">
              <div class="quantity-selector">
                <button class="qty-btn" :disabled="buyQuantity <= 1" @click="decBuyQty">−</button>
                <input
                  type="number"
                  class="qty-input"
                  v-model.number="buyQuantity"
                  :min="1"
                  :max="buyMaxQuantity"
                  @change="clampBuyQuantity"
                />
                <button class="qty-btn" :disabled="buyQuantity >= buyMaxQuantity" @click="incBuyQty">+</button>
              </div>
              <button
                class="action-btn buy"
                :disabled="!canAffordBuy()"
                @click="handleBuy(selectedBuyEntry.itemId)"
              >
                💰 购买 ×{{ buyQuantity }}（{{ totalBuyPrice }}）
              </button>
            </div>
          </template>

          <!-- 出售详情 -->
          <template v-else-if="currentTab === 'sell' && selectedSellEntry">
            <div class="detail-header">
              <h3 :class="selectedSellEntry.info?.rarity">{{ selectedSellEntry.info?.name }}</h3>
              <span class="quality-badge">{{ getRarityName(selectedSellEntry.info?.rarity || 'common') }}</span>
            </div>
            <p class="detail-desc">{{ selectedSellEntry.info?.description }}</p>
            <div class="detail-info">
              <span>类型: {{ getTypeName(selectedSellEntry.info?.type || 'misc') }}</span>
              <span>持有: {{ selectedSellEntry.item.count }}</span>
              <span>单价: 💰 {{ getSellPrice(selectedSellEntry.item.itemId) }}</span>
            </div>
            <div v-if="selectedSellEntry.info?.effect" class="effect-info">
              <span>{{ getEffectText(selectedSellEntry.info.effect) }}</span>
            </div>
            <div class="detail-actions">
              <div class="quantity-selector">
                <button class="qty-btn" :disabled="sellQuantity <= 1" @click="decSellQty">−</button>
                <input
                  type="number"
                  class="qty-input"
                  v-model.number="sellQuantity"
                  :min="1"
                  :max="selectedSellEntry.item.count"
                  @change="clampSellQuantity"
                />
                <button class="qty-btn" :disabled="sellQuantity >= selectedSellEntry.item.count" @click="incSellQty">+</button>
              </div>
              <button
                class="action-btn sell"
                :disabled="selectedSellEntry.item.count <= 0"
                @click="handleSell(selectedSellEntry.item.itemId)"
              >
                💰 出售 ×{{ sellQuantity }}（{{ totalSellPrice }}）
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
</template>

<script setup lang="ts">
/**
 * @fileoverview 商店弹窗组件
 * @description 提供购买和出售两个标签页的商品交易界面，支持按分类筛选物品，以列表形式展示。
 */

import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useShopStore } from '@/modules/shop';
import { useCharacterStore } from '@/modules/character';
import { useInventoryStore } from '@/modules/inventory';
import { eventBus, GameEvents } from '@/modules/bus/core';
import type { ShopDisplayItem, ItemQuality, ItemCategory } from '@/modules/shop';
import type { InventoryItem, Item, ItemType, ItemRarity, ItemEffect } from '@/modules/inventory';
import BasePopup from '../common/BasePopup.vue';

/** 出售标签的物品条目（关联背包数据和物品模板） */
interface SellItemEntry {
  item: InventoryItem;
  info: Item | null;
}

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const shopStore = useShopStore();
const characterStore = useCharacterStore();
const inventoryStore = useInventoryStore();

// ==================== 状态 ====================

const currentTab = ref<'buy' | 'sell'>('buy');

function switchTab(tab: 'buy' | 'sell') {
  currentTab.value = tab;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_tab' });
}
const selectedCategory = ref<'all' | ItemType>('all');

// 购买标签选中
const selectedBuyEntry = ref<ShopDisplayItem | null>(null);
const buySelectedIndex = ref<number>(-1);

// 出售标签选中
const selectedSellEntry = ref<SellItemEntry | null>(null);
const sellSelectedIndex = ref<number>(-1);

// 数量选择
const buyQuantity = ref(1);
const sellQuantity = ref(1);

const currentShopId = computed(() => shopStore.currentShopId || '');

/** 商店名称，直接从 Shop Store 响应式数据派生 */
const shopName = computed(() => {
  const config = shopStore.getShopConfig(currentShopId.value);
  return config?.name || '商店';
});

const gold = computed(() => characterStore.gold);

// ==================== 分类 ====================

/** 分类选项（与背包界面保持一致，使用 ItemType） */
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

// ==================== 图标/名称映射 ====================

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

// ==================== 工具函数 ====================

/** 物品模板中 icon 字段已直接存储 emoji（如 ❤️、🍞），直接返回即可 */
function getItemIcon(icon: string) {
  return icon || '📦';
}

function getRarityName(rarity: ItemRarity | ItemQuality) {
  return rarityNames[rarity] || rarity;
}

function getTypeName(type: ItemType | string) {
  return typeNames[type as ItemType] || type;
}

function getEffectText(effect: ItemEffect | { type: string; value: number | Partial<Record<string, number>> }) {
  if (!effect) return '';
  if (effect.type === 'health_restore') return `恢复 ${effect.value} 点生命值`;
  if (effect.type === 'mana_restore') return `恢复 ${effect.value} 点法力值`;
  if (effect.type === 'physical_damage') return `造成 ${effect.value} 点物理伤害`;
  if (effect.type === 'magic_damage') return `造成 ${effect.value} 点魔法伤害`;
  if (effect.type === 'stat') return '提升属性';
  return '';
}

function getSellPrice(itemId: string) {
  const itemInfo = inventoryStore.getItemInfo(itemId);
  if (!itemInfo) return 0;
  return shopStore.calculateSellPrice(itemId);
}

/** 购买最大数量（受金币和回购剩余数量限制） */
const buyMaxQuantity = computed(() => {
  if (!selectedBuyEntry.value || selectedBuyEntry.value.price <= 0) return 1;
  const byGold = Math.floor(gold.value / selectedBuyEntry.value.price);
  const byStock = selectedBuyEntry.value.quantity;
  return Math.max(1, Math.min(byGold, byStock));
});

/** 购买总价 */
const totalBuyPrice = computed(() => {
  if (!selectedBuyEntry.value) return 0;
  return selectedBuyEntry.value.price * buyQuantity.value;
});

/** 出售总价 */
const totalSellPrice = computed(() => {
  if (!selectedSellEntry.value) return 0;
  return getSellPrice(selectedSellEntry.value.item.itemId) * sellQuantity.value;
});

function canAffordBuy() {
  if (!selectedBuyEntry.value) return false;
  return gold.value >= selectedBuyEntry.value.price * buyQuantity.value;
}

function clampBuyQuantity() {
  buyQuantity.value = Math.max(1, Math.min(buyQuantity.value || 1, buyMaxQuantity.value));
}

function clampSellQuantity() {
  if (!selectedSellEntry.value) return;
  sellQuantity.value = Math.max(1, Math.min(sellQuantity.value || 1, selectedSellEntry.value.item.count));
}

// 分类切换
function selectShopCategory(catId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_category' });
  selectedCategory.value = catId as 'all' | ItemType;
}

// 数量加减按钮
function decBuyQty() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_qty_dec' });
  buyQuantity.value--;
}
function incBuyQty() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_qty_inc' });
  buyQuantity.value++;
}
function decSellQty() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_qty_dec' });
  sellQuantity.value--;
}
function incSellQty() {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_qty_inc' });
  sellQuantity.value++;
}

// ==================== 购买标签：筛选后的商店物品（直接从 store 读取并富化） ====================

/**
 * 将 store 的 ShopItem[] 富化为 ShopDisplayItem[]（注入物品模板信息），并按分类筛选
 * 库存为 0 的商品已在 service 层被过滤，此处不再展示
 */
const displayShopItems = computed<ShopDisplayItem[]>(() => {
  const enriched = shopStore.currentItems.map(shopItem => {
    const itemInfo = inventoryStore.getItemInfo(shopItem.itemId);
    if (!itemInfo) return null;
    return {
      id: itemInfo.id,
      itemId: shopItem.itemId,
      name: itemInfo.name,
      type: itemInfo.type as ItemCategory,
      quality: itemInfo.rarity as ItemQuality,
      icon: itemInfo.icon,
      description: itemInfo.description,
      price: shopItem.price,
      quantity: shopItem.quantity,
      category: itemInfo.type as ItemCategory,
      effect: itemInfo.effect
    } as ShopDisplayItem;
  }).filter(Boolean) as ShopDisplayItem[];

  if (selectedCategory.value === 'all') return enriched;
  return enriched.filter(item => {
    const info = inventoryStore.getItemInfo(item.itemId);
    return info?.type === selectedCategory.value;
  });
});

// ==================== 出售标签：筛选后的背包物品（直接从 inventoryStore 读取） ====================

const displaySellItems = computed<SellItemEntry[]>(() => {
  const invItems = inventoryStore.inventory;
  const filtered = selectedCategory.value === 'all'
    ? invItems
    : invItems.filter(item => {
        const info = inventoryStore.getItemInfo(item.itemId);
        return info?.type === selectedCategory.value;
      });
  return filtered.map(item => ({
    item,
    info: inventoryStore.getItemInfo(item.itemId)
  }));
});

// ==================== 选择物品 ====================

function selectBuyItem(entry: ShopDisplayItem, index: number) {
  selectedBuyEntry.value = entry;
  buySelectedIndex.value = index;
  buyQuantity.value = 1;
  // 切换标签时清除另一边选中
  selectedSellEntry.value = null;
  sellSelectedIndex.value = -1;
}

function selectSellItem(entry: SellItemEntry, index: number) {
  selectedSellEntry.value = entry;
  sellSelectedIndex.value = index;
  sellQuantity.value = 1;
  // 切换标签时清除另一边选中
  selectedBuyEntry.value = null;
  buySelectedIndex.value = -1;
}

// ==================== 买卖操作 ====================

async function handleBuy(itemId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_buy' });
  const result = await shopStore.buyItem(itemId, buyQuantity.value);
  if (result) {
    selectedBuyEntry.value = null;
    buySelectedIndex.value = -1;
    buyQuantity.value = 1;
  }
}

async function handleSell(itemId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_sell' });
  const result = await shopStore.sellItem(itemId, sellQuantity.value);
  if (result) {
    selectedSellEntry.value = null;
    sellSelectedIndex.value = -1;
    sellQuantity.value = 1;
  }
}

// ==================== 数据加载 ====================

/** 防止并发重复加载的守卫 */
let isLoading = false;

async function loadShopItems() {
  if (isLoading) return;
  isLoading = true;
  try {
    // 通过 store 初始化（加载商店配置 + 恢复上次的 currentShopId）
    await shopStore.init();

    // 确保物品模板已加载
    await inventoryStore.loadInventory();

    // 切换商店时强制刷新（await 确保 DB 写入完成）
    await shopStore.refreshItems();
  } catch (err) {
    console.error('[ShopPopup] 加载商店数据失败:', err);
  } finally {
    isLoading = false;
  }
}

// ==================== 生命周期 ====================

onMounted(() => {
  loadShopItems();
});

onUnmounted(() => {
  // 保留，供未来扩展
});

// 切换商店时刷新数据（监听 store.currentShopId，非 prop）
watch(() => shopStore.currentShopId, (newId) => {
  if (!newId) return;
  loadShopItems();
  selectedBuyEntry.value = null;
  buySelectedIndex.value = -1;
  buyQuantity.value = 1;
  selectedSellEntry.value = null;
  sellSelectedIndex.value = -1;
  sellQuantity.value = 1;
});

// 切换买卖标签时清除选中和数量
watch(currentTab, () => {
  selectedBuyEntry.value = null;
  buySelectedIndex.value = -1;
  buyQuantity.value = 1;
  selectedSellEntry.value = null;
  sellSelectedIndex.value = -1;
  sellQuantity.value = 1;
});
</script>

<style scoped>
.shop-content {
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

.shop-name {
  font-size: 13px;
  color: #aaa;
}

.gold-display {
  font-size: 14px;
  font-weight: bold;
  color: #ffd700;
}

/* 买卖标签栏 */
.shop-tabs {
  display: flex;
  gap: 12px;
}

.tab-btn {
  padding: 10px 20px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid #4a4a4a;
  border-radius: 6px;
  color: #fff;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.3s;
}

.tab-btn:hover {
  border-color: #666;
}

.tab-btn.active {
  background: rgba(255, 215, 0, 0.2);
  border-color: #ffd700;
  color: #ffd700;
}

/* 分类筛选栏 */
.category-tabs {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cat-btn {
  padding: 6px 14px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  color: #888;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.3s;
}

.cat-btn:hover {
  border-color: #666;
}

.cat-btn.active {
  background: rgba(0, 153, 255, 0.2);
  border-color: #0099ff;
  color: #0099ff;
}

/* 物品列表 */
.item-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 320px;
  overflow-y: auto;
  padding: 2px;
}

.item-list::-webkit-scrollbar {
  width: 6px;
}

.item-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.item-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

/* 物品列表卡片 */
.item-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  padding: 10px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.item-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.item-card.selected {
  border-color: #ffd700;
  background: rgba(255, 215, 0, 0.1);
}

/* 稀有度边框色 */
.item-card.common { border-color: #9d9d9d; }
.item-card.uncommon { border-color: #1eff00; }
.item-card.rare { border-color: #0070dd; }
.item-card.epic { border-color: #a335ee; }
.item-card.legendary {
  border-color: #ff8000;
  animation: legendary-glow 2s infinite;
}

.card-icon {
  font-size: 26px;
  flex-shrink: 0;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: 14px;
  color: #fff;
  font-weight: bold;
  margin-bottom: 2px;
}

.card-desc {
  font-size: 12px;
  color: #888;
}

.card-count {
  font-size: 12px;
  color: #ffd700;
  margin-top: 2px;
}

.card-price {
  font-size: 13px;
  color: #ffd700;
  font-weight: bold;
  flex-shrink: 0;
}

.card-quantity {
  font-size: 12px;
  color: #4CAF50;
  margin-top: 2px;
}

/* 数量选择器 */
.quantity-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 12px;
}

.qty-btn {
  width: 28px;
  height: 28px;
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.qty-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.2);
}

.qty-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.qty-input {
  width: 52px;
  height: 28px;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  color: #ffd700;
  font-size: 14px;
  font-weight: bold;
  text-align: center;
  -moz-appearance: textfield;
}

.qty-input::-webkit-inner-spin-button,
.qty-input::-webkit-outer-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* 物品详情面板 */
.item-detail {
  background: rgba(0, 0, 0, 0.6);
  border-radius: 6px;
  padding: 14px;
  border: 1px solid #4a4a4a;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.detail-header h3 {
  font-size: 16px;
  margin: 0;
}

.detail-header h3.common { color: #ffffff; }
.detail-header h3.uncommon { color: #1eff00; }
.detail-header h3.rare { color: #0070dd; }
.detail-header h3.epic { color: #a335ee; }
.detail-header h3.legendary { color: #ff8000; }

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
  margin: 0 0 8px 0;
}

.detail-info {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.detail-info span {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #888;
  font-size: 13px;
}

.effect-info {
  margin-bottom: 10px;
}

.effect-info span {
  color: #4CAF50;
  font-size: 13px;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 10px;
}

.action-btn {
  padding: 8px 18px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
  color: #fff;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.action-btn.buy {
  background: linear-gradient(135deg, #4CAF50, #45a049);
}

.action-btn.sell {
  background: linear-gradient(135deg, #ff9800, #f57c00);
}

/* 占位符 */
.detail-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 0;
  color: #555;
  gap: 8px;
}

.placeholder-icon {
  font-size: 32px;
}

.placeholder-text {
  font-size: 14px;
}
</style>
