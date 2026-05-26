<template>
  <div v-if="visible" class="popup-overlay">
    <div class="popup-content">
      <div class="inventory-view">
        <div class="inventory-header">
          <h2>背包</h2>
          <button class="close-btn" @click="$emit('close')">×</button>
          <div class="inventory-count">{{ inventoryItems.length }} / {{ maxSlots }}</div>
        </div>

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
        v-for="(item, index) in filteredItems" 
        :key="item.id || index"
        :class="['item-slot', item.quality]"
        @click="selectItem(item)"
      >
        <span class="item-icon">{{ getItemIcon(item.icon) }}</span>
        <span v-if="item.count > 1" class="item-count">{{ item.count }}</span>
      </div>
      <div 
        v-for="i in emptySlots" 
        :key="'empty-' + i"
        class="item-slot empty"
      >
      </div>
    </div>

    <div v-if="selectedItem" class="item-detail">
      <div class="detail-header">
        <h3 :class="selectedItem.quality">{{ selectedItem.name }}</h3>
        <span class="quality-badge">{{ getQualityName(selectedItem.quality) }}</span>
      </div>
      <p>{{ selectedItem.description }}</p>
      <div class="detail-info">
        <span>类型: {{ getCategoryName(selectedItem.category) }}</span>
        <span>数量: {{ selectedItem.count }}</span>
      </div>
      <div v-if="selectedItem.effect" class="effect-info">
        <span>效果: {{ getEffectText(selectedItem.effect) }}</span>
      </div>
      <div class="detail-actions">
        <button 
          v-if="selectedItem.category === 'consumable'"
          class="action-btn use"
          @click="useItem(selectedItem.itemId)"
        >
          💊 使用
        </button>
        <button 
          v-if="selectedItem.category === 'weapon' || selectedItem.category === 'armor' || selectedItem.category === 'accessory'"
          class="action-btn equip"
          @click="equipItem(selectedItem.itemId)"
        >
          🛡️ {{ selectedItem.equipped ? '卸下' : '装备' }}
        </button>
        <button 
          class="action-btn drop"
          @click="dropItem(selectedItem.itemId)"
        >
          🗑️ 丢弃
        </button>
      </div>
    </div>

    <div class="bottom-actions">
      <button class="organize-btn" @click="organizeInventory">
        📦 整理背包
      </button>
    </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { inventoryService } from '@/modules/inventory';
import type { InventoryItem, ItemCategory, ItemQuality } from '@/modules/inventory';

defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const selectedCategory = ref<ItemCategory | 'all'>('all');
const selectedItem = ref<InventoryItem | null>(null);

const inventoryItems = ref<InventoryItem[]>([]);
const maxSlots = 50;

const categories = [
  { id: 'all' as const, name: '全部' },
  { id: 'consumable' as const, name: '消耗品' },
  { id: 'weapon' as const, name: '武器' },
  { id: 'armor' as const, name: '护甲' },
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

const filteredItems = computed(() => {
  if (selectedCategory.value === 'all') return inventoryItems.value;
  return inventoryItems.value.filter(item => item.category === selectedCategory.value);
});

const emptySlots = computed(() => {
  const visibleCount = filteredItems.value.length;
  const gridSize = Math.ceil(visibleCount / 10) * 10;
  return Math.max(0, gridSize - visibleCount);
});

function selectItem(item: InventoryItem) {
  selectedItem.value = item;
}

function useItem(itemId: string) {
  const item = inventoryItems.value.find(i => i.itemId === itemId);
  if (!item || item.category !== 'consumable') return;

  if (item.effect?.type === 'heal') {
    characterService.addHp(item.effect.value);
    alert(`使用 ${item.name}，恢复了 ${item.effect.value} HP！`);
    inventoryService.removeItemByItemId(itemId, 1);
    loadInventory();
  } else if (item.effect?.type === 'stat' && item.effect.statType === 'maxMana') {
    characterService.addMp(item.effect.value);
    alert(`使用 ${item.name}，恢复了 ${item.effect.value} MP！`);
    inventoryService.removeItemByItemId(itemId, 1);
    loadInventory();
  }
}

function equipItem(itemId: string) {
  const item = inventoryItems.value.find(i => i.itemId === itemId);
  if (!item) return;

  if (item.equipped) {
    const equipment = inventoryService.getEquipment();
    const slot = equipment.find(e => e.itemId === itemId)?.slot;
    if (slot) {
      inventoryService.unequipItem(slot);
      alert(`已卸下${item.name}`);
    }
  } else {
    const index = inventoryItems.value.findIndex(i => i.itemId === itemId);
    if (index !== -1) {
      const result = inventoryService.equipItem(index);
      if (result.success) {
        alert(`已装备${item.name}`);
      } else {
        alert(result.message);
      }
    }
  }
  loadInventory();
}

function dropItem(itemId: string) {
  if (!confirm('确定丢弃此物品吗？')) return;
  
  const item = inventoryItems.value.find(i => i.itemId === itemId);
  if (!item) return;
  
  inventoryService.removeItemByItemId(itemId, 1);
  alert(`已丢弃${item.name}`);
  loadInventory();
}

function organizeInventory() {
  inventoryService.organizeInventory();
  alert('背包已整理！');
  loadInventory();
}

async function loadInventory() {
  await inventoryService.initialize();
  inventoryItems.value = inventoryService.getInventory();
}

onMounted(() => {
  loadInventory();
});
</script>

<style scoped>
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.8);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
  box-sizing: border-box;
}

