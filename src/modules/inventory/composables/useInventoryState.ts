/**
 * @fileoverview 背包模块状态层（P3-155 拆分自 store.ts）
 * @description 持有所有背包响应式状态、计算属性、持久化逻辑和初始化流程。
 *              其他 composable（items/filter/effect）通过此模块返回的 state 对象读写共享状态。
 * @module inventory/composables
 */
import { ref, computed, shallowRef } from 'vue';
import type { Item, InventoryItem, SortField, SortOrder, ItemFilters, ItemRarity, ItemKind } from '../types';
import { inventoryDbService } from '../db';
import { unifiedItemTemplateCache } from '@/modules/item-template';
import { useLogStore } from '@/modules/log/store';
import { generateLogId } from '@/modules/log/service';
import { useGameStore } from '@/modules/game';
import { errorReporter } from '@/utils/errorReport';
import { RARITY_CONFIG } from '../../../config/inventory';
import { sortAndFilterInventory, INVENTORY_SIZE } from '../service';

/** 物品收集通知回调类型（ARCH-2 修复：回调注入替代 inventory → quest 静态依赖） */
type OnItemCollectedCallback = (itemId: string, quantity: number) => void;

let onItemCollectedCallback: OnItemCollectedCallback | null = null;

export function setInventoryExternalCallbacks(callbacks: {
  onItemCollected: OnItemCollectedCallback;
} | null): void {
  onItemCollectedCallback = callbacks?.onItemCollected ?? null;
}

export function clearInventoryExternalCallbacks(): void {
  onItemCollectedCallback = null;
}

