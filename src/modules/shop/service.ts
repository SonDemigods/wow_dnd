/**
 * 商店模块服务层
 * 
 * 提供商店管理的核心业务逻辑
 */
import type { 
  IShopService, 
  ShopConfig, 
  ShopItem 
} from './types';
import type { ItemRarity } from '../inventory/types';
import { shopDbService } from './db';
import { characterService } from '../character/service';
import { inventoryService } from '../inventory/service';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 稀有度价格倍数映射
 */
const RARITY_MULTIPLIERS: Record<ItemRarity, number> = {
  common: 1,
  uncommon: 1.5,
  rare: 3,
  epic: 6,
  legendary: 15
};

/**
 * 商店服务实现类
 */
export class ShopService implements IShopService {
  /** 商店配置缓存 */
  private shopConfigs: Map<string, ShopConfig> = new Map();
  
  /** 商店商品缓存 */
  private shopItems: Map<string, ShopItem[]> = new Map();
  
  /** 上次刷新时间 */
  private lastRefresh: Map<string, number> = new Map();
  
  /**
   * 初始化服务
   */
  async init(): Promise<void> {
    await this.loadShopConfigs();
    await this.initDefaultShops();
  }
  
  /**
   * 加载商店配置
   */
  private async loadShopConfigs(): Promise<void> {
    const configs = await shopDbService.getAllShopConfigs();
    configs.forEach(config => {
      this.shopConfigs.set(config.id, config);
    });
  }
  
  /**
   * 初始化默认商店
   */
  private async initDefaultShops(): Promise<void> {
    const defaultShops: ShopConfig[] = [
      {
        id: 'generalGoods',
        name: '杂货铺',
        type: 'general',
        icon: '🏪',
        refreshInterval: 300000,
        priceVariation: { min: 0.8, max: 1.2 }
      },
      {
        id: 'potionShop',
        name: '炼金术士小屋',
        type: 'potion',
        icon: '⚗️',
        refreshInterval: 600000,
        priceVariation: { min: 0.85, max: 1.15 }
      },
      {
        id: 'scrollShop',
        name: '奥术商店',
        type: 'scroll',
        icon: '📜',
        refreshInterval: 900000,
        priceVariation: { min: 0.9, max: 1.1 }
      }
    ];
    
    for (const shop of defaultShops) {
      if (!this.shopConfigs.has(shop.id)) {
        await shopDbService.saveShopConfig(shop);
        this.shopConfigs.set(shop.id, shop);
        
        // 初始化商品
        this.refreshShopItems(shop.id);
      }
    }
  }
  
  /**
   * 获取商店配置
   * @param shopId - 商店ID
   * @returns 商店配置
   */
  getShopConfig(shopId: string): ShopConfig | null {
    return this.shopConfigs.get(shopId) || null;
  }
  
  /**
   * 获取商店商品列表
   * @param shopId - 商店ID
   * @returns 商品列表
   */
  getShopItems(shopId: string): ShopItem[] {
    let items = this.shopItems.get(shopId);
    if (!items) {
      // 如果没有商品，尝试刷新
      this.refreshShopItems(shopId);
      items = this.shopItems.get(shopId) || [];
    }
    
    // 检查是否需要刷新
    if (this.needsRefresh(shopId)) {
      this.refreshShopItems(shopId);
      items = this.shopItems.get(shopId) || [];
    }
    
    return items;
  }
  
  /**
   * 刷新商店商品
   * @param shopId - 商店ID
   */
  refreshShopItems(shopId: string): void {
    const config = this.getShopConfig(shopId);
    if (!config) {
      return;
    }
    
    const items = this.generateShopItems(config);
    
    this.shopItems.set(shopId, items);
    this.lastRefresh.set(shopId, Date.now());
    shopDbService.saveShopItems(shopId, items);
    
    // 触发商店刷新事件
    eventBus.emit(GameEvents.SHOP_REFRESHED, { shopId });
  }
  
  /**
   * 生成商店商品
   * @param config - 商店配置
   * @returns 商品列表
   */
  private generateShopItems(config: ShopConfig): ShopItem[] {
    const items: ShopItem[] = [];
    
    // 根据商店类型生成不同的商品
    const itemPool = this.getItemPool(config.type);
    
    // 随机选择5-8个商品
    const itemCount = Math.floor(Math.random() * 4) + 5;
    
    // 随机选择商品
    const shuffled = [...itemPool].sort(() => Math.random() - 0.5);
    const selectedItems = shuffled.slice(0, itemCount);
    
    selectedItems.forEach(item => {
      // 随机价格倍数
      const priceMultiplier = config.priceVariation.min + 
        Math.random() * (config.priceVariation.max - config.priceVariation.min);
      
      items.push({
        itemId: item.id,
        price: this.calculateBuyPrice(item.id, item.rarity, priceMultiplier)
      });
    });
    
    return items;
  }
  
