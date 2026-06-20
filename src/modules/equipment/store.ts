/**
 * 装备模块状态管理（Store 核心架构）
 * 
 * Store 是装备数据的唯一持有者，所有响应式状态集中管理。
 * Action 负责编排：调用纯函数 → 更新 Store → 调用其他 Store Action → 调用 DB 持久化。
 * 跨模块通信通过直接调用其他 Store 的 Action 实现，不再通过 EventBus。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EquipmentItem, EquipmentSlot, EquippedItem } from './types';
import type { Stats } from '../character/types';
import type { ItemRarity } from '../inventory/types';
import { equipmentDbService } from './db';
import { useLogStore } from '../log/store';
import { generateLogId } from '../log/service';
import { RARITY_CONFIG } from '../../config/inventory';
import { useCharacterStore } from '../character/store';
import { useInventoryStore } from '../inventory/store';
import { validateSlot, computeEquipBonus, canEquipItem, getEquipmentBySlot } from './service';

/**
 * 槽位配置（UI 展示用）
 */
const SLOT_CONFIG: Record<EquipmentSlot, { name: string; icon: string }> = {
  weapon1: { name: '主手', icon: 'game-icons:broadsword' },
  weapon2: { name: '副手', icon: 'game-icons:checked-shield' },
  armor1: { name: '头部', icon: 'game-icons:visored-helm' },
  armor2: { name: '胸部', icon: 'game-icons:chest-armor' },
  armor3: { name: '腿部', icon: 'game-icons:leg-armor' },
  armor4: { name: '鞋子', icon: 'game-icons:leather-boot' }
};

/**
 * 获取默认空装备状态
 */
function getDefaultEquipment(): Record<EquipmentSlot, EquippedItem | null> {
  return {
    weapon1: null,
    weapon2: null,
    armor1: null,
    armor2: null,
    armor3: null,
    armor4: null
  };
}

/**
 * 装备状态存储
 */
