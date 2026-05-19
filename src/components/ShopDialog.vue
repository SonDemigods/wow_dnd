<template>
  <div v-if="isOpen" class="shop-overlay" @click.self="closeShop">
    <div class="shop-dialog">
      <div class="shop-header">
        <div class="shop-title">
          <span class="shop-icon">{{ shopConfig?.icon || '🏪' }}</span>
          <span>{{ shopConfig?.name || '商店' }}</span>
        </div>
        <button class="close-btn" @click="closeShop">✕</button>
      </div>

      <div class="shop-content">
        <!-- 玩家金币 -->
        <div class="player-gold">
          <span>💰 金币: {{ playerGold }}</span>
        </div>

        <div class="shop-tabs">
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'buy' }"
            @click="activeTab = 'buy'"
          >
            购买
          </button>
          <button 
            class="tab-btn" 
            :class="{ active: activeTab === 'sell' }"
            @click="activeTab = 'sell'"
          >
            出售
          </button>
        </div>

        <!-- 购买标签 -->
        <div v-if="activeTab === 'buy'" class="buy-tab">
          <div class="item-grid">
            <div 
              v-for="item in shopItems" 
              :key="item.id" 
              class="shop-item"
              :class="{ 'out-of-stock': item.stock <= 0 }"
            >
              <div class="item-icon">{{ item.icon }}</div>
              <div class="item-info">
                <div class="item-name" :class="item.rarity">{{ item.name }}</div>
                <div class="item-desc">{{ item.description }}</div>
                <div class="item-stock">库存: {{ item.stock }}</div>
              </div>
              <div class="item-price">
                <span class="price">💰 {{ item.currentPrice }}</span>
              </div>
              <div class="item-actions">
                <div class="quantity-controls">
                  <button @click="decrementQuantity(item.id)" :disabled="getQuantity(item.id) <= 1">-</button>
                  <span class="quantity">{{ getQuantity(item.id) }}</span>
                  <button @click="incrementQuantity(item.id)" :disabled="getQuantity(item.id) >= item.stock">+</button>
                </div>
                <button 
                  class="buy-btn"
                  :disabled="item.stock <= 0 || !canAffordItem(item)"
                  @click="buyItem(item)"
                >
                  购买
                </button>
              </div>
            </div>
          </div>
          
          <div v-if="shopItems.length === 0" class="empty-message">
            商店暂无商品
          </div>
        </div>

        <!-- 出售标签 -->
        <div v-if="activeTab === 'sell'" class="sell-tab">
          <div class="inventory-grid">
            <div 
              v-for="(item, slot) in inventoryItems" 
              :key="slot" 
              class="inventory-slot"
              @click="selectItemToSell(item, slot)"
              :class="{ 'selected': selectedSellSlot === slot && item }"
            >
              <div v-if="item" class="slot-content">
                <span class="item-icon">{{ item.icon }}</span>
                <span v-if="item.count && item.count > 1" class="item-count">x{{ item.count }}</span>
              </div>
              <div v-else class="slot-empty"></div>
            </div>
          </div>

          <div v-if="selectedItemToSell" class="sell-preview">
            <div class="preview-header">
              <span class="item-icon">{{ selectedItemToSell.icon }}</span>
              <span class="item-name">{{ selectedItemToSell.name }}</span>
            </div>
            <div class="sell-price">
              出售价格: <span class="price">💰 {{ sellPrice }}</span>
            </div>
            <div class="sell-quantity">
              数量: 
              <button @click="sellQuantity = Math.max(1, sellQuantity - 1)">-</button>
              <span>{{ sellQuantity }}</span>
              <button @click="sellQuantity = Math.min(getItemCount(selectedItemToSell), sellQuantity + 1)">+</button>
            </div>
            <button 
              class="sell-btn"
              @click="sellSelectedItem"
            >
              出售 (得 💰 {{ sellPrice * sellQuantity }})
            </button>
          </div>
        </div>
      </div>

      <!-- 刷新提示 -->
      <div class="shop-footer">
        <span v-if="nextRefreshIn > 0">下次刷新: {{ formatTime(nextRefreshIn) }}</span>
        <button class="refresh-btn" @click="manualRefresh">立即刷新</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useShopStore } from '@/modules/shop'
import { useCharacterStore } from '@/modules/character'
import { useInventoryStore } from '@/modules/inventory'
import type { ShopItem, Item } from '@/types'

const shopStore = useShopStore()
const characterStore = useCharacterStore()
const inventoryStore = useInventoryStore()

const activeTab = ref<'buy' | 'sell'>('buy')
const selectedItemToSell = ref<Item | null>(null)
const selectedSellSlot = ref<number | null>(null)
const sellQuantity = ref(1)
const quantities = ref<Record<string, number>>({})
let refreshTimer: number | null = null

