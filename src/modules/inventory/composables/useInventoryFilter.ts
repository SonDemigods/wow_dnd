/**
 * @fileoverview 背包筛选排序 Composable（P3-155 拆分自 store.ts）
 * @description 提供筛选、排序、搜索功能。
 * @module inventory/composables
 */
import { sortAndFilterInventory } from '../service';
import type { InventoryState } from './useInventoryState';
import type { InventoryItem, SortField, SortOrder, ItemFilters } from '../types';

export function useInventoryFilter(state: InventoryState) {
  const { inventory, itemTemplates, filters, sortBy, sortOrder, searchKeyword } = state;

  function searchItems(keyword: string): InventoryItem[] {
    return sortAndFilterInventory(inventory.value, itemTemplates.value, {}, sortBy.value, sortOrder.value, keyword);
  }

  function filterInventory(filtersParam: ItemFilters): InventoryItem[] {
    return sortAndFilterInventory(inventory.value, itemTemplates.value, filtersParam, sortBy.value, sortOrder.value, searchKeyword.value);
  }

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

  return { searchItems, filterInventory, updateSort, setFilters, setSearchKeyword, resetFilters };
}