export const useEquipmentStore = defineStore('equipment', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================
  const equipment = ref<Record<EquipmentSlot, EquippedItem | null>>(getDefaultEquipment());
  const equipmentTemplates = ref<Map<string, EquipmentItem>>(new Map());
  const currentCharacterId = ref<string | null>(null);
  const isLoading = ref(false);

  // ==================== 计算属性 ====================
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
        Object.keys(equippedItem.item.bonus).forEach(key => {
          const statKey = key as keyof Stats;
          stats[statKey] += equippedItem.item.bonus![statKey] || 0;
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

  // ==================== 辅助方法 ====================

  /** 持久化装备数据到数据库（仅存装备 ID） */
  async function persist(): Promise<void> {
    if (currentCharacterId.value) {
      // 提取装备 ID 映射
      const idMap: Record<EquipmentSlot, string | null> = {
        weapon1: null,
        weapon2: null,
        armor1: null,
        armor2: null,
        armor3: null,
        armor4: null
      };
      for (const slot of Object.keys(equipment.value) as EquipmentSlot[]) {
        idMap[slot] = equipment.value[slot]?.item.id ?? null;
      }
      await equipmentDbService.saveEquipment(currentCharacterId.value, idMap);
    }
  }

  // ==================== Action：初始化 ====================

  /**
   * 初始化装备模块：从 DB 加载装备 ID 映射和模板，解析为完整装备对象
   * @param characterId - 角色ID
   */
  async function initialize(characterId: string): Promise<void> {
    isLoading.value = true;
    currentCharacterId.value = characterId;

    // 1. 先加载装备模板（后续解析 ID 需要）
    const templates = await equipmentDbService.getAllEquipmentTemplates();
    const map = new Map<string, EquipmentItem>();
    templates.forEach(item => map.set(item.id, item));
    equipmentTemplates.value = map;

    // 2. 从 DB 加载装备 ID 映射
    const idMap = await equipmentDbService.getEquipment(characterId);

    // 3. 从模板解析 ID 为完整 EquippedItem 对象
    const resolved: Record<EquipmentSlot, EquippedItem | null> = getDefaultEquipment();
    for (const slot of Object.keys(idMap) as EquipmentSlot[]) {
      const itemId = idMap[slot];
      if (itemId) {
        const template = map.get(itemId);
        if (template) {
          resolved[slot] = { item: template, equippedAt: Date.now() };
        }
      }
    }
    equipment.value = resolved;

    isLoading.value = false;
  }

  // ==================== Action：装备物品 ====================

  /**
   * 将物品装备到指定槽位
   * @param slot - 目标槽位
   * @param item - 装备物品
   * @returns 是否装备成功
   */
  async function equipItem(slot: EquipmentSlot, item: EquipmentItem): Promise<boolean> {
    if (!currentCharacterId.value) return false;

    // 1. 校验槽位
    if (!validateSlot(item, slot)) {
      return false;
    }

    // 2. 检查等级要求
    const characterStore = useCharacterStore();
    if (item.levelRequirement && characterStore.level < item.levelRequirement) {
      return false;
    }

    // 3. 获取当前槽位的旧装备（如果有的话，需要卸下并放回背包）
    const currentEquipped = equipment.value[slot];

    // 4. 如果有旧装备，先移除它的属性加成，并放回背包
    if (currentEquipped) {
      const oldBonus = computeEquipBonus(currentEquipped.item);
      if (Object.keys(oldBonus).length > 0) {
        await characterStore.removeBonus(oldBonus);
      }

      // 将旧装备放回背包
      const inventoryStore = useInventoryStore();
      inventoryStore.addItem(currentEquipped.item.id, 1);
    }

    // 5. 装备新物品
    equipment.value[slot] = {
      item,
      equippedAt: Date.now()
    };

    // 6. 应用新装备的属性加成
    const newBonus = computeEquipBonus(item);
    if (Object.keys(newBonus).length > 0) {
      await characterStore.applyBonus(newBonus);
    }

    // 7. 持久化到数据库
    await persist();

    // 8. 记录冒险日志
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'item',
      message: `装备了：${item.name}`,
      icon: 'game-icons:crossed-swords'
    });

    return true;
  }

  // ==================== Action：卸下装备 ====================

  /**
   * 卸下指定槽位的装备
   * @param slot - 目标槽位
   * @returns 卸下的装备（失败返回 null）
   */
  async function unequipItem(slot: EquipmentSlot): Promise<EquippedItem | null> {
    if (!currentCharacterId.value) return null;

    const equippedItem = equipment.value[slot];
    if (!equippedItem) return null;

    // 1. 移除属性加成
    const bonus = computeEquipBonus(equippedItem.item);
    if (Object.keys(bonus).length > 0) {
      const characterStore = useCharacterStore();
      await characterStore.removeBonus(bonus);
    }

    // 2. 清空槽位
    equipment.value[slot] = null;

    // 3. 持久化到数据库
    await persist();

    // 4. 将卸下的装备放回背包
    const inventoryStore = useInventoryStore();
    inventoryStore.addItem(equippedItem.item.id, 1);

    // 5. 记录冒险日志
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'item',
      message: `卸下了：${equippedItem.item.name}`,
      icon: 'game-icons:downgrade'
    });

    return equippedItem;
  }

  // ==================== Action：查询 ====================

  /** 获取当前装备状态（返回副本，纯查询） */
  function getEquipment(): Record<EquipmentSlot, EquippedItem | null> {
    return { ...equipment.value };
  }

  /** 获取指定槽位的装备 */
  function getEquippedItem(slot: EquipmentSlot): EquippedItem | null {
    return getEquipmentBySlot(equipment.value, slot);
  }

  /**
   * 检查物品是否可以装备
   * @param item - 装备物品
   * @param slot - 可选的目标槽位
   * @returns 是否可以装备
   */
  function canEquip(item: EquipmentItem, slot?: EquipmentSlot): boolean {
    // 检查等级要求
    if (item.levelRequirement) {
      const characterStore = useCharacterStore();
      if (characterStore.level < item.levelRequirement) {
        return false;
      }
    }

    // 如果指定了槽位，检查槽位是否匹配
    if (slot) {
      return validateSlot(item, slot);
    }

    // 未指定槽位时，检查是否有可用的兼容槽位
    const result = canEquipItem(item, equipment.value);
    return result.canEquip;
  }

  /** 获取稀有度配置 */
  function getRarityConfig(rarity: ItemRarity) {
    return RARITY_CONFIG[rarity];
  }

  /** 获取稀有度颜色 */
  function getRarityColor(rarity: ItemRarity): string {
    return RARITY_CONFIG[rarity].color;
  }

  /** 获取装备模板 */
  function getEquipmentTemplate(itemId: string): EquipmentItem | null {
    return equipmentTemplates.value.get(itemId) || null;
  }

  /** 添加装备模板 */
  function addEquipmentTemplate(item: EquipmentItem): void {
    equipmentTemplates.value.set(item.id, item);
    equipmentDbService.saveEquipmentTemplate(item);
  }

  /** 删除装备模板 */
  function removeEquipmentTemplate(itemId: string): void {
    equipmentTemplates.value.delete(itemId);
    equipmentDbService.deleteEquipmentTemplate(itemId);
  }

  // ==================== Action：重置 ====================

  /**
   * 重置装备模块状态（退出角色时调用）
   * 移除所有装备属性加成，清空 Store 状态
   */
  async function reset(): Promise<void> {
    const charId = currentCharacterId.value;

    // 移除所有装备属性加成
    if (charId) {
      const characterStore = useCharacterStore();
      for (const eq of Object.values(equipment.value)) {
        if (eq) {
          const bonus = computeEquipBonus(eq.item);
          if (Object.keys(bonus).length > 0) {
            await characterStore.removeBonus(bonus);
          }
        }
      }
    }

    // 持久化清空后的装备状态
    equipment.value = getDefaultEquipment();
    if (charId) {
      await equipmentDbService.saveEquipment(charId, getDefaultEquipment());
    }

    // 清空 Store 状态
    currentCharacterId.value = null;
    equipmentTemplates.value = new Map();
  }

  // ==================== 生命周期 ====================

  /**
   * 清理资源
   * Store 核心架构下无需清理事件监听，跨模块通信通过直接 Store Action 调用实现。
   */
  function dispose(): void {
    // 无需清理（无事件监听）
  }

  return {
    // 状态
    equipment,
    equipmentTemplates,
    currentCharacterId,
    isLoading,

    // 计算属性
    totalStats,
    equippedCount,
    slotList,
    weaponSlots,
    armorSlots,

    // Action
    initialize,
    equipItem,
    unequipItem,
    getEquipment,
    getEquippedItem,
    canEquip,
    getRarityConfig,
    getRarityColor,
    getEquipmentTemplate,
    addEquipmentTemplate,
    removeEquipmentTemplate,
    reset,
    dispose
  };
});
