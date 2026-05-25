<template>
  <div class="shop-view">
    <div class="shop-header">
      <h2>商店</h2>
      <div class="gold-display">💰 {{ gold }}</div>
    </div>

    <div class="shop-tabs">
      <button 
        :class="['tab-btn', { active: currentTab === 'buy' }]"
        @click="currentTab = 'buy'"
      >
        购买
      </button>
      <button 
        :class="['tab-btn', { active: currentTab === 'sell' }]"
        @click="currentTab = 'sell'"
      >
        出售
      </button>
    </div>

    <div class="category-filter">
      <button 
        v-for="cat in categories" 
        :key="cat.id"
        :class="['cat-btn', { active: selectedCategory === cat.id }]"
        @click="selectedCategory = cat.id"
      >
        {{ cat.name }}
      </button>
    </div>

    <div v-if="currentTab === 'buy'" class="shop-items">
      <div 
        v-for="item in filteredShopItems" 
        :key="item.id"
        :class="['item-card', item.quality]"
        @click="selectItem(item)"
      >
        <div class="item-icon">{{ getItemIcon(item.icon) }}</div>
        <div class="item-info">
          <div class="item-name">{{ item.name }}</div>
          <div class="item-desc">{{ item.description }}</div>
          <div class="item-price">💰 {{ item.price }}</div>
        </div>
        <button 
          class="buy-btn"
          :disabled="!canAfford(item) || item.quantity <= 0"
          @click.stop="buyItem(item.itemId)"
        >
          购买
        </button>
      </div>
    </div>

    <div v-else class="shop-items">
      <div 
        v-for="item in filteredInventoryItems" 
        :key="item.id"
        class="item-card"
        @click="selectItem(item)"
      >
        <div class="item-icon">{{ getItemIcon(item.icon) }}</div>
        <div class="item-info">
          <div class="item-name">{{ item.name }}</div>
          <div class="item-desc">{{ item.description }}</div>
          <div class="item-count">数量: {{ item.count }}</div>
          <div class="item-price">💰 {{ getSellPrice(item.itemId) }}</div>
        </div>
        <button 
          class="sell-btn"
          :disabled="item.count <= 0"
          @click.stop="sellItem(item.itemId)"
        >
          出售
        </button>
      </div>
    </div>

    <div v-if="selectedItem" class="item-detail">
      <h3>{{ selectedItem.name }}</h3>
      <p>{{ selectedItem.description }}</p>
      <div class="detail-info">
        <span>类型: {{ getCategoryName(selectedItem.category) }}</span>
        <span>稀有度: {{ getQualityName(selectedItem.quality) }}</span>
      </div>
      <div v-if="selectedItem.effect" class="effect-info">
        <span>效果: {{ getEffectText(selectedItem.effect) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { shopService } from '@/modules/shop';
import { characterService } from '@/modules/character';
import { inventoryService } from '@/modules/inventory';
import type { ShopItem, ItemCategory, ItemQuality } from '@/modules/shop';

const currentTab = ref<'buy' | 'sell'>('buy');
const selectedCategory = ref<ItemCategory | 'all'>('all');
const selectedItem = ref<ShopItem | any>(null);

const shopItems = ref<ShopItem[]>([]);
const inventoryItems = ref<any[]>([]);

const gold = computed(() => characterService.getGold());

const categories = [
  { id: 'all' as const, name: '全部' },
  { id: 'consumable' as const, name: '消耗品' },
  { id: 'weapon' as const, name: '武器' },
  { id: 'armor' as const, name: '装备' },
  { id: 'accessory' as const, name: '饰品' },
  { id: 'material' as const, name: '材料' },
  { id: 'misc' as const, name: '其他' }
];

const iconMap: Record<string, string> = {
  potion: '🧪', sword: '⚔️', axe: '🪓', staff: '🔮',
  armor: '🛡️', ring: '💍', necklace: '📿',
  herb: '🌿', ore: '🪨', enchant: '✨',
  scroll: '📜'
};

const qualityNames: Record<ItemQuality, string> = {
  common: '普通',
  uncommon: '优秀',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说'
};

const categoryNames: Record<string, string> = {
  consumable: '消耗品',
  weapon: '武器',
  armor: '护甲',
  accessory: '饰品',
  material: '材料',
  misc: '其他'
};

function getItemIcon(icon: string) {
  return iconMap[icon] || '📦';
}

function getQualityName(quality: ItemQuality) {
  return qualityNames[quality];
}

function getCategoryName(category: string) {
  return categoryNames[category] || category;
}

function getEffectText(effect: any) {
  if (!effect) return '';
  if (effect.type === 'heal') return `恢复${effect.value}点生命值`;
  if (effect.type === 'stat') return `${effect.statType === 'physicalAttack' ? '物理攻击' : 
    effect.statType === 'magicAttack' ? '魔法攻击' : 
    effect.statType === 'physicalDefense' ? '物理防御' :
    effect.statType === 'magicDefense' ? '魔法防御' :
    effect.statType === 'maxHp' ? '最大生命值' :
    effect.statType === 'allAttributes' ? '全属性' : effect.statType} +${effect.value}`;
  return JSON.stringify(effect);
}

const filteredShopItems = computed(() => {
  if (selectedCategory.value === 'all') return shopItems.value;
  return shopItems.value.filter(item => item.category === selectedCategory.value);
});

const filteredInventoryItems = computed(() => {
  if (selectedCategory.value === 'all') return inventoryItems.value;
  return inventoryItems.value.filter(item => item.category === selectedCategory.value);
});

function canAfford(item: ShopItem) {
  return gold.value >= item.price;
}

function getSellPrice(itemId: string) {
  const basePrice = shopItems.value.find(i => i.itemId === itemId)?.price || 10;
  return Math.floor(basePrice * 0.5);
}

function selectItem(item: any) {
  selectedItem.value = item;
}

function buyItem(itemId: string) {
  const result = shopService.buyItem(itemId, 1);
  if (result.success) {
    alert(result.message);
    loadShopItems();
    loadInventoryItems();
  } else {
    alert(result.message);
  }
}

function sellItem(itemId: string) {
  const result = shopService.sellItem(itemId, 1);
  if (result.success) {
    alert(result.message);
    loadInventoryItems();
  } else {
    alert(result.message);
  }
}

function loadShopItems() {
  shopItems.value = shopService.getItems();
}

function loadInventoryItems() {
  inventoryItems.value = inventoryService.getInventory();
}

onMounted(() => {
  loadShopItems();
  loadInventoryItems();
});
</script>

<style scoped>
.shop-view {
  max-width: 800px;
  margin: 0 auto;
}

.shop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.shop-header h2 {
  font-size: 24px;
  color: #ffd700;
}

.gold-display {
  font-size: 20px;
  font-weight: bold;
}

.shop-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.tab-btn {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
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

.category-filter {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.cat-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  color: #888;
  font-size: 14px;
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

.shop-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.item-card {
  background: rgba(255, 255, 255, 0.05);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: all 0.3s;
}

.item-card:hover {
  background: rgba(255, 255, 255, 0.1);
}

.item-card.common {
  border-color: #ffffff;
}

.item-card.uncommon {
  border-color: #1eff00;
}

.item-card.rare {
  border-color: #0070dd;
}

.item-card.epic {
  border-color: #a335ee;
}

.item-card.legendary {
  border-color: #ff8000;
  animation: legendary-glow 2s infinite;
}

@keyframes legendary-glow {
  0%, 100% { box-shadow: 0 0 5px #ff8000; }
  50% { box-shadow: 0 0 20px #ff8000; }
}

.item-icon {
  font-size: 32px;
}

.item-info {
  flex: 1;
}

.item-name {
  font-size: 16px;
  color: #fff;
  font-weight: bold;
  margin-bottom: 4px;
}

.item-desc {
  font-size: 12px;
  color: #888;
  margin-bottom: 8px;
}

.item-price, .item-count {
  font-size: 14px;
  color: #ffd700;
}

.buy-btn, .sell-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.3s;
}

.buy-btn {
  background: linear-gradient(135deg, #4CAF50, #45a049);
  color: #fff;
}

.sell-btn {
  background: linear-gradient(135deg, #ff9800, #f57c00);
  color: #fff;
}

.buy-btn:hover:not(:disabled), .sell-btn:hover:not(:disabled) {
  transform: translateY(-2px);
}

.buy-btn:disabled, .sell-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.item-detail {
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 16px;
  border: 2px solid #4a4a4a;
}

.item-detail h3 {
  font-size: 18px;
  color: #ffd700;
  margin-bottom: 8px;
}

.item-detail p {
  color: #aaa;
  margin-bottom: 12px;
}

.detail-info {
  display: flex;
  gap: 16px;
  margin-bottom: 12px;
}

.detail-info span {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #888;
  font-size: 14px;
}

.effect-info span {
  color: #4CAF50;
  font-size: 14px;
}
</style>