/**
 * @fileoverview 装备服务模块
 * @description 提供装备管理、装备效果计算等功能
 * @module modules/equipment
 */

import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import type {
  EquipmentSlot,
  EquipmentType,
  EquipmentItem,
  EquippedItem,
  EquipmentState,
  EquipmentEquippedEvent,
  EquipmentUnequippedEvent,
  EquipmentChangedEvent,
  IEquipmentService,
} from './types';
import type { Stats } from '@/types';

/**
 * 本地存储键名
 */
const EQUIPMENT_STORAGE_KEY = 'wow_equipment';

/**
 * 装备状态管理Store
 */
export const useEquipmentStore = defineStore('equipment', () => {
  /**
   * 已装备物品
   */
  const equippedItems = ref<EquipmentState>({});

  /**
   * 从本地存储加载装备
   */
  function loadFromStorage() {
    try {
      const data = localStorage.getItem(EQUIPMENT_STORAGE_KEY);
      if (data) {
        equippedItems.value = JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load equipment:', e);
    }
  }

  /**
   * 保存装备到本地存储
   */
  function saveToStorage() {
    try {
      localStorage.setItem(EQUIPMENT_STORAGE_KEY, JSON.stringify(equippedItems.value));
    } catch (e) {
      console.error('Failed to save equipment:', e);
    }
  }

  /**
   * 计算装备的总属性
   */
  const getTotalStats = computed((): Partial<Stats> => {
    const total: Partial<Stats> = {
      str: 0,
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0,
    };

    Object.values(equippedItems.value).forEach(item => {
      if (item && item.stats) {
        Object.entries(item.stats).forEach(([stat, value]) => {
          const key = stat as keyof Stats;
          if (value !== undefined && total[key] !== undefined) {
            total[key]! += value;
          }
        });
      }
    });

    return total;
  });

  /**
   * 获取指定槽位的装备
   */
  const getEquippedItem = (slot: EquipmentSlot): EquippedItem | null => {
    return equippedItems.value[slot] || null;
  };

  /**
   * 获取所有已装备物品
   */
  const getEquippedItems = (): EquipmentState => {
    return { ...equippedItems.value };
  };

  /**
   * 判断是否可以装备
   */
  const canEquip = (slot: EquipmentSlot, item: EquipmentItem): boolean => {
    return item.slot === slot;
  };

  /**
   * 装备物品
   */
  const equipItem = (slot: EquipmentSlot, item: EquipmentItem): boolean => {
    if (!canEquip(slot, item)) {
      return false;
    }

    const oldItem = equippedItems.value[slot];
    const equippedItem: EquippedItem = {
      ...item,
      equippedAt: Date.now(),
    };

    const newStatsChange: Partial<Stats> = { ...item.stats };
    if (oldItem) {
      Object.entries(oldItem.stats).forEach(([stat, value]) => {
        const key = stat as keyof Stats;
        if (value !== undefined && newStatsChange[key] !== undefined) {
          newStatsChange[key]! -= value;
        }
      });
    }

    equippedItems.value[slot] = equippedItem;
    saveToStorage();

    if (oldItem) {
      const unequipEvent: EquipmentUnequippedEvent = {
        slot,
        item: oldItem,
      };
      eventBus.emit(GameEvents.EQUIPMENT_UNEQUIPPED, unequipEvent);
    }

    const equipEvent: EquipmentEquippedEvent = {
      slot,
      item: equippedItem,
    };
    eventBus.emit(GameEvents.EQUIPMENT_EQUIPPED, equipEvent);

    const changeEvent: EquipmentChangedEvent = {
      slot,
      oldItem,
      newItem: equippedItem,
      statsChange: newStatsChange,
    };
    eventBus.emit(GameEvents.EQUIPMENT_CHANGED, changeEvent);

    return true;
  };

  /**
   * 卸下装备
   */
  const unequipItem = (slot: EquipmentSlot): EquippedItem | null => {
    const oldItem = equippedItems.value[slot];
    if (!oldItem) {
      return null;
    }

    delete equippedItems.value[slot];
    saveToStorage();

    const unequipEvent: EquipmentUnequippedEvent = {
      slot,
      item: oldItem,
    };
    eventBus.emit(GameEvents.EQUIPMENT_UNEQUIPPED, unequipEvent);

    const negativeStats: Partial<Stats> = {};
    Object.entries(oldItem.stats).forEach(([stat, value]) => {
      const key = stat as keyof Stats;
      if (value !== undefined) {
        negativeStats[key] = -value;
      }
    });

    const changeEvent: EquipmentChangedEvent = {
      slot,
      oldItem,
      statsChange: negativeStats,
    };
    eventBus.emit(GameEvents.EQUIPMENT_CHANGED, changeEvent);

    return oldItem;
  };

  /**
   * 重置装备
   */
  const reset = () => {
    equippedItems.value = {};
    localStorage.removeItem(EQUIPMENT_STORAGE_KEY);
  };

  // 初始化时加载
  loadFromStorage();

  return {
    equippedItems,
    getTotalStats,
    getEquippedItem,
    getEquippedItems,
    canEquip,
    equipItem,
    unequipItem,
    reset,
  };
});

/**
 * 装备服务实现
 */
export const equipmentService: IEquipmentService = {
  equipItem: (slot: EquipmentSlot, item: EquipmentItem) =>
    useEquipmentStore().equipItem(slot, item),
  unequipItem: (slot: EquipmentSlot) =>
    useEquipmentStore().unequipItem(slot),
  getEquippedItem: (slot: EquipmentSlot) =>
    useEquipmentStore().getEquippedItem(slot),
  getEquippedItems: () => useEquipmentStore().getEquippedItems(),
  getTotalStats: () => useEquipmentStore().getTotalStats,
  canEquip: (slot: EquipmentSlot, item: EquipmentItem) =>
    useEquipmentStore().canEquip(slot, item),
  reset: () => useEquipmentStore().reset(),
};
