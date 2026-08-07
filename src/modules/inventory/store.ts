/**
 * @fileoverview 背包模块状态管理（Pinia Store — 组合入口）
 * @description P3-155 拆分后，Store 仅负责组合各 composable 并暴露扁平公共 API。
 *              状态/持久化/初始化在 useInventoryState，物品操作在 useInventoryItems，
 *              筛选排序在 useInventoryFilter，物品使用在 useItemEffect。
 * @module inventory
 */
import { defineStore } from 'pinia';
import { useInventoryState, setInventoryExternalCallbacks, clearInventoryExternalCallbacks } from './composables/useInventoryState';
import { useInventoryItems } from './composables/useInventoryItems';
import { useInventoryFilter } from './composables/useInventoryFilter';
import { useItemEffect } from './composables/useItemEffect';

// 重新导出回调管理函数（供 GameBootstrap 调用）
export { setInventoryExternalCallbacks, clearInventoryExternalCallbacks };

export const useInventoryStore = defineStore('inventory', () => {
  const state = useInventoryState();
  const items = useInventoryItems(state);
  const filter = useInventoryFilter(state);
  const effect = useItemEffect(state);

  async function loadInventory(): Promise<void> {
    if (state.currentCharacterId.value) {
      await state.initialize(state.currentCharacterId.value);
    }
  }

  return {
    // 状态
    inventory: state.inventory,
    itemTemplates: state.itemTemplates,
    filters: state.filters,
    sortBy: state.sortBy,
    sortOrder: state.sortOrder,
    searchKeyword: state.searchKeyword,
    currentCharacterId: state.currentCharacterId,
    isLoading: state.isLoading,
    persistError: state.persistError,

    // 计算属性
    filteredInventory: state.filteredInventory,
    emptySlots: state.emptySlots,
    isFull: state.isFull,
    totalValue: state.totalValue,
    itemCountByKind: state.itemCountByKind,
    allItemKinds: state.allItemKinds,
    allRarities: state.allRarities,

    // 初始化
    initialize: state.initialize,
    loadInventory,

    // 物品操作
    addItem: items.addItem,
    removeItem: items.removeItem,
    removeItemByIndex: items.removeItemByIndex,
    dropItemByIndex: items.dropItemByIndex,
    dropItemsByIndices: items.dropItemsByIndices,
    organizeInventory: items.organizeInventory,

    // 物品使用
    useItem: effect.useItem,
    useItemByIndex: effect.useItemByIndex,

    // 持久化
    flushPersist: state.flushPersist,

    // 查询
    getItemInfo: state.getItemInfo,
    getAllItems: state.getAllItems,

    // 筛选排序
    searchItems: filter.searchItems,
    filterInventory: filter.filterInventory,
    updateSort: filter.updateSort,
    setFilters: filter.setFilters,
    setSearchKeyword: filter.setSearchKeyword,
    resetFilters: filter.resetFilters,

    // 模板管理
    addItemTemplate: state.addItemTemplate,
    removeItemTemplate: state.removeItemTemplate,

    // 重置
    resetInventory: state.resetInventory,
  };
});
