import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { characterService } from '@/modules/character.module';
import { LOOT_ITEMS, EQUIPMENT_ITEMS } from '@/data';
import type { Item, EquipmentItem } from '@/types';

export type ItemCategory = 'weapon' | 'armor' | 'consumable' | 'accessory' | 'material' | 'misc';

export type ItemQuality = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface InventoryItem {
  id: string;
  itemId: string;
  name: string;
  icon: string;
  category: ItemCategory;
  quality: ItemQuality;
  count: number;
  maxStack: number;
  description: string;
  effect?: ItemEffect;
  equipped?: boolean;
  level?: number;
}

export interface ItemEffect {
  type: 'heal' | 'damage' | 'buff' | 'debuff' | 'stat';
  value: number;
  duration?: number;
  statType?: string;
}

export interface EquipmentSlot {
  slot: EquipmentSlotType;
  itemId: string | null;
}

export type EquipmentSlotType = 'weapon' | 'armor' | 'accessory' | 'helmet' | 'boots';

export interface InventoryState {
  items: InventoryItem[];
  equipment: EquipmentSlot[];
  maxSlots: number;
  usedSlots: number;
  filter: InventoryFilter;
}

export interface InventoryFilter {
  category: ItemCategory | 'all';
  quality: ItemQuality | 'all';
  searchText: string;
  sortBy: 'name' | 'quality' | 'count' | 'category';
  sortOrder: 'asc' | 'desc';
}

export interface InventoryResult {
  success: boolean;
  message: string;
  item?: InventoryItem;
}

export interface IInventoryService {
  getInventory(): InventoryItem[];
  getEquipment(): EquipmentSlot[];
  addItem(item: InventoryItem | { id: string; count?: number }): InventoryResult;
  removeItem(index: number): InventoryResult;
  removeItemByItemId(itemId: string, count: number): void;
  useItem(index: number): InventoryResult;
  equipItem(index: number): InventoryResult;
  unequipItem(slot: EquipmentSlotType): void;
  getState(): InventoryState;
  setFilter(filter: Partial<InventoryFilter>): void;
  sortItems(): void;
  organizeInventory(): void;
  getItemById(itemId: string): InventoryItem | undefined;
  getUsedSlots(): number;
  getMaxSlots(): number;
}

const QUALITY_ORDER: Record<ItemQuality, number> = {
  legendary: 5,
  epic: 4,
  rare: 3,
  uncommon: 2,
  common: 1
};

const ALL_ITEMS: Record<string, Item | EquipmentItem> = {
  ...Object.fromEntries(LOOT_ITEMS.map(item => [item.id, item])),
  ...Object.fromEntries(EQUIPMENT_ITEMS.map(item => [item.id, item]))
};

