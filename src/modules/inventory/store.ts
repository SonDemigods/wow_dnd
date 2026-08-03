/**
 * 背包模块状态管理（Store 核心架构）
 *
 * Store 是背包数据的唯一持有者，所有响应式状态集中管理。
 *
 * ## 架构模式
 * Action 负责编排，遵循标准流程：
 * 1. 调用 Service 纯函数计算
 * 2. 更新 Store 响应式状态
 * 3. 调用 DB 持久化（persistInventory）
 * 4. 通知其他 Store（useLogStore、useCharacterStore）
 *
 * ## 跨模块依赖
 * - item-template（聚合层）：初始化时加载合并后的物品模板（普通物品 + 装备），消除对 equipment 的直接/间接依赖（A1/G1 修复）
 * - useCharacterStore：物品使用时传递效果到角色模块
 * - useLogStore：记录物品获得/使用/丢弃的冒险日志
 *
 * ## 持久化策略
 * - 大多数 Action 使用 fire-and-forget 异步持久化（不阻塞 UI）
 * - useItem 使用 await 持久化（效果应用与物品消耗需要事务性保证）
 * - persistInventory 内部有 try/catch，失败时输出 console.error 但不影响 UI
 */
import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import type { Item, InventoryItem, SortField, SortOrder, ItemFilters, ItemType, ItemRarity } from './types';
import { inventoryDbService } from './db';
import { unifiedItemTemplateCache } from '@/modules/item-template';
import { useLogStore } from '@/modules/log/store';
import { generateLogId } from '@/modules/log/service';
import { useCharacterStore } from '@/modules/character/store';
import { errorReporter } from '@/utils/errorReport';
import { RARITY_CONFIG } from '../../config/inventory';
import {
  computeStackResult,
  findItemIndex,
  sortAndFilterInventory,
  computeUseEffect,
  ITEM_TYPE_NAMES,
  MAX_STACK,
  INVENTORY_SIZE,
  RARITY_ORDER
} from './service';

/**
 * 物品收集通知回调类型（ARCH-2 修复：回调注入替代 inventory → quest 静态依赖）
 *
 * 当背包 addItem 成功添加物品时触发，供 quest 模块监听以推进 collect 类型任务进度。
 * 设计参考 equipment/store.ts 的 setInventoryCallbacks 模式。
 */
type OnItemCollectedCallback = (itemId: string, quantity: number) => void;

/**
 * 物品收集通知回调引用（模块级单例）
 *
 * 由 GameBootstrap.initialize 调用 setInventoryExternalCallbacks 注入，
 * inventory/store 内部 addItem 通过此回调通知 quest 模块。
 *
 * 设计权衡：
 * - 不使用 EventBus：物品收集是同步语义，EventBus 异步触发不合适
 * - 不使用 Pinia 跨 store 直接调用：会引入 inventory → quest 静态依赖（循环依赖）
 * - 回调注入：保持同步语义 + 消除静态依赖，由 GameBootstrap 统一编排生命周期
 */
let onItemCollectedCallback: OnItemCollectedCallback | null = null;

/**
 * 设置 inventory 模块的外部回调（供 GameBootstrap 在初始化时调用）
 *
 * @param callbacks - 外部回调集合，传 null 表示清除
 */
export function setInventoryExternalCallbacks(callbacks: {
  onItemCollected: OnItemCollectedCallback;
} | null): void {
  onItemCollectedCallback = callbacks?.onItemCollected ?? null;
}

/**
 * 清除 inventory 模块的外部回调（供 GameBootstrap.dispose 调用，避免回调泄漏）
 */
export function clearInventoryExternalCallbacks(): void {
  onItemCollectedCallback = null;
}

/**
 * 背包状态存储
 */
