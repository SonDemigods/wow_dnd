/**
 * 装备模块状态管理（Store 核心架构）
 *
 * ## 模块定位
 *
 * Store 是装备数据的唯一持有者，所有响应式状态集中在此管理。
 * 不通过 EventBus 广播事件 —— 跨模块通信通过 Store Action 直接调用或回调注入。
 *
 * ## 数据流
 *
 * ```
 * UI Layer ──→ Store Action ──→ service 纯函数（业务校验）
 *                    │                      ↓
 *                    ├── 更新 ref 状态（响应式驱动 UI）
 *                    ├── 调用其他 Store Action（角色属性、日志）
 *                    ├── 通过回调操作背包（A1/G1 修复：消除 equipment → inventory 静态依赖）
 *                    └── 调用 DB 层持久化
 * ```
 *
 * ## 跨模块依赖（A1/G1 修复）
 *
 * equipment 模块不再直接 import inventory/store：
 * - 卸下装备放回背包：通过 setInventoryCallbacks 注入的 inventoryAddItemCallback
 * - 装备物品从背包移除：通过 setInventoryCallbacks 注入的 inventoryRemoveItemCallback
 * - 回调由 GameBootstrap.initialize 在 inventory 初始化后注入，dispose 时清除
 *
 * ## 存储策略
 *
 * char_equipment 表仅存装备 ID 映射（Record<EquipmentSlot, string | null>），
 * 完整装备属性通过 equipmentTemplates（内存 Map）按 ID 获取。
 * 这样装备属性变更只需更新模板，无需遍历所有角色数据。
 *
 * P3 TS-17 审计决策（2026-07-31）：本文件中 `Object.keys(equipment.value) as EquipmentSlot[]`
 * 共 3 处（约 325、364、810 行），属于 TS 语言限制的标准 workaround。
 * equipment.value 类型为 Record<EquipmentSlot, ...>，键已由类型保证为 EquipmentSlot，断言是合理的。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { EquipmentItem, EquipmentSlot, EquippedItem } from './types';
import type { Stats } from '@/modules/character/types';
import { equipmentDbService } from './db';
import { useLogStore } from '@/modules/log/store';
import { generateLogId } from '@/modules/log/service';
import { useCharacterStore } from '@/modules/character/store';
import { validateSlot, computeEquipBonus, canEquipItem, getEquipmentBySlot, createEmptySlotMap, checkClassRestriction, getActiveSetBonuses, SLOT_CONFIG } from './service';
import { errorReporter } from '@/utils/errorReport';

/**
 * 物品入背包回调类型
 *
 * 卸下装备时需要将装备放回背包，但 equipment 模块不再直接 import inventory/store
 * （A1/G1 修复：消除 equipment → inventory 静态依赖）。
 * 通过回调注入方式，由 GameBootstrap 在初始化时绑定 inventoryStore.addItem。
 *
 * 回调签名与 inventoryStore.addItem 一致：
 * @param itemId - 物品 ID
 * @param quantity - 数量
 * @returns 实际添加的数量
 */
type AddItemToInventoryCallback = (itemId: string, quantity: number) => number;

/**
 * 物品出背包回调类型
 *
 * 装备物品时需要从背包移除，但 equipment 模块不再直接 import inventory/store
 * （A1/G1 修复：消除 equipment → inventory 静态依赖）。
 * 通过回调注入方式，由 GameBootstrap 在初始化时绑定 inventoryStore.removeItem。
 *
 * 回调签名与 inventoryStore.removeItem 一致：
 * @param itemId - 物品 ID
 * @param quantity - 数量
 * @returns 实际移除的数量
 */
type RemoveItemFromInventoryCallback = (itemId: string, quantity: number) => number;

/**
 * 物品入/出背包回调引用（模块级单例）
 *
 * 由 GameBootstrap.initialize 调用 setInventoryCallbacks 注入，
 * equipment/store 内部 doUnequip / equipItem 通过此回调操作背包。
 *
 * 设计权衡：
 * - 不使用 EventBus：装备放回/移除背包是同步语义，EventBus 异步触发不合适
 * - 不使用 Pinia 跨 store 直接调用：会引入 equipment → inventory 静态依赖
 * - 回调注入：保持同步语义 + 消除静态依赖，由 GameBootstrap 统一编排生命周期
 */