  /**
   * 获取商品池
   * @param type - 商店类型
   * @returns 物品信息列表
   */
  private getItemPool(type: string): { id: string; rarity: ItemRarity }[] {
    // 根据商店类型返回不同的商品池
    const pools: Record<string, { id: string; rarity: ItemRarity }[]> = {
      general: [
        { id: 'item_potion_minor_heal', rarity: 'common' },
        { id: 'item_potion_minor_mana', rarity: 'common' },
        { id: 'item_bandage', rarity: 'common' },
        { id: 'item_food_ration', rarity: 'common' },
        { id: 'item_map_fragment', rarity: 'uncommon' },
        { id: 'item_potion_heal', rarity: 'uncommon' },
        { id: 'item_antidote', rarity: 'common' }
      ],
      potion: [
        { id: 'item_potion_minor_heal', rarity: 'common' },
        { id: 'item_potion_minor_mana', rarity: 'common' },
        { id: 'item_potion_heal', rarity: 'uncommon' },
        { id: 'item_potion_mana', rarity: 'uncommon' },
        { id: 'item_potion_major_heal', rarity: 'rare' },
        { id: 'item_potion_major_mana', rarity: 'rare' },
        { id: 'item_potion_strength', rarity: 'rare' },
        { id: 'item_potion_dexterity', rarity: 'rare' },
        { id: 'item_antidote', rarity: 'common' },
        { id: 'item_ether', rarity: 'uncommon' }
      ],
      scroll: [
        { id: 'scroll_fireball', rarity: 'uncommon' },
        { id: 'scroll_heal', rarity: 'uncommon' },
        { id: 'scroll_shield', rarity: 'uncommon' },
        { id: 'scroll_lightning', rarity: 'rare' },
        { id: 'scroll_ice', rarity: 'rare' },
        { id: 'scroll_teleport', rarity: 'epic' }
      ],
      food: [
        { id: 'item_bread', rarity: 'common' },
        { id: 'item_roasted_meat', rarity: 'common' },
        { id: 'item_magic_bread', rarity: 'uncommon' },
        { id: 'item_feast', rarity: 'rare' }
      ],
      material: [
        { id: 'item_magic_dust', rarity: 'common' },
        { id: 'item_rune_stone', rarity: 'uncommon' },
        { id: 'item_dragon_scale', rarity: 'rare' },
        { id: 'item_healing_crystal', rarity: 'uncommon' },
        { id: 'item_ancient_key', rarity: 'rare' }
      ]
    };
    
    return pools[type] || pools.general;
  }
  
  /**
   * 购买物品
   * @param shopId - 商店ID
   * @param itemId - 物品ID
   * @param quantity - 购买数量，默认为1
   * @returns 是否购买成功
   */
  buyItem(shopId: string, itemId: string, quantity: number = 1): boolean {
    // 获取商店商品
    const items = this.getShopItems(shopId);
    
    // 查找商品
    const shopItem = items.find(item => item.itemId === itemId);
    if (!shopItem) {
      return false;
    }
    
    // 计算总价
    const totalPrice = shopItem.price * quantity;
    
    // 检查金币
    if (characterService.getGold() < totalPrice) {
      return false;
    }
    
    // 扣除金币
    characterService.addGold(-totalPrice);
    
    // 添加物品到背包
    const itemTemplate = inventoryService.getItemInfo(itemId);
    if (!itemTemplate) {
      characterService.addGold(totalPrice);
      return false;
    }

    let success = true;
    for (let i = 0; i < quantity; i++) {
      if (!inventoryService.addItem(itemTemplate)) {
        success = false;
        break;
      }
    }
    if (!success) {
      // 如果背包空间不足，返还金币
      characterService.addGold(totalPrice);
      return false;
    }
    
    // 触发购买事件
    eventBus.emit(GameEvents.SHOP_TRANSACTION, { shopId, itemId, quantity, totalPrice });
    
    return true;
  }
  
