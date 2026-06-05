/**
 * 商店模块状态管理层
 * 
 * Store 是商店数据的唯一持有者，Service 作为纯业务逻辑层供 Store 调用。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ShopConfig, ShopItem } from './types';
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
   * 选择商店
   * @param shopId - 商店ID
   */
  function selectShop(shopId: string): void {
    currentShopId.value = shopId;
    currentItems.value = shopService.getShopItems(shopId);
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
    return shopService.sellItem(itemId, quantity);
  }
  
  /**
   * 刷新商店商品
   */
  function refreshItems(): void {
    if (!currentShopId.value) return;
    shopService.refreshShopItems(currentShopId.value);
    currentItems.value = shopService.getShopItems(currentShopId.value);
  }
  
  /**
   * 获取商店配置
   * @param shopId - 商店ID
   * @returns 商店配置
   */
  function getShopConfig(shopId: string): ShopConfig | null {
    return shopService.getShopConfig(shopId);
  }
  
  /**
   * 获取商店商品列表
   * @param shopId - 商店ID
   * @returns 商品列表
   */
  function getShopItems(shopId: string): ShopItem[] {
    return shopService.getShopItems(shopId);
  }
  
  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('shopStore');
  }
  
  /**
   * 初始化
   */
  async function init(): Promise<void> {
    await shopService.init();
    syncFromService();
  }
  
  /**
   * 重置
   */
  function reset(): void {
    shopService.reset();
    syncFromService();
    currentShopId.value = null;
    currentItems.value = [];
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
    init,
    reset,
    dispose
  };
});
