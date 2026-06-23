/**
 * @fileoverview 商店模块状态管理（Pinia Store）
 * @description Store 是商店数据的唯一持有者，所有响应式状态在此集中管理。
 *              Action 负责编排完整业务流程：
 *              Service 纯函数 → Store 状态更新 → DB 持久化 → 事件总线通知。
 *
 * **核心设计决策**：
 * - **回购列表**：用 `ref<Map>` 而非 `reactive`，通过整体替换触发响应式（如 `soldItems.value.delete()`），
 *   避免 Map 内部变更不被追踪的问题。
 * - **商品刷新**：配置加载与商品生成分离——`loadShopConfigs` 只加载商店元数据，
 *   `loadOrGenerateItems` 按需加载/生成商品，避免一次性加载所有数据。
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
import { eventBus, GameEvents } from '../bus/core';
import { useLogStore } from '../log/store';
import { generateLogId } from '../log/service';
import { useCharacterStore } from '../character/store';
import { useInventoryStore } from '../inventory/store';
import { generateShopItems, canAffordItem, computeSellPrice } from './service';
import { SHOPS } from '@/data/config_shops';

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

  /** 当前打开的商店ID，null 表示未打开任何商店 */
  const currentShopId = ref<string | null>(null);

  /** 当前商店的商品列表（生成商品 + 回购物品合并后） */
  const currentItems = ref<ShopItem[]>([]);

  /** 初始化加载标志，防止重复 init */
  const isLoading = ref(false);

  // ==================== 内部状态（仅 ref 层面响应式） ====================

  /**
   * 玩家出售给商店的物品（回购跟踪）
   *
   * 结构：`shopId → itemId → SoldItemEntry` 二级 Map。
   * 注意：Vue 3 的 `ref<Map>` 对 Map 的 `.set()` / `.delete()` 不触发深层响应式，
   * 因此修改后需通过整体操作（如 `soldItems.value.delete(shopId)` 等）触发更新。
   */
  const soldItems = ref<Map<string, Map<string, SoldItemEntry>>>(new Map());

  /**
   * 各商店上次商品生成时间戳
   *
   * 用于判断打开商店时是否需要重新生成商品（超过 refreshInterval 则刷新）。
   */
  const lastRefresh = ref<Map<string, number>>(new Map());

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
    const soldMap = soldItems.value.get(currentShopId.value || '');
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
   * @param shopId - 商店ID
   * @returns 商品列表
   */
  async function loadOrGenerateItems(shopId: string): Promise<ShopItem[]> {
    // 尝试从 DB 加载已保存的商品
    const savedItems = await shopDbService.getShopItems(shopId);
    if (savedItems && savedItems.length > 0) {
      return savedItems;
    }

    // 重新生成
    return await regenerateItems(shopId);
  }

  /**
   * 强制重新生成商店商品并持久化
   *
   * 调用 {@link generateShopItems} 生成新商品列表，写入 DB 并更新内存中的刷新时间戳。
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

    lastRefresh.value.set(shopId, Date.now());
    await shopDbService.saveShopItems(shopId, items);

    return items;
  }

  // ==================== Action：初始化 ====================

  /**
   * 初始化商店模块
   *
   * 调用时机：应用启动时由 bootstrap 调用。
   * 流程：加载商店配置 → 恢复上次会话打开的商店ID（如有）。
   * 注意：此处只恢复商店ID，商品数据在 openShop 时才按需加载。
   */
  async function init(): Promise<void> {
    if (isLoading.value) return;
    isLoading.value = true;

    try {
      await loadShopConfigs();

      // 恢复上次保存的商店ID
      const savedShopId = await shopDbService.getCurrentShopId();
      if (savedShopId && shops.value.some(s => s.id === savedShopId)) {
        currentShopId.value = savedShopId;
      }
    } catch (err) {
      console.error('[ShopStore] 初始化失败:', err);
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

      // 持久化当前商店ID
      await shopDbService.saveCurrentShopId(shopId);

      // 更新 Store 状态
      currentShopId.value = shopId;
      currentItems.value = mergeItems(generatedItems);

      // 通知 UI（音效等）
      const characterStore = useCharacterStore();
      const characterId = characterStore.getCharacterId();
      eventBus.emit(GameEvents.SHOP_OPENED, { shopId, characterId: characterId || undefined });
    } catch (err) {
      console.error('[ShopStore] 打开商店失败:', err);
    }
  }

  // ==================== Action：购买物品 ====================

  /**
   * 从当前商店购买物品
   *
   * 完整交易流程：
   * 1. 校验商店状态、物品库存
   * 2. 检查金币 → 扣除金币（spendGold）
   * 3. 添加物品到背包（addItem）→ 失败则返还金币
   * 4. 更新商店库存（回购列表或生成商品）
   * 5. 刷新当前商品列表
   * 6. emit SHOP_TRANSACTION 通知 UI
   * 7. 写入冒险日志
   *
   * 购买有两种路径：
   * - **回购路径**：物品在 soldItems Map 中，直接扣减回购数量
   * - **生成商品路径**：物品来自系统生成，从 DB 商品列表中扣减
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

    const totalPrice = shopItem.price * quantity;

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
      // 背包空间不足，返还金币
      await characterStore.gainGold(totalPrice);
      return false;
    }

    // 3. 更新商店库存
    const soldMap = soldItems.value.get(shopId);
    const isBuyback = soldMap?.has(itemId);
    let generated: ShopItem[] | null = null;

    if (isBuyback && soldMap) {
      // 从回购列表中扣减（前置条件 isBuyback 已保证 soldMap 中存在该 itemId）
      const entry = soldMap.get(itemId)!;
      entry.quantity -= quantity;
      if (entry.quantity <= 0) {
        soldMap.delete(itemId);
      }
      if (soldMap.size === 0) {
        soldItems.value.delete(shopId);
      }
    } else {
      // 从生成商品中扣减
      generated = await shopDbService.getShopItems(shopId);
      if (generated) {
        const idx = generated.findIndex(i => i.itemId === itemId);
        if (idx !== -1) {
          generated[idx].quantity -= quantity;
          if (generated[idx].quantity <= 0) {
            generated.splice(idx, 1);
          }
          await shopDbService.saveShopItems(shopId, generated);
        }
      }
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

    // 5. 加入回购列表
    let soldMap = soldItems.value.get(shopId);
    if (!soldMap) {
      soldMap = new Map();
      soldItems.value.set(shopId, soldMap);
    }
    const existing = soldMap.get(itemId);
    if (existing) {
      existing.quantity += actualQuantity;
    } else {
      soldMap.set(itemId, { itemId, price: unitPrice, quantity: actualQuantity });
    }

    // 6. 刷新当前商品列表（合并回购物品）
    const currentGenerated = await shopDbService.getShopItems(shopId);
    currentItems.value = mergeItems(currentGenerated || []);

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

    // 持久化空商店ID
    await shopDbService.saveCurrentShopId(null);

    // 清理状态
    currentShopId.value = null;
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
    const generatedItems = await regenerateItems(shopId);
    currentItems.value = mergeItems(generatedItems);
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
   */
  async function reset(): Promise<void> {
    await shopDbService.clearAllShopItems();
    shops.value = [];
    currentShopId.value = null;
    currentItems.value = [];
    soldItems.value = new Map();
    lastRefresh.value = new Map();
    await shopDbService.saveCurrentShopId(null);
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