let inventoryAddItemCallback: AddItemToInventoryCallback | null = null;
let inventoryRemoveItemCallback: RemoveItemFromInventoryCallback | null = null;
/**
 * 等待背包持久化完成的回调（DB-1/DB-2 修复）
 *
 * inventoryStore.addItem/removeItem 内部以 fire-and-forget 调用 persistInventory。
 * 当 equipment persist 失败需要回滚内存状态时，回滚的 removeItem 也会触发
 * fire-and-forget persistInventory。若不等待，可能出现竞态：
 * - addItem 的 persistInventory1（写入新状态）与 removeItem 的 persistInventory2（写入回滚状态）并发
 * - 若 persistInventory1 后完成，DB 中会是新状态（错误）
 *
 * 通过 flushPersist 等待 persistInventory1 完成后再触发 persistInventory2，
 * 确保回滚状态最终写入 DB。
 */
let inventoryFlushPersistCallback: (() => Promise<void>) | null = null;

/**
 * 设置物品入/出背包回调（供 GameBootstrap 在初始化时调用）
 *
 * @param addCallback - inventoryStore.addItem 的引用（卸下装备时放回背包）
 * @param removeCallback - inventoryStore.removeItem 的引用（装备物品时从背包移除）
 * @param flushPersistCallback - inventoryStore.flushPersist 的引用（DB-1/DB-2 修复：回滚时等待持久化完成）
 */
export function setInventoryCallbacks(
  addCallback: AddItemToInventoryCallback | null,
  removeCallback: RemoveItemFromInventoryCallback | null,
  flushPersistCallback: (() => Promise<void>) | null = null
): void {
  inventoryAddItemCallback = addCallback;
  inventoryRemoveItemCallback = removeCallback;
  inventoryFlushPersistCallback = flushPersistCallback;
}

/**
 * 清除物品入/出背包回调（供 GameBootstrap.dispose 调用，避免回调泄漏）
 */