export const useInventoryStore = defineStore('inventory', () => {
  const items = ref<InventoryItem[]>([]);
  const equipment = ref<EquipmentSlot[]>([
    { slot: 'weapon', itemId: null },
    { slot: 'armor', itemId: null },
    { slot: 'accessory', itemId: null },
    { slot: 'helmet', itemId: null },
    { slot: 'boots', itemId: null }
  ]);
  const maxSlots = ref(50);
  const filter = ref<InventoryFilter>({
    category: 'all',
    quality: 'all',
    searchText: '',
    sortBy: 'name',
    sortOrder: 'asc'
  });

  const usedSlots = computed(() => {
    return items.value.length;
  });

  const filteredItems = computed(() => {
    let result = [...items.value];

    if (filter.value.category !== 'all') {
      result = result.filter(item => item.category === filter.value.category);
    }

    if (filter.value.quality !== 'all') {
      result = result.filter(item => item.quality === filter.value.quality);
    }

    if (filter.value.searchText) {
      const search = filter.value.searchText.toLowerCase();
      result = result.filter(item => 
        item.name.toLowerCase().includes(search) ||
        item.description.toLowerCase().includes(search)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (filter.value.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'quality':
          comparison = QUALITY_ORDER[b.quality] - QUALITY_ORDER[a.quality];
          break;
        case 'count':
          comparison = a.count - b.count;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return filter.value.sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  });

  const state = computed<InventoryState>(() => ({
    items: filteredItems.value,
    equipment: equipment.value,
    maxSlots: maxSlots.value,
    usedSlots: usedSlots.value,
    filter: filter.value
  }));

  function getInventory(): InventoryItem[] {
    return filteredItems.value;
  }

  function getEquipment(): EquipmentSlot[] {
    return equipment.value;
  }

  function addItem(itemData: InventoryItem | { id: string; count?: number }): InventoryResult {
    const count = (itemData as any).count || 1;
    const itemId = (itemData as any).id || (itemData as InventoryItem).itemId;
    
    const template = ALL_ITEMS[itemId];
    if (!template) {
      return { success: false, message: '物品不存在！' };
    }

    if (usedSlots.value >= maxSlots.value) {
      return { success: false, message: '背包已满！' };
    }

    const existingItem = items.value.find(item => item.itemId === itemId);
    const maxStack = template.stackable ? (template.type === 'gold' ? 999999 : 20) : 1;
    
    if (existingItem) {
      if (existingItem.count < maxStack) {
        const addCount = Math.min(count, maxStack - existingItem.count);
        existingItem.count += addCount;
        
        eventBus.emit(GameEvents.INVENTORY_UPDATE, { item: existingItem, action: 'add' });
        return { 
          success: true, 
          message: `\u5DF2\u6DFB\u52A0 ${addCount} 个 ${existingItem.name}`,
          item: existingItem 
        };
      }
    }

    const newItem: InventoryItem = {
      id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      itemId,
      name: template.name,
      icon: template.icon,
      category: template.type === 'weapon' ? 'weapon' : template.type === 'armor' ? 'armor' : 
                template.type === 'potion' || template.type === 'scroll' || template.type === 'food' ? 'consumable' :
                template.type === 'material' ? 'material' : 'misc',
      quality: template.rarity,
      maxStack,
      description: template.description,
      count: Math.min(count, maxStack),
      effect: template.bonus ? { type: 'stat', value: Object.values(template.bonus)[0] as number, statType: Object.keys(template.bonus)[0] } : 
              template.hpRestore ? { type: 'heal', value: template.hpRestore } : 
              template.mpRestore ? { type: 'heal', value: template.mpRestore } : undefined
    };

    items.value.push(newItem);
    
    eventBus.emit(GameEvents.INVENTORY_UPDATE, { item: newItem, action: 'add' });
    return { 
      success: true, 
      message: `\u5DF2\u6DFB\u52A0 ${newItem.count} 个 ${newItem.name}`,
      item: newItem 
    };
  }

  function removeItem(index: number): InventoryResult {
    if (index < 0 || index >= items.value.length) {
      return { success: false, message: '无效的物品索引！' };
    }

    const item = items.value[index];
    
    if (item.count > 1) {
      item.count--;
      eventBus.emit(GameEvents.INVENTORY_UPDATE, { item, action: 'remove' });
      return { success: true, message: `\u5DF2\u51CF\u5C11 1 个 ${item.name}`, item };
    }

    const removedItem = items.value.splice(index, 1)[0];
    eventBus.emit(GameEvents.INVENTORY_UPDATE, { item: removedItem, action: 'remove' });
    return { success: true, message: `\u5DF2\u79FB\u9664 ${removedItem.name}`, item: removedItem };
  }

  function removeItemByItemId(itemId: string, count: number): void {
    const item = items.value.find(i => i.itemId === itemId);
    if (!item) return;

    if (item.count <= count) {
      const index = items.value.findIndex(i => i.itemId === itemId);
      if (index !== -1) {
        items.value.splice(index, 1);
      }
    } else {
      item.count -= count;
    }

    eventBus.emit(GameEvents.INVENTORY_UPDATE, { item, action: 'remove' });
  }

  function useItem(index: number): InventoryResult {
    const item = filteredItems.value[index];
    if (!item) {
      return { success: false, message: '物品不存在！' };
    }

    if (item.category !== 'consumable') {
      return { success: false, message: '该物品不可使用！' };
    }

    if (!item.effect) {
      return { success: false, message: '该物品没有效果！' };
    }

    switch (item.effect.type) {
      case 'heal':
        characterService.addHp(item.effect.value);
        break;
      case 'buff':
        break;
    }

    removeItemByItemId(item.itemId, 1);

    return { success: true, message: `\u4F7F\u7528\u4E86 ${item.name}`, item };
  }

  function equipItem(index: number): InventoryResult {
    const item = filteredItems.value[index];
    if (!item) {
      return { success: false, message: '物品不存在！' };
    }

    let slotType: EquipmentSlotType | null = null;
    
    switch (item.category) {
      case 'weapon':
        slotType = 'weapon';
        break;
      case 'armor':
        slotType = 'armor';
        break;
      case 'accessory':
        slotType = 'accessory';
        break;
    }

    if (!slotType) {
      return { success: false, message: '该物品无法装备！' };
    }

    const slotIndex = equipment.value.findIndex(e => e.slot === slotType);
    if (slotIndex === -1) {
      return { success: false, message: '装备槽位不存在！' };
    }

    const currentEquipped = equipment.value[slotIndex].itemId;
    
    if (currentEquipped) {
      unequipItem(slotType);
    }

    equipment.value[slotIndex].itemId = item.itemId;
    item.equipped = true;

    const statValue = item.effect?.value || 0;
    const statType = item.effect?.statType || '';
    
    if (statType && statValue > 0) {
      const bonus: any = {};
      bonus[statType] = statValue;
      characterService.applyBonus(bonus);
    }

    eventBus.emit(GameEvents.EQUIPMENT_CHANGE, { slot: slotType, item });
    return { success: true, message: `\u5DF2\u88C5\u5907 ${item.name}`, item };
  }

  function unequipItem(slot: EquipmentSlotType): void {
    const slotIndex = equipment.value.findIndex(e => e.slot === slot);
    if (slotIndex === -1) return;

    const itemId = equipment.value[slotIndex].itemId;
    if (!itemId) return;

    const inventoryItem = items.value.find(i => i.itemId === itemId);
    if (inventoryItem) {
      inventoryItem.equipped = false;
      
      const statValue = inventoryItem.effect?.value || 0;
      const statType = inventoryItem.effect?.statType || '';
      
      if (statType && statValue > 0) {
        const bonus: any = {};
        bonus[statType] = -statValue;
        characterService.applyBonus(bonus);
      }
    }

    equipment.value[slotIndex].itemId = null;

    eventBus.emit(GameEvents.EQUIPMENT_CHANGE, { slot, item: null });
  }

  function getState(): InventoryState {
    return state.value;
  }

  function setFilter(newFilter: Partial<InventoryFilter>): void {
    filter.value = { ...filter.value, ...newFilter };
  }

  function sortItems(): void {
    items.value.sort((a, b) => {
      let comparison = 0;
      switch (filter.value.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'quality':
          comparison = QUALITY_ORDER[b.quality] - QUALITY_ORDER[a.quality];
          break;
        case 'count':
          comparison = a.count - b.count;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
      }
      return filter.value.sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  function organizeInventory(): void {
    const organized: InventoryItem[] = [];
    
    const sorted = [...items.value].sort((a, b) => {
      const catOrder: Record<ItemCategory, number> = {
        weapon: 1, armor: 2, accessory: 3, consumable: 4, material: 5, misc: 6
      };
      return catOrder[a.category] - catOrder[b.category];
    });

    for (const item of sorted) {
      const existing = organized.find(i => i.itemId === item.itemId);
      if (existing && existing.count < existing.maxStack) {
        const remaining = existing.maxStack - existing.count;
        const transfer = Math.min(item.count, remaining);
        existing.count += transfer;
        item.count -= transfer;
      }
      if (item.count > 0) {
        organized.push({ ...item, id: `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` });
      }
    }

    items.value = organized;
    
    eventBus.emit(GameEvents.INVENTORY_ORGANIZED, {});
  }

  function getItemById(itemId: string): InventoryItem | undefined {
    return items.value.find(item => item.itemId === itemId);
  }

  function getUsedSlots(): number {
    return usedSlots.value;
  }

  function getMaxSlots(): number {
    return maxSlots.value;
  }

  function expandInventory(amount: number): void {
    maxSlots.value += amount;
  }

  return {
    items,
    equipment,
    maxSlots,
    filter,
    usedSlots,
    filteredItems,
    state,
    getInventory,
    getEquipment,
    addItem,
    removeItem,
    removeItemByItemId,
    useItem,
    equipItem,
    unequipItem,
    getState,
    setFilter,
    sortItems,
    organizeInventory,
    getItemById,
    getUsedSlots,
    getMaxSlots,
    expandInventory
  };
});

export const inventoryService: IInventoryService = {
  getInventory: () => useInventoryStore().getInventory(),
  getEquipment: () => useInventoryStore().getEquipment(),
  addItem: (item) => useInventoryStore().addItem(item),
  removeItem: (index) => useInventoryStore().removeItem(index),
  removeItemByItemId: (itemId, count) => useInventoryStore().removeItemByItemId(itemId, count),
  useItem: (index) => useInventoryStore().useItem(index),
  equipItem: (index) => useInventoryStore().equipItem(index),
  unequipItem: (slot) => useInventoryStore().unequipItem(slot),
  getState: () => useInventoryStore().getState(),
  setFilter: (filter) => useInventoryStore().setFilter(filter),
  sortItems: () => useInventoryStore().sortItems(),
  organizeInventory: () => useInventoryStore().organizeInventory(),
  getItemById: (itemId) => useInventoryStore().getItemById(itemId),
  getUsedSlots: () => useInventoryStore().getUsedSlots(),
  getMaxSlots: () => useInventoryStore().getMaxSlots()
};
