/**
 * 背包模块状态管理（Store 核心架构）
 * 
 * Store 是背包数据的唯一持有者，所有响应式状态集中管理。
 * Action 负责编排：调用 Service 纯函数 → 更新 Store 状态 → 调用 DB 持久化 → 通知其他 Store。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Item, InventoryItem, SortField, SortOrder, ItemFilters, ItemType, ItemRarity } from './types';
import { inventoryDbService } from './db';
import { equipmentDbService } from '../equipment/db';
import { useLogStore } from '../log/store';
import { generateLogId } from '../log/service';
import { useCharacterStore } from '../character/store';
import { RARITY_CONFIG } from '../../config/inventory';
import type { EquippedItem } from '../equipment/types';
import {
  computeStackResult,
  findItemIndex,
  sortAndFilterInventory,
  computeUseEffect,
  ITEM_TYPE_NAMES,
  MAX_STACK,
  INVENTORY_SIZE
} from './service';

/**
 * 背包状态存储
 */
export const useInventoryStore = defineStore('inventory', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================
  const inventory = ref<InventoryItem[]>([]);
  const itemTemplates = ref<Map<string, Item>>(new Map());
  const filters = ref<ItemFilters>({});
  const sortBy = ref<SortField>('type');
  const sortOrder = ref<SortOrder>('asc');
  const searchKeyword = ref('');
  const currentCharacterId = ref<string | null>(null);
  const isLoading = ref(false);

  // ==================== 计算属性 ====================

  const filteredInventory = computed(() => {
    return sortAndFilterInventory(
      inventory.value,
      itemTemplates.value,
      filters.value,
      sortBy.value,
      sortOrder.value,
      searchKeyword.value
    );
  });

  const emptySlots = computed(() => INVENTORY_SIZE - inventory.value.length);
  const isFull = computed(() => inventory.value.length >= INVENTORY_SIZE);

  const totalValue = computed(() => {
    let total = 0;
    inventory.value.forEach(invItem => {
      const item = itemTemplates.value.get(invItem.itemId);
      if (item) {
        total += item.value * invItem.count;
      }
    });
    return total;
  });

  const itemCountByType = computed(() => {
    const counts: Record<ItemType, number> = {
      gold: 0, potion: 0, scroll: 0, food: 0,
      material: 0, quest: 0, weapon: 0, armor: 0, misc: 0
    };
    inventory.value.forEach(invItem => {
      const item = itemTemplates.value.get(invItem.itemId);
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
    return Object.entries(RARITY_CONFIG).map(([key, value]) => ({
      id: key as ItemRarity,
      name: value.name,
      color: value.color
    }));
  });

  // ==================== 私有：物品模板加载 ====================

  /**
   * 加载物品模板（普通物品 + 装备物品）
   */
  async function loadItemTemplates(): Promise<void> {
    const map = new Map<string, Item>();

    // 加载普通物品模板
    const templates = await inventoryDbService.getAllItemTemplates();
    templates.forEach(item => map.set(item.id, item));

    // 加载装备模板并转换为物品格式（保留对 equipmentDbService 的引用）
    const equipmentTemplates = await equipmentDbService.getAllEquipmentTemplates();
    equipmentTemplates.forEach(equip => {
      if (!map.has(equip.id)) {
        map.set(equip.id, {
          id: equip.id,
          name: equip.name,
          type: equip.type,
          rarity: equip.rarity,
          icon: equip.icon,
          description: equip.description,
          bonus: equip.bonus,
          value: equip.value,
          stackable: equip.stackable || false,
          levelRequirement: equip.levelRequirement
        });
      }
    });

    itemTemplates.value = map;
  }

  // ==================== 私有：持久化 ====================

  /**
   * 持久化背包数据到数据库
   */
  async function persistInventory(): Promise<void> {
    if (currentCharacterId.value) {
      await inventoryDbService.saveInventory(currentCharacterId.value, inventory.value);
    }
  }

  // ==================== Action：初始化 ====================

  /**
   * 初始化背包模块
   * @param characterId - 角色ID
   */
  async function initialize(characterId: string): Promise<void> {
    isLoading.value = true;
    currentCharacterId.value = characterId;

    if (characterId) {
      inventory.value = await inventoryDbService.getInventory(characterId);
    } else {
      inventory.value = [];
    }

    await loadItemTemplates();
    isLoading.value = false;
  }

  // ==================== Action：添加物品 ====================

  /**
   * 添加物品到背包
   * @param itemId - 物品ID
   * @param quantity - 数量
   * @returns 实际添加的数量
   */
  function addItem(itemId: string, quantity: number): number {
    if (!currentCharacterId.value || quantity <= 0) return 0;

    const itemTemplate = itemTemplates.value.get(itemId);
    if (!itemTemplate) return 0;

    let added = 0;
    const newInventory = inventory.value.map(item => ({ ...item }));

    // 可堆叠物品：先尝试堆叠到已有槽位
    if (itemTemplate.stackable) {
      for (let i = 0; i < newInventory.length && added < quantity; i++) {
        if (newInventory[i].itemId === itemId) {
          const result = computeStackResult(newInventory[i].count, quantity - added, MAX_STACK);
          const delta = result.quantity - newInventory[i].count;
          newInventory[i] = { ...newInventory[i], count: result.quantity };
          added += delta;
        }
      }
    }

    // 剩余物品添加到空槽位
    const perSlot = itemTemplate.stackable ? MAX_STACK : 1;
    while (added < quantity && newInventory.length < INVENTORY_SIZE) {
      const slotCount = Math.min(quantity - added, perSlot);
      newInventory.push({ itemId, count: slotCount });
      added += slotCount;
    }

    if (added > 0) {
      inventory.value = newInventory;
      persistInventory(); // 异步持久化

      // 记录冒险日志
      const countText = added > 1 ? ` x${added}` : '';
      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'item',
        message: `获得了物品：${itemTemplate.name}${countText}`,
        icon: 'game-icons:chest'
      });
    }

    return added;
  }

  // ==================== Action：移除物品 ====================

  /**
   * 移除指定物品
   * @param itemId - 物品ID
   * @param quantity - 要移除的数量
   * @returns 实际移除的数量
   */
  function removeItem(itemId: string, quantity: number): number {
    if (!currentCharacterId.value || quantity <= 0) return 0;

    let removed = 0;
    const newInventory: InventoryItem[] = [];

    for (const invItem of inventory.value) {
      if (invItem.itemId === itemId && removed < quantity) {
        const toRemove = Math.min(invItem.count, quantity - removed);
        removed += toRemove;
        if (invItem.count > toRemove) {
          newInventory.push({ ...invItem, count: invItem.count - toRemove });
        }
      } else {
        newInventory.push(invItem);
      }
    }

    if (removed > 0) {
      inventory.value = newInventory;
      persistInventory(); // 异步持久化
    }

    return removed;
  }

  /**
   * 按索引移除物品（兼容旧接口）
   * @param index - 物品位置索引
   * @returns 实际移除的数量
   */
  function removeItemByIndex(index: number): number {
    if (index < 0 || index >= inventory.value.length) return 0;
    const invItem = inventory.value[index];
    const newInventory = [...inventory.value];
    newInventory.splice(index, 1);
    inventory.value = newInventory;
    persistInventory(); // 异步持久化
    return invItem.count;
  }

  // ==================== Action：使用物品 ====================

  /**
   * 使用指定物品（供其他 Store 直接调用）
   * @param itemId - 物品ID
   * @returns 是否成功使用
   */
  async function useItem(itemId: string): Promise<boolean> {
    if (!currentCharacterId.value) return false;

    const idx = findItemIndex(inventory.value, itemId);
    if (idx === -1) return false;

    const invItem = inventory.value[idx];
    const itemTemplate = itemTemplates.value.get(itemId);
    if (!itemTemplate || !itemTemplate.consumable) return false;

    // 计算并应用物品效果 → 直接调用 characterStore Action
    const effect = computeUseEffect(itemTemplate);
    if (effect) {
      const { type, value } = effect;
      const characterStore = useCharacterStore();

      if (type === 'health_restore' && typeof value === 'number' && value > 0) {
        await characterStore.receiveHeal(value);
      } else if (type === 'mana_restore' && typeof value === 'number' && value > 0) {
        await characterStore.changeMp(value);
      }
    }

    // 应用属性加成 → 直接调用 characterStore Action
    if (itemTemplate.bonus) {
      const characterStore = useCharacterStore();
      await characterStore.applyBonus(itemTemplate.bonus);
    }

    // 减少物品数量或移除
    if (invItem.count > 1) {
      inventory.value = inventory.value.map((item, i) =>
        i === idx ? { ...item, count: item.count - 1 } : item
      );
    } else {
      inventory.value = inventory.value.filter((_, i) => i !== idx);
    }

    await persistInventory();

    // 记录冒险日志
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'item',
      message: `使用了：${itemTemplate.name}`,
      icon: 'game-icons:potion-ball'
    });

    return true;
  }

  /**
   * 按索引使用物品（兼容旧接口）
   * @param index - 物品位置索引
   * @returns 是否成功使用
   */
  async function useItemByIndex(index: number): Promise<boolean> {
    if (index < 0 || index >= inventory.value.length) return false;
    return useItem(inventory.value[index].itemId);
  }

  // ==================== Action：丢弃物品 ====================

  /**
   * 按索引丢弃物品（兼容旧接口）
   * @param index - 物品位置索引
   * @param count - 丢弃数量，默认丢弃全部
   * @returns 是否成功丢弃
   */
  function dropItemByIndex(index: number, count?: number): boolean {
    if (index < 0 || index >= inventory.value.length) return false;

    const invItem = inventory.value[index];
    const dropCount = count || invItem.count;

    if (dropCount >= invItem.count) {
      inventory.value = inventory.value.filter((_, i) => i !== index);
    } else {
      inventory.value = inventory.value.map((item, i) =>
        i === index ? { ...item, count: item.count - dropCount } : item
      );
    }

    persistInventory(); // 异步持久化

    // 记录冒险日志
    const droppedItem = itemTemplates.value.get(invItem.itemId);
    if (droppedItem) {
      const countText = dropCount > 1 ? ` x${dropCount}` : '';
      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'item',
        message: `丢弃了：${droppedItem.name}${countText}`,
        icon: 'game-icons:trash-can'
      });
    }

    return true;
  }

  /**
   * 批量丢弃物品（兼容旧接口）
   * @param indices - 物品位置索引列表
   * @returns 是否成功丢弃
   */
  function dropItemsByIndices(indices: number[]): boolean {
    if (indices.length === 0) return false;

    const sortedIndices = [...indices].sort((a, b) => b - a);
    const newInventory = [...inventory.value];
    sortedIndices.forEach(index => {
      if (index >= 0 && index < newInventory.length) {
        newInventory.splice(index, 1);
      }
    });
    inventory.value = newInventory;
    persistInventory(); // 异步持久化
    return true;
  }

  // ==================== Action：整理背包 ====================

  /**
   * 整理背包：合并同类物品并按品质/分类排序
   */
  function organizeInventory(): void {
    const itemsMap = new Map<string, number>();
    inventory.value.forEach(item => {
      itemsMap.set(item.itemId, (itemsMap.get(item.itemId) || 0) + item.count);
    });

    const newInventory: InventoryItem[] = [];
    itemsMap.forEach((totalCount, itemId) => {
      const itemInfo = itemTemplates.value.get(itemId);
      if (!itemInfo?.stackable) {
        for (let i = 0; i < totalCount; i++) {
          newInventory.push({ itemId, count: 1 });
        }
      } else {
        while (totalCount > 0) {
          const stackSize = Math.min(totalCount, MAX_STACK);
          newInventory.push({ itemId, count: stackSize });
          totalCount -= stackSize;
        }
      }
    });

    // 按品质降序再按分类升序
    const rarityOrder: Record<string, number> = {
      legendary: 4, epic: 3, rare: 2, uncommon: 1, common: 0
    };
    newInventory.sort((a, b) => {
      const itemA = itemTemplates.value.get(a.itemId);
      const itemB = itemTemplates.value.get(b.itemId);
      const rarityA = rarityOrder[itemA?.rarity || 'common'] || 0;
      const rarityB = rarityOrder[itemB?.rarity || 'common'] || 0;
      if (rarityA !== rarityB) return rarityB - rarityA;
      return (ITEM_TYPE_NAMES[itemA?.type || 'misc'] || '').localeCompare(
        ITEM_TYPE_NAMES[itemB?.type || 'misc'] || ''
      );
    });

    inventory.value = newInventory;
    persistInventory(); // 异步持久化
  }

  // ==================== Action：查询 ====================

  /**
   * 获取物品模板信息
   * @param itemId - 物品ID
   * @returns 物品模板数据或 null
   */
  function getItemInfo(itemId: string): Item | null {
    return itemTemplates.value.get(itemId) || null;
  }

  /**
   * 获取所有物品模板
   * @returns 全部物品模板列表
   */
  function getAllItems(): Item[] {
    return Array.from(itemTemplates.value.values());
  }

  /**
   * 搜索物品（按关键词）
   * @param keyword - 搜索关键词
   * @returns 匹配的物品列表
   */
  function searchItems(keyword: string): InventoryItem[] {
    return sortAndFilterInventory(inventory.value, itemTemplates.value, {}, sortBy.value, sortOrder.value, keyword);
  }

  /**
   * 按筛选条件过滤物品
   * @param filtersParam - 筛选条件
   * @returns 匹配的物品列表
   */
  function filterInventory(filtersParam: ItemFilters): InventoryItem[] {
    return sortAndFilterInventory(inventory.value, itemTemplates.value, filtersParam, sortBy.value, sortOrder.value, searchKeyword.value);
  }

  /**
   * 获取当前角色已装备的物品列表
   * @returns 已装备物品数组
   */
  async function getEquipment(): Promise<EquippedItem[]> {
    const characterId = currentCharacterId.value;
    if (!characterId) return [];
    const equipmentRecord = await equipmentDbService.getEquipment(characterId);
    return Object.values(equipmentRecord).filter((e): e is EquippedItem => e !== null);
  }

  // ==================== Action：排序与筛选设置 ====================

  function updateSort(sortField: SortField, order: SortOrder): void {
    sortBy.value = sortField;
    sortOrder.value = order;
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

  // ==================== Action：模板管理 ====================

  function addItemTemplate(item: Item): void {
    const newMap = new Map(itemTemplates.value);
    newMap.set(item.id, item);
    itemTemplates.value = newMap;
    inventoryDbService.saveItemTemplate(item);
  }

  function removeItemTemplate(itemId: string): void {
    const newMap = new Map(itemTemplates.value);
    newMap.delete(itemId);
    itemTemplates.value = newMap;
    inventoryDbService.deleteItemTemplate(itemId);
  }

  // ==================== Action：加载（兼容旧接口） ====================

  /**
   * 加载背包数据（兼容旧 store.loadInventory() 调用）
   * 当 characterId 已通过 setCharacter 或 initialize 设置时，可无参调用。
   */
  async function loadInventory(): Promise<void> {
    if (currentCharacterId.value) {
      inventory.value = await inventoryDbService.getInventory(currentCharacterId.value);
      await loadItemTemplates();
    }
  }

  // ==================== Action：重置 ====================

  function resetInventory(): void {
    inventory.value = [];
    persistInventory(); // 异步持久化
  }

  /**
   * 清理资源（在新架构下不再需要事件清理，保留空实现以兼容旧调用）
   */
  function dispose(): void {
    // Store 核心架构不再使用事件总线，无需清理
  }

  // ==================== 导出 ====================

  return {
    // 状态
    inventory,
    itemTemplates,
    filters,
    sortBy,
    sortOrder,
    searchKeyword,
    currentCharacterId,
    isLoading,

    // 计算属性
    filteredInventory,
    emptySlots,
    isFull,
    totalValue,
    itemCountByType,
    allItemTypes,
    allRarities,

    // Action：初始化
    initialize,
    loadInventory,

    // Action：核心操作（供其他 Store 直接调用）
    addItem,
    removeItem,
    useItem,

    // Action：查询
    getItemInfo,
    getAllItems,
    searchItems,
    filterInventory,
    getEquipment,

    // Action：兼容旧接口
    removeItemByIndex,
    useItemByIndex,
    dropItemByIndex,
    dropItemsByIndices,
    organizeInventory,
    addItemTemplate,
    removeItemTemplate,
    resetInventory,

    // Action：筛选设置
    updateSort,
    setFilters,
    setSearchKeyword,
    resetFilters,

    // 生命周期
    dispose
  };
});
