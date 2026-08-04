<template>
  <BasePopup :visible="visible" :title="shopName || '商店'" @close="$emit('close')">
    <template #header-extra>
      <div class="header-info">
        <span :class="['gold-display', { flash: goldFlash }]"><BaseIcon name="two-coins" gradient="gold" :size="16" /> {{ gold }}</span>
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
            <ItemIcon :icon="entry.icon" :rarity="entry.quality" size="md" />
            <div class="card-info">
              <div class="card-name">{{ entry.name }}</div>
              <div class="card-desc">{{ entry.description }}</div>
              <div v-if="entry.quantity > 0" class="card-quantity">库存: {{ entry.quantity }}</div>
            </div>
            <div class="card-price"><BaseIcon name="two-coins" gradient="gold" :size="14" /> {{ entry.price }}</div>
          </div>
        </div>

        <!-- 出售标签：背包物品列表 -->
        <div v-else class="item-list">
          <div
            v-for="(entry, index) in displaySellItems"
            :key="entry.item.itemId"
            :class="['item-card', entry.info?.rarity, { selected: sellSelectedIndex === index }]"
            @click="selectSellItem(entry, index)"
          >
            <ItemIcon :icon="entry.info?.icon" :rarity="entry.info?.rarity" size="md" />
            <div class="card-info">
              <div class="card-name">{{ entry.info?.name }}</div>
              <div class="card-desc">{{ entry.info?.description }}</div>
              <div class="card-count">数量: {{ entry.item.count }}</div>
            </div>
            <div class="card-price"><BaseIcon name="two-coins" gradient="gold" :size="14" /> {{ getSellPrice(entry.item.itemId) }}</div>
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
              <span>单价: <BaseIcon name="two-coins" gradient="gold" :size="14" /> {{ selectedBuyEntry.price }}</span>
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
                <BaseIcon name="two-coins" gradient="gold" :size="14" /> 购买 ×{{ buyQuantity }}（{{ totalBuyPrice }}）
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
              <span>单价: <BaseIcon name="two-coins" gradient="gold" :size="14" /> {{ getSellPrice(selectedSellEntry.item.itemId) }}</span>
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
                <BaseIcon name="two-coins" gradient="gold" :size="14" /> 出售 ×{{ sellQuantity }}（{{ totalSellPrice }}）
              </button>
            </div>
          </template>

          <EmptyState v-else icon="chest" text="点击物品查看详情" />
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

import { ref, computed, onMounted, watch } from 'vue';
import { useShopStore } from '@/modules/shop';
import { useCharacterStore } from '@/modules/character';
import { useInventoryStore } from '@/modules/inventory';
import { eventBus, GameEvents } from '@/modules/bus';
import { errorHandler } from '@/services/ErrorHandler';
import { SHOP_TYPE_ITEM_TYPE_MAP } from '@/modules/shop';
import type { ShopDisplayItem } from '@/modules/shop';
import type { ItemType, ItemRarity, ItemEffect } from '@/modules/inventory';
import BasePopup from '../common/BasePopup.vue';
import ItemIcon from '../common/ItemIcon.vue';
import BaseIcon from '@/components/common/BaseIcon.vue';
import EmptyState from '@/components/common/EmptyState.vue';
// P3-163：抽离交易逻辑与金币闪烁动画为独立 Composable
import { useShopTransactions, type SellItemEntry } from './composables/useShopTransactions';
import { useGoldFlash } from './composables/useGoldFlash';

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const shopStore = useShopStore();
const characterStore = useCharacterStore();
const inventoryStore = useInventoryStore();

// P3-163：金币闪烁动画抽离为独立 Composable
const { goldFlash, trigger: triggerGoldFlash } = useGoldFlash();

// P3-163：交易逻辑（买卖流程、数量选择、金币校验）抽离为独立 Composable
const {
  selectedBuyEntry, buySelectedIndex, selectedSellEntry, sellSelectedIndex,
  buyQuantity, sellQuantity, gold, buyMaxQuantity, totalBuyPrice, totalSellPrice,
  getSellPrice, canAffordBuy, clampBuyQuantity, clampSellQuantity,
  selectBuyItem, selectSellItem, decBuyQty, incBuyQty, decSellQty, incSellQty,
  handleBuy, handleSell, resetSelection,
} = useShopTransactions({
  shopStore, characterStore, inventoryStore, onTransactionSuccess: triggerGoldFlash,
});

// ==================== 标签与分类 ====================

const currentTab = ref<'buy' | 'sell'>('buy');
function switchTab(tab: 'buy' | 'sell') {
  currentTab.value = tab;
  eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_tab' });
}

const selectedCategory = ref<'all' | ItemType>('all');
function selectShopCategory(catId: string) {
  eventBus.emit(GameEvents.UI_CLICK, { source: 'shop_category' });
  selectedCategory.value = catId as 'all' | ItemType;
}