export function clearInventoryCallbacks(): void {
  inventoryAddItemCallback = null;
  inventoryRemoveItemCallback = null;
  inventoryFlushPersistCallback = null;
}

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

  /** DB-1/DB-2 修复：装备持久化错误状态，供 UI 监听并提示用户重试（null 表示无错误） */
  const persistError = ref<string | null>(null);

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
    // P2-49 修复：有效的 Stats 属性白名单，防止 bonus 中包含无效 key 时产生 NaN
    const validStatKeys: ReadonlySet<keyof Stats> = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);
    Object.values(equipment.value).forEach(equippedItem => {
      if (equippedItem && equippedItem.item.bonus) {
        const bonus = equippedItem.item.bonus;
        Object.keys(bonus).forEach(key => {
          if (validStatKeys.has(key as keyof Stats)) {
            const statKey = key as keyof Stats;
            stats[statKey] += bonus[statKey] || 0;
          }
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

  /**
   * 已应用的套装奖励标记列表（BIZ-13）
   *
   * 跟踪当前已应用到角色属性上的套装奖励，用于装备变化时 diff 计算：
   * 移除不再激活的加成，应用新激活的加成。
   */
  const appliedSetBonuses = ref<Array<{ setId: string; requiredPieces: number; stat: keyof Stats; value: number }>>([]);

  // ==================== 辅助方法 ====================

  /**
   * 重新应用套装奖励（BIZ-13）
   *
   * 对比当前激活的套装奖励与已应用的套装奖励：
   * 1. 移除不再激活的套装属性加成（调用 characterStore.removeBonus）
   * 2. 应用新激活的套装属性加成（调用 characterStore.applyBonus）
   * 3. 更新 appliedSetBonuses 列表
   *
   * 在 equipItem / unequipItem / initialize / reset 中调用，
   * 确保装备变化后套装奖励正确同步到角色属性。
   */
  async function reapplySetBonuses(): Promise<void> {
    const characterStore = useCharacterStore();
    const currentActive = getActiveSetBonuses(equipment.value);

    // 唯一键：setId + requiredPieces + stat + value
    const buildKey = (setId: string, pieces: number, stat: string, value: number) =>
      `${setId}:${pieces}:${stat}:${value}`;

    const currentKeys = new Set(
      currentActive
        // P2-48 修复：使用 != null 显式检查，避免 value=0 的套装奖励被吞掉
        // P3 TS-15 修复：使用类型守卫 predicate 收窄类型，消除非空断言 !
        .filter((b): b is typeof b & { bonus: { bonus: { stat: string; value: number } } } =>
          b.bonus.bonus.stat != null && b.bonus.bonus.value != null)
        .map(b => buildKey(b.setId, b.bonus.requiredPieces, b.bonus.bonus.stat, b.bonus.bonus.value))
    );
    const appliedKeys = new Set(
      appliedSetBonuses.value.map(b => buildKey(b.setId, b.requiredPieces, b.stat, b.value))
    );

    // 移除不再激活的加成
    for (const b of appliedSetBonuses.value) {
      if (!currentKeys.has(buildKey(b.setId, b.requiredPieces, b.stat, b.value))) {
        await characterStore.removeBonus({ [b.stat]: b.value } as Partial<Stats>);
      }
    }

    // 应用新激活的加成
    for (const b of currentActive) {
      const bonus = b.bonus.bonus;
      if (!bonus.stat || !bonus.value) continue;
      const key = buildKey(b.setId, b.bonus.requiredPieces, bonus.stat, bonus.value);
      if (!appliedKeys.has(key)) {
        await characterStore.applyBonus({ [bonus.stat]: bonus.value } as Partial<Stats>);
      }
    }

    // 更新已应用列表
    appliedSetBonuses.value = currentActive
      // P2-48 修复：使用 != null 显式检查，避免 value=0 的套装奖励被吞掉
      // P3 TS-15 修复：使用类型守卫 predicate 收窄类型，消除非空断言 ! 和 as keyof Stats
      .filter((b): b is typeof b & { bonus: { bonus: { stat: string; value: number } } } =>
        b.bonus.bonus.stat != null && b.bonus.bonus.value != null)
      .map(b => ({
        setId: b.setId,
        requiredPieces: b.bonus.requiredPieces,
        stat: b.bonus.bonus.stat as keyof Stats,
        value: b.bonus.bonus.value
      }));
  }

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
      // DB-1/DB-2 修复：抛出异常让调用方感知失败并回滚内存状态
      // 调用方（equipItem/unequipItem）负责 try-catch 并回滚
      await equipmentDbService.saveEquipment(currentCharacterId.value, idMap);
      persistError.value = null;
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

    // BIZ-13：初始化后应用套装效果
    await reapplySetBonuses();

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

  /**
   * 重新应用指定槽位装备的属性加成
   *
   * 与 removeBonusesFromSlot 对应，用于回滚场景（如背包满导致卸下失败后恢复装备状态）。
   * 仅应用单件装备的基础 bonus，不包含套装奖励（套装奖励由 reapplySetBonuses 单独管理）。
   *
   * @param slot - 目标槽位
   */
  async function applyBonusForSlot(slot: EquipmentSlot): Promise<void> {
    const eq = equipment.value[slot];
    if (!eq) return;
    const bonus = computeEquipBonus(eq.item);
    if (Object.keys(bonus).length > 0) {
      await useCharacterStore().applyBonus(bonus);
    }
  }

  // ==================== 内部辅助：卸下装备 ====================

  /**
   * 卸下指定槽位的装备
   *
   * 完整的卸装流程（不包含持久化和日志）：
   * 1. 移除该装备的属性加成 → 调用 removeBonusesFromSlot
   * 2. 清空槽位 → equipment[slot] = null
   * 3. 将装备放回背包 → 通过 inventoryAddItemCallback（A1/G1 修复：回调注入替代直接 import）
   *
   * 此方法为内部函数，外部不应直接调用。
   * equipItem 和 unequipItem 各自包装持久化和日志后对外暴露。
   *
   * 安全保障：
   * - 若回调未注入（inventoryAddItemCallback === null）：抛出错误，阻止卸下操作，避免装备丢失
   * - 若背包已满（回调返回 0）：回滚槽位和属性加成，抛出错误，让调用方提示用户清理背包
   *
   * @param slot - 目标槽位
   * @returns 卸下的装备（含时间戳），若槽位为空则返回 null
   * @throws {Error} 当 inventoryAddItemCallback 未注入或背包已满无法放回时抛出
   */
  async function doUnequip(slot: EquipmentSlot): Promise<EquippedItem | null> {
    const equippedItem = equipment.value[slot];
    if (!equippedItem) return null;

    // 回调未注入时直接抛出，避免装备被卸下后无处可去导致丢失
    if (!inventoryAddItemCallback) {
      throw new Error('[EquipmentStore] inventoryAddItemCallback 未注入，无法卸下装备。请检查 GameBootstrap 初始化流程。');
    }

    await removeBonusesFromSlot(slot);
    equipment.value[slot] = null;

    // 通过回调注入将装备放回背包（A1/G1 修复：消除 equipment → inventory 静态依赖）
    const added = inventoryAddItemCallback(equippedItem.item.id, 1);

    // 背包已满等原因导致放回失败：回滚槽位和属性加成，避免装备丢失
    if (added <= 0) {
      equipment.value[slot] = equippedItem;
      await applyBonusForSlot(slot);
      throw new Error(`[EquipmentStore] 背包已满，无法卸下「${equippedItem.item.name}」。请先清理背包。`);
    }

    return equippedItem;
  }

  // ==================== Action：装备物品 ====================

  /**
   * 将物品装备到指定槽位
   *
   * 完整的装备流程（8 步）：
   * 1. 槽位校验 —— validateSlot
   * 2. 等级校验 —— 检查 levelRequirement
   * 3. 从背包移除 —— inventoryRemoveItemCallback（失败则直接返回）
   * 4. 卸下旧装备 —— doUnequip（try/catch 含回滚，防止装备丢失）
   * 5. 装备新物品 —— 写入 equipment ref
   * 6. 应用属性加成 —— characterStore.applyBonus
   * 7. 持久化 —— persist（写入 char_equipment 表）
   * 8. 记录日志 —— useLogStore().addLogEntry
   *
   * 第 3 步（背包移除）在第 4 步（卸旧装）之前执行，
   * 若第 4 步异常则通过 catch 块将装备放回背包，保证数据一致性。
   *
   * 背包操作通过回调注入完成（A1/G1 修复：消除 equipment → inventory 静态依赖）。
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

    // 3. 从背包中移除要装备的物品（通过回调注入，A1/G1 修复）
    if (!inventoryRemoveItemCallback) {
      console.warn('[EquipmentStore] inventoryRemoveItemCallback 未注入，无法装备物品。请检查 GameBootstrap 初始化流程。');
      return false;
    }
    const removed = inventoryRemoveItemCallback(item.id, 1);
    if (removed <= 0) return false;

    // 4. 如果有旧装备，先卸下
    // P2-55 修复：记录旧装备，用于第 6 步失败时回滚
    let previousEquipped: EquippedItem | null = null;
    try {
      previousEquipped = await doUnequip(slot);
    } catch (e) {
      // 回滚：卸下失败时将已移除的装备放回背包（通过回调注入）
      console.error('[EquipmentStore] equipItem 卸下旧装备失败，回滚已移除的物品:', e);
      if (inventoryAddItemCallback) {
        inventoryAddItemCallback(item.id, 1);
      }
      return false;
    }

    // 5. 装备新物品
    equipment.value[slot] = {
      item,
      equippedAt: Date.now()
    };

    // 6. 应用新装备的属性加成
    // P2-55 修复：applyBonus 失败时回滚装备状态（移除新装备、装回旧装备、放回背包）
    try {
      const newBonus = computeEquipBonus(item);
      if (Object.keys(newBonus).length > 0) {
        await characterStore.applyBonus(newBonus);
      }
    } catch (e) {
      console.error('[EquipmentStore] equipItem applyBonus 失败，回滚装备状态:', e);
      // 6.1 移除新装备
      equipment.value[slot] = null;
      // 6.2 把新装备放回背包
      if (inventoryAddItemCallback) {
        inventoryAddItemCallback(item.id, 1);
      }
      // 6.3 如果之前有旧装备，重新装上并应用 bonus
      if (previousEquipped) {
        // 从背包移除旧装备（doUnequip 已放回背包）
        if (inventoryRemoveItemCallback) {
          inventoryRemoveItemCallback(previousEquipped.item.id, 1);
        }
        equipment.value[slot] = previousEquipped;
        try {
          await applyBonusForSlot(slot);
        } catch (rollbackErr) {
          // 旧装备 bonus 应用失败也只记录日志，避免二次抛出掩盖原始错误
          console.error('[EquipmentStore] equipItem 回滚旧装备 bonus 失败:', rollbackErr);
        }
      }
      return false;
    }

    // 6.5 BIZ-13：重新应用套装效果（装备变化可能导致套装激活/失效）
    await reapplySetBonuses();

    // 7. 持久化到数据库
    // DB-2 修复：persist 失败时回滚装备和背包状态，避免物品丢失
    // DB-1/DB-2 增强：回滚后 await flushPersist 确保回滚的背包操作写入 DB，避免竞态
    try {
      await persist();
    } catch (persistErr) {
      console.error('[EquipmentStore] equipItem persist 失败，回滚装备状态:', persistErr);
      persistError.value = persistErr instanceof Error ? persistErr.message : String(persistErr);
      errorReporter.report(persistErr, 'manual', {
        context: '装备持久化失败，已回滚装备和背包状态',
        characterId: currentCharacterId.value,
      });
      // 回滚：移除新装备的 bonus
      try {
        const newBonus = computeEquipBonus(item);
        if (Object.keys(newBonus).length > 0) {
          await useCharacterStore().removeBonus(newBonus);
        }
      } catch (rollbackErr) {
        console.error('[EquipmentStore] equipItem 回滚新装备 bonus 失败:', rollbackErr);
      }
      // 回滚：移除新装备
      equipment.value[slot] = null;
      // 回滚：放回新装备到背包
      if (inventoryAddItemCallback) {
        inventoryAddItemCallback(item.id, 1);
      }
      // 回滚：如果有旧装备，重新装上
      if (previousEquipped) {
        if (inventoryRemoveItemCallback) {
          inventoryRemoveItemCallback(previousEquipped.item.id, 1);
        }
        equipment.value[slot] = previousEquipped;
        try {
          await applyBonusForSlot(slot);
        } catch (rollbackErr) {
          console.error('[EquipmentStore] equipItem 回滚旧装备 bonus 失败:', rollbackErr);
        }
      }
      // 重新应用套装效果
      await reapplySetBonuses();
      // DB-1/DB-2 增强：等待回滚的背包持久化完成，确保 DB 状态与内存一致
      // 避免 addItem 的 persistInventory1 与回滚 removeItem 的 persistInventory2 竞态
      if (inventoryFlushPersistCallback) {
        await inventoryFlushPersistCallback();
      }
      return false;
    }

    // 8. 记录冒险日志
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'item',
      message: `装备了：${item.name}（${SLOT_CONFIG[slot].name}）`,
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

    // BIZ-13：重新应用套装效果（卸下装备可能导致套装失效）
    await reapplySetBonuses();

    // 持久化到数据库
    // DB-1 修复：persist 失败时回滚装备状态（恢复装备 + 移除背包物品），避免物品复制
    try {
      await persist();
    } catch (persistErr) {
      console.error('[EquipmentStore] unequipItem persist 失败，回滚装备状态:', persistErr);
      persistError.value = persistErr instanceof Error ? persistErr.message : String(persistErr);
      errorReporter.report(persistErr, 'manual', {
        context: '装备持久化失败，已回滚装备状态',
        characterId: currentCharacterId.value,
      });
      // 回滚：从背包移除已放回的装备
      if (inventoryRemoveItemCallback) {
        inventoryRemoveItemCallback(equippedItem.item.id, 1);
      }
      // 回滚：恢复装备到槽位
      equipment.value[slot] = equippedItem;
      // 回滚：重新应用装备 bonus
      try {
        await applyBonusForSlot(slot);
      } catch (rollbackErr) {
        console.error('[EquipmentStore] unequipItem 回滚装备 bonus 失败:', rollbackErr);
      }
      // 重新应用套装效果
      await reapplySetBonuses();
      // DB-1/DB-2 增强：等待回滚的背包持久化完成，确保 DB 状态与内存一致
      // 避免 doUnequip 的 addItem persistInventory1 与回滚 removeItem 的 persistInventory2 竞态
      if (inventoryFlushPersistCallback) {
        await inventoryFlushPersistCallback();
      }
      return null;
    }

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
    // P1-17 修复：添加错误处理，避免 unhandled promise rejection 导致内存与持久化状态不一致
    equipmentDbService.saveEquipmentTemplate(item).catch(err => {
      console.error('[EquipmentStore] saveEquipmentTemplate 失败:', err);
      equipmentTemplates.value.delete(item.id);
    });
  }

  /**
   * 删除装备模板（从内存缓存和数据库）
   *
   * @param itemId - 装备 ID
   */
  function removeEquipmentTemplate(itemId: string): void {
    equipmentTemplates.value.delete(itemId);
    // P1-17 修复：添加错误处理，失败时回滚内存缓存
    equipmentDbService.deleteEquipmentTemplate(itemId).catch(err => {
      console.error('[EquipmentStore] deleteEquipmentTemplate 失败:', err);
    });
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

    // BIZ-13：移除所有套装效果（equipment 已清空，所有套装不再激活）
    if (charId) {
      await reapplySetBonuses();
    }

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
    persistError,

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
