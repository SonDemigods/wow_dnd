/**
 * @fileoverview 背包物品操作 Composable（P3-155 拆分自 store.ts）
 * @description 提供添加、移除、丢弃、整理物品功能。
 * @module inventory/composables
 */
import { computeStackResult, MAX_STACK, INVENTORY_SIZE, sortItems } from '../service';
import type { InventoryState } from './useInventoryState';
import type { InventoryItem } from '../types';

export function useInventoryItems(state: InventoryState) {
  const { inventory, itemTemplates, currentCharacterId, persistInventory, logItemAcquired, logItemDropped, notifyItemCollected, sortBy, sortOrder } = state;

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

    // P9-048 修复：复用已取出的 itemTemplate 变量，避免重复 get
    if (itemTemplate) logItemDropped(itemTemplate.name, dropCount);
    return true;
  }

  async function dropItemsByIndices(indices: number[]): Promise<boolean> {
    if (indices.length === 0) return false;
    const validIndices = indices.filter(index => {
      if (index < 0 || index >= inventory.value.length) return false;
      const invItem = inventory.value[index];
      const itemTemplate = itemTemplates.value.get(invItem.itemId);
      return itemTemplate?.kind !== 'quest';
    });
    if (validIndices.length === 0) return false;

    // P9-014 修复：批量丢弃前记录日志
    // P11-306 修复：await logItemDropped，避免 fire-and-forget 异步
    for (const index of validIndices) {
      const invItem = inventory.value[index];
      const itemTemplate = itemTemplates.value.get(invItem.itemId);
      if (itemTemplate) await logItemDropped(itemTemplate.name, invItem.count);
    }

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
        const itemMaxStack = itemInfo.maxStack ?? MAX_STACK;
        let remaining = totalCount;
        while (remaining > 0) {
          const stackSize = Math.min(remaining, itemMaxStack);
          newInventory.push({ itemId, count: stackSize });
          remaining -= stackSize;
        }
      }
    });

    // P9-053 修复：整理后按用户排序偏好（sortBy/sortOrder）排序，而非硬编码稀有度+名称
    inventory.value = sortItems(newInventory, itemTemplates.value, sortBy.value, sortOrder.value);
    persistInventory();
  }

  return { addItem, removeItem, removeItemByIndex, dropItemByIndex, dropItemsByIndices, organizeInventory };
}
