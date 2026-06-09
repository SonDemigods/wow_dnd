/**
 * 背包模块状态管理
 * 
 * 使用 Pinia 管理背包状态，响应式更新UI。
 * Store 是背包数据的唯一持有者，Service 作为纯业务逻辑层供 Store 调用。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Item, InventoryItem, SortField, SortOrder, ItemFilters, ItemType, ItemRarity } from './types';
import { inventoryService } from './service';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 背包容量
 */
const INVENTORY_SIZE = 50;

/**
 * 物品类型名称映射
 */
const ITEM_TYPE_NAMES: Record<ItemType, string> = {
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

/**
 * 物品稀有度配置
 */
const ITEM_RARITY_CONFIG: Record<ItemRarity, { color: string; name: string }> = {
  common: { color: '#9d9d9d', name: '普通' },
  uncommon: { color: '#1eff00', name: '优秀' },
  rare: { color: '#0070dd', name: '稀有' },
  epic: { color: '#a335ee', name: '史诗' },
  legendary: { color: '#ff8000', name: '传说' }
};

/**
 * 背包状态存储
 */
export const useInventoryStore = defineStore('inventory', () => {
  // 状态
  const inventory = ref<InventoryItem[]>([]);
  const filters = ref<ItemFilters>({});
  const sortBy = ref<SortField>('type');
  const sortOrder = ref<SortOrder>('asc');
  const searchKeyword = ref('');
  const isLoading = ref(false);

  /** 跨模块事件监听是否已注册（避免重复注册） */
  let crossModuleListenersSetup = false;

  /**
   * 从 Service 同步最新背包数据到 Store
   */
  function syncFromService(): void {
    inventory.value = inventoryService.getInventory();
  }

  // 计算属性
  const filteredInventory = computed(() => {
    let result = [...inventory.value];
    
    // 搜索筛选
    if (searchKeyword.value.trim()) {
      const keyword = searchKeyword.value.toLowerCase();
      result = result.filter(invItem => {
        const item = inventoryService.getItemInfo(invItem.itemId);
        return item && (
          item.name.toLowerCase().includes(keyword) ||
          item.description.toLowerCase().includes(keyword)
        );
      });
    }
    
    // 条件筛选
    if (filters.value.types && filters.value.types.length > 0) {
      result = result.filter(invItem => {
        const item = inventoryService.getItemInfo(invItem.itemId);
        return item && filters.value.types!.includes(item.type);
      });
    }
    
    if (filters.value.rarities && filters.value.rarities.length > 0) {
      result = result.filter(invItem => {
        const item = inventoryService.getItemInfo(invItem.itemId);
        return item && filters.value.rarities!.includes(item.rarity);
      });
    }
    
    if (filters.value.stackable !== undefined) {
      result = result.filter(invItem => {
        const item = inventoryService.getItemInfo(invItem.itemId);
        return item && item.stackable === filters.value.stackable;
      });
    }
    
    // 排序
    const multiplier = sortOrder.value === 'asc' ? 1 : -1;
    result.sort((a, b) => {
      const itemA = inventoryService.getItemInfo(a.itemId);
      const itemB = inventoryService.getItemInfo(b.itemId);
      
      let comparison = 0;
      
      switch (sortBy.value) {
        case 'type':
          comparison = (ITEM_TYPE_NAMES[itemA?.type || 'misc'] || '').localeCompare(
            ITEM_TYPE_NAMES[itemB?.type || 'misc'] || ''
          );
          break;
        case 'rarity':
          const rarityOrder: Record<ItemRarity, number> = {
            common: 0,
            uncommon: 1,
            rare: 2,
            epic: 3,
            legendary: 4
          };
          comparison = (rarityOrder[itemA?.rarity || 'common'] || 0) - 
                       (rarityOrder[itemB?.rarity || 'common'] || 0);
          break;
        case 'name':
          comparison = (itemA?.name || '').localeCompare(itemB?.name || '');
          break;
        case 'level':
          comparison = (itemA?.bonus?.str || 0) - (itemB?.bonus?.str || 0);
          break;
        default:
          comparison = 0;
      }
      
      return comparison * multiplier;
    });
    
    return result;
  });

  const emptySlots = computed(() => INVENTORY_SIZE - inventory.value.length);
  const isFull = computed(() => inventory.value.length >= INVENTORY_SIZE);
  const totalValue = computed(() => inventoryService.getTotalValue());

  const itemCountByType = computed(() => {
    const counts: Record<ItemType, number> = {
      gold: 0,
      potion: 0,
      scroll: 0,
      food: 0,
      material: 0,
      quest: 0,
      weapon: 0,
      armor: 0,
      misc: 0
    };
    
    inventory.value.forEach(invItem => {
      const item = inventoryService.getItemInfo(invItem.itemId);
      if (item) {
        counts[item.type] += invItem.count;
      }
    });
    
    return counts;
  });

  const allItemTypes = computed(() => {
    return Object.entries(ITEM_TYPE_NAMES).map(([key, value]) => ({
      id: key as ItemType,
      name: value
    }));
  });

  const allRarities = computed(() => {
    return Object.entries(ITEM_RARITY_CONFIG).map(([key, value]) => ({
      id: key as ItemRarity,
      name: value.name,
      color: value.color
    }));
  });

  // 方法
  async function loadInventory(): Promise<void> {
    isLoading.value = true;
    await inventoryService.initialize();
    syncFromService();
    // 首次加载时注册跨模块事件监听（商店交易后自动刷新背包）
    if (!crossModuleListenersSetup) {
      setupCrossModuleListeners();
      crossModuleListenersSetup = true;
    }
    isLoading.value = false;
  }

  function getItemInfo(itemId: string): Item | null {
    return inventoryService.getItemInfo(itemId);
  }

  function getItem(index: number): InventoryItem | null {
    return inventoryService.getItem(index);
  }

  function addItem(item: Item): boolean {
    const success = inventoryService.addItem(item);
    if (success) syncFromService();
    return success;
  }

  function addItems(item: Item, count: number): number {
    const added = inventoryService.addItems(item, count);
    if (added > 0) syncFromService();
    return added;
  }

  function removeItem(index: number): boolean {
    const success = inventoryService.removeItem(index);
    if (success) syncFromService();
    return success;
  }

  async function useItem(index: number): Promise<boolean> {
    const success = await inventoryService.useItem(index);
    if (success) syncFromService();
    return success;
  }

  function dropItem(index: number, count?: number): boolean {
    const success = inventoryService.dropItem(index, count);
    if (success) syncFromService();
    return success;
  }

  function dropItems(indices: number[]): boolean {
    const success = inventoryService.dropItems(indices);
    if (success) syncFromService();
    return success;
  }

  function sortItems(sortField: SortField, order: SortOrder): void {
    sortBy.value = sortField;
    sortOrder.value = order;
    inventoryService.sortItems(sortField, order);
    syncFromService();
  }

  function organizeInventory(): void {
    inventoryService.organizeInventory();
    syncFromService();
  }

  function setFilters(newFilters: ItemFilters): void {
    filters.value = newFilters;
  }

  function setSearchKeyword(keyword: string): void {
    searchKeyword.value = keyword;
  }

  function resetFilters(): void {
    filters.value = {};
    searchKeyword.value = '';
  }

  function addItemTemplate(item: Item): void {
    inventoryService.addItemTemplate(item);
  }

  function removeItemTemplate(itemId: string): void {
    inventoryService.removeItemTemplate(itemId);
  }

  async function setCharacter(characterId: string): Promise<void> {
    await inventoryService.setCharacter(characterId);
    syncFromService();
  }

  function reset(): void {
    inventoryService.reset();
    inventory.value = [];
  }

  /**
   * 跨模块事件监听（每次调用前会先清理旧监听器，防止重复注册）
   */
  function setupCrossModuleListeners(): void {
    // 先清理旧监听器，防止重复注册
    eventBus.clearGroup('inventoryStore');

    eventBus.onGroup('inventoryStore', GameEvents.CHARACTER_SELECTED, async (data) => {
      if (data?.characterId) {
        await setCharacter(data.characterId);
      }
    });

    eventBus.onGroup('inventoryStore', GameEvents.CHARACTER_LOGOUT, () => {
      inventory.value = [];
    });

    // 商店交易后刷新背包物品列表
    eventBus.onGroup('inventoryStore', GameEvents.SHOP_TRANSACTION, () => {
      syncFromService();
    });

    // 背包物品变更时同步（控制台命令、战斗掉落等）
    eventBus.onGroup('inventoryStore', GameEvents.INVENTORY_CHANGE, () => {
      syncFromService();
    });
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('inventoryStore');
  }

  return {
    // 状态
    inventory,
    filters,
    sortBy,
    sortOrder,
    searchKeyword,
    isLoading,
    
    // 计算属性
    filteredInventory,
    emptySlots,
    isFull,
    totalValue,
    itemCountByType,
    allItemTypes,
    allRarities,
    
    // 方法
    loadInventory,
    getItemInfo,
    getItem,
    addItem,
    addItems,
    removeItem,
    useItem,
    dropItem,
    dropItems,
    sortItems,
    organizeInventory,
    setFilters,
    setSearchKeyword,
    resetFilters,
    addItemTemplate,
    removeItemTemplate,
    setCharacter,
    reset,
    setupCrossModuleListeners,
    dispose
  };
});