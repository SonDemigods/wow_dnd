/**
 * @fileoverview 商店模块状态管理（Pinia Store）
 * @description Store 是商店数据的唯一持有者，所有响应式状态在此集中管理。
 *              Action 负责编排完整业务流程：
 *              Service 纯函数 → Store 状态更新 → DB 持久化 → 事件总线通知。
 *
 * **核心设计决策**：
 * - **回购列表**：用 `ref<Map>` 而非 `reactive`，通过 `_replaceSoldItems` 辅助函数整体替换
 *   触发响应式（ARCH-14 修复），避免 Map 内部变更不被追踪的问题。
 *   BIZ-16：`soldItems` 持久化到 IndexedDB `runtime_shopSoldItems` 表，`init` 时恢复。
 * - **商品刷新**：配置加载与商品生成分离——`loadShopConfigs` 只加载商店元数据，
 *   `loadOrGenerateItems` 按需加载/生成商品，避免一次性加载所有数据。
 *   BIZ-20：`lastRefresh` 随 `runtime_shopItems` 表持久化，`init`/`loadOrGenerateItems` 时恢复，
 *   避免页面刷新后刷新检查被跳过。
 * - **购买次数限制**：BIZ-21 — 生成商品可选携带 `maxPurchaseCount`，`buyItem` 累计 `purchasedCount`
 *   并在达到上限时阻止购买（toast 提示），`purchasedCount` 随商品列表持久化。
 * - **种子数据回退**：DB 中无配置时自动从硬编码 {@link SHOPS} 播种并写回，确保首次运行不报错。
 * - **页面恢复**：关闭/刷新页面时通过 `saveCurrentShopId` 持久化当前商店ID，
 *   下次 `init` 时自动恢复。
 *
 * **事件通知**（通过 {@link eventBus}）：
 * - `SHOP_OPENED`      — 打开商店时触发
 * - `SHOP_CLOSED`      — 关闭商店时触发
 * - `SHOP_TRANSACTION` — 买卖操作完成时触发（携带交易详情）
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ShopConfig, ShopItem, SoldItemEntry } from './types';
import { shopDbService } from './db';
import { eventBus, GameEvents } from '@/modules/bus';
import { useLogStore } from '@/modules/log/store';
import { generateLogId } from '@/modules/log/service';
import { useCharacterStore } from '@/modules/character/store';
import { useInventoryStore } from '@/modules/inventory/store';
import { generateShopItems, canAffordItem, computeSellPrice } from './service';
import { useToast } from '@/composables/useToast';
import { SHOPS } from '@/data/config_shops';
import { errorHandler } from '@/services/ErrorHandler';
import { errorReporter } from '@/utils/errorReport';
import { useGameStore } from '@/modules/game';
import { hasCapability } from '@/modules/item/capabilityRegistry';

/**
 * 商店 Pinia Store
 *
 * 使用 Setup Store 语法（组合式 API），所有状态和方法定义在同一函数作用域内，
 * 通过 return 选择性地暴露给外部。
 */
