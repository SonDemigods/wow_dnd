/**
 * 商店模块服务层
 * 
 * 提供商店管理的核心业务逻辑
 */
import type { 
  IShopService, 
  ShopConfig, 
  ShopInventory, 
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
  
  /** 商店库存缓存 */
  private shopInventories: Map<string, ShopInventory> = new Map();
  
  /**
   * 初始化服务
   */
  async init(): Promise<void> {
    await this.loadShopConfigs();
    await this.loadShopInventories();
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
   * 加载商店库存
   */
  private async loadShopInventories(): Promise<void> {
    const inventories = await shopDbService.getAllShopInventories();
    inventories.forEach(inventory => {
      this.shopInventories.set(inventory.shopId, inventory);
    });
  }
  
  /**
   * 初始化默认商店
   */
  private async initDefaultShops(): Promise<void> {
    const defaultShops: ShopConfig[] = [
      {
        id: 'shop_inn',
        name: '旅馆商店',
        type: 'general',
        icon: '🏠',
        locationId: 'village',
        refreshInterval: 3600000, // 1小时
        minItems: 5,
        maxItems: 10,
        priceVariation: { min: 0.9, max: 1.1 },
        stockVariation: { min: 1, max: 5 }
      },
      {
        id: 'shop_weapon',
        name: '武器店',
        type: 'weapon',
        icon: '⚔️',
        locationId: 'village',
        refreshInterval: 7200000, // 2小时
        minItems: 3,
        maxItems: 6,
        priceVariation: { min: 0.8, max: 1.2 },
        stockVariation: { min: 1, max: 3 }
      },
      {
        id: 'shop_armor',
        name: '防具店',
        type: 'armor',
        icon: '🛡️',
        locationId: 'village',
        refreshInterval: 7200000, // 2小时
        minItems: 3,
        maxItems: 6,
        priceVariation: { min: 0.8, max: 1.2 },
        stockVariation: { min: 1, max: 3 }
      },
      {
        id: 'shop_potion',
        name: '药剂店',
        type: 'consumable',
        icon: '🧪',
        locationId: 'village',
        refreshInterval: 1800000, // 30分钟
        minItems: 6,
        maxItems: 12,
        priceVariation: { min: 0.9, max: 1.1 },
        stockVariation: { min: 3, max: 10 }
      }
    ];
    
    for (const shop of defaultShops) {
      if (!this.shopConfigs.has(shop.id)) {
        await shopDbService.saveShopConfig(shop);
        this.shopConfigs.set(shop.id, shop);
        
        // 初始化库存
        this.refreshShopInventory(shop.id);
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
   * 获取商店库存
   * @param shopId - 商店ID
   * @returns 商店库存
   */
  getShopInventory(shopId: string): ShopInventory | null {
    const inventory = this.shopInventories.get(shopId);
    if (!inventory) {
      // 如果没有库存，尝试刷新
      this.refreshShopInventory(shopId);
      return this.shopInventories.get(shopId) || null;
    }
    
    // 检查是否需要刷新
    if (this.needsRefresh(shopId)) {
      this.refreshShopInventory(shopId);
    }
    
    return this.shopInventories.get(shopId) || null;
  }
  
  /**
   * 刷新商店库存
   * @param shopId - 商店ID
   */
  refreshShopInventory(shopId: string): void {
    const config = this.getShopConfig(shopId);
    if (!config) {
      return;
    }
    
    const items = this.generateShopItems(config);
    
    const inventory: ShopInventory = {
      shopId,
      items,
      lastRefresh: Date.now()
    };
    
    this.shopInventories.set(shopId, inventory);
    shopDbService.saveShopInventory(inventory);
    
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
    
    // 随机选择商品数量
    const itemCount = Math.floor(Math.random() * (config.maxItems - config.minItems + 1)) + config.minItems;
    
    // 随机选择商品
    const shuffled = [...itemPool].sort(() => Math.random() - 0.5);
    const selectedItems = shuffled.slice(0, itemCount);
    
    selectedItems.forEach(item => {
      // 随机价格倍数
      const priceMultiplier = config.priceVariation.min + 
        Math.random() * (config.priceVariation.max - config.priceVariation.min);
      
      // 随机库存
      const stock = Math.floor(Math.random() * (config.stockVariation.max - config.stockVariation.min + 1)) + 
        config.stockVariation.min;
      
      items.push({
        itemId: item.id,
        price: this.calculateBuyPrice(item.id, item.rarity, priceMultiplier),
        stock,
        maxStock: stock
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
        { id: 'item_gold_coin', rarity: 'common' },
        { id: 'item_potion_minor_heal', rarity: 'common' },
        { id: 'item_potion_minor_mana', rarity: 'common' },
        { id: 'item_bandage', rarity: 'common' },
        { id: 'item_food_ration', rarity: 'common' },
        { id: 'item_map_fragment', rarity: 'uncommon' },
        { id: 'item_potion_heal', rarity: 'uncommon' }
      ],
      weapon: [
        { id: 'weapon_sword_iron', rarity: 'common' },
        { id: 'weapon_axe_iron', rarity: 'common' },
        { id: 'weapon_bow_iron', rarity: 'common' },
        { id: 'weapon_dagger', rarity: 'common' },
        { id: 'weapon_sword_steel', rarity: 'uncommon' },
        { id: 'weapon_axe_steel', rarity: 'uncommon' },
        { id: 'weapon_bow_steel', rarity: 'uncommon' },
        { id: 'weapon_sword_mithril', rarity: 'rare' },
        { id: 'weapon_axe_mithril', rarity: 'rare' }
      ],
      armor: [
        { id: 'armor_leather', rarity: 'common' },
        { id: 'armor_chainmail', rarity: 'uncommon' },
        { id: 'armor_plate', rarity: 'rare' },
        { id: 'helmet_leather', rarity: 'common' },
        { id: 'helmet_chain', rarity: 'uncommon' },
        { id: 'helmet_plate', rarity: 'rare' },
        { id: 'boots_leather', rarity: 'common' },
        { id: 'boots_chain', rarity: 'uncommon' },
        { id: 'boots_plate', rarity: 'rare' }
      ],
      consumable: [
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
    // 获取商店库存
    const inventory = this.getShopInventory(shopId);
    if (!inventory) {
      return false;
    }
    
    // 查找商品
    const shopItem = inventory.items.find(item => item.itemId === itemId);
    if (!shopItem) {
      return false;
    }
    
    // 检查库存
    if (shopItem.stock < quantity) {
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
    const success = inventoryService.addItem(itemId, quantity);
    if (!success) {
      // 如果背包空间不足，返还金币
      characterService.addGold(totalPrice);
      return false;
    }
    
    // 更新商店库存
    shopItem.stock -= quantity;
    
    // 保存更新
    this.shopInventories.set(shopId, inventory);
    shopDbService.saveShopInventory(inventory);
    
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
    if (!inventoryItem || inventoryItem.amount < quantity) {
      return false;
    }
    
    // 计算售价
    const sellPrice = this.calculateSellPrice(itemId, itemInfo.rarity) * quantity;
    
    // 移除物品
    const success = inventoryService.removeItem(itemId, quantity);
    if (!success) {
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
      
      // 材料
      'item_gold_coin': 1,
      'item_map_fragment': 20,
      'item_herb': 5,
      
      // 武器
      'weapon_sword_iron': 50,
      'weapon_axe_iron': 50,
      'weapon_bow_iron': 45,
      'weapon_dagger': 30,
      'weapon_sword_steel': 120,
      'weapon_axe_steel': 120,
      'weapon_bow_steel': 100,
      'weapon_sword_mithril': 300,
      'weapon_axe_mithril': 300,
      
      // 防具
      'armor_leather': 40,
      'armor_chainmail': 100,
      'armor_plate': 250,
      'helmet_leather': 20,
      'helmet_chain': 50,
      'helmet_plate': 120,
      'boots_leather': 15,
      'boots_chain': 40,
      'boots_plate': 100
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
   * 获取指定地点的商店列表
   * @param locationId - 地点ID
   * @returns 商店配置列表
   */
  getShopsByLocation(locationId: string): ShopConfig[] {
    return Array.from(this.shopConfigs.values()).filter(
      config => config.locationId === locationId
    );
  }
  
  /**
   * 检查商店是否需要刷新
   * @param shopId - 商店ID
   * @returns 是否需要刷新
   */
  needsRefresh(shopId: string): boolean {
    const config = this.getShopConfig(shopId);
    const inventory = this.shopInventories.get(shopId);
    
    if (!config || !inventory) {
      return true;
    }
    
    const now = Date.now();
    return now - inventory.lastRefresh >= config.refreshInterval;
  }
  
  /**
   * 重置所有商店数据
   */
  reset(): void {
    this.shopInventories.clear();
    shopDbService.clearAllShopInventories();
    
    // 重新初始化所有商店库存
    this.shopConfigs.forEach((_, shopId) => {
      this.refreshShopInventory(shopId);
    });
  }
}

/**
 * 商店服务实例
 */
export const shopService = new ShopService();