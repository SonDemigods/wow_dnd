/**
 * @fileoverview 装备模块状态层（P3-155 拆分自 store.ts）
 * @description 持有所有装备响应式状态、计算属性、持久化逻辑和初始化流程。
 *              其他 composable（setBonus/ops）通过此模块返回的 state 对象读写共享状态。
 * @module equipment/composables
 */
import { ref, computed, shallowRef, triggerRef } from 'vue';
import type { EquipmentItem, EquipmentSlot, EquippedItem } from '../types';
import type { Stats } from '@/modules/character/types';
import { equipmentDbService } from '../db';
import { useCharacterStore } from '@/modules/character/store';
import { useGameStore } from '@/modules/game';
import { configCache } from '@/modules/config';
import { createEmptySlotMap, SLOT_CONFIG, getEquipmentBySlot } from '../service';
import { getAllSetProgresses } from '../setService';
import type { AddItemToInventoryCallback, RemoveItemFromInventoryCallback } from './callbacks';

/** 物品入/出背包回调引用（模块级单例） */
let inventoryAddItemCallback: AddItemToInventoryCallback | null = null;
let inventoryRemoveItemCallback: RemoveItemFromInventoryCallback | null = null;
let inventoryFlushPersistCallback: (() => Promise<void>) | null = null;

export function setInventoryCallbacks(
  addCallback: AddItemToInventoryCallback | null,
  removeCallback: RemoveItemFromInventoryCallback | null,
  flushPersistCallback: (() => Promise<void>) | null = null
): void {
  inventoryAddItemCallback = addCallback;
  inventoryRemoveItemCallback = removeCallback;
  inventoryFlushPersistCallback = flushPersistCallback;
}

export function clearInventoryCallbacks(): void {
  inventoryAddItemCallback = null;
  inventoryRemoveItemCallback = null;
  inventoryFlushPersistCallback = null;
}

/** 获取回调引用（供 useEquipmentOps 使用） */
export function getInventoryCallbacks() {
  return {
    addItem: () => inventoryAddItemCallback,
    removeItem: () => inventoryRemoveItemCallback,
    flushPersist: () => inventoryFlushPersistCallback,
  };
}

function getDefaultEquipment(): Record<EquipmentSlot, EquippedItem | null> {
  return createEmptySlotMap<EquippedItem | null>(null);
}

