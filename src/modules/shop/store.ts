/**
 * 商店模块状态管理层
 * 
 * 使用 Pinia 管理商店状态，提供响应式数据和事件监听
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ShopConfig, ShopInventory } from './types';
import { shopService } from './service';
import { eventBus, GameEvents } from '../bus/core';

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
   * 更新商店列表
   */
  function updateShops(): void {
    shops.value = shopService.getAllShops();
  }
  
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
   * 初始化事件监听
   */
  function initEventListeners(): void {
    // 商店刷新事件
    eventBus.onGroup('shopStore', GameEvents.SHOP_REFRESHED, (data: { shopId: string }) => {
      if (currentShopId.value === data.shopId) {
        currentInventory.value = shopService.getShopInventory(data.shopId);
      }
    });
    
    // 物品购买事件
    eventBus.onGroup('shopStore', GameEvents.SHOP_TRANSACTION, (data: { shopId: string }) => {
      if (currentShopId.value === data.shopId) {
        currentInventory.value = shopService.getShopInventory(data.shopId);
      }
    });
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
    updateShops();
    initEventListeners();
  }
  
  /**
   * 重置
   */
  function reset(): void {
    shopService.reset();
    updateShops();
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
    updateShops,
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