const currentShopId = computed(() => shopStore.currentShopId || '');
const shopName = computed(() => shopStore.getShopConfig(currentShopId.value)?.name || '商店');

// ==================== 图标/名称映射与工具函数 ====================

const rarityNames: Record<ItemRarity, string> = { common: '普通', uncommon: '优秀', rare: '稀有', epic: '史诗', legendary: '传说' };
const typeNames: Record<ItemType, string> = {
  gold: '货币', potion: '药水', scroll: '卷轴', food: '食物',
  material: '材料', quest: '任务物品', weapon: '武器', armor: '护甲', misc: '杂项'
};

function getRarityName(rarity: ItemRarity) { return rarityNames[rarity] || rarity; }
function getTypeName(type: ItemType | string) { return typeNames[type as ItemType] || type; }
function getEffectText(effect: ItemEffect | { type: string; value: number | Partial<Record<string, number>> }) {
  if (!effect) return '';
  if (effect.type === 'health_restore') return `恢复 ${effect.value} 点生命值`;
  if (effect.type === 'mana_restore') return `恢复 ${effect.value} 点法力值`;
  if (effect.type === 'physical_damage') return `造成 ${effect.value} 点物理伤害`;
  if (effect.type === 'magic_damage') return `造成 ${effect.value} 点魔法伤害`;
  if (effect.type === 'stat') return '提升属性';
  return '';
}

// ==================== 分类（P3-161：按商店类型动态生成，消除死分类） ====================

const categories = computed(() => {
  const base = [{ id: 'all' as const, name: '全部' }];
  const config = shopStore.getShopConfig(currentShopId.value);
  if (!config) return base;
  const allowedTypes = SHOP_TYPE_ITEM_TYPE_MAP[config.type];
  return [...base, ...allowedTypes.map(t => ({ id: t, name: typeNames[t] }))];
});

// ==================== 商品列表（UI 派生数据：富化 + 按分类筛选） ====================

/** 将 store 的 ShopItem[] 富化为 ShopDisplayItem[]（注入物品模板信息），并按分类筛选 */
const displayShopItems = computed<ShopDisplayItem[]>(() => {
  const enriched = shopStore.currentItems.map(shopItem => {
    const itemInfo = inventoryStore.getItemInfo(shopItem.itemId);
    if (!itemInfo) return null;
    return {
      id: itemInfo.id, itemId: shopItem.itemId, name: itemInfo.name, type: itemInfo.type,
      quality: itemInfo.rarity, icon: itemInfo.icon, description: itemInfo.description,
      price: shopItem.price, quantity: shopItem.quantity, effect: itemInfo.effect
    } as ShopDisplayItem;
  }).filter((item): item is ShopDisplayItem => item !== null);

  if (selectedCategory.value === 'all') return enriched;
  return enriched.filter(item => inventoryStore.getItemInfo(item.itemId)?.type === selectedCategory.value);
});

const displaySellItems = computed<SellItemEntry[]>(() => {
  const invItems = inventoryStore.inventory;
  const filtered = selectedCategory.value === 'all'
    ? invItems
    : invItems.filter(item => inventoryStore.getItemInfo(item.itemId)?.type === selectedCategory.value);
  return filtered.map(item => ({ item, info: inventoryStore.getItemInfo(item.itemId) }));
});

// ==================== 数据加载与生命周期 ====================

let isLoading = false;
async function loadShopItems() {
  if (isLoading) return;
  isLoading = true;
  try {
    await shopStore.init();
    await inventoryStore.loadInventory();
    await shopStore.refreshShop();
  } catch (err) {
    console.error('[ShopPopup] 加载商店数据失败:', err);
    errorHandler.report(err, '加载商店失败');
  } finally {
    isLoading = false;
  }
}

onMounted(loadShopItems);

// 切换商店时刷新数据并重置选中
watch(() => shopStore.currentShopId, (newId) => {
  if (!newId) return;
  loadShopItems();
  resetSelection();
});

// 切换买卖标签时重置选中
watch(currentTab, resetSelection);
</script>

<style lang="less" scoped>
.shop-content {
  .flex-col();
  height: 100%;
  gap: 14px;
}

.header-info {
  display: flex;
  align-items: center;
  gap: @spacing-xl;
}

.shop-name {
  font-size: @font-base;
  color: #aaa;
}

.gold-display {
  font-size: @font-md;
  font-weight: @font-weight-bold;
  color: @accent-color;
  transition: color @transition-normal;
}

.gold-display.flash {
  animation: gold-flash 0.5s ease;
}

/* 买卖标签栏 */
.shop-tabs {
  display: flex;
  gap: @spacing-xl;
}

.tab-btn {
  padding: @spacing-lg @spacing-4xl;
  background: @white-10;
  border: @border-card;
  border-radius: @radius-md;
  color: @popup-text-color;
  font-size: @font-md;
  cursor: pointer;
  transition: all @transition-normal;
}

