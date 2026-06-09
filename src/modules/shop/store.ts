/**
 * 商店模块状态管理层
 * 
 * Store 是商店数据的唯一持有者，所有数据通过 service 层读写。
 * UI 组件只通过 Store 操作数据，不得直接引用 service 或 db。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ShopConfig, ShopItem } from './types';
import type { ItemRarity } from '../inventory/types';
import { shopService } from './service';
import { eventBus } from '../bus/core';

/**
 * 商店状态存储
 */
export const useShopStore = defineStore('shop', () => {
  /** 商店配置列表 */
  const shops = ref<ShopConfig[]>([]);
  
  /** 当前选中的商店ID */
  const currentShopId = ref<string | null>(null);
  
  /** 当前商店商品列表 */
  const currentItems = ref<ShopItem[]>([]);

  /** 从 Service 同步到 Store */
  function syncFromService(): void {
    shops.value = shopService.getAllShops();
  }
  
  /**
   * 获取所有商店
   */
  const getAllShops = computed(() => shops.value);
  
  /**
   * 获取当前商店配置
   */
  const getCurrentShop = computed(() => {
    if (!currentShopId.value) return null;
    return shops.value.find(shop => shop.id === currentShopId.value) || null;
  });
  
  /**
   * 获取当前商店商品列表
   */
  const getCurrentItems = computed(() => currentItems.value);
  
  /**
   * 选择商店（先持久化到 DB，成功后再更新响应式状态）
   * @param shopId - 商店ID
   */
  async function selectShop(shopId: string): Promise<void> {
    // 防御：不保存空的商店ID
    if (!shopId) {
      console.warn('[ShopStore] selectShop 收到空 shopId，已忽略');
      return;
    }
    // 仅在切换商店时清空旧数据
    if (currentShopId.value !== shopId) {
      currentItems.value = [];
    }
    try {
      // 先持久化到 DB，确保写入成功后再更新响应式状态
      await shopService.saveCurrentShopId(shopId);
      currentShopId.value = shopId;
    } catch (err) {
      console.error('[ShopStore] 保存 currentShopId 失败:', err);
    }
  }
  
  /**
   * 购买物品
   * @param itemId - 物品ID
   * @param quantity - 购买数量，默认为1
   * @returns 是否购买成功
   */
  function buyItem(itemId: string, quantity: number = 1): boolean {
    if (!currentShopId.value) return false;
    
    const success = shopService.buyItem(currentShopId.value, itemId, quantity);
    if (success) {
      currentItems.value = shopService.getShopItems(currentShopId.value);
    }
    
    return success;
  }
  
  /**
   * 出售物品
   * @param itemId - 物品ID
   * @param quantity - 出售数量，默认为1
   * @returns 是否出售成功
   */
  function sellItem(itemId: string, quantity: number = 1): boolean {
    if (!currentShopId.value) return false;
    
    const success = shopService.sellItem(itemId, quantity, currentShopId.value);
    if (success) {
      // 出售后刷新商店商品列表（回购物品会出现在购买列表中）
      currentItems.value = shopService.getShopItems(currentShopId.value);
    }
    
    return success;
  }
  
  /**
   * 刷新商店商品
   */
  async function refreshItems(): Promise<void> {
    if (!currentShopId.value) return;
    await shopService.refreshShopItems(currentShopId.value);
    currentItems.value = shopService.getShopItems(currentShopId.value);
  }
  
  /**
   * 获取商店配置
   * @param shopId - 商店ID
   */
  function getShopConfig(shopId: string): ShopConfig | null {
    return shopService.getShopConfig(shopId);
  }
  
  /**
   * 获取商店商品列表
   * @param shopId - 商店ID
   */
  function getShopItems(shopId: string): ShopItem[] {
    return shopService.getShopItems(shopId);
  }

  /**
   * 计算物品售价（代理 service 方法，供 UI 使用）
   * @param itemId - 物品ID
   * @param rarity - 稀有度
   */
  function calculateSellPrice(itemId: string, rarity: ItemRarity): number {
    return shopService.calculateSellPrice(itemId, rarity);
  }

  /**
   * 获取指定物品在商店的回购剩余数量（代理 service 方法，供 UI 使用）
   * @param shopId - 商店ID
   * @param itemId - 物品ID
   */
  function getSoldItemCount(shopId: string, itemId: string): number {
    return shopService.getSoldItemCount(shopId, itemId);
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('shopStore');
  }
  
  /**
   * 初始化（加载商店配置，恢复上次的 currentShopId）
   */
  async function init(): Promise<void> {
    await shopService.init();
    syncFromService();
    const savedShopId = await shopService.getCurrentShopId();
    if (savedShopId) {
      currentShopId.value = savedShopId;
    }
  }
  
  /**
   * 重置
   */
  async function reset(): Promise<void> {
    await shopService.reset();
    syncFromService();
    currentShopId.value = null;
    currentItems.value = [];
    await shopService.saveCurrentShopId(null);
  }
  
  return {
    // 状态
    shops,
    currentShopId,
    currentItems,
    
    // 计算属性
    getAllShops,
    getCurrentShop,
    getCurrentItems,
    
    // 方法
    selectShop,
    buyItem,
    sellItem,
    refreshItems,
    getShopConfig,
    getShopItems,
    calculateSellPrice,
    getSoldItemCount,
    init,
    reset,
    dispose
  };
});