  /**
   * 出售物品
   * @param itemId - 物品ID
   * @param quantity - 出售数量，默认为1
   * @returns 是否出售成功
   */
  sellItem(itemId: string, quantity: number = 1): boolean {
    // 获取物品信息
    const itemInfo = inventoryService.getItemInfo(itemId);
    if (!itemInfo) {
      return false;
    }
    
    // 检查背包中是否有足够数量
    const inventory = inventoryService.getInventory();
    const inventoryItem = inventory.find(item => item.itemId === itemId);
    if (!inventoryItem || inventoryItem.count < quantity) {
      return false;
    }
    
    // 计算售价
    const sellPrice = this.calculateSellPrice(itemId, itemInfo.rarity) * quantity;
    
    // 移除物品
    let removed = 0;
    for (let i = 0; i < quantity; i++) {
      const inventory = inventoryService.getInventory();
      const index = inventory.findIndex(item => item.itemId === itemId);
      if (index === -1) break;
      if (inventoryService.removeItem(index)) {
        removed++;
      }
    }
    if (removed === 0) {
      return false;
    }
    
    // 添加金币
    characterService.addGold(sellPrice);
    
    // 触发出售事件
    eventBus.emit(GameEvents.SHOP_TRANSACTION, { itemId, quantity, sellPrice });
    
    return true;
  }
  
  /**
   * 计算物品售价
   * @param itemId - 物品ID
   * @param rarity - 物品稀有度
   * @param priceMultiplier - 价格倍数，默认为1
   * @returns 售价
   */
  calculateBuyPrice(itemId: string, rarity: ItemRarity, priceMultiplier: number = 1): number {
    // 基础价格根据物品类型确定
    const basePrices: Record<string, number> = {
      // 消耗品
      'item_potion_minor_heal': 10,
      'item_potion_minor_mana': 10,
      'item_potion_heal': 25,
      'item_potion_mana': 25,
      'item_potion_major_heal': 60,
      'item_potion_major_mana': 60,
      'item_potion_strength': 80,
      'item_potion_dexterity': 80,
      'item_antidote': 15,
      'item_ether': 35,
      'item_bandage': 5,
      'item_food_ration': 3,
      
      // 卷轴
      'scroll_fireball': 40,
      'scroll_heal': 35,
      'scroll_shield': 30,
      'scroll_lightning': 80,
      'scroll_ice': 70,
      'scroll_teleport': 200,
      
      // 食物
      'item_bread': 5,
      'item_roasted_meat': 15,
      'item_magic_bread': 30,
      'item_feast': 100,
      
      // 材料
      'item_magic_dust': 15,
      'item_rune_stone': 25,
      'item_dragon_scale': 80,
      'item_healing_crystal': 45,
      'item_ancient_key': 100,
      'item_map_fragment': 20
    };
    
    const basePrice = basePrices[itemId] || 10;
    const rarityMultiplier = RARITY_MULTIPLIERS[rarity] || 1;
    
    return Math.floor(basePrice * rarityMultiplier * priceMultiplier);
  }
  
  /**
   * 计算物品回收价
   * @param itemId - 物品ID
   * @param rarity - 物品稀有度
   * @returns 回收价
   */
  calculateSellPrice(itemId: string, rarity: ItemRarity): number {
    // 回收价是售价的50%
    const buyPrice = this.calculateBuyPrice(itemId, rarity);
    return Math.floor(buyPrice * 0.5);
  }
  
  /**
   * 获取所有商店列表
   * @returns 商店配置列表
   */
  getAllShops(): ShopConfig[] {
    return Array.from(this.shopConfigs.values());
  }
  
  /**
   * 检查商店是否需要刷新
   * @param shopId - 商店ID
   * @returns 是否需要刷新
   */
  needsRefresh(shopId: string): boolean {
    const config = this.getShopConfig(shopId);
    const lastRefreshTime = this.lastRefresh.get(shopId);
    
    if (!config || !lastRefreshTime) {
      return true;
    }
    
    const now = Date.now();
    return now - lastRefreshTime >= config.refreshInterval;
  }
  
  /**
   * 重置所有商店数据
   */
  reset(): void {
    this.shopItems.clear();
    this.lastRefresh.clear();
    shopDbService.clearAllShopItems();
    
    // 重新初始化所有商店商品
    this.shopConfigs.forEach((_, shopId) => {
      this.refreshShopItems(shopId);
    });
  }
}

/**
 * 商店服务实例
 */
export const shopService = new ShopService();