.tab-btn:hover {
  border-color: @color-dim-gray;
}

.tab-btn.active {
  background: @gold-bg-active;
  border-color: @accent-color;
  color: @accent-color;
}

/* 分类筛选栏 */
.category-tabs {
  display: flex;
  gap: @spacing-md;
  flex-wrap: wrap;
}

.cat-btn {
  padding: @spacing-sm 14px;
  background: @white-05;
  border: @border-sm;
  border-radius: @radius-sm;
  color: @color-dodge;
  font-size: @font-base;
  cursor: pointer;
  transition: all @transition-normal;
}

.cat-btn:hover {
  border-color: @color-dim-gray;
}

.cat-btn.active {
  background: rgba(0, 153, 255, 0.2);
  border-color: @skill-blue;
  color: @skill-blue;
}

/* 物品列表 */
.item-list {
  .flex-col();
  gap: @spacing-md;
  max-height: 320px;
  overflow-y: auto;
  padding: 2px;
  .custom-scrollbar();
}

/* 物品列表卡片 */
.item-card {
  background: @white-05;
  border-radius: @radius-lg;
  padding: @spacing-lg 14px;
  display: flex;
  align-items: center;
  gap: @spacing-xl;
  cursor: pointer;
  transition: all @transition-quick;
}

.item-card:hover {
  background: @white-10;
}

.item-card.selected {
  outline: 2px solid @accent-color;
  outline-offset: -2px;
  background: @gold-bg;
}

.card-info {
  flex: 1;
  min-width: 0;
}

.card-name {
  font-size: @font-md;
  color: @popup-text-color;
  font-weight: @font-weight-bold;
  margin-bottom: 2px;
}

.card-desc {
  font-size: @font-sm;
  color: @color-dodge;
}

.card-count {
  font-size: @font-sm;
  color: @accent-color;
  margin-top: 2px;
}

.card-price {
  font-size: @font-base;
  color: @accent-color;
  font-weight: @font-weight-bold;
  flex-shrink: 0;
}

.card-quantity {
  font-size: @font-sm;
  color: @heal-hp;
  margin-top: 2px;
}

/* 数量选择器 */
.quantity-selector {
  display: flex;
  align-items: center;
  gap: @spacing-xs;
  margin-right: 12px;
}

.qty-btn {
  width: 28px;
  height: 28px;
  border: @border-sm;
  border-radius: @radius-sm;
  background: @white-10;
  color: @popup-text-color;
  font-size: @font-lg;
  cursor: pointer;
  .flex-center();
  transition: all @transition-quick;
}

.qty-btn:hover:not(:disabled) {
  background: @white-20;
}

.qty-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.qty-input {
  width: 52px;
  height: 28px;
  background: @overlay-dim;
  border: @border-sm;
  border-radius: @radius-sm;
  color: @accent-color;
  font-size: @font-md;
  font-weight: @font-weight-bold;
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
  background: @overlay-dark;
  border-radius: @radius-md;
  padding: 14px;
  border: @border-sm;
}

.detail-header {
  .flex-between();
  margin-bottom: @spacing-md;
}

.detail-header h3 {
  font-size: @font-lg;
  margin: 0;
}

.detail-header h3.common { color: @popup-text-color; }
.detail-header h3.uncommon { color: #1eff00; }
.detail-header h3.rare { color: #0070dd; }
.detail-header h3.epic { color: #a335ee; }
.detail-header h3.legendary { color: #ff8000; }

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
  margin: 0 0 @spacing-md 0;
}

.detail-info {
  display: flex;
  gap: @spacing-xl;
  margin-bottom: @spacing-md;
  flex-wrap: wrap;
}

.detail-info span {
  padding: @spacing-xs @spacing-md;
  background: @white-10;
  border-radius: @radius-sm;
  color: @color-dodge;
  font-size: @font-base;
}

.effect-info {
  margin-bottom: @spacing-lg;
}

.effect-info span {
  color: @heal-hp;
  font-size: @font-base;
}

.detail-actions {
  display: flex;
  align-items: center;
  gap: @spacing-lg;
  margin-top: @spacing-lg;
}

.action-btn {
  padding: @spacing-md 18px;
  border: none;
  border-radius: @radius-sm;
  font-size: @font-md;
  font-weight: @font-weight-bold;
  cursor: pointer;
  transition: all @transition-normal;
  color: @popup-text-color;
}

.action-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.action-btn:disabled {
  opacity: @opacity-dimmed;
  cursor: not-allowed;
}

.action-btn.buy {
  background: linear-gradient(135deg, @heal-hp, #45a049);
}

.action-btn.sell {
  background: linear-gradient(135deg, #ff9800, #f57c00);
}


</style>
