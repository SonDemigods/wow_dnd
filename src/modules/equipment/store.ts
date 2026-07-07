/**
 * 装备模块状态管理（Store 核心架构）
 *
 * ## 模块定位
 *
 * Store 是装备数据的唯一持有者，所有响应式状态集中在此管理。
 * 不通过 EventBus 广播事件 —— 跨模块通信直接调用其他 Store 的 Action。
 *
 * ## 数据流
 *
 * ```
 * UI Layer ──→ Store Action ──→ service 纯函数（业务校验）
 *                    │                      ↓
 *                    ├── 更新 ref 状态（响应式驱动 UI）
 *                    ├── 调用其他 Store Action（角色属性、背包、日志）
 *                    └── 调用 DB 层持久化
 * ```
 *
 * ## 存储策略
 *
 * char_equipment 表仅存装备 ID 映射（Record<EquipmentSlot, string | null>），
 * 完整装备属性通过 equipmentTemplates（内存 Map）按 ID 获取。
 * 这样装备属性变更只需更新模板，无需遍历所有角色数据。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EquipmentItem, EquipmentSlot, EquippedItem } from './types';
import type { Stats } from '../character/types';
import { equipmentDbService } from './db';
import { useLogStore } from '../log/store';
import { generateLogId } from '../log/service';
import { useCharacterStore } from '../character/store';
import { useInventoryStore } from '../inventory/store';
import { validateSlot, computeEquipBonus, canEquipItem, getEquipmentBySlot, createEmptySlotMap, checkClassRestriction, getActiveSetBonuses } from './service';

/**
 * 槽位配置（UI 展示用）
 *
 * 定义每个装备槽位的展示名称和图标。
 * 与 ALL_EQUIPMENT_SLOTS（service.ts）共同构成槽位定义的完整视角。
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
 * 获取默认空装备状态（全部槽位为 null）
 *
 * 复用 service 层的 createEmptySlotMap 工厂函数，确保与 DB 层的默认值生成逻辑一致。
 */
function getDefaultEquipment(): Record<EquipmentSlot, EquippedItem | null> {
  return createEmptySlotMap<EquippedItem | null>(null);
}

/**
 * 装备 Store
 *
 * ## 导出接口分类
 *
 * | 分类 | 成员 | 说明 |
 * |------|------|------|
 * | 响应式状态 | `equipment`, `equipmentTemplates`, `currentCharacterId`, `isLoading` | 外部可直接读取 |
 * | 计算属性 | `totalStats`, `equippedCount`, `slotList`, `weaponSlots`, `armorSlots` | 派生状态 |
 * | 生命周期 | `initialize`, `reset` | 角色进入/退出时调用 |
 * | 装备操作 | `equipItem`, `unequipItem` | 装备/卸下操作 |
 * | 查询 | `getEquipment`, `getEquippedItem`, `canEquip`, `getEquipmentTemplate` | 纯查询，无副作用 |
 * | 模板管理 | `addEquipmentTemplate`, `removeEquipmentTemplate` | 装备模板的增删 |
 */
