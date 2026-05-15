/**
 * @fileoverview 背包服务类
 * @description 提供物品管理、背包操作、道具使用等核心功能
 * @module modules/inventory/index
 */

import { ref } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { configManager } from '@/services/configManager';
import { characterService } from '../character';
import type { Item } from '@/types';
import type {
  InventoryItemAddedEvent,
  InventoryItemRemovedEvent,
  InventoryItemUsedEvent,
  InventoryUpdatedEvent,
  IInventoryService
} from './types';

/**
 * 本地存储键名
 */
const INVENTORY_STORAGE_KEY = 'wow_inventory';

/**
 * 背包状态管理Store
 */
export const useInventoryStore = defineStore('inventory', () => {
  /** 背包大小 */
  const inventorySize = ref(8);
  /** 背包物品数组 */
  const items = ref<(Item | null)[]>(new Array(inventorySize.value).fill(null));

  /**
   * 从本地存储加载背包数据
   */
  function loadFromStorage() {
    try {
      const data = localStorage.getItem(INVENTORY_STORAGE_KEY);
      if (data) {
        const saved = JSON.parse(data);
        inventorySize.value = saved.inventorySize ?? 8;
        items.value = saved.items ?? new Array(inventorySize.value).fill(null);
      }
    } catch (e) {
      console.error('Failed to load inventory:', e);
    }
  }

  /**
   * 保存背包数据到本地存储
   */
  function saveToStorage() {
    try {
      const data = {
        inventorySize: inventorySize.value,
        items: items.value,
      };
      localStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save inventory:', e);
    }
  }

  /**
   * 清除背包本地存储
   */
  function clearStorage() {
    localStorage.removeItem(INVENTORY_STORAGE_KEY);
  }

  /**
   * 更新背包大小
   */
  const updateSize = (size: number) => {
    inventorySize.value = size;
    // 如果缩小背包，移除超过新容量的物品
    if (items.value.length > size) {
      for (let i = size; i < items.value.length; i++) {
        if (items.value[i]) {
          const event: InventoryItemRemovedEvent = {
            item: items.value[i]!,
            slot: i,
          };
          eventBus.emit(GameEvents.INVENTORY_ITEM_REMOVED, event);
        }
      }
    }
    items.value = new Array(size).fill(null).map((_, i) => items.value[i] || null);
    emitInventoryUpdated();
  };

  /**
   * 获取指定位置的物品
   */
  const getItem = (slot: number): Item | null => {
    if (slot < 0 || slot >= items.value.length) return null;
    return items.value[slot];
  };

  /**
   * 查找第一个空槽位
   */
  const findEmptySlot = (): number => {
    return items.value.findIndex(item => item === null);
  };

  /**
   * 添加物品到背包
   */
  const addItem = (item: Item): boolean => {
    const emptySlot = findEmptySlot();
    if (emptySlot === -1) {
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'warning',
        message: '背包已满！',
      });
      return false;
    }

    items.value[emptySlot] = { ...item };
    const event: InventoryItemAddedEvent = {
      item: items.value[emptySlot]!,
      slot: emptySlot,
    };
    eventBus.emit(GameEvents.INVENTORY_ITEM_ADDED, event);
    emitInventoryUpdated();
    saveToStorage();
    return true;
  };

  /**
   * 移除指定位置的物品
   */
  const removeItem = (slot: number): Item | null => {
    if (slot < 0 || slot >= items.value.length || !items.value[slot]) {
      return null;
    }

    const removed = items.value[slot];
    items.value[slot] = null;
    const event: InventoryItemRemovedEvent = {
      item: removed!,
      slot,
    };
    eventBus.emit(GameEvents.INVENTORY_ITEM_REMOVED, event);
    emitInventoryUpdated();
    saveToStorage();
    return removed;
  };

  /**
   * 使用物品
   */
  const useItem = (slot: number): boolean => {
    const item = getItem(slot);
    if (!item) return false;

    // 根据物品类型执行不同效果
    if (item.type === 'heal' && item.hpRestore) {
      characterService.addHp(item.hpRestore);
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'success',
        message: `使用了 ${item.name}，恢复了 ${item.hpRestore} 点生命值`,
      });
    } else if (item.type === 'mana' && item.mpRestore) {
      characterService.addMp(item.mpRestore);
      eventBus.emit(GameEvents.NOTIFICATION, {
        type: 'success',
        message: `使用了 ${item.name}，恢复了 ${item.mpRestore} 点魔法值`,
      });
    }

    const event: InventoryItemUsedEvent = { item, slot };
    eventBus.emit(GameEvents.INVENTORY_ITEM_USED, event);

    // 消耗品使用后移除
    if (item.consumable) {
      removeItem(slot);
    }

    return true;
  };

  /**
   * 清空指定槽位
   */
  const clearSlot = (slot: number): void => {
    if (slot < 0 || slot >= items.value.length) return;
    items.value[slot] = null;
    emitInventoryUpdated();
    saveToStorage();
  };

  /**
   * 检查是否有指定物品
   */
  const hasItem = (itemId: string): boolean => {
    return items.value.some(item => item && item.id === itemId);
  };

  /**
   * 获取指定物品的数量
   */
  const getItemCount = (itemId: string): number => {
    return items.value.filter(item => item && item.id === itemId).length;
  };

  /**
   * 获取空槽位数量
   */
  const getEmptySlotCount = (): number => {
    return items.value.filter(item => item === null).length;
  };

  /**
   * 检查背包是否已满
   */
  const isFull = (): boolean => {
    return items.value.every(item => item !== null);
  };

  /**
   * 发出背包更新事件
   */
  const emitInventoryUpdated = () => {
    const event: InventoryUpdatedEvent = { items: [...items.value] };
    eventBus.emit(GameEvents.INVENTORY_UPDATED, event);
  };

  /**
   * 重置背包（开始新游戏）
   */
  const reset = () => {
    const config = configManager.getConfig();
    inventorySize.value = config.inventorySize;
    items.value = new Array(inventorySize.value).fill(null);
    emitInventoryUpdated();
    clearStorage();
  };

  // 初始化时加载数据
  loadFromStorage();

  return {
    // 状态
    items,
    inventorySize,
    // 方法
    getItem,
    addItem,
    removeItem,
    useItem,
    clearSlot,
    hasItem,
    getItemCount,
    getEmptySlotCount,
    isFull,
    updateSize,
    reset,
  };
});

/**
 * 背包服务实现
 */
export const inventoryService: IInventoryService = {
  getItems: () => useInventoryStore().items,
  getItem: (slot: number) => useInventoryStore().getItem(slot),
  addItem: (item: Item) => useInventoryStore().addItem(item),
  removeItem: (slot: number) => useInventoryStore().removeItem(slot),
  useItem: (slot: number) => useInventoryStore().useItem(slot),
  clearSlot: (slot: number) => useInventoryStore().clearSlot(slot),
  hasItem: (itemId: string) => useInventoryStore().hasItem(itemId),
  getItemCount: (itemId: string) => useInventoryStore().getItemCount(itemId),
  getEmptySlotCount: () => useInventoryStore().getEmptySlotCount(),
  isFull: () => useInventoryStore().isFull(),
  reset: () => useInventoryStore().reset(),
};