.popup-content {
  background: rgba(13, 17, 23, 0.98);
  border-radius: 12px;
  border: 2px solid #4a4a4a;
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
}

.close-btn {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 32px;
  height: 32px;
  background: rgba(255, 255, 255, 0.1);
  border: none;
  border-radius: 50%;
  color: #fff;
  font-size: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.close-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.inventory-view {
  max-width: 800px;
  margin: 0 auto;
}

.inventory-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.inventory-header h2 {
  font-size: 24px;
  color: #ffd700;
}

.inventory-count {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #888;
}

.category-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 8px 16px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #4a4a4a;
  border-radius: 4px;
  color: #888;
  font-size: 14px;
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
  grid-template-columns: repeat(10, 1fr);
  gap: 8px;
  background: rgba(0, 0, 0, 0.5);
  padding: 16px;
  border-radius: 8px;
  border: 2px solid #4a4a4a;
  margin-bottom: 16px;
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
}

.item-slot.empty {
  border-style: dashed;
  opacity: 0.3;
}

.item-slot.common {
  border-color: #ffffff;
}

.item-slot.uncommon {
  border-color: #1eff00;
}

.item-slot.rare {
  border-color: #0070dd;
}

.item-slot.epic {
  border-color: #a335ee;
}

.item-slot.legendary {
  border-color: #ff8000;
  animation: legendary-glow 2s infinite;
}

.item-slot.equipped {
  border-color: #4CAF50;
  background: rgba(76, 175, 80, 0.2);
}

@keyframes legendary-glow {
  0%, 100% { box-shadow: 0 0 5px #ff8000; }
  50% { box-shadow: 0 0 20px #ff8000; }
}

.item-icon {
  font-size: 28px;
}

.item-count {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: 12px;
  color: #fff;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
}

.item-detail {
  background: rgba(0, 0, 0, 0.7);
  border-radius: 8px;
  padding: 16px;
  border: 2px solid #4a4a4a;
  margin-bottom: 16px;
}

.detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.item-detail h3 {
  font-size: 18px;
  color: #fff;
  font-weight: bold;
}

.item-detail h3.common { color: #ffffff; }
.item-detail h3.uncommon { color: #1eff00; }
.item-detail h3.rare { color: #0070dd; }
.item-detail h3.epic { color: #a335ee; }
.item-detail h3.legendary { color: #ff8000; }

.quality-badge {
  padding: 4px 8px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  color: #888;
  font-size: 12px;
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

.detail-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
}

.action-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  font-size: 14px;
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

.bottom-actions {
  display: flex;
  justify-content: center;
}

.organize-btn {
  padding: 12px 24px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid #4a4a4a;
  border-radius: 8px;
  color: #fff;
  font-size: 16px;
  cursor: pointer;
  transition: all 0.3s;
}

.organize-btn:hover {
  border-color: #0099ff;
  background: rgba(0, 153, 255, 0.2);
}
</style>