export const useEquipmentStore = defineStore('equipment', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================

  /** 当前角色装备状态：Record<槽位, 已装备物品 | null> */
  const equipment = ref<Record<EquipmentSlot, EquippedItem | null>>(getDefaultEquipment());

  /** 装备模板缓存：Map<装备ID, 装备完整数据>，从 config_equipmentItems 表加载 */
  const equipmentTemplates = ref<Map<string, EquipmentItem>>(new Map());

  /** 当前活跃角色 ID，null 表示未进入角色 */
  const currentCharacterId = ref<string | null>(null);

  /** 数据加载状态标识 */
  const isLoading = ref(false);

  // ==================== 计算属性 ====================

  /**
   * 当前装备提供的总属性加成
   *
   * 遍历所有槽位的装备 bonus，累加后返回完整的 Stats 对象。
   * 若装备无 bonus 或槽位为空，各属性值为 0。
   * 响应式依赖：equipment 变化时自动重新计算。
   */
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
        const bonus = equippedItem.item.bonus;
        Object.keys(bonus).forEach(key => {
          const statKey = key as keyof Stats;
          stats[statKey] += bonus[statKey] || 0;
        });
      }
    });
    return stats;
  });

  /** 已装备的槽位数（0-6） */
  const equippedCount = computed(() => {
    return Object.values(equipment.value).filter(Boolean).length;
  });

  /**
   * 完整槽位列表（含 UI 展示信息）
   *
   * 将 SLOT_CONFIG 的静态配置与 equipment 动态状态合并，
   * 直接用于 UI 组件渲染装备面板。
   */
  const slotList = computed(() => {
    return Object.entries(SLOT_CONFIG).map(([key, config]) => ({
      id: key as EquipmentSlot,
      name: config.name,
      icon: config.icon,
      equippedItem: equipment.value[key as EquipmentSlot],
      isWeapon: key.startsWith('weapon')
    }));
  });

  /** 武器槽位列表（主手 + 副手） */
  const weaponSlots = computed(() => {
    return slotList.value.filter(slot => slot.isWeapon);
  });

  /** 护甲槽位列表（头部 + 胸部 + 腿部 + 鞋子） */
  const armorSlots = computed(() => {
    return slotList.value.filter(slot => !slot.isWeapon);
  });

  /**
   * 当前已激活的套装奖励列表（Phase 5.3）
   *
   * 根据当前 equipment 状态计算所有已激活的套装奖励。
   * 响应式依赖 equipment，装备变化时自动重新计算。
   * UI 可据此展示套装进度和激活效果。
   */
  const activeSetBonuses = computed(() => {
    return getActiveSetBonuses(equipment.value);
  });

  // ==================== 辅助方法 ====================

  /**
   * 持久化装备数据到数据库
   *
   * 将当前 equipment 状态提取为装备 ID 映射并写入 char_equipment 表。
   * 仅写入装备 ID（不写完整数据），完整属性由模板表提供。
   *
   * 外部不应直接调用此方法 —— 由 equipItem / unequipItem / reset 内部调用。
   */
  async function persist(): Promise<void> {
    if (currentCharacterId.value) {
      const idMap = createEmptySlotMap<string | null>(null);
      for (const slot of Object.keys(equipment.value) as EquipmentSlot[]) {
        idMap[slot] = equipment.value[slot]?.item.id ?? null;
      }
      await equipmentDbService.saveEquipment(currentCharacterId.value, idMap);
    }
  }

  // ==================== Action：初始化 ====================

  /**
   * 初始化装备模块（进入角色时调用）
   *
   * 执行流程：
   * 1. 加载装备模板 → 缓存到 equipmentTemplates Map
   * 2. 加载角色装备 ID 映射 → 按 ID 从模板解析为完整的 EquippedItem
   * 3. 填充 equipment 响应式状态
   *
   * 外部调用者应在此方法 resolve 后再访问装备数据。
   *
   * @param characterId - 角色 ID
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

  // ==================== 内部辅助：移除属性加成 ====================

  /**
   * 移除指定槽位装备提供的属性加成
   *
   * 计算装备 bonus 并调用角色 Store 的 removeBonus 从角色属性中扣除。
   * 若槽位为空或无 bonus，不做任何操作。
   *
   * 此方法同时被 doUnequip（卸下单个装备）和 reset（清空全部装备）复用。
   *
   * @param slot - 目标槽位
   */
  async function removeBonusesFromSlot(slot: EquipmentSlot): Promise<void> {
    const eq = equipment.value[slot];
    if (!eq) return;
    const bonus = computeEquipBonus(eq.item);
    if (Object.keys(bonus).length > 0) {
      await useCharacterStore().removeBonus(bonus);
    }
  }

  // ==================== 内部辅助：卸下装备 ====================

  /**
   * 卸下指定槽位的装备
   *
   * 完整的卸装流程（不包含持久化和日志）：
   * 1. 移除该装备的属性加成 → 调用 removeBonusesFromSlot
   * 2. 清空槽位 → equipment[slot] = null
   * 3. 将装备放回背包 → inventoryStore.addItem
   *
   * 此方法为内部函数，外部不应直接调用。
   * equipItem 和 unequipItem 各自包装持久化和日志后对外暴露。
   *
   * @param slot - 目标槽位
   * @returns 卸下的装备（含时间戳），若槽位为空则返回 null
   */
  async function doUnequip(slot: EquipmentSlot): Promise<EquippedItem | null> {
    const equippedItem = equipment.value[slot];
    if (!equippedItem) return null;

    await removeBonusesFromSlot(slot);

    equipment.value[slot] = null;

    const inventoryStore = useInventoryStore();
    inventoryStore.addItem(equippedItem.item.id, 1);

    return equippedItem;
  }

  // ==================== Action：装备物品 ====================

  /**
   * 将物品装备到指定槽位
   *
   * 完整的装备流程（8 步）：
   * 1. 槽位校验 —— validateSlot
   * 2. 等级校验 —— 检查 levelRequirement
   * 3. 从背包移除 —— inventoryStore.removeItem（失败则直接返回）
   * 4. 卸下旧装备 —— doUnequip（try/catch 含回滚，防止装备丢失）
   * 5. 装备新物品 —— 写入 equipment ref
   * 6. 应用属性加成 —— characterStore.applyBonus
   * 7. 持久化 —— persist（写入 char_equipment 表）
   * 8. 记录日志 —— useLogStore().addLogEntry
   *
   * 第 3 步（背包移除）在第 4 步（卸旧装）之前执行，
   * 若第 4 步异常则通过 catch 块将装备放回背包，保证数据一致性。
   *
   * @param slot - 目标槽位
   * @param item - 要装备的物品
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

    // 2.5 检查职业限制（Phase 5.3）
    if (!checkClassRestriction(item, characterStore.classId)) {
      return false;
    }

    // 3. 从背包中移除要装备的物品
    const inventoryStore = useInventoryStore();
    const removed = inventoryStore.removeItem(item.id, 1);
    if (removed <= 0) return false;

    // 4. 如果有旧装备，先卸下
    try {
      await doUnequip(slot);
    } catch {
      // 回滚：卸下失败时将已移除的装备放回背包
      inventoryStore.addItem(item.id, 1);
      return false;
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
   *
   * 在 doUnequip（卸装核心逻辑）基础上追加持久化和日志。
   * 外部 UI 应通过此方法执行卸装操作，不应直接调用 doUnequip。
   *
   * @param slot - 目标槽位
   * @returns 卸下的装备（失败返回 null）
   */
  async function unequipItem(slot: EquipmentSlot): Promise<EquippedItem | null> {
    if (!currentCharacterId.value) return null;

    const equippedItem = await doUnequip(slot);
    if (!equippedItem) return null;

    // 持久化到数据库
    await persist();

    // 记录冒险日志
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'item',
      message: `卸下了：${equippedItem.item.name}`,
      icon: 'game-icons:armor-downgrade'
    });

    return equippedItem;
  }

  // ==================== Action：查询 ====================

  /**
   * 获取当前装备状态（返回浅拷贝，纯查询，不产生副作用）
   *
   * 外部不应通过修改返回值来变更装备状态 —— 使用 equipItem / unequipItem 进行写操作。
   */
  function getEquipment(): Record<EquipmentSlot, EquippedItem | null> {
    return { ...equipment.value };
  }

  /**
   * 获取指定槽位的装备（返回浅拷贝，避免外部修改内部状态）
   *
   * @param slot - 目标槽位
   * @returns 已装备物品或 null
   */
  function getEquippedItem(slot: EquipmentSlot): EquippedItem | null {
    const item = getEquipmentBySlot(equipment.value, slot);
    return item ? { ...item } : null;
  }

  /**
   * 检查物品是否可以装备
   *
   * 检查逻辑：
   * - 若装备有等级限制，检查角色等级是否满足
   * - 若传入 slot 参数，检查该槽位是否兼容
   * - 若未传入 slot，检查是否存在至少一个空闲的兼容槽位
   *
   * @param item - 装备物品
   * @param slot - 可选的目标槽位（不传则检查所有兼容槽位）
   * @returns 是否可以装备
   */
  function canEquip(item: EquipmentItem, slot?: EquipmentSlot): boolean {
    const characterStore = useCharacterStore();

    if (item.levelRequirement) {
      if (characterStore.level < item.levelRequirement) {
        return false;
      }
    }

    // 检查职业限制（Phase 5.3）
    if (!checkClassRestriction(item, characterStore.classId)) {
      return false;
    }

    if (slot) {
      return validateSlot(item, slot);
    }

    const result = canEquipItem(item, equipment.value);
    return result.canEquip;
  }

  /**
   * 获取装备模板（按 ID 从内存缓存查询）
   *
   * @param itemId - 装备 ID
   * @returns 装备模板数据，不存在则返回 null
   */
  function getEquipmentTemplate(itemId: string): EquipmentItem | null {
    return equipmentTemplates.value.get(itemId) || null;
  }

  /**
   * 添加装备模板到内存缓存并持久化
   *
   * 同时更新 equipmentTemplates Map 和 config_equipmentItems 表。
   *
   * @param item - 装备模板数据
   */
  function addEquipmentTemplate(item: EquipmentItem): void {
    equipmentTemplates.value.set(item.id, item);
    equipmentDbService.saveEquipmentTemplate(item);
  }

  /**
   * 删除装备模板（从内存缓存和数据库）
   *
   * @param itemId - 装备 ID
   */
  function removeEquipmentTemplate(itemId: string): void {
    equipmentTemplates.value.delete(itemId);
    equipmentDbService.deleteEquipmentTemplate(itemId);
  }

  // ==================== Action：重置 ====================

  /**
   * 重置装备模块状态（退出角色时调用）
   *
   * 执行顺序：
   * 1. 移除所有装备属性加成 → 调用 removeBonusesFromSlot 遍历所有槽位
   * 2. 持久化清空后的装备状态 → 写入全 null 的 ID 映射
   * 3. 清空 Store 状态 → equipment、currentCharacterId、equipmentTemplates
   *
   * 注意：退出角色时装备直接清空，不调用 doUnequip（不放回背包），
   * 因为背包数据由 inventory 模块独立管理，退出角色时也会重置。
   */
  async function reset(): Promise<void> {
    const charId = currentCharacterId.value;

    // 移除所有装备属性加成
    if (charId) {
      for (const slot of Object.keys(equipment.value) as EquipmentSlot[]) {
        await removeBonusesFromSlot(slot);
      }
    }

    // 持久化清空后的装备状态
    equipment.value = getDefaultEquipment();
    if (charId) {
      const emptyIdMap = createEmptySlotMap<string | null>(null);
      await equipmentDbService.saveEquipment(charId, emptyIdMap);
    }

    // 清空 Store 状态
    currentCharacterId.value = null;
    equipmentTemplates.value = new Map();
  }

  return {
    // 响应式状态
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
    activeSetBonuses,

    // 生命周期
    initialize,
    reset,

    // 装备操作
    equipItem,
    unequipItem,

    // 查询
    getEquipment,
    getEquippedItem,
    canEquip,
    getEquipmentTemplate,

    // 模板管理
    addEquipmentTemplate,
    removeEquipmentTemplate
  };
});
