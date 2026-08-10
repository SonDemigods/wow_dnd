/**
 * @fileoverview 物品使用效果 Composable（P3-155 拆分自 store.ts）
 * @description 提供消耗品使用逻辑，包括效果应用和物品消耗。
 * @module inventory/composables
 */
import { useCharacterStore } from '@/modules/character/store';
import { findItemIndex, computeUseEffect, computeStatBonus } from '../service';
import { hasCapability } from '../../item/capabilityRegistry';
import type { InventoryState } from './useInventoryState';

export function useItemEffect(state: InventoryState) {
  const { inventory, itemTemplates, currentCharacterId, persistInventory, logItemUsed } = state;

  async function useItem(itemId: string): Promise<boolean> {
    if (!currentCharacterId.value) return false;

    const idx = findItemIndex(inventory.value, itemId);
    if (idx === -1) return false;

    const invItem = inventory.value[idx];
    const itemTemplate = itemTemplates.value.get(itemId);
    if (!itemTemplate || !hasCapability(itemTemplate, 'usable')) return false;

    const characterStore = useCharacterStore();

    if (itemTemplate.levelRequirement && characterStore.level < itemTemplate.levelRequirement) {
      return false;
    }

    const effect = computeUseEffect(itemTemplate);
    if (effect) {
      const { type, value } = effect;
      if (type === 'health_restore' && typeof value === 'number' && value > 0) {
        await characterStore.receiveHeal(value);
      } else if (type === 'mana_restore' && typeof value === 'number' && value > 0) {
        await characterStore.changeMp(value);
      } else {
        // P6-050 修复：未处理的效果类型（如 buff/physical_damage 等），拒绝消耗物品
        if (import.meta.env.DEV) {
          console.warn(
            `[InventoryStore] 消耗品 ${itemTemplate.id} (${itemTemplate.name}) 的效果类型 ${type} 未被处理，已阻止消耗。`
          );
        }
        return false;
      }
    }

    const statBonus = computeStatBonus(itemTemplate);
    if (statBonus && Object.keys(statBonus).length > 0) {
      if (hasCapability(itemTemplate, 'attribute_potion')) {
        await characterStore.applyPotionBonus(statBonus);
      } else {
        if (import.meta.env.DEV) {
          console.warn(
            `[InventoryStore] 消耗品 ${itemTemplate.id} (${itemTemplate.name}) 配置了 stat 效果，` +
            `使用时将永久叠加到 bonusStats。建议改为 buff 系统实现临时增益。`
          );
        }
        await characterStore.applyBonus(statBonus);
      }
    }

    if (invItem.count > 1) {
      inventory.value = inventory.value.map((item, i) =>
        i === idx ? { ...item, count: item.count - 1 } : item
      );
    } else {
      inventory.value = inventory.value.filter((_, i) => i !== idx);
    }

    await persistInventory();
    logItemUsed(itemTemplate.name);
    return true;
  }

  async function useItemByIndex(index: number): Promise<boolean> {
    if (index < 0 || index >= inventory.value.length) return false;
    return useItem(inventory.value[index].itemId);
  }

  return { useItem, useItemByIndex };
}