export function useEquipmentState() {
  // ==================== 状态 ====================
  const equipment = ref<Record<EquipmentSlot, EquippedItem | null>>(getDefaultEquipment());
  const equipmentTemplates = shallowRef<Map<string, EquipmentItem>>(new Map());
  const persistError = ref<string | null>(null);
  const gameStore = useGameStore();
  const currentCharacterId = computed<string | null>(() => gameStore.currentCharacterId);
  const isLoading = ref(false);
  const appliedSetBonuses = ref<Array<{ setId: string; stat: keyof Stats; value: number }>>([]);

  // ==================== 计算属性 ====================
  const totalStats = computed<Stats>(() => {
    const stats: Stats = { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    const validStatKeys: ReadonlySet<keyof Stats> = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    Object.values(equipment.value).forEach(equippedItem => {
      if (equippedItem && equippedItem.item.bonus) {
        const bonus = equippedItem.item.bonus;
        Object.keys(bonus).forEach(key => {
          if (validStatKeys.has(key as keyof Stats)) {
            const statKey = key as keyof Stats;
            stats[statKey] += bonus[statKey] || 0;
          }
        });
      }
    });
    return stats;
  });

  const equippedCount = computed(() => Object.values(equipment.value).filter(Boolean).length);

  const slotList = computed(() => {
    return Object.entries(SLOT_CONFIG).map(([key, config]) => ({
      id: key as EquipmentSlot, name: config.name, icon: config.icon,
      equippedItem: equipment.value[key as EquipmentSlot], isWeapon: key.startsWith('weapon')
    }));
  });

  const weaponSlots = computed(() => slotList.value.filter(slot => slot.isWeapon));
  const armorSlots = computed(() => slotList.value.filter(slot => !slot.isWeapon));

  const activeSetBonuses = computed(() => {
    return getAllSetProgresses(equipment.value, configCache.getSetDefinitions());
  });

  // ==================== 持久化 ====================
  async function persist(): Promise<void> {
    if (currentCharacterId.value) {
      const idMap = createEmptySlotMap<string | null>(null);
      for (const slot of Object.keys(equipment.value) as EquipmentSlot[]) {
        idMap[slot] = equipment.value[slot]?.item.id ?? null;
      }
      await equipmentDbService.saveEquipment(currentCharacterId.value, idMap);
      persistError.value = null;
    }
  }

  // ==================== 初始化 ====================
  // P9-028 修复：try/finally 确保异常时 isLoading 不卡死
  async function initialize(characterId: string): Promise<void> {
    if (!characterId) return;
    isLoading.value = true;
    try {
      const templates = await equipmentDbService.getAllEquipmentTemplates();
      await configCache.loadSetDefinitions();
      const map = new Map<string, EquipmentItem>();
      templates.forEach(item => map.set(item.id, item));
      equipmentTemplates.value = map;

      const idMap = await equipmentDbService.getEquipment(characterId);
      const resolved: Record<EquipmentSlot, EquippedItem | null> = getDefaultEquipment();
      for (const slot of Object.keys(idMap) as EquipmentSlot[]) {
        const itemId = idMap[slot];
        if (itemId) {
          const template = map.get(itemId);
          if (template) resolved[slot] = { item: template, equippedAt: Date.now() };
        }
      }
      equipment.value = resolved;
    } finally {
      isLoading.value = false;
    }
  }

  // ==================== 查询 ====================
  function getEquipment(): Record<EquipmentSlot, EquippedItem | null> {
    return { ...equipment.value };
  }
  function getEquippedItem(slot: EquipmentSlot): EquippedItem | null {
    const item = getEquipmentBySlot(equipment.value, slot);
    return item ? { ...item } : null;
  }
  function getEquipmentTemplate(itemId: string): EquipmentItem | null {
    return equipmentTemplates.value.get(itemId) || null;
  }

  // ==================== 模板管理 ====================
  function addEquipmentTemplate(item: EquipmentItem): void {
    equipmentTemplates.value.set(item.id, item);
    triggerRef(equipmentTemplates);
    equipmentDbService.saveEquipmentTemplate(item).catch(err => {
      console.error('[EquipmentStore] saveEquipmentTemplate 失败:', err);
      equipmentTemplates.value.delete(item.id);
      triggerRef(equipmentTemplates);
    });
  }
  function removeEquipmentTemplate(itemId: string): void {
    // P9-082 修复：保存被删除的模板引用，DB 删除失败时回滚内存 map 状态
    const removedItem = equipmentTemplates.value.get(itemId);
    equipmentTemplates.value.delete(itemId);
    triggerRef(equipmentTemplates);
    equipmentDbService.deleteEquipmentTemplate(itemId).catch(err => {
      console.error('[EquipmentStore] deleteEquipmentTemplate 失败:', err);
      // P9-082 修复：DB 删除失败时回滚内存 map 状态
      if (removedItem) {
        equipmentTemplates.value.set(itemId, removedItem);
        triggerRef(equipmentTemplates);
      }
    });
  }

  // ==================== 重置 ====================
  async function reset(): Promise<void> {
    const charId = currentCharacterId.value;
    if (charId) {
      for (const slot of Object.keys(equipment.value) as EquipmentSlot[]) {
        const eq = equipment.value[slot];
        if (!eq) continue;
        const { computeEquipBonus } = await import('../service');
        const bonus = computeEquipBonus(eq.item);
        if (Object.keys(bonus).length > 0) {
          await useCharacterStore().removeBonus(bonus);
        }
      }
    }
    equipment.value = getDefaultEquipment();
    if (charId) {
      const emptyIdMap = createEmptySlotMap<string | null>(null);
      await equipmentDbService.saveEquipment(charId, emptyIdMap);
    }
    equipmentTemplates.value = new Map();
  }

  return {
    // 状态
    equipment, equipmentTemplates, currentCharacterId, isLoading, persistError, appliedSetBonuses,
    // 计算属性
    totalStats, equippedCount, slotList, weaponSlots, armorSlots, activeSetBonuses,
    // 持久化
    persist,
    // 初始化 & 重置
    initialize, reset,
    // 查询
    getEquipment, getEquippedItem, getEquipmentTemplate,
    // 模板管理
    addEquipmentTemplate, removeEquipmentTemplate,
    // 回调
    getInventoryCallbacks,
  };
}

export type EquipmentState = ReturnType<typeof useEquipmentState>;