export function useInventoryState() {
  // ==================== 状态 ====================
  const inventory = ref<InventoryItem[]>([]);
  const itemTemplates = shallowRef<Map<string, Item>>(new Map());
  const filters = ref<ItemFilters>({});
  const sortBy = ref<SortField>('kind');
  const sortOrder = ref<SortOrder>('asc');
  const searchKeyword = ref('');
  const gameStore = useGameStore();
  const currentCharacterId = computed<string | null>(() => gameStore.currentCharacterId);
  const isLoading = ref(false);
  const persistError = ref<string | null>(null);
  let pendingPersistPromise: Promise<void> | null = null;

  // ==================== 计算属性 ====================
  const filteredInventory = computed(() => {
    return sortAndFilterInventory(inventory.value, itemTemplates.value, filters.value, sortBy.value, sortOrder.value, searchKeyword.value);
  });
  const emptySlots = computed(() => INVENTORY_SIZE - inventory.value.length);
  const isFull = computed(() => inventory.value.length >= INVENTORY_SIZE);
  const totalValue = computed(() => {
    let total = 0;
    inventory.value.forEach(invItem => {
      const item = itemTemplates.value.get(invItem.itemId);
      if (item) total += item.value * invItem.count;
    });
    return total;
  });
  const itemCountByKind = computed(() => {
    const counts: Record<ItemKind, number> = { consumable: 0, material: 0, equipment: 0, quest: 0, currency: 0, misc: 0 };
    inventory.value.forEach(invItem => {
      const item = itemTemplates.value.get(invItem.itemId);
      if (item) counts[item.kind] += invItem.count;
    });
    return counts;
  });
  const allItemKinds = computed(() => {
    const kindNames: Record<ItemKind, string> = { consumable: '消耗品', material: '材料', equipment: '装备', quest: '任务物品', currency: '货币', misc: '杂项' };
    return (Object.keys(kindNames) as ItemKind[]).map(kind => ({ id: kind, name: kindNames[kind] }));
  });
  const allRarities = computed(() => {
    return Object.entries(RARITY_CONFIG).map(([key, value]) => ({ id: key as ItemRarity, name: value.name, color: value.color }));
  });

  // ==================== 持久化 ====================
  async function persistInventory(): Promise<void> {
    const charId = currentCharacterId.value;
    if (charId) {
      // P8-204 修复：串行化持久化，链式 .then() 确保顺序写入，避免竞态
      const promise = (pendingPersistPromise ?? Promise.resolve()).then(async () => {
        try {
          await inventoryDbService.saveInventory(charId, inventory.value);
          persistError.value = null;
        } catch (err) {
          persistError.value = err instanceof Error ? err.message : String(err);
          errorReporter.report(err, 'manual', {
            context: '背包数据持久化失败，UI 与 DB 状态可能不一致',
            characterId: charId, itemCount: inventory.value.length,
          });
        }
      });
      pendingPersistPromise = promise;
      return promise;
    }
  }

  async function flushPersist(): Promise<void> {
    if (pendingPersistPromise) {
      await pendingPersistPromise;
      pendingPersistPromise = null;
    }
  }

  // ==================== 模板加载 ====================
  async function loadItemTemplates(): Promise<void> {
    const items = await unifiedItemTemplateCache.getAll();
    const map = new Map<string, Item>();
    items.forEach(item => map.set(item.id, item));
    itemTemplates.value = map;
  }

  // ==================== 初始化 ====================
  async function initialize(characterId: string): Promise<void> {
    isLoading.value = true;
    if (characterId) {
      inventory.value = await inventoryDbService.getInventory(characterId);
    } else {
      inventory.value = [];
    }
    await loadItemTemplates();
    isLoading.value = false;
  }

  // ==================== 查询 ====================
  function getItemInfo(itemId: string): Item | null {
    return itemTemplates.value.get(itemId) || null;
  }
  function getAllItems(): Item[] {
    return Array.from(itemTemplates.value.values());
  }

  // ==================== 模板管理 ====================
  function addItemTemplate(item: Item): void {
    const newMap = new Map(itemTemplates.value);
    newMap.set(item.id, item);
    itemTemplates.value = newMap;
    // P8-206 修复：DB 失败时上报 errorReporter，而非仅 console.error
    inventoryDbService.saveItemTemplate(item).catch(err => {
      console.error('[InventoryStore] 保存物品模板失败:', item.id, err);
      errorReporter.report(err);
    });
  }
  function removeItemTemplate(itemId: string): void {
    const newMap = new Map(itemTemplates.value);
    newMap.delete(itemId);
    itemTemplates.value = newMap;
    // P8-206 修复：DB 失败时上报 errorReporter，而非仅 console.error
    inventoryDbService.deleteItemTemplate(itemId).catch(err => {
      console.error('[InventoryStore] 删除物品模板失败:', itemId, err);
      errorReporter.report(err);
    });
  }

  // ==================== 重置 ====================
  function resetInventory(): void {
    inventory.value = [];
    persistInventory();
  }

  // ==================== 日志辅助 ====================
  function logItemAcquired(itemName: string, count: number): void {
    const countText = count > 1 ? ` x${count}` : '';
    useLogStore().addLogEntry({
      id: generateLogId(), timestamp: Date.now(), type: 'item',
      message: `获得了物品：${itemName}${countText}`, icon: 'game-icons:chest'
    });
  }
  function logItemUsed(itemName: string): void {
    useLogStore().addLogEntry({
      id: generateLogId(), timestamp: Date.now(), type: 'item',
      message: `使用了：${itemName}`, icon: 'game-icons:potion-ball'
    });
  }
  function logItemDropped(itemName: string, count: number): void {
    const countText = count > 1 ? ` x${count}` : '';
    useLogStore().addLogEntry({
      id: generateLogId(), timestamp: Date.now(), type: 'item',
      message: `丢弃了：${itemName}${countText}`, icon: 'game-icons:trash-can'
    });
  }

  // ==================== 回调通知 ====================
  function notifyItemCollected(itemId: string, quantity: number): void {
    onItemCollectedCallback?.(itemId, quantity);
  }

  return {
    // 状态
    inventory, itemTemplates, filters, sortBy, sortOrder, searchKeyword,
    currentCharacterId, isLoading, persistError,
    // 计算属性
    filteredInventory, emptySlots, isFull, totalValue, itemCountByKind, allItemKinds, allRarities,
    // 持久化
    persistInventory, flushPersist,
    // 初始化
    initialize, loadItemTemplates,
    // 查询
    getItemInfo, getAllItems,
    // 模板管理
    addItemTemplate, removeItemTemplate,
    // 重置
    resetInventory,
    // 日志辅助
    logItemAcquired, logItemUsed, logItemDropped,
    // 回调
    notifyItemCollected,
  };
}

export type InventoryState = ReturnType<typeof useInventoryState>;
