/**
 * 商店模块状态管理层
 * 
 * Store 是商店数据的唯一持有者，Service 作为纯业务逻辑层供 Store 调用。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ShopConfig, ShopInventory } from './types';
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
  
  /** 当前商店库存 */
  const currentInventory = ref<ShopInventory | null>(null);

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
   * 获取当前商店库存
   */
  const getCurrentInventory = computed(() => currentInventory.value);
  
  /**
   * 选择商店
   * @param shopId - 商店ID
   */
  function selectShop(shopId: string): void {
    currentShopId.value = shopId;
    currentInventory.value = shopService.getShopInventory(shopId);
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
      currentInventory.value = shopService.getShopInventory(currentShopId.value);
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
   * 刷新商店库存
   */
  function refreshInventory(): void {
    if (!currentShopId.value) return;
    shopService.refreshShopInventory(currentShopId.value);
    currentInventory.value = shopService.getShopInventory(currentShopId.value);
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
   * 获取商店库存
   * @param shopId - 商店ID
   * @returns 商店库存
   */
  function getShopInventory(shopId: string): ShopInventory | null {
    return shopService.getShopInventory(shopId);
  }
  
  /**
   * 获取指定地点的商店
   * @param locationId - 地点ID
   * @returns 商店配置列表
   */
  function getShopsByLocation(locationId: string): ShopConfig[] {
    return shopService.getShopsByLocation(locationId);
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
    currentInventory.value = null;
  }
  
  return {
    // 状态
    shops,
    currentShopId,
    currentInventory,
    
    // 计算属性
    getAllShops,
    getCurrentShop,
    getCurrentInventory,
    
    // 方法
    selectShop,
    buyItem,
    sellItem,
    refreshInventory,
    getShopConfig,
    getShopInventory,
    getShopsByLocation,
    init,
    reset,
    dispose
  };
});