const isOpen = computed(() => shopStore.isShopOpen)
const shopConfig = computed(() => shopStore.currentShopId ? shopStore.getShopConfig(shopStore.currentShopId) : null)
const playerGold = computed(() => characterStore.gold)
const shopItems = computed(() => {
  if (!shopStore.currentShopId) return []
  return shopStore.getShopItems(shopStore.currentShopId)
})
const inventoryItems = computed(() => {
  return inventoryStore.items
})

const nextRefreshIn = computed(() => {
  if (!shopStore.currentShopId) return 0
  const config = shopStore.getShopConfig(shopStore.currentShopId)
  if (!config) return 0
  
  const lastRefresh = shopStore.lastRefresh[shopStore.currentShopId] || 0
  const now = Date.now()
  const timePassed = now - lastRefresh
  const timeLeft = config.refreshInterval - timePassed
  
  return Math.max(0, timeLeft)
})

function getQuantity(itemId: string): number {
  return quantities.value[itemId] || 1
}

function incrementQuantity(itemId: string): void {
  quantities.value[itemId] = (quantities.value[itemId] || 1) + 1
}

function decrementQuantity(itemId: string): void {
  if ((quantities.value[itemId] || 1) > 1) {
    quantities.value[itemId] = (quantities.value[itemId] || 1) - 1
  }
}

function canAffordItem(item: ShopItem): boolean {
  const qty = getQuantity(item.id)
  return characterStore.gold >= item.currentPrice * qty
}

function buyItem(item: ShopItem): void {
  const qty = getQuantity(item.id)
  shopStore.purchaseItem(item.id, qty)
  quantities.value[item.id] = 1
}

function selectItemToSell(item: Item | null, slot: number): void {
  if (!item) return
  selectedItemToSell = item
  selectedSellSlot = slot
  sellQuantity.value = 1
}

function getItemCount(item: Item): number {
  return item.count || 1
}

const sellPrice = computed(() => {
  if (!selectedItemToSell) return 0
  const rarity = selectedItemToSell.rarity || 'common'
  const multiplier = {
    common: 0.5,
    uncommon: 0.4,
    rare: 0.35,
    epic: 0.3,
    legendary: 0.25
  }[rarity] || 0.5
  
  const basePrice = selectedItemToSell.value || 10
  return Math.ceil(basePrice * multiplier)
})

function sellSelectedItem(): void {
  if (!selectedItemToSell || selectedSellSlot === null) return
  
  shopStore.sellItem(selectedItemToSell.id, selectedSellSlot, sellQuantity.value)
  selectedItemToSell = null
  selectedSellSlot = null
  sellQuantity.value = 1
}

function closeShop(): void {
  shopStore.closeShop()
}

function manualRefresh(): void {
  if (!shopStore.currentShopId) return
  shopStore.refreshShop(shopStore.currentShopId)
}

function formatTime(ms: number): string {
  const seconds = Math.ceil(ms / 1000)
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function updateRefreshTimer(): void {
  refreshTimer = window.setInterval(() => {
    // 不需要做什么，computed 会自动更新
  }, 1000)
}

onMounted(() => {
  updateRefreshTimer()
})

onUnmounted(() => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
  }
})
</script>

<style scoped>
.shop-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.shop-dialog {
  background: linear-gradient(135deg, #3d2817 0%, #25150b 100%);
  border: 3px solid #8b6914;
  border-radius: 12px;
  width: 90%;
  max-width: 900px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 0 20px rgba(0, 0, 0, 0.8);
}

.shop-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: rgba(0, 0, 0, 0.4);
  border-bottom: 2px solid #8b6914;
}

.shop-title {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 20px;
  color: #ffd700;
  font-weight: bold;
  text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.8);
}

.shop-icon {
  font-size: 28px;
}

.close-btn {
  background: #8b0000;
  border: 2px solid #cc3333;
  color: white;
  padding: 6px 14px;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  font-weight: bold;
}

.close-btn:hover {
  background: #cc3333;
}

.shop-content {
  padding: 20px;
  flex: 1;
  overflow-y: auto;
}

.player-gold {
  background: rgba(0, 0, 0, 0.3);
  padding: 10px 16px;
  border-radius: 6px;
  margin-bottom: 16px;
  color: #ffd700;
  font-size: 18px;
  font-weight: bold;
  text-align: center;
}

.shop-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}

.tab-btn {
  flex: 1;
  padding: 12px;
  background: rgba(0, 0, 0, 0.4);
  border: 2px solid #8b6914;
  color: #ffd700;
  font-size: 16px;
  cursor: pointer;
  border-radius: 6px;
  font-weight: bold;
}

