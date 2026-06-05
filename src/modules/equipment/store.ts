/**
 * 装备模块状态管理
 * 
 * Store 是装备数据的唯一持有者，Service 作为纯业务逻辑层供 Store 调用。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EquipmentItem, EquipmentSlot, EquippedItem } from './types';
import type { Stats } from '../character/types';
import type { ItemRarity } from '../inventory/types';
import { equipmentService } from './service';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 稀有度配置
 */
const RARITY_CONFIGS: Record<ItemRarity, { name: string; color: string; multiplier: number }> = {
  common: { name: '普通', color: '#9d9d9d', multiplier: 1.0 },
  uncommon: { name: '优秀', color: '#1eff00', multiplier: 1.5 },
  rare: { name: '稀有', color: '#0070dd', multiplier: 2.0 },
  epic: { name: '史诗', color: '#a335ee', multiplier: 3.0 },
  legendary: { name: '传说', color: '#ff8000', multiplier: 5.0 }
};

/**
 * 槽位配置
 */
const SLOT_CONFIG: Record<EquipmentSlot, { name: string; icon: string }> = {
  weapon1: { name: '主手', icon: '⚔️' },
  weapon2: { name: '副手', icon: '🛡️' },
  armor1: { name: '头部', icon: '🪖' },
  armor2: { name: '胸部', icon: '🦺' },
  armor3: { name: '腿部', icon: '👖' },
  armor4: { name: '鞋子', icon: '👢' }
};

/**
 * 装备状态存储
 */
export const useEquipmentStore = defineStore('equipment', () => {
  // 状态
  const equipment = ref<Record<EquipmentSlot, EquippedItem | null>>({
    weapon1: null,
    weapon2: null,
    armor1: null,
    armor2: null,
    armor3: null,
    armor4: null
  });
  const isLoading = ref(false);

  /** 从 Service 同步装备数据到 Store */
  function syncFromService(): void {
    equipment.value = equipmentService.getEquipment();
  }

  // 计算属性
  const totalStats = computed<Stats>(() => {
    const stats: Stats = {
      str: 0,
      dex: 0,
      con: 0,
      int: 0,
      wis: 0,
      cha: 0
    };
    
    Object.values(equipment.value).forEach(equippedItem => {
      if (equippedItem && equippedItem.item.bonus) {
        const bonus = equipmentService.calculateRarityBonus(
          equippedItem.item.bonus,
          equippedItem.item.rarity
        );
        Object.keys(bonus).forEach(key => {
          const statKey = key as keyof Stats;
          stats[statKey] += bonus[statKey] || 0;
        });
      }
    });
    
    return stats;
  });

  const equippedCount = computed(() => {
    return Object.values(equipment.value).filter(Boolean).length;
  });

  const slotList = computed(() => {
    return Object.entries(SLOT_CONFIG).map(([key, config]) => ({
      id: key as EquipmentSlot,
      name: config.name,
      icon: config.icon,
      equippedItem: equipment.value[key as EquipmentSlot],
      isWeapon: key.startsWith('weapon')
    }));
  });

  const weaponSlots = computed(() => {
    return slotList.value.filter(slot => slot.isWeapon);
  });

  const armorSlots = computed(() => {
    return slotList.value.filter(slot => !slot.isWeapon);
  });

  // 方法
  async function loadEquipment(): Promise<void> {
    isLoading.value = true;
    await equipmentService.initialize();
    syncFromService();
    isLoading.value = false;
  }

  async function equipItem(slot: EquipmentSlot, item: EquipmentItem): Promise<boolean> {
    const success = await equipmentService.equipItem(slot, item);
    if (success) {
      syncFromService();
    }
    return success;
  }

  async function unequipItem(slot: EquipmentSlot): Promise<EquippedItem | null> {
    const result = await equipmentService.unequipItem(slot);
    if (result) {
      syncFromService();
    }
    return result;
  }

  function getEquippedItem(slot: EquipmentSlot): EquippedItem | null {
    return equipmentService.getEquippedItem(slot);
  }

  function canEquip(item: EquipmentItem, slot?: EquipmentSlot): boolean {
    return equipmentService.canEquip(item, slot);
  }

  function getRarityConfig(rarity: ItemRarity) {
    return RARITY_CONFIGS[rarity];
  }

  function getRarityColor(rarity: ItemRarity): string {
    return RARITY_CONFIGS[rarity].color;
  }

  function getEquipmentTemplate(itemId: string): EquipmentItem | null {
    return equipmentService.getEquipmentTemplate(itemId);
  }

  function addEquipmentTemplate(item: EquipmentItem): void {
    equipmentService.addEquipmentTemplate(item);
  }

  function removeEquipmentTemplate(itemId: string): void {
    equipmentService.removeEquipmentTemplate(itemId);
  }

  function setCharacter(characterId: string): void {
    equipmentService.setCharacter(characterId);
    syncFromService();
  }

  function reset(): void {
    equipmentService.reset();
    equipment.value = {
      weapon1: null,
      weapon2: null,
      armor1: null,
      armor2: null,
      armor3: null,
      armor4: null
    };
  }

  /**
   * 跨模块事件监听
   */
  function setupCrossModuleListeners(): void {
    eventBus.onGroup('equipmentStore', GameEvents.CHARACTER_SELECTED, (data) => {
      if (data?.characterId) {
        setCharacter(data.characterId);
      }
    });

    eventBus.onGroup('equipmentStore', GameEvents.CHARACTER_LOGOUT, () => {
      equipment.value = {
        weapon1: null,
        weapon2: null,
        armor1: null,
        armor2: null,
        armor3: null,
        armor4: null
      };
    });
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('equipmentStore');
  }

  return {
    // 状态
    equipment,
    isLoading,
    
    // 计算属性
    totalStats,
    equippedCount,
    slotList,
    weaponSlots,
    armorSlots,
    
    // 方法
    loadEquipment,
    equipItem,
    unequipItem,
    getEquippedItem,
    canEquip,
    getRarityConfig,
    getRarityColor,
    getEquipmentTemplate,
    addEquipmentTemplate,
    removeEquipmentTemplate,
    setCharacter,
    reset,
    setupCrossModuleListeners,
    dispose
  };
});