export const useInventoryStore = defineStore('inventory', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================

  /** 背包物品列表（每个元素代表一个槽位），索引即 UI 位置 */
  const inventory = ref<InventoryItem[]>([]);
  /**
   * 物品模板缓存（key=itemId, value=Item），包含普通物品和装备物品
   *
   * P3-144 修复：改用 shallowRef。更新模式为整体替换（loadItemTemplates 中 `itemTemplates.value = new Map(...)`），
   * 无原地 mutate 调用点，shallowRef 避免对 Map 内部做深度响应式追踪。
   */
  const itemTemplates = shallowRef<Map<string, Item>>(new Map());
  /** 当前筛选条件（所有字段可选，全部为空表示不筛选） */
  const filters = ref<ItemFilters>({});
  /** 当前排序字段，默认按类型排序 */
  const sortBy = ref<SortField>('type');
  /** 当前排序顺序，默认升序 */
  const sortOrder = ref<SortOrder>('asc');
  /** 搜索关键词（实时响应输入） */
  const searchKeyword = ref('');
  /** 当前活跃角色 ID（null 表示未初始化） */
  const currentCharacterId = ref<string | null>(null);
  /** 加载状态标识（用于 UI 显示加载动画） */
  const isLoading = ref(false);
  /**
   * 最近一次持久化错误（null 表示无错误或已恢复）
   *
   * P2-50 修复：原 persistInventory 静默吞掉错误，UI 与 DB 状态不一致。
   * 暴露错误状态供 UI 监听并提示用户"保存失败，请重试"。
   * 写入成功时重置为 null，便于 UI 判断错误恢复。
   */
  const persistError = ref<string | null>(null);
  /**
   * 进行中的持久化 Promise（null 表示无进行中的持久化）
   *
   * DB-1/DB-2 修复：addItem/removeItem 以 fire-and-forget 调用 persistInventory，
   * 外部模块（如 equipment/store.ts 在回滚场景）需要等待持久化完成以确保 DB 状态一致。
   * flushPersist() 通过 await 此 Promise 实现等待语义。
   */
  let pendingPersistPromise: Promise<void> | null = null;

  // ==================== 计算属性 ====================

  /** 筛选并排序后的背包物品（由 filteredInventory 组件直接消费） */
  const filteredInventory = computed(() => {
    return sortAndFilterInventory(
      inventory.value,
      itemTemplates.value,
      filters.value,
      sortBy.value,
      sortOrder.value,
      searchKeyword.value
    );
  });

  /** 剩余空槽位数 = 总容量 - 已用槽位数 */
  const emptySlots = computed(() => INVENTORY_SIZE - inventory.value.length);
  /** 背包是否已满（不可再添加新物品槽位，但可堆叠到已有槽位） */
  const isFull = computed(() => inventory.value.length >= INVENTORY_SIZE);

  /** 背包物品总价值（物品单价 × 数量累加） */
  const totalValue = computed(() => {
    let total = 0;
    inventory.value.forEach(invItem => {
      const item = itemTemplates.value.get(invItem.itemId);
      if (item) {
        total += item.value * invItem.count;
      }
    });
    return total;
  });

  /** 按物品类型的数量统计（Record<ItemType, number>，所有类型均有条目） */
  const itemCountByType = computed(() => {
    const counts: Record<ItemType, number> = {
      gold: 0, potion: 0, scroll: 0, food: 0,
      material: 0, quest: 0, weapon: 0, armor: 0, misc: 0
    };
    inventory.value.forEach(invItem => {
      const item = itemTemplates.value.get(invItem.itemId);
      if (item) {
        counts[item.type] += invItem.count;
      }
    });
    return counts;
  });

  /** 所有物品类型列表（供筛选下拉组件使用） */
  const allItemTypes = computed(() => {
    return Object.entries(ITEM_TYPE_NAMES).map(([key, value]) => ({
      id: key as ItemType,
      name: value
    }));
  });

  /** 所有稀有度列表（含名称和颜色，供筛选下拉组件使用） */
  const allRarities = computed(() => {
    return Object.entries(RARITY_CONFIG).map(([key, value]) => ({
      id: key as ItemRarity,
      name: value.name,
      color: value.color
    }));
  });

  // ==================== 私有：物品模板加载 ====================

  /**
   * 加载物品模板到内存缓存
   *
   * 通过 item-template 聚合层获取合并后的物品模板（A1/G1 修复）：
   * - 普通物品模板（config_items 表）
   * - 装备模板（config_equipmentItems 表，已转换为 Item 格式）
   *
   * 合并策略由 item-template/service.ts 的 mergeItemTemplates 实现：
   * 普通物品优先，装备模板仅在 ID 不冲突时插入。
   *
   * 此函数在 initialize() 中调用，每次切换/初始化角色时重新加载。
   * inventory 模块不再直接或间接依赖 equipment 模块（消除 C3 循环依赖）。
   */
  async function loadItemTemplates(): Promise<void> {
    const items = await unifiedItemTemplateCache.getAll();
    const map = new Map<string, Item>();
    items.forEach(item => map.set(item.id, item));
    itemTemplates.value = map;
  }

  // ==================== 私有：持久化 ====================

  /**
   * 持久化背包数据到 IndexedDB
   *
   * 内部有 try/catch，持久化失败时上报到 errorReporter（统一错误处理路径），
   * 不抛出异常以避免中断用户操作流程。
   *
   * P2-50 修复：原仅 console.error 静默吞掉错误，UI 与 DB 状态不一致且无统一上报。
   * 现通过两条路径修复：
   * 1. 通过 errorReporter 上报到错误日志（防抖批量写入 localStorage），便于全局监测
   * 2. 同步设置 persistError ref，供 UI 通过 watch 监听并提示用户"保存失败，请重试"
   * 写入成功时重置 persistError 为 null，便于 UI 判断错误恢复。
   *
   * 大部分 Action 以 fire-and-forget 调用（不 await），useItem 例外（见其文档）。
   */
  async function persistInventory(): Promise<void> {
    const charId = currentCharacterId.value;
    if (charId) {
      // DB-1/DB-2 修复：跟踪进行中的持久化 Promise，供 flushPersist 等待
      const promise = (async () => {
        try {
          await inventoryDbService.saveInventory(charId, inventory.value);
          persistError.value = null;
        } catch (err) {
          // P2-50 修复：通过 errorReporter 统一上报 + persistError 暴露给 UI
          persistError.value = err instanceof Error ? err.message : String(err);
          errorReporter.report(err, 'manual', {
            context: '背包数据持久化失败，UI 与 DB 状态可能不一致',
            characterId: charId,
            itemCount: inventory.value.length,
          });
        }
      })();
      pendingPersistPromise = promise;
      return promise;
    }
  }

  /**
   * 等待进行中的持久化操作完成
   *
   * DB-1/DB-2 修复：equipment/store.ts 在 persist 失败回滚内存状态后，
   * 需要确保回滚的 removeItem 操作也已写入 DB，避免 fire-and-forget
   * persistInventory 与 equipment persist 失败之间的竞态导致 DB 状态不一致。
   *
   * 调用方式：由 GameBootstrap 通过 setInventoryCallbacks 注入到 equipment 模块。
   * 无进行中的持久化时立即返回。
   */
  async function flushPersist(): Promise<void> {
    if (pendingPersistPromise) {
      await pendingPersistPromise;
      pendingPersistPromise = null;
    }
  }

  // ==================== Action：初始化 ====================

  /**
   * 初始化背包模块
   *
   * 执行流程：
   * 1. 设置加载状态（isLoading = true）
   * 2. 设定当前角色 ID
   * 3. 从 DB 加载该角色的背包数据
   * 4. 加载所有物品模板（含装备模板）
   * 5. 清除加载状态
   *
   * UI 组件通常通过 isLoading 控制加载动画，通过 filteredInventory 获取展示数据。
   *
   * @param characterId - 角色 ID
   */
  async function initialize(characterId: string): Promise<void> {
    isLoading.value = true;
    currentCharacterId.value = characterId;

    if (characterId) {
      inventory.value = await inventoryDbService.getInventory(characterId);
    } else {
      inventory.value = [];
    }

    await loadItemTemplates();
    isLoading.value = false;
  }

  // ==================== Action：添加物品 ====================

  /**
   * 添加物品到背包
   *
   * 添加策略（先后顺序）：
   * 1. 可堆叠物品优先堆叠到已有的同名槽位（遍历现有槽位，逐个填充）
   * 2. 剩余数量创建新槽位（每个新槽位最多 MAX_STACK 或 1 个）
   *
   * 容量保护：
   * - 背包满时（INVENTORY_SIZE），未添加的部分静默丢弃
   * - 返回值告诉调用方实际添加的数量
   *
   * 副作用：
   * - 异步触发 persistInventory（失败不影响 UI）
   * - 通过 useLogStore 记录冒险日志
   *
   * @param itemId - 物品 ID
   * @param quantity - 期望添加的数量
   * @returns 实际成功添加的数量（可能小于 quantity）
   */
  function addItem(itemId: string, quantity: number): number {
    if (!currentCharacterId.value || quantity <= 0) return 0;

    const itemTemplate = itemTemplates.value.get(itemId);
    if (!itemTemplate) return 0;

    let added = 0;
    // 浅拷贝整个背包以确保 Vue 响应式更新
    // [性能敏感] O(n) 浅拷贝，当前背包规模（几十个物品槽位）开销可接受。
    // 若未来扩展到数百个槽位，可考虑基于 Immer 或结构共享方案。
    const newInventory = inventory.value.map(item => ({ ...item }));

    // 第一步：可堆叠物品先尝试填充已有槽位
    if (itemTemplate.stackable) {
      for (let i = 0; i < newInventory.length && added < quantity; i++) {
        if (newInventory[i].itemId === itemId) {
          const result = computeStackResult(newInventory[i].count, quantity - added, MAX_STACK);
          const delta = result.quantity - newInventory[i].count;
          newInventory[i] = { ...newInventory[i], count: result.quantity };
          added += delta;
        }
      }
    }

    // 第二步：剩余数量创建新槽位
    const perSlot = itemTemplate.stackable ? MAX_STACK : 1;
    while (added < quantity && newInventory.length < INVENTORY_SIZE) {
      const slotCount = Math.min(quantity - added, perSlot);
      newInventory.push({ itemId, count: slotCount });
      added += slotCount;
    }

    if (added > 0) {
      inventory.value = newInventory;
      persistInventory();

      // 记录冒险日志
      const countText = added > 1 ? ` x${added}` : '';
      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'item',
        message: `获得了物品：${itemTemplate.name}${countText}`,
        icon: 'game-icons:chest'
      });

      // P1-1：通知任务系统物品收集进度（collect 类型任务）
      // ARCH-2 修复：通过回调注入替代 useQuestStore() 直接调用，消除 inventory → quest 静态依赖
      onItemCollectedCallback?.(itemId, added);
    }

    return added;
  }

  // ==================== Action：移除物品 ====================

  /**
   * 移除指定物品
   *
   * 从前往后遍历背包，逐个扣减直到满足数量要求。
   * 槽位中物品数量用尽后整个槽位被移除。
   *
   * @param itemId - 物品 ID
   * @param quantity - 期望移除的数量
   * @returns 实际成功移除的数量（背包中不足时返回实际移除数）
   */
  function removeItem(itemId: string, quantity: number): number {
    if (!currentCharacterId.value || quantity <= 0) return 0;

    let removed = 0;
    const newInventory: InventoryItem[] = [];

    for (const invItem of inventory.value) {
      if (invItem.itemId === itemId && removed < quantity) {
        const toRemove = Math.min(invItem.count, quantity - removed);
        removed += toRemove;
        if (invItem.count > toRemove) {
          // 部分移除：保留剩余数量
          newInventory.push({ ...invItem, count: invItem.count - toRemove });
        }
        // 全部移除：不 push（槽位删除）
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

  /**
   * 按索引移除物品（兼容旧接口）
   *
   * 删除指定位置槽位的所有物品（无论 count 多少）。
   * 建议新代码使用 removeItem(itemId, quantity) 代替此接口。
   *
   * @param index - 物品位置索引
   * @returns 实际移除的数量
   */
  function removeItemByIndex(index: number): number {
    if (index < 0 || index >= inventory.value.length) return 0;
    const invItem = inventory.value[index];
    // [性能敏感] 数组浅拷贝，当前背包规模可接受。
    const newInventory = [...inventory.value];
    newInventory.splice(index, 1);
    inventory.value = newInventory;
    persistInventory();
    return invItem.count;
  }

  // ==================== Action：使用物品 ====================

  /**
   * 使用指定消耗品（供其他 Store 直接调用）
   *
   * 使用流程：
   * 1. 验证：角色存在、物品在背包中、物品为消耗品
   * 2. 效果应用：effect 字段驱动即时效果（恢复/伤害），bonus 字段驱动属性加成
   * 3. 物品消耗：堆叠物品 count-1，单件物品从槽位移除
   * 4. 持久化：await persistInventory（确保效果和消耗的事务性）
   * 5. 日志：记录冒险日志
   *
   * 效果类型支持：
   * - health_restore：调用 characterStore.receiveHeal
   * - mana_restore：调用 characterStore.changeMp
   * - physical_damage / magic_damage：不在本方法处理（见下方说明）
   * - stat：通过 bonus 字段处理（见下方 bonus 分支）
   *
   * 伤害型物品（physical_damage / magic_damage）的设计说明：
   * 伤害计算依赖战斗上下文（目标、暴击、BOSS 防御机制、荆棘反伤等），
   * 由 combat/composables/usePlayerAction.ts 的 playerUseItem 先对目标造成伤害，
   * 再调用本方法仅消耗物品数量。本方法遇到伤害型效果时跳过（非战斗上下文使用伤害物品无意义）。
   *
   * 注意：effect 和 bonus 是两个独立的 if 分支：
   * - effect 处理即时效果（恢复/伤害）
   * - bonus 处理属性加成（独立于 effect，允许纯属性药水等物品）
   *
   * @param itemId - 物品 ID
   * @returns 是否成功使用
   */
  async function useItem(itemId: string): Promise<boolean> {
    if (!currentCharacterId.value) return false;

    const idx = findItemIndex(inventory.value, itemId);
    if (idx === -1) return false;

    const invItem = inventory.value[idx];
    const itemTemplate = itemTemplates.value.get(itemId);
    if (!itemTemplate || !itemTemplate.consumable) return false;

    // 获取角色 Store（提升到顶部避免重复调用）
    const characterStore = useCharacterStore();

    // P1-14 修复：校验等级要求，低等级角色不可使用高等级消耗品
    if (itemTemplate.levelRequirement && characterStore.level < itemTemplate.levelRequirement) {
      return false;
    }

    // 计算并应用物品即时效果（effect 字段）
    const effect = computeUseEffect(itemTemplate);
    if (effect) {
      const { type, value } = effect;

      if (type === 'health_restore' && typeof value === 'number' && value > 0) {
        await characterStore.receiveHeal(value);
      } else if (type === 'mana_restore' && typeof value === 'number' && value > 0) {
        await characterStore.changeMp(value);
      } else if (type === 'physical_damage' && typeof value === 'number' && value > 0) {
        // 伤害型物品由战斗系统处理（见 usePlayerAction.playerUseItem），此处仅消耗物品数量
      } else if (type === 'magic_damage' && typeof value === 'number' && value > 0) {
        // 伤害型物品由战斗系统处理（见 usePlayerAction.playerUseItem），此处仅消耗物品数量
      } else if (type === 'stat') {
        // stat 类型效果通过 bonus 字段处理，见下方 bonus 应用逻辑
      }
    }

    // 应用属性加成（bonus 字段，独立于 effect）
    // P2-53 修复：消耗品的 bonus 是永久叠加到 bonusStats，使用 10 瓶"力量药水"会永久获得 +50 力量。
    // 设计原则：bonus 字段不应配置在 consumable 物品上，应仅用于装备；
    //           消耗品的临时增益应通过 buff 系统（combat/effects）实现。
    // 此处保留 applyBonus 调用作为向后兼容，但开发期会输出警告提示配置问题。
    if (itemTemplate.bonus && Object.keys(itemTemplate.bonus).length > 0) {
      if (import.meta.env.DEV) {
        console.warn(
          `[InventoryStore] 消耗品 ${itemTemplate.id} (${itemTemplate.name}) 配置了 bonus 字段，` +
          `使用时将永久叠加到 bonusStats。建议改为 buff 系统实现临时增益。`
        );
      }
      await characterStore.applyBonus(itemTemplate.bonus);
    }

    // 消耗物品：堆叠物品 count-1，单件物品移除槽位
    // [性能敏感] map 创建新数组副本，当前背包规模可接受。
    if (invItem.count > 1) {
      inventory.value = inventory.value.map((item, i) =>
        i === idx ? { ...item, count: item.count - 1 } : item
      );
    } else {
      inventory.value = inventory.value.filter((_, i) => i !== idx);
    }

    // 事务性持久化：确保效果应用和物品消耗同步落盘
    await persistInventory();

    // 记录冒险日志
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'item',
      message: `使用了：${itemTemplate.name}`,
      icon: 'game-icons:potion-ball'
    });

    return true;
  }

  /**
   * 按索引使用物品（兼容旧接口）
   *
   * 将索引转换为 itemId 后委托给 useItem(itemId)。
   *
   * @param index - 物品位置索引
   * @returns 是否成功使用
   */
  async function useItemByIndex(index: number): Promise<boolean> {
    if (index < 0 || index >= inventory.value.length) return false;
    return useItem(inventory.value[index].itemId);
  }

  // ==================== Action：丢弃物品 ====================

  /**
   * 按索引丢弃物品（兼容旧接口）
   *
   * 从指定槽位丢弃 count 个物品。
   * count 未提供时丢弃该槽位的全部物品。
   *
   * 使用 ?? 而非 || 作为默认值，因为 count=0 是合法输入（虽不常见）。
   *
   * @param index - 物品位置索引
   * @param count - 丢弃数量（可选，默认丢弃全部）
   * @returns 是否成功丢弃
   */
  function dropItemByIndex(index: number, count?: number): boolean {
    if (index < 0 || index >= inventory.value.length) return false;

    const invItem = inventory.value[index];
    // P1-15 修复：任务物品不可丢弃，防止玩家误操作导致任务卡死
    const itemTemplate = itemTemplates.value.get(invItem.itemId);
    if (itemTemplate?.type === 'quest') return false;

    const dropCount = count ?? invItem.count;

    if (dropCount >= invItem.count) {
      // 丢弃全部：移除槽位
      // [性能敏感] filter 创建新数组副本，当前背包规模可接受。
      inventory.value = inventory.value.filter((_, i) => i !== index);
    } else {
      // 丢弃部分：减少 count
      // [性能敏感] map 创建新数组副本，当前背包规模可接受。
      inventory.value = inventory.value.map((item, i) =>
        i === index ? { ...item, count: item.count - dropCount } : item
      );
    }

    persistInventory();

    // 记录冒险日志
    const droppedItem = itemTemplates.value.get(invItem.itemId);
    if (droppedItem) {
      const countText = dropCount > 1 ? ` x${dropCount}` : '';
      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'item',
        message: `丢弃了：${droppedItem.name}${countText}`,
        icon: 'game-icons:trash-can'
      });
    }

    return true;
  }

  /**
   * 批量丢弃物品（兼容旧接口）
   *
   * 一次性丢弃多个槽位的物品。
   * 从后往前排序避免 splice 导致的索引偏移问题。
   *
   * @param indices - 物品位置索引列表
   * @returns 是否成功丢弃
   */
  function dropItemsByIndices(indices: number[]): boolean {
    if (indices.length === 0) return false;

    // P1-15 修复：过滤掉任务物品的索引，任务物品不可丢弃
    const validIndices = indices.filter(index => {
      if (index < 0 || index >= inventory.value.length) return false;
      const invItem = inventory.value[index];
      const itemTemplate = itemTemplates.value.get(invItem.itemId);
      return itemTemplate?.type !== 'quest';
    });
    if (validIndices.length === 0) return false;

    // 从大到小排序：从尾部开始 splice，前面的索引不会受影响
    // [性能敏感] 数组浅拷贝，当前背包规模可接受。
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

  // ==================== Action：整理背包 ====================

  /**
   * 整理背包：合并同类物品并按品质/分类排序
   *
   * 整理流程：
   * 1. 合并同类物品（相同 itemId 的物品汇总总数量）
   * 2. 按堆叠规则重新分配槽位（堆叠物品按 MAX_STACK 分拆，不可堆叠每件一个槽位）
   * 3. 排序：先按稀有度降序（传说 → 普通），同稀有度按类型升序（拼音）
   *
   * 注意：此操作不可逆，整理后的槽位顺序与原始顺序无关。
   *
   * [性能敏感] 整理操作重建整个背包数组，涉及 Map 聚合 + 重分配 + 排序。
   * 当前背包规模（几十个物品槽位）开销可接受。若未来扩展到数百个槽位，
   * 可考虑增量整理（仅对新增/变化物品做排序插入）。
   */
  function organizeInventory(): void {
    // 第一步：汇总每个 itemId 的总数量
    const itemsMap = new Map<string, number>();
    inventory.value.forEach(item => {
      itemsMap.set(item.itemId, (itemsMap.get(item.itemId) || 0) + item.count);
    });

    // 第二步：按堆叠规则分配槽位
    const newInventory: InventoryItem[] = [];
    itemsMap.forEach((totalCount, itemId) => {
      const itemInfo = itemTemplates.value.get(itemId);
      if (!itemInfo?.stackable) {
        // 不可堆叠：每件物品占用一个独立槽位
        for (let i = 0; i < totalCount; i++) {
          newInventory.push({ itemId, count: 1 });
        }
      } else {
        // P3-105 修复：使用独立变量 remaining，避免修改 forEach 回调参数
        let remaining = totalCount;
        while (remaining > 0) {
          const stackSize = Math.min(remaining, MAX_STACK);
          newInventory.push({ itemId, count: stackSize });
          remaining -= stackSize;
        }
      }
    });

    // 第三步：排序（品质降序 → 类型升序）
    newInventory.sort((a, b) => {
      const itemA = itemTemplates.value.get(a.itemId);
      const itemB = itemTemplates.value.get(b.itemId);
      const rarityA = RARITY_ORDER[itemA?.rarity || 'common'];
      const rarityB = RARITY_ORDER[itemB?.rarity || 'common'];
      if (rarityA !== rarityB) return rarityB - rarityA; // 稀有度降序
      return ITEM_TYPE_NAMES[itemA?.type || 'misc'].localeCompare(
        ITEM_TYPE_NAMES[itemB?.type || 'misc']
      );
    });

    inventory.value = newInventory;
    persistInventory();
  }

  // ==================== Action：查询 ====================

  /**
   * 获取物品模板信息
   *
   * 从内存缓存中查询，不触发 DB 操作。
   *
   * @param itemId - 物品 ID
   * @returns 物品模板数据，不存在时返回 null
   */
  function getItemInfo(itemId: string): Item | null {
    return itemTemplates.value.get(itemId) || null;
  }

  /**
   * 获取所有物品模板
   *
   * 返回 itemTemplates Map 中所有物品（含装备）的数组副本。
   *
   * @returns 全部物品模板列表
   */
  function getAllItems(): Item[] {
    return Array.from(itemTemplates.value.values());
  }

  /**
   * 搜索物品（按关键词）
   *
   * 直接复用 sortAndFilterInventory 实现搜索。
   * filters 传入空对象表示不做类型/稀有度筛选。
   *
   * @param keyword - 搜索关键词
   * @returns 匹配的物品列表
   */
  function searchItems(keyword: string): InventoryItem[] {
    return sortAndFilterInventory(inventory.value, itemTemplates.value, {}, sortBy.value, sortOrder.value, keyword);
  }

  /**
   * 按筛选条件过滤物品
   *
   * 直接复用 sortAndFilterInventory 实现过滤，
   * 搜索关键词保持当前 searchKeyword 值。
   *
   * @param filtersParam - 筛选条件
   * @returns 匹配的物品列表
   */
  function filterInventory(filtersParam: ItemFilters): InventoryItem[] {
    return sortAndFilterInventory(inventory.value, itemTemplates.value, filtersParam, sortBy.value, sortOrder.value, searchKeyword.value);
  }

  // ==================== Action：排序与筛选设置 ====================

  /** 更新排序方式（同时设置字段和顺序） */
  function updateSort(sortField: SortField, order: SortOrder): void {
    sortBy.value = sortField;
    sortOrder.value = order;
  }

  /** 设置筛选条件（替换当前所有条件） */
  function setFilters(newFilters: ItemFilters): void {
    filters.value = newFilters;
  }

  /** 设置搜索关键词 */
  function setSearchKeyword(keyword: string): void {
    searchKeyword.value = keyword;
  }

  /** 重置所有筛选条件和搜索关键词 */
  function resetFilters(): void {
    filters.value = {};
    searchKeyword.value = '';
  }

  // ==================== Action：模板管理 ====================

  /**
   * 添加物品模板（运行时动态注册）
   *
   * 先更新内存缓存（Map.set），再异步持久化到 DB。
   * DB 持久化使用 .catch() 记录错误，不影响内存状态。
   *
   * @param item - 物品数据
   */
  function addItemTemplate(item: Item): void {
    const newMap = new Map(itemTemplates.value);
    newMap.set(item.id, item);
    itemTemplates.value = newMap;
    inventoryDbService.saveItemTemplate(item).catch(err => {
      console.error('[InventoryStore] 保存物品模板失败:', item.id, err);
    });
  }

  /**
   * 删除物品模板
   *
   * 先更新内存缓存（Map.delete），再异步从 DB 删除。
   * DB 删除使用 .catch() 记录错误，不影响内存状态。
   *
   * @param itemId - 物品 ID
   */
  function removeItemTemplate(itemId: string): void {
    const newMap = new Map(itemTemplates.value);
    newMap.delete(itemId);
    itemTemplates.value = newMap;
    inventoryDbService.deleteItemTemplate(itemId).catch(err => {
      console.error('[InventoryStore] 删除物品模板失败:', itemId, err);
    });
  }

  // ==================== Action：加载（兼容旧接口） ====================

  /**
   * 加载背包数据（兼容旧接口 store.loadInventory()）
   *
   * 当 characterId 已通过 initialize 设置时可无参调用。
   * 新代码建议使用 initialize(characterId) 直接初始化。
   */
  async function loadInventory(): Promise<void> {
    if (currentCharacterId.value) {
      await initialize(currentCharacterId.value);
    }
  }

  // ==================== Action：重置 ====================

  /**
   * 重置背包
   *
   * 清空背包物品列表并持久化为空数组。
   * 不重置 itemTemplates 和筛选设置。
   */
  function resetInventory(): void {
    inventory.value = [];
    persistInventory();
  }

  // ==================== 导出 ====================

  return {
    // 状态（响应式 ref）
    inventory,
    itemTemplates,
    filters,
    sortBy,
    sortOrder,
    searchKeyword,
    currentCharacterId,
    isLoading,
    // P2-50：暴露持久化错误状态，供 UI 监听并提示用户
    persistError,

    // 计算属性（computed）
    filteredInventory,
    emptySlots,
    isFull,
    totalValue,
    itemCountByType,
    allItemTypes,
    allRarities,

    // Action：初始化
    initialize,
    loadInventory,

    // Action：核心操作（供其他 Store 直接调用）
    addItem,
    removeItem,
    useItem,

    // DB-1/DB-2 修复：等待进行中的持久化完成（供 equipment 模块回滚场景使用）
    flushPersist,

    // Action：查询（只读，不修改状态）
    getItemInfo,
    getAllItems,
    searchItems,
    filterInventory,

    // Action：兼容旧接口（基于索引而非 itemId 操作）
    removeItemByIndex,
    useItemByIndex,
    dropItemByIndex,
    dropItemsByIndices,
    organizeInventory,
    addItemTemplate,
    removeItemTemplate,
    resetInventory,

    // Action：筛选设置
    updateSort,
    setFilters,
    setSearchKeyword,
    resetFilters
  };
});