.tab-btn:hover {
  background: rgba(139, 105, 20, 0.3);
}

.tab-btn.active {
  background: #8b6914;
  color: white;
}

.item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}

.shop-item {
  background: rgba(0, 0, 0, 0.4);
  border: 2px solid #8b6914;
  border-radius: 8px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.shop-item.out-of-stock {
  opacity: 0.5;
}

.shop-item.out-of-stock .buy-btn {
  opacity: 0.5;
  cursor: not-allowed;
}

.item-icon {
  font-size: 40px;
  text-align: center;
}

.item-info {
  flex: 1;
}

.item-name {
  font-weight: bold;
  margin-bottom: 4px;
}

.item-name.common { color: #ffffff; }
.item-name.uncommon { color: #1eff00; }
.item-name.rare { color: #0070dd; }
.item-name.epic { color: #a335ee; }
.item-name.legendary { color: #ff8000; }

.item-desc {
  color: #888;
  font-size: 12px;
  margin-bottom: 4px;
}

.item-stock {
  color: #ffd700;
  font-size: 14px;
}

.item-price {
  text-align: center;
}

.price {
  color: #ffd700;
  font-weight: bold;
  font-size: 18px;
}

.item-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.quantity-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 4px;
  padding: 4px;
}

.quantity-controls button {
  width: 28px;
  height: 28px;
  background: #8b6914;
  border: 1px solid #ffd700;
  color: white;
  font-weight: bold;
  cursor: pointer;
  border-radius: 4px;
}

.quantity-controls button:hover:not(:disabled) {
  background: #ffd700;
  color: #25150b;
}

.quantity-controls button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quantity {
  min-width: 30px;
  text-align: center;
  color: white;
  font-weight: bold;
}

.buy-btn {
  flex: 1;
  background: linear-gradient(180deg, #4d7b0d 0%, #315a08 100%);
  border: 2px solid #73a620;
  color: white;
  padding: 10px;
  font-size: 14px;
  cursor: pointer;
  border-radius: 6px;
  font-weight: bold;
}

.buy-btn:hover:not(:disabled) {
  background: linear-gradient(180deg, #73a620 0%, #4d7b0d 100%);
}

.buy-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.empty-message {
  text-align: center;
  color: #888;
  padding: 40px;
}

/* 出售标签 */
.sell-tab {
  display: flex;
  gap: 20px;
}

.inventory-grid {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.inventory-slot {
  aspect-ratio: 1;
  background: rgba(0, 0, 0, 0.4);
  border: 2px solid #8b6914;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  position: relative;
}

.inventory-slot:hover {
  border-color: #ffd700;
}

.inventory-slot.selected {
  border-color: #00ff00;
  box-shadow: 0 0 10px rgba(0, 255, 0, 0.5);
}

.slot-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.slot-content .item-icon {
  font-size: 32px;
}

.item-count {
  position: absolute;
  bottom: 2px;
  right: 4px;
  color: white;
  font-size: 12px;
  font-weight: bold;
  text-shadow: 1px 1px 2px black;
}

.slot-empty {
  color: #444;
  font-size: 24px;
}

.sell-preview {
  width: 240px;
  background: rgba(0, 0, 0, 0.4);
  border: 2px solid #8b6914;
  border-radius: 8px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 18px;
  font-weight: bold;
  color: #ffd700;
}

.preview-header .item-icon {
  font-size: 36px;
}

.sell-price,
.sell-quantity {
  color: white;
  font-size: 14px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.sell-price .price {
  font-size: 16px;
}

.sell-quantity button {
  width: 28px;
  height: 28px;
  background: #8b6914;
  border: 1px solid #ffd700;
  color: white;
  font-weight: bold;
  cursor: pointer;
  border-radius: 4px;
}

.sell-quantity button:hover {
  background: #ffd700;
  color: #25150b;
}

.sell-quantity span {
  min-width: 30px;
  text-align: center;
  font-weight: bold;
}

.sell-btn {
  background: linear-gradient(180deg, #8b0000 0%, #5a0000 100%);
  border: 2px solid #cc3333;
  color: white;
  padding: 12px;
  font-size: 16px;
  cursor: pointer;
  border-radius: 6px;
  font-weight: bold;
  margin-top: 8px;
}

.sell-btn:hover {
  background: linear-gradient(180deg, #cc3333 0%, #8b0000 100%);
}

.shop-footer {
  padding: 12px 20px;
  background: rgba(0, 0, 0, 0.4);
  border-top: 2px solid #8b6914;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.refresh-btn {
  background: #8b6914;
  border: 2px solid #ffd700;
  color: white;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
}

.refresh-btn:hover {
  background: #ffd700;
  color: #25150b;
}
</style>