export const useShopStore = defineStore('shop', () => {
  // ==================== 响应式状态 ====================

  /** 全部商店配置列表（从 DB 加载，空则用种子数据播种） */
  const shops = ref<ShopConfig[]>([]);

  // P3-116 修复：currentShopId 收敛到 GameStore，shopStore 通过只读 computed 代理访问。
  // 所有修改必须通过 gameStore.setCurrentShopId() 完成（触发持久化），
  // 不能直接赋值 currentShopId.value（只读 computed 会触发 Vue 警告且不生效）。
  const gameStore = useGameStore();
  /** 当前打开的商店ID，null 表示未打开任何商店 */
  const currentShopId = computed<string | null>(() => gameStore.currentShopId);

  /** 当前商店的商品列表（生成商品 + 回购物品合并后） */
  const currentItems = ref<ShopItem[]>([]);

  /** 初始化加载标志，防止重复 init */
  const isLoading = ref(false);

  // ==================== 内部状态（仅 ref 层面响应式） ====================

  /**
   * 玩家出售给商店的物品（回购跟踪）
   *
   * 结构：`shopId → itemId → SoldItemEntry` 二级 Map。
   *
   * ARCH-14 修复：Vue 3 的 `ref<Map>` 对 Map 的 `.set()` / `.delete()` 不触发深层响应式，
   * 因此修改后必须创建新 Map 实例整体替换。`_replaceSoldItems` 辅助函数封装该模式，
   * 在副本上执行修改后整体赋值，避免遗漏。
   * BIZ-16：修改后通过 {@link shopDbService.saveSoldItems} 持久化到 IndexedDB。
   */
  const soldItems = ref<Map<string, Map<string, SoldItemEntry>>>(new Map());

  /**
   * 各商店上次商品生成时间戳
   *
   * 用于判断打开商店时是否需要重新生成商品（超过 refreshInterval 则刷新）。
   * BIZ-20：持久化到 IndexedDB（随 runtime_shopItems 表的 lastRefresh 字段），
   * init 时从 DB 恢复，避免页面刷新后刷新检查被跳过。
   */
  const lastRefresh = ref<Map<string, number>>(new Map());

  /**
   * 整体替换 soldItems 触发响应式更新（ARCH-14 修复）
   *
   * Vue 3 的 `ref<Map>` 对 Map 的 `.set()` / `.delete()` 不触发深层响应式，
   * 因此修改前先深拷贝二级 Map，在副本上执行修改，再整体赋值给 `soldItems.value`。
   *
   * @param mutator - 在副本上执行的修改函数
   */
  function _replaceSoldItems(mutator: (map: Map<string, Map<string, SoldItemEntry>>) => void): void {
    // 深拷贝二级 Map，避免修改原引用
    const newMap = new Map<string, Map<string, SoldItemEntry>>();
    for (const [shopId, innerMap] of soldItems.value) {
      newMap.set(shopId, new Map(innerMap));
    }
    mutator(newMap);
    soldItems.value = newMap;
  }

  // ==================== 计算属性 ====================

  /** 当前商店配置对象的快捷访问，未打开商店时返回 null */
  const currentShopConfig = computed<ShopConfig | null>(() => {
    if (!currentShopId.value) return null;
    return shops.value.find(shop => shop.id === currentShopId.value) || null;
  });

  // ==================== 内部工具函数 ====================

  /**
   * 合并生成商品与回购物品为统一展示列表
   *
   * 合并规则：
   * 1. 回购物品排在最前面
   * 2. 生成商品中排除已在回购列表的物品（避免重复）
   * 3. 过滤掉库存为 0 的商品
   *
   * @param generatedItems - DB 中的生成商品列表
   * @returns 合并后的商品列表（回购物品在前，生成商品在后）
   */
  function mergeItems(generatedItems: ShopItem[]): ShopItem[] {
    // P3-103 修复：使用显式守卫替代非空断言，避免 currentShopId 为 null 时意外通过
    const shopId = currentShopId.value;
    if (!shopId) return [...generatedItems];
    const soldMap = soldItems.value.get(shopId);
    const sold: ShopItem[] = soldMap
      ? Array.from(soldMap.values()).map(e => ({ itemId: e.itemId, price: e.price, quantity: e.quantity }))
      : [];

    const soldIds = new Set(sold.map(s => s.itemId));
    const filtered = generatedItems.filter(i => !soldIds.has(i.itemId) && i.quantity > 0);

    return [...sold, ...filtered];
  }

  // ==================== 数据加载 ====================

  /**
   * 加载商店配置（DB → 状态）
   *
   * DB 有数据时直接使用；DB 为空（首次运行或数据损坏）时回退到硬编码种子数据
   * 并异步写回 DB，保证后续启动从 DB 读取。
   */
  async function loadShopConfigs(): Promise<void> {
    const configs = await shopDbService.getAllShopConfigs();
    if (configs.length > 0) {
      shops.value = configs;
    } else {
      // DB 中无商店配置（数据损坏或首次运行），回退到硬编码数据
      console.warn('[ShopStore] 数据库中无商店配置，使用硬编码种子数据');
      shops.value = [...SHOPS];
      // 回写到 DB，修复数据
      for (const shop of SHOPS) {
        shopDbService.saveShopConfig(shop).catch(err => {
          console.error('[ShopStore] 种子商店配置写入失败:', err);
        });
      }
    }
  }

  /**
   * 按需加载或生成商店商品
   *
   * 优先从 DB 恢复已保存的商品；DB 为空时调用 regenerateItems 重新生成。
   * 此设计避免在 init 阶段一次性为所有商店生成商品，改为按需懒加载。
   *
   * BIZ-20：从 DB 加载商品时同步恢复 `lastRefresh` 时间戳，避免页面刷新后
   * 刷新检查被跳过（玩家通过刷新页面重置商店刷新计时器的漏洞）。
   *
   * @param shopId - 商店ID
   * @returns 商品列表
   */
  async function loadOrGenerateItems(shopId: string): Promise<ShopItem[]> {
    // 读取完整 storage（包含 lastRefresh 元数据）
    const storage = await shopDbService.getShopItemsStorage(shopId);
    if (storage && storage.items && storage.items.length > 0) {
      // BIZ-20: 恢复 lastRefresh 到内存 Map（与 init 中的恢复幂等，确保最新）
      if (typeof storage.lastRefresh === 'number') {
        lastRefresh.value.set(shopId, storage.lastRefresh);
      }
      return storage.items;
    }

    // 重新生成
    return await regenerateItems(shopId);
  }

  /**
   * 强制重新生成商店商品并持久化
   *
   * 调用 {@link generateShopItems} 生成新商品列表，写入 DB 并更新内存中的刷新时间戳。
   *
   * BIZ-20：内存与 DB 中的 `lastRefresh` 使用同一时间戳，避免不一致导致刷新计时器错乱。
   *
   * @param shopId - 商店ID
   * @returns 生成的商品列表（商店不存在时返回空数组）
   */
  async function regenerateItems(shopId: string): Promise<ShopItem[]> {
    const config = shops.value.find(s => s.id === shopId);
    if (!config) return [];

    const inventoryStore = useInventoryStore();
    const allTemplates = inventoryStore.getAllItems();
    const items = generateShopItems(config, allTemplates);

    // BIZ-20: 统一内存与 DB 中的 lastRefresh 时间戳
    const now = Date.now();
    lastRefresh.value.set(shopId, now);
    await shopDbService.saveShopItems(shopId, items, now);

    return items;
  }

  // ==================== Action：初始化 ====================

  /**
   * 初始化商店模块
   *
   * 调用时机：应用启动时由 bootstrap 调用。
   * 流程：加载商店配置 → 恢复上次会话打开的商店ID（如有）→ 恢复回购列表与刷新时间戳。
   * 注意：此处只恢复商店ID与运行时状态，商品数据在 openShop 时才按需加载。
   *
   * BIZ-16：从 IndexedDB 恢复回购列表（soldItems），避免页面刷新后回购列表清空。
   * BIZ-20：从 IndexedDB 恢复各商店 lastRefresh 时间戳，避免刷新检查被跳过。
   */
  async function init(): Promise<void> {
    if (isLoading.value) return;
    isLoading.value = true;

    try {
      await loadShopConfigs();

      // P3-116 修复：currentShopId 已由 GameStore 持有（App.vue 初始化时从 DB 恢复）
      // 此处仅需验证 savedShopId 是否在当前商店配置中有效，无效则清空
      const savedShopId = gameStore.getCurrentShopId();
      if (savedShopId && !shops.value.some(s => s.id === savedShopId)) {
        // 商店配置中不存在该 ID（数据损坏或版本变更），清空 currentShopId
        await gameStore.setCurrentShopId(null);
      }

      // BIZ-16: 恢复回购列表（持久化数据 → 内存 Map，通过 _replaceSoldItems 触发响应式）
      const allSoldItems = await shopDbService.getAllSoldItems();
      _replaceSoldItems(newMap => {
        for (const record of allSoldItems) {
          const innerMap = new Map<string, SoldItemEntry>();
          for (const entry of record.soldItems) {
            innerMap.set(entry.itemId, { ...entry });
          }
          newMap.set(record.shopId, innerMap);
        }
      });

      // BIZ-20: 恢复各商店上次刷新时间戳，避免页面刷新后刷新检查被跳过
      const allStorages = await shopDbService.getAllShopItemsStorage();
      for (const storage of allStorages) {
        if (typeof storage.lastRefresh === 'number') {
          lastRefresh.value.set(storage.shopId, storage.lastRefresh);
        }
      }
    } catch (err) {
      console.error('[ShopStore] 初始化失败:', err);
      errorHandler.report(err, '加载商店失败');
    } finally {
      isLoading.value = false;
    }
  }

  // ==================== Action：打开商店 ====================

  /**
   * 打开指定商店
   *
   * 完整流程：
   * 1. 校验 shopId 有效性
   * 2. 切换商店时清空旧商品列表
   * 3. 确保配置已加载（首次调用时触发 loadShopConfigs）
   * 4. 加载/生成商品，按需自动刷新
   * 5. 持久化当前商店ID（供页面恢复）
   * 6. 更新 Store 状态
   * 7. emit SHOP_OPENED 通知 UI
   *
   * @param shopId - 商店ID
   */
  async function openShop(shopId: string): Promise<void> {
    if (!shopId) {
      console.warn('[ShopStore] openShop 收到空 shopId，已忽略');
      return;
    }

    // 切换商店时清空旧数据
    if (currentShopId.value !== shopId) {
      currentItems.value = [];
    }

    try {
      // 确保配置已加载
      if (shops.value.length === 0) {
        await loadShopConfigs();
      }

      const config = shops.value.find(s => s.id === shopId);
      if (!config) {
        console.warn(`[ShopStore] 商店 "${shopId}" 不存在`);
        return;
      }

      // 加载或生成商品
      let generatedItems = await loadOrGenerateItems(shopId);

      // 检查是否需要刷新
      const lastTime = lastRefresh.value.get(shopId);
      if (lastTime && config.refreshInterval > 0) {
        if (Date.now() - lastTime >= config.refreshInterval) {
          generatedItems = await regenerateItems(shopId);
        }
      }

      // P3-116 修复：通过 GameStore 设置并持久化 currentShopId（只读 computed 自动反映）
      await gameStore.setCurrentShopId(shopId);

      // 更新 Store 状态
      currentItems.value = mergeItems(generatedItems);

      // 通知 UI（音效等）
      const characterStore = useCharacterStore();
      const characterId = characterStore.getCharacterId();
      eventBus.emit(GameEvents.SHOP_OPENED, { shopId, characterId: characterId || undefined });
    } catch (err) {
      console.error('[ShopStore] 打开商店失败:', err);
      errorHandler.report(err, '加载商店失败');
    }
  }

  // ==================== Action：购买物品 ====================

  /**
   * 从当前商店购买物品
   *
   * 完整交易流程：
   * 1. 校验商店状态、物品库存
   * 2. BIZ-21：校验购买次数上限（仅生成商品，回购物品不限制）
   * 3. 检查金币 → 扣除金币（spendGold）
   * 4. 添加物品到背包（addItem）→ 失败则返还金币
   * 5. 更新商店库存（回购列表或生成商品）
   * 6. 刷新当前商品列表
   * 7. emit SHOP_TRANSACTION 通知 UI
   * 8. 写入冒险日志
   *
   * 购买有两种路径：
   * - **回购路径**：物品在 soldItems Map 中，直接扣减回购数量（BIZ-16：同步持久化）
   * - **生成商品路径**：物品来自系统生成，从 DB 商品列表中扣减（BIZ-21：累计 purchasedCount）
   *
   * @param itemId   - 物品ID
   * @param quantity - 购买数量，默认 1
   * @returns 是否购买成功
   */
  async function buyItem(itemId: string, quantity: number = 1): Promise<boolean> {
    if (!currentShopId.value || quantity <= 0) return false;

    const shopId = currentShopId.value;

    // 查找商品（可能在回购列表或生成商品中）
    const shopItem = currentItems.value.find(item => item.itemId === itemId);
    if (!shopItem || shopItem.quantity < quantity) return false;

    // 判断是否为回购物品（回购物品不限制购买次数，其可购买次数由 quantity 自然限制）
    const soldMap = soldItems.value.get(shopId);
    const isBuyback = soldMap?.has(itemId) ?? false;

    // BIZ-21: 校验购买次数上限（仅对生成商品，回购物品不限制）
    if (!isBuyback && shopItem.maxPurchaseCount !== undefined) {
      const currentPurchased = shopItem.purchasedCount ?? 0;
      if (currentPurchased + quantity > shopItem.maxPurchaseCount) {
        const remaining = Math.max(0, shopItem.maxPurchaseCount - currentPurchased);
        const toast = useToast();
        if (remaining > 0) {
          // P6-055 修复：有剩余额度时按剩余数量部分购买
          toast.show({
            message: `该商品限购 ${shopItem.maxPurchaseCount} 次，本次仅可购买 ${remaining} 件`,
            type: 'warning',
            duration: 2500
          });
          quantity = remaining;
        } else {
          toast.show({
            message: `该商品已达购买上限（${shopItem.maxPurchaseCount} 次）`,
            type: 'warning',
            duration: 2500
          });
          return false;
        }
      }
    }

    let totalPrice = shopItem.price * quantity;

    // 1. 检查并扣除金币
    const characterStore = useCharacterStore();
    const character = characterStore.getCharacterData();
    if (!character || !canAffordItem(character, totalPrice)) return false;

    const spent = await characterStore.spendGold(totalPrice);
    if (!spent) return false;

    // 2. 添加物品到背包
    const inventoryStore = useInventoryStore();
    const added = inventoryStore.addItem(itemId, quantity);
    if (added < quantity) {
      // P2-1：背包空间不足，按未添加比例返还金币（避免部分成功时白嫖）
      const unitPrice = shopItem.price;
      const refundAmount = unitPrice * (quantity - added);
      if (refundAmount > 0) {
        await characterStore.gainGold(refundAmount);
      }
      if (added === 0) {
        return false;
      }
      // 部分成功：继续后续流程，商店库存/日志按实际购买量 added 处理
      useToast().show({
        message: `背包空间不足，仅成功购买 ${added} 件`,
        type: 'warning',
        duration: 2500
      });
      quantity = added;
      totalPrice = shopItem.price * added;
    }

    // 3. 更新商店库存（ARCH-14：通过 _replaceSoldItems 整体替换触发响应式）
    // P2-54 修复：将扣金币、加背包、减库存视为事务，第 3 步失败时回滚前两步
    let generated: ShopItem[] | null = null;

    try {
      if (isBuyback && soldMap) {
        // 从回购列表中扣减（前置条件 isBuyback 已保证 soldMap 中存在该 itemId）
        _replaceSoldItems(newMap => {
          const innerMap = newMap.get(shopId);
          if (!innerMap) return;
          const entry = innerMap.get(itemId);
          if (!entry) return;
          entry.quantity -= quantity;
          if (entry.quantity <= 0) {
            innerMap.delete(itemId);
          }
          if (innerMap.size === 0) {
            newMap.delete(shopId);
          }
        });

        // BIZ-16: 持久化回购列表到 IndexedDB（整体替换后读取最新状态）
        const updatedSoldMap = soldItems.value.get(shopId);
        await shopDbService.saveSoldItems(shopId, updatedSoldMap ? Array.from(updatedSoldMap.values()) : []);
      } else {
        // 从生成商品中扣减（读取完整 storage 以保留原 lastRefresh，避免重置刷新计时器）
        const storage = await shopDbService.getShopItemsStorage(shopId);
        generated = storage?.items ?? null;
        if (generated) {
          const idx = generated.findIndex(i => i.itemId === itemId);
          if (idx !== -1) {
            generated[idx].quantity -= quantity;
            // BIZ-21: 累计已购买次数（仅当商品携带 maxPurchaseCount 时）
            if (generated[idx].maxPurchaseCount !== undefined) {
              generated[idx].purchasedCount = (generated[idx].purchasedCount ?? 0) + quantity;
            }
            if (generated[idx].quantity <= 0) {
              generated.splice(idx, 1);
            }
            // BIZ-20: 保留原 lastRefresh，避免购买操作重置刷新计时器
            await shopDbService.saveShopItems(shopId, generated, storage?.lastRefresh);
          }
        }
      }
    } catch (err) {
      // P2-54 修复：商店库存更新失败，回滚金币和背包
      // DB-3 增强：回滚失败时上报 errorReporter，确保运维可监测
      console.error('[ShopStore] buyItem 更新商店库存失败，回滚金币和背包:', err);
      errorReporter.report(err, 'manual', {
        context: '商店购买库存更新失败，已回滚金币和背包',
        shopId,
        itemId,
        quantity,
      });
      // 回滚背包：移除已添加的物品
      try {
        inventoryStore.removeItem(itemId, quantity);
        // DB-3 修复：等待回滚的背包持久化完成，确保 DB 状态与内存一致
        // 与 DB-1/DB-2 同源问题：addItem 的 fire-and-forget persistInventory1
        // 与回滚 removeItem 的 persistInventory2 竞态，若 persistInventory1 后完成
        // 会覆盖回滚状态导致物品残留。flushPersist 等待最新 persist 完成即可
        // （Dexie 同表写入串行化，await 最后一个隐式 await 所有前序）
        await inventoryStore.flushPersist();
      } catch (rollbackErr) {
        console.error('[ShopStore] buyItem 回滚背包失败:', rollbackErr);
        errorReporter.report(rollbackErr, 'manual', {
          context: '商店购买回滚背包失败，物品可能残留',
          shopId, itemId, quantity,
        });
      }
      // 回滚金币：返还已扣的金币
      try {
        await characterStore.gainGold(totalPrice);
      } catch (rollbackErr) {
        console.error('[ShopStore] buyItem 回滚金币失败:', rollbackErr);
        errorReporter.report(rollbackErr, 'manual', {
          context: '商店购买回滚金币失败，金币可能未退还',
          shopId, totalPrice,
        });
      }
      useToast().show({
        message: '商店库存更新失败，已退还金币和物品',
        type: 'danger',
        duration: 3000
      });
      return false;
    }

    // 4. 刷新当前商品列表（回购路径需重新读取 DB，生成路径复用已读取的数据）
    const currentGenerated = isBuyback ? await shopDbService.getShopItems(shopId) : generated;
    currentItems.value = mergeItems(currentGenerated || []);

    // 5. 通知 UI（音效等）
    eventBus.emit(GameEvents.SHOP_TRANSACTION, { shopId, itemId, quantity, totalPrice });

    // 6. 记录冒险日志
    const itemTemplate = inventoryStore.getItemInfo(itemId);
    if (itemTemplate) {
      const qtyText = quantity > 1 ? ` x${quantity}` : '';
      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'shop',
        message: `购买了：${itemTemplate.name}${qtyText}，花费 ${totalPrice} 金币`,
        icon: 'game-icons:shopping-cart'
      });
    }

    return true;
  }

  // ==================== Action：出售物品 ====================

  /**
   * 向当前商店出售物品
   *
   * 完整交易流程：
   * 1. 获取物品模板，计算出售价格（{@link computeSellPrice}）
   * 2. 从背包移除物品（removeItem）
   * 3. 添加金币（gainGold）
   * 4. 加入回购列表（soldItems Map），同物品多次出售会合并数量
   * 5. 刷新商品列表（回购物品出现在商店顶部）
   * 6. emit SHOP_TRANSACTION 通知 UI
   * 7. 写入冒险日志
   *
   * @param itemId   - 物品ID
   * @param quantity - 出售数量，默认 1
   * @returns 是否出售成功
   */
  async function sellItem(itemId: string, quantity: number = 1): Promise<boolean> {
    if (!currentShopId.value || quantity <= 0) return false;

    const shopId = currentShopId.value;
    const inventoryStore = useInventoryStore();

    // 1. 获取物品模板信息
    const itemTemplate = inventoryStore.getItemInfo(itemId);
    if (!itemTemplate) return false;

    // P1-15 修复：任务物品不可出售，防止玩家出售后无法找回导致存档损坏
    // C2：按 sellable 能力查询分发（替代旧 itemTemplate.kind === 'quest' 判断）
    // C1 配置中任务物品不声明 sellable，行为与旧 kind === 'quest' 等价；
    // C3 引入复合物品时，能力查询天然支持"任务物品即便有其他能力也不可出售"
    if (!hasCapability(itemTemplate, 'sellable')) return false;

    // 2. 计算售价（复用已获取的 itemTemplate，避免重复查询）
    const unitPrice = computeSellPrice(itemTemplate);
    if (unitPrice <= 0) return false;

    // 3. 从背包移除物品
    const removed = inventoryStore.removeItem(itemId, quantity);
    if (removed <= 0) return false;

    const actualQuantity = removed;
    const actualSellPrice = unitPrice * actualQuantity;

    // 4. 添加金币
    const characterStore = useCharacterStore();
    await characterStore.gainGold(actualSellPrice);

    // 5. 加入回购列表（ARCH-14：通过 _replaceSoldItems 整体替换触发响应式）
    // P5-010 修复：持久化阶段加 try-catch，失败时回滚背包和金币
    _replaceSoldItems(newMap => {
      let innerMap = newMap.get(shopId);
      if (!innerMap) {
        innerMap = new Map();
        newMap.set(shopId, innerMap);
      }
      const existing = innerMap.get(itemId);
      if (existing) {
        existing.quantity += actualQuantity;
      } else {
        innerMap.set(itemId, { itemId, price: unitPrice, quantity: actualQuantity });
      }
    });

    try {
      // BIZ-16: 持久化回购列表到 IndexedDB（整体替换后读取最新状态）
      const currentSoldMap = soldItems.value.get(shopId);
      await shopDbService.saveSoldItems(shopId, currentSoldMap ? Array.from(currentSoldMap.values()) : []);

      // 6. 刷新当前商品列表（合并回购物品）
      const currentGenerated = await shopDbService.getShopItems(shopId);
      currentItems.value = mergeItems(currentGenerated || []);
    } catch (err) {
      // P5-010 修复：持久化失败，回滚背包和金币
      // P6-051 修复：同时回滚 soldItems Map（内存中已添加但持久化失败的回购条目）
      console.error('[ShopStore] sellItem 持久化失败，回滚背包和金币:', err);
      errorReporter.report(err, 'manual', {
        context: '商店出售持久化失败，已回滚背包和金币',
        shopId, itemId, quantity: actualQuantity,
      });
      // P6-051：回滚 soldItems Map —— 移除刚加入的回购条目
      _replaceSoldItems(newMap => {
        const innerMap = newMap.get(shopId);
        if (!innerMap) return;
        const entry = innerMap.get(itemId);
        if (!entry) return;
        if (entry.quantity > actualQuantity) {
          entry.quantity -= actualQuantity;
        } else {
          innerMap.delete(itemId);
        }
        if (innerMap.size === 0) {
          newMap.delete(shopId);
        }
      });
      // 回滚背包：加回物品
      try {
        inventoryStore.addItem(itemId, actualQuantity);
        await inventoryStore.flushPersist();
      } catch (rollbackErr) {
        console.error('[ShopStore] sellItem 回滚背包失败:', rollbackErr);
        errorReporter.report(rollbackErr, 'manual', {
          context: '商店出售回滚背包失败，物品可能未恢复',
          shopId, itemId, quantity: actualQuantity,
        });
      }
      // 回滚金币：扣回获得的金币
      try {
        await characterStore.spendGold(actualSellPrice);
      } catch (rollbackErr) {
        console.error('[ShopStore] sellItem 回滚金币失败:', rollbackErr);
        errorReporter.report(rollbackErr, 'manual', {
          context: '商店出售回滚金币失败，金币可能未扣除',
          shopId, sellPrice: actualSellPrice,
        });
      }
      useToast().show({
        message: '出售失败，已恢复物品和金币',
        type: 'danger',
        duration: 3000
      });
      return false;
    }

    // 7. 通知 UI（音效等）
    eventBus.emit(GameEvents.SHOP_TRANSACTION, { shopId, itemId, quantity: actualQuantity, sellPrice: actualSellPrice });

    // 8. 记录冒险日志
    const qtyText = actualQuantity > 1 ? ` x${actualQuantity}` : '';
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'shop',
      message: `出售了：${itemTemplate.name}${qtyText}，获得 ${actualSellPrice} 金币`,
      icon: 'game-icons:two-coins'
    });

    return true;
  }

  // ==================== Action：关闭商店 ====================

  /**
   * 关闭当前商店
   *
   * 持久化空商店ID → 清空内存状态 → emit SHOP_CLOSED。
   */
  async function closeShop(): Promise<void> {
    const closedShopId = currentShopId.value;
    if (!closedShopId) return;

    // P3-116 修复：通过 GameStore 清空 currentShopId（触发持久化，只读 computed 自动反映）
    await gameStore.setCurrentShopId(null);

    // 清理状态
    currentItems.value = [];

    // 通知 UI
    eventBus.emit(GameEvents.SHOP_CLOSED, { shopId: closedShopId });
  }

  // ==================== Action：刷新商店 ====================

  /**
   * 手动刷新当前商店商品
   *
   * 调用 regenerateItems 重新生成并更新 currentItems。
   * 刷新后回购列表不变，通过 mergeItems 自动合并。
   */
  async function refreshShop(): Promise<void> {
    if (!currentShopId.value) return;

    const shopId = currentShopId.value;
    try {
      const generatedItems = await regenerateItems(shopId);
      currentItems.value = mergeItems(generatedItems);
    } catch (err) {
      console.error('[ShopStore] 刷新商店失败:', err);
      errorHandler.report(err, '加载商店失败');
    }
  }

  // ==================== 查询辅助方法 ====================

  /**
   * 获取指定商店的配置
   *
   * @param shopId - 商店ID
   * @returns 商店配置或 null
   */
  function getShopConfig(shopId: string): ShopConfig | null {
    return shops.value.find(s => s.id === shopId) || null;
  }

  /**
   * 计算物品在当前商店的出售价格（供 UI 预览使用）
   *
   * 通过物品ID查询模板并计算售价，不修改任何状态。
   *
   * @param itemId - 物品ID
   * @returns 出售价格，物品不存在返回 0
   */
  function calculateSellPrice(itemId: string): number {
    const inventoryStore = useInventoryStore();
    const itemTemplate = inventoryStore.getItemInfo(itemId);
    if (!itemTemplate) return 0;

    return computeSellPrice(itemTemplate);
  }

  /**
   * 查询物品在当前商店的可回购数量
   *
   * @param itemId - 物品ID
   * @returns 可回购数量，非回购物品返回 0
   */
  function getSoldItemCount(itemId: string): number {
    if (!currentShopId.value) return 0;
    const soldMap = soldItems.value.get(currentShopId.value);
    if (!soldMap) return 0;
    const entry = soldMap.get(itemId);
    return entry ? entry.quantity : 0;
  }

  // ==================== Action：重置 ====================

  /**
   * 重置所有商店数据（清空 DB → 清空内存状态）
   *
   * 通常在"新游戏"或调试清档时调用。
   * BIZ-16：同步清空回购列表持久化数据。
   */
  async function reset(): Promise<void> {
    await shopDbService.clearAllShopItems();
    await shopDbService.clearAllSoldItems();
    shops.value = [];
    // P3-116 修复：通过 GameStore 清空 currentShopId（触发持久化）
    await gameStore.setCurrentShopId(null);
    currentItems.value = [];
    soldItems.value = new Map();
    lastRefresh.value = new Map();
  }

  // ==================== 公开导出 ====================

  return {
    // 响应式状态
    shops,
    currentShopId,
    currentItems,
    isLoading,

    // 内部状态（供 UI 查询回购信息及商品刷新状态）
    soldItems,
    lastRefresh,

    // 计算属性
    currentShopConfig,

    // Action：核心业务流程
    init,           // 初始化 → 加载配置，恢复商店ID
    openShop,       // 打开商店 → 加载/生成商品，emit SHOP_OPENED
    buyItem,        // 购买物品 → 扣金币 → 加背包 → 减库存，emit SHOP_TRANSACTION
    sellItem,       // 出售物品 → 减背包 → 加金币 → 进回购，emit SHOP_TRANSACTION
    closeShop,      // 关闭商店 → 清空状态，emit SHOP_CLOSED
    refreshShop,    // 刷新商品 → 重新生成，合并回购

    // 查询辅助
    getShopConfig,
    calculateSellPrice,
    getSoldItemCount,

    // 生命周期
    reset
  };
});
