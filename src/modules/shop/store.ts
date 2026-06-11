/**
 * 商店模块状态管理（Store 核心架构）
 * 
 * Store 是商店数据的唯一持有者，所有响应式状态集中管理。
 * Action 负责编排：调用 Service 纯函数 → 更新 Store 状态 → 调用 DB 持久化 → 通知其他 Store。
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
import { calculatePrice, generateShopItems, canAffordItem } from './service';
import { SHOPS } from '@/data/shop.data';

/**
 * 商店状态存储
 */
export const useShopStore = defineStore('shop', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================

  /** 全部商店配置列表 */
  const shops = ref<ShopConfig[]>([]);

  /** 当前打开的商店ID */
  const currentShopId = ref<string | null>(null);

  /** 当前商店商品列表（合并生成商品 + 玩家出售的回购物品） */
  const currentItems = ref<ShopItem[]>([]);

  /** 当前操作的角色ID */
  const currentCharacterId = ref<string | null>(null);

  /** 是否正在加载 */
  const isLoading = ref(false);

  // ==================== 内部状态（不对外暴露） ====================

  /** 玩家卖给商店的商品（按 shopId → itemId → 条目 组织，支持回购） */
  const soldItems = ref<Map<string, Map<string, SoldItemEntry>>>(new Map());

  /** 商店上次刷新时间（用于判断是否需要重新生成商品） */
  const lastRefresh = ref<Map<string, number>>(new Map());

  // ==================== 计算属性 ====================

  /** 当前商店配置 */
  const currentShopConfig = computed<ShopConfig | null>(() => {
    if (!currentShopId.value) return null;
    return shops.value.find(shop => shop.id === currentShopId.value) || null;
  });

  // ==================== 私有：合并商品列表 ====================

  /**
   * 将生成商品与回购商品合并为统一列表
   * 回购物品排在前面，去重（排除已在回购列表中的生成商品），过滤库存为 0 的商品
   */
  function mergeItems(generatedItems: ShopItem[]): ShopItem[] {
    const soldMap = soldItems.value.get(currentShopId.value || '');
    const sold: ShopItem[] = soldMap
      ? Array.from(soldMap.values()).map(e => ({ itemId: e.itemId, price: e.price, quantity: e.count }))
      : [];

    const soldIds = new Set(sold.map(s => s.itemId));
    const filtered = generatedItems.filter(i => !soldIds.has(i.itemId) && i.quantity > 0);

    return [...sold, ...filtered];
  }

  // ==================== 私有：加载/播种商店配置 ====================

  /**
   * 从 DB 加载商店配置，DB 为空时回退到硬编码种子数据
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
        shopDbService.saveShopConfig(shop);
      }
    }
  }

  /**
   * 生成或恢复商店商品
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
   * 重新生成商店商品并持久化
   * @param shopId - 商店ID
   * @returns 生成的商品列表
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
   * 初始化商店模块：加载商店配置，恢复上次打开的商店ID
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
   * 打开指定商店（加载配置 → 生成商品 → 更新 Store → 调 DB → emit SHOP_OPENED）
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

      // 记录当前角色ID
      const characterStore = useCharacterStore();
      currentCharacterId.value = characterStore.getCharacterId();

      // 通知 UI（音效等）
      eventBus.emit(GameEvents.SHOP_OPENED, { shopId, characterId: currentCharacterId.value || undefined });
    } catch (err) {
      console.error('[ShopStore] 打开商店失败:', err);
    }
  }

  // ==================== Action：购买物品 ====================

  /**
   * 从当前商店购买物品
   * 流程：计算价格 → characterStore.spendGold → inventoryStore.addItem → 更新 Store → 调 DB → emit SHOP_TRANSACTION
   * @param itemId - 物品ID
   * @param quantity - 购买数量，默认为1
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

    if (isBuyback && soldMap) {
      // 从回购列表中扣减
      const entry = soldMap.get(itemId)!;
      entry.count -= quantity;
      if (entry.count <= 0) {
        soldMap.delete(itemId);
      }
      if (soldMap.size === 0) {
        soldItems.value.delete(shopId);
      }
    } else {
      // 从生成商品中扣减
      const generated = await shopDbService.getShopItems(shopId);
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

    // 4. 刷新当前商品列表
    const currentGenerated = await shopDbService.getShopItems(shopId);
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
        icon: '🛒'
      });
    }

    return true;
  }

  // ==================== Action：出售物品 ====================

  /**
   * 向当前商店出售物品
   * 流程：计算价格 → characterStore.gainGold → inventoryStore.removeItem → 更新 Store → 调 DB → emit SHOP_TRANSACTION
   * @param itemId - 物品ID
   * @param quantity - 出售数量，默认为1
   * @returns 是否出售成功
   */
  async function sellItem(itemId: string, quantity: number = 1): Promise<boolean> {
    if (!currentShopId.value || quantity <= 0) return false;

    const shopId = currentShopId.value;
    const inventoryStore = useInventoryStore();

    // 1. 获取物品模板信息
    const itemTemplate = inventoryStore.getItemInfo(itemId);
    if (!itemTemplate) return false;

    // 2. 计算售价
    const config = shops.value.find(s => s.id === shopId);
    if (!config) return false;
    const unitPrice = calculatePrice(itemTemplate, config, false);

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
      existing.count += actualQuantity;
    } else {
      soldMap.set(itemId, { itemId, price: unitPrice, count: actualQuantity });
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
      icon: '💰'
    });

    return true;
  }

  // ==================== Action：关闭商店 ====================

  /**
   * 关闭当前商店（清理状态 → emit SHOP_CLOSED）
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
   * 刷新当前商店商品（重新生成商品 → 更新 Store → 调 DB）
   */
  async function refreshShop(): Promise<void> {
    if (!currentShopId.value) return;

    const shopId = currentShopId.value;
    const generatedItems = await regenerateItems(shopId);
    currentItems.value = mergeItems(generatedItems);
  }

  // ==================== 查询辅助方法 ====================

  /**
   * 获取商店配置
   * @param shopId - 商店ID
   * @returns 商店配置或 null
   */
  function getShopConfig(shopId: string): ShopConfig | null {
    return shops.value.find(s => s.id === shopId) || null;
  }

  /**
   * 计算物品卖出价格（供 UI 预览使用）
   * @param itemId - 物品ID
   * @returns 卖出价格，物品不存在返回 0
   */
  function calculateSellPrice(itemId: string): number {
    const inventoryStore = useInventoryStore();
    const itemTemplate = inventoryStore.getItemInfo(itemId);
    if (!itemTemplate) return 0;

    const config = currentShopConfig.value;
    if (!config) return 0;

    return calculatePrice(itemTemplate, config, false);
  }

  /**
   * 获取指定物品在当前商店的回购剩余数量
   * @param itemId - 物品ID
   * @returns 可回购数量（非回购物品返回 0）
   */
  function getSoldItemCount(itemId: string): number {
    if (!currentShopId.value) return 0;
    const soldMap = soldItems.value.get(currentShopId.value);
    if (!soldMap) return 0;
    const entry = soldMap.get(itemId);
    return entry ? entry.count : 0;
  }

  // ==================== 兼容旧接口（别名） ====================

  /**
   * 选择商店（openShop 的别名，保持旧调用兼容）
   * @deprecated 请使用 openShop
   */
  async function selectShop(shopId: string): Promise<void> {
    return openShop(shopId);
  }

  /**
   * 刷新商品列表（refreshShop 的别名，保持旧调用兼容）
   * @deprecated 请使用 refreshShop
   */
  async function refreshItems(): Promise<void> {
    return refreshShop();
  }

  // ==================== Action：重置 ====================

  /**
   * 重置所有商店数据
   */
  async function reset(): Promise<void> {
    await shopDbService.clearAllShopItems();
    shops.value = [];
    currentShopId.value = null;
    currentItems.value = [];
    currentCharacterId.value = null;
    soldItems.value = new Map();
    lastRefresh.value = new Map();
    await shopDbService.saveCurrentShopId(null);
  }

  // ==================== 生命周期 ====================

  /**
   * 清理资源（Store 核心架构不再使用事件监听）
   */
  function dispose(): void {
    // Store 核心架构不再使用事件总线，无需清理
  }

  // ==================== 导出 ====================

  return {
    // 状态
    shops,
    currentShopId,
    currentItems,
    currentCharacterId,
    isLoading,

    // 计算属性
    currentShopConfig,

    // Action：核心操作
    init,
    openShop,
    buyItem,
    sellItem,
    closeShop,
    refreshShop,

    // Action：兼容旧接口
    selectShop,
    refreshItems,

    // 查询辅助
    getShopConfig,
    calculateSellPrice,
    getSoldItemCount,

    // 生命周期
    reset,
    dispose
  };
});
