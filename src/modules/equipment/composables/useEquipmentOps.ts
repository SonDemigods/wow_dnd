/**
 * @fileoverview 装备穿卸操作 Composable（P3-155 拆分自 store.ts）
 * @description 提供装备/卸下装备的核心逻辑，含回滚保护。
 * @module equipment/composables
 */
import { useCharacterStore } from '@/modules/character/store';
import { useLogStore } from '@/modules/log/store';
import { generateLogId } from '@/modules/log/service';
import { errorReporter } from '@/utils/errorReport';
import {
  validateSlot, computeEquipBonus, canEquipItem, checkClassRestriction,
  SLOT_CONFIG, isSlotLockedByTwoHanded,
} from '../service';
import type { EquipmentState } from './useEquipmentState';
import type { EquipmentItem, EquipmentSlot, EquippedItem } from '../types';

export function useEquipmentOps(state: EquipmentState, setBonus: ReturnType<typeof import('./useSetBonus').useSetBonus>) {
  const { equipment, currentCharacterId, persist, persistError, getInventoryCallbacks } = state;

  async function removeBonusesFromSlot(slot: EquipmentSlot): Promise<void> {
    const eq = equipment.value[slot];
    if (!eq) return;
    const bonus = computeEquipBonus(eq.item);
    if (Object.keys(bonus).length > 0) {
      await useCharacterStore().removeBonus(bonus);
    }
  }

  async function applyBonusForSlot(slot: EquipmentSlot): Promise<void> {
    const eq = equipment.value[slot];
    if (!eq) return;
    const bonus = computeEquipBonus(eq.item);
    if (Object.keys(bonus).length > 0) {
      await useCharacterStore().applyBonus(bonus);
    }
  }

  async function doUnequip(slot: EquipmentSlot): Promise<EquippedItem | null> {
    const equippedItem = equipment.value[slot];
    if (!equippedItem) return null;

    const cb = getInventoryCallbacks();
    if (!cb.addItem()) {
      throw new Error('[EquipmentStore] inventoryAddItemCallback 未注入，无法卸下装备。请检查 GameBootstrap 初始化流程。');
    }

    await removeBonusesFromSlot(slot);
    equipment.value[slot] = null;

    const added = cb.addItem()!(equippedItem.item.id, 1);
    if (added <= 0) {
      equipment.value[slot] = equippedItem;
      await applyBonusForSlot(slot);
      throw new Error(`[EquipmentStore] 背包已满，无法卸下「${equippedItem.item.name}」。请先清理背包。`);
    }
    return equippedItem;
  }

  async function equipItem(slot: EquipmentSlot, item: EquipmentItem): Promise<boolean> {
    if (!currentCharacterId.value) return false;
    if (!validateSlot(item, slot)) return false;
    if (item.grip === 'two_handed' && slot === 'weapon1' && equipment.value.weapon2) return false;
    if (slot === 'weapon2' && isSlotLockedByTwoHanded(equipment.value, 'weapon2')) return false;

    const characterStore = useCharacterStore();
    if (item.levelRequirement && characterStore.level < item.levelRequirement) return false;
    if (!checkClassRestriction(item, characterStore.classId)) return false;

    const cb = getInventoryCallbacks();
    if (!cb.removeItem()) {
      console.warn('[EquipmentStore] inventoryRemoveItemCallback 未注入，无法装备物品。');
      return false;
    }
    const removed = cb.removeItem()!(item.id, 1);
    if (removed <= 0) return false;

    let previousEquipped: EquippedItem | null = null;
    try {
      previousEquipped = await doUnequip(slot);
    } catch (e) {
      console.error('[EquipmentStore] equipItem 卸下旧装备失败，回滚已移除的物品:', e);
      if (cb.addItem()) cb.addItem()!(item.id, 1);
      return false;
    }

    equipment.value[slot] = { item, equippedAt: Date.now() };

    try {
      const newBonus = computeEquipBonus(item);
      if (Object.keys(newBonus).length > 0) {
        await characterStore.applyBonus(newBonus);
      }
    } catch (e) {
      console.error('[EquipmentStore] equipItem applyBonus 失败，回滚装备状态:', e);
      equipment.value[slot] = null;
      if (cb.addItem()) cb.addItem()!(item.id, 1);
      if (previousEquipped) {
        if (cb.removeItem()) cb.removeItem()!(previousEquipped.item.id, 1);
        equipment.value[slot] = previousEquipped;
        try { await applyBonusForSlot(slot); } catch (rollbackErr) {
          console.error('[EquipmentStore] equipItem 回滚旧装备 bonus 失败:', rollbackErr);
        }
      }
      return false;
    }

    await setBonus.reapplySetBonuses();

    try {
      await persist();
    } catch (persistErr) {
      console.error('[EquipmentStore] equipItem persist 失败，回滚装备状态:', persistErr);
      persistError.value = persistErr instanceof Error ? persistErr.message : String(persistErr);
      errorReporter.report(persistErr, 'manual', {
        context: '装备持久化失败，已回滚装备和背包状态', characterId: currentCharacterId.value,
      });
      try {
        const newBonus = computeEquipBonus(item);
        if (Object.keys(newBonus).length > 0) await useCharacterStore().removeBonus(newBonus);
      } catch (rollbackErr) {
        console.error('[EquipmentStore] equipItem 回滚新装备 bonus 失败:', rollbackErr);
      }
      equipment.value[slot] = null;
      if (cb.addItem()) cb.addItem()!(item.id, 1);
      if (previousEquipped) {
        if (cb.removeItem()) cb.removeItem()!(previousEquipped.item.id, 1);
        equipment.value[slot] = previousEquipped;
        try { await applyBonusForSlot(slot); } catch (rollbackErr) {
          console.error('[EquipmentStore] equipItem 回滚旧装备 bonus 失败:', rollbackErr);
        }
      }
      await setBonus.reapplySetBonuses();
      if (cb.flushPersist()) await cb.flushPersist()!();
      return false;
    }

    useLogStore().addLogEntry({
      id: generateLogId(), timestamp: Date.now(), type: 'item',
      message: `装备了：${item.name}（${SLOT_CONFIG[slot].name}）`, icon: 'game-icons:crossed-swords'
    });
    return true;
  }

  async function unequipItem(slot: EquipmentSlot): Promise<EquippedItem | null> {
    if (!currentCharacterId.value) return null;
    const equippedItem = await doUnequip(slot);
    if (!equippedItem) return null;

    await setBonus.reapplySetBonuses();

    try {
      await persist();
    } catch (persistErr) {
      console.error('[EquipmentStore] unequipItem persist 失败，回滚装备状态:', persistErr);
      persistError.value = persistErr instanceof Error ? persistErr.message : String(persistErr);
      errorReporter.report(persistErr, 'manual', {
        context: '装备持久化失败，已回滚装备状态', characterId: currentCharacterId.value,
      });
      const cb = getInventoryCallbacks();
      if (cb.removeItem()) cb.removeItem()!(equippedItem.item.id, 1);
      equipment.value[slot] = equippedItem;
      try { await applyBonusForSlot(slot); } catch (rollbackErr) {
        console.error('[EquipmentStore] unequipItem 回滚装备 bonus 失败:', rollbackErr);
      }
      await setBonus.reapplySetBonuses();
      if (cb.flushPersist()) await cb.flushPersist()!();
      return null;
    }

    useLogStore().addLogEntry({
      id: generateLogId(), timestamp: Date.now(), type: 'item',
      message: `卸下了：${equippedItem.item.name}`, icon: 'game-icons:armor-downgrade'
    });
    return equippedItem;
  }

  function canEquip(item: EquipmentItem, slot?: EquipmentSlot): boolean {
    const characterStore = useCharacterStore();
    if (item.levelRequirement && characterStore.level < item.levelRequirement) return false;
    if (!checkClassRestriction(item, characterStore.classId)) return false;
    if (slot) {
      if (!validateSlot(item, slot)) return false;
      if (item.grip === 'two_handed' && slot === 'weapon1' && equipment.value.weapon2) return false;
      if (slot === 'weapon2' && isSlotLockedByTwoHanded(equipment.value, 'weapon2')) return false;
      return true;
    }
    return canEquipItem(item, equipment.value).canEquip;
  }

  function isSlotLocked(slot: EquipmentSlot): boolean {
    return isSlotLockedByTwoHanded(equipment.value, slot);
  }

  return { equipItem, unequipItem, canEquip, isSlotLocked };
}
