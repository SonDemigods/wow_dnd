/**
 * @fileoverview 背包物品操作 Composable（P3-155 拆分自 store.ts）
 * @description 提供添加、移除、丢弃、整理物品功能。
 * @module inventory/composables
 */
import { computeStackResult, MAX_STACK, INVENTORY_SIZE } from '../service';
import { getItemDisplayName } from '../../item/typeRegistry';
import { RARITY_ORDER } from '../service';
import type { InventoryState } from './useInventoryState';
import type { InventoryItem } from '../types';

export function useInventoryItems(state: InventoryState) {
  const { inventory, itemTemplates, currentCharacterId, persistInventory, logItemAcquired, logItemDropped, notifyItemCollected } = state;

  function addItem(itemId: string, quantity: number): number {
    if (!currentCharacterId.value || quantity <= 0) return 0;
    const itemTemplate = itemTemplates.value.get(itemId);
    if (!itemTemplate) return 0;

    let added = 0;
    const newInventory = inventory.value.map(item => ({ ...item }));

    if (itemTemplate.stackable) {
      // P9-013 修复：使用物品模板的 maxStack 替代硬编码 MAX_STACK
      const maxStack = itemTemplate.maxStack ?? MAX_STACK;
      for (let i = 0; i < newInventory.length && added < quantity; i++) {
        if (newInventory[i].itemId === itemId) {
          const result = computeStackResult(newInventory[i].count, quantity - added, maxStack);
          const delta = result.quantity - newInventory[i].count;
          newInventory[i] = { ...newInventory[i], count: result.quantity };
          added += delta;
        }
      }
    }

    const perSlot = itemTemplate.stackable ? (itemTemplate.maxStack ?? MAX_STACK) : 1;
    while (added < quantity && newInventory.length < INVENTORY_SIZE) {
      const slotCount = Math.min(quantity - added, perSlot);
      newInventory.push({ itemId, count: slotCount });
      added += slotCount;
    }

    if (added > 0) {
      inventory.value = newInventory;
      persistInventory();
      logItemAcquired(itemTemplate.name, added);
      notifyItemCollected(itemId, added);
    }
    return added;
  }

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
      persistInventory();
    }
    return removed;
  }

  function removeItemByIndex(index: number): number {
    if (index < 0 || index >= inventory.value.length) return 0;
    const invItem = inventory.value[index];
    const newInventory = [...inventory.value];
    newInventory.splice(index, 1);
    inventory.value = newInventory;
    persistInventory();
    return invItem.count;
  }

  function dropItemByIndex(index: number, count?: number): boolean {
    if (index < 0 || index >= inventory.value.length) return false;
    const invItem = inventory.value[index];
    const itemTemplate = itemTemplates.value.get(invItem.itemId);
    if (itemTemplate?.kind === 'quest') return false;

    // P8-205 修复：确保 dropCount 不超过实际堆叠数，日志用 dropCount
    const dropCount = Math.min(count ?? invItem.count, invItem.count);
    if (dropCount >= invItem.count) {
      inventory.value = inventory.value.filter((_, i) => i !== index);
    } else {
      inventory.value = inventory.value.map((item, i) =>
        i === index ? { ...item, count: item.count - dropCount } : item
      );
    }
    persistInventory();

    const droppedItem = itemTemplates.value.get(invItem.itemId);
    if (droppedItem) logItemDropped(droppedItem.name, dropCount);
    return true;
  }

  function dropItemsByIndices(indices: number[]): boolean {
    if (indices.length === 0) return false;
    const validIndices = indices.filter(index => {
      if (index < 0 || index >= inventory.value.length) return false;
      const invItem = inventory.value[index];
      const itemTemplate = itemTemplates.value.get(invItem.itemId);
      return itemTemplate?.kind !== 'quest';
    });
    if (validIndices.length === 0) return false;

    const sortedIndices = [...validIndices].sort((a, b) => b - a);
    const newInventory = [...inventory.value];
    sortedIndices.forEach(index => {
      if (index >= 0 && index < newInventory.length) {
        newInventory.splice(index, 1);
      }
    });
    inventory.value = newInventory;
    persistInventory();
    return true;
  }

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
        let remaining = totalCount;
        while (remaining > 0) {
          const stackSize = Math.min(remaining, MAX_STACK);
          newInventory.push({ itemId, count: stackSize });
          remaining -= stackSize;
        }
      }
    });

    newInventory.sort((a, b) => {
      const itemA = itemTemplates.value.get(a.itemId);
      const itemB = itemTemplates.value.get(b.itemId);
      const rarityA = RARITY_ORDER[itemA?.rarity || 'common'];
      const rarityB = RARITY_ORDER[itemB?.rarity || 'common'];
      if (rarityA !== rarityB) return rarityB - rarityA;
      const nameA = itemA ? getItemDisplayName(itemA) : '杂项';
      const nameB = itemB ? getItemDisplayName(itemB) : '杂项';
      return nameA.localeCompare(nameB);
    });

    inventory.value = newInventory;
    persistInventory();
  }

  return { addItem, removeItem, removeItemByIndex, dropItemByIndex, dropItemsByIndices, organizeInventory };
}
