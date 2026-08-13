/**
 * @fileoverview 装备模块状态管理（Pinia Store — 组合入口）
 * @description P3-155 拆分后，Store 仅负责组合各 composable 并暴露扁平公共 API。
 *              状态/持久化/初始化在 useEquipmentState，套装计算在 useSetBonus，
 *              装备穿卸在 useEquipmentOps。
 * @module equipment
 */
import { defineStore } from 'pinia';
import { useEquipmentState, setInventoryCallbacks, clearInventoryCallbacks } from './composables/useEquipmentState';
import { useSetBonus } from './composables/useSetBonus';
import { useEquipmentOps } from './composables/useEquipmentOps';
import { useCharacterStore } from '@/modules/character/store';
import { equipmentDbService } from './db';
import { createEmptySlotMap, computeEquipBonus } from './service';
import type { EquipmentSlot } from './types';

// 重新导出回调管理函数（供 GameBootstrap 调用）
export { setInventoryCallbacks, clearInventoryCallbacks };

export const useEquipmentStore = defineStore('equipment', () => {
  const state = useEquipmentState();
  const setBonus = useSetBonus(state);
  const ops = useEquipmentOps(state, setBonus);

  async function initialize(characterId: string): Promise<void> {
    await state.initialize(characterId);
    // P9-006 修复：角色加载时对齐 diff 基线，不重复 applyBonus（bonusStats 已从 DB 恢复）
    setBonus.syncAppliedBonuses();
  }

  async function reset(): Promise<void> {
    const charId = state.currentCharacterId.value;
    if (charId) {
      for (const slot of Object.keys(state.equipment.value) as EquipmentSlot[]) {
        const eq = state.equipment.value[slot];
        if (!eq) continue;
        const bonus = computeEquipBonus(eq.item);
        if (Object.keys(bonus).length > 0) {
          await useCharacterStore().removeBonus(bonus);
        }
      }
    }
    state.equipment.value = createEmptySlotMap(null);

    if (charId) {
      await setBonus.reapplySetBonuses();
      const emptyIdMap = createEmptySlotMap<string | null>(null);
      await equipmentDbService.saveEquipment(charId, emptyIdMap);
    }
    state.equipmentTemplates.value = new Map();
  }

  return {
    // 状态
    equipment: state.equipment,
    equipmentTemplates: state.equipmentTemplates,
    currentCharacterId: state.currentCharacterId,
    isLoading: state.isLoading,
    persistError: state.persistError,

    // 计算属性
    totalStats: state.totalStats,
    equippedCount: state.equippedCount,
    slotList: state.slotList,
    weaponSlots: state.weaponSlots,
    armorSlots: state.armorSlots,
    activeSetBonuses: state.activeSetBonuses,

    // 生命周期
    initialize,
    reset,

    // 装备操作
    equipItem: ops.equipItem,
    unequipItem: ops.unequipItem,

    // 查询
    getEquipment: state.getEquipment,
    getEquippedItem: state.getEquippedItem,
    canEquip: ops.canEquip,
    isSlotLocked: ops.isSlotLocked,
    getEquipmentTemplate: state.getEquipmentTemplate,

    // 模板管理
    addEquipmentTemplate: state.addEquipmentTemplate,
    removeEquipmentTemplate: state.removeEquipmentTemplate,
  };
});
