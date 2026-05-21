/**
 * @fileoverview 游戏数据统一导出文件
 * @description 集中管理所有游戏相关的数据模块，方便其他组件统一导入
 * @module data
 */

// 导出阵营和种族数据
export { FACTIONS, RACES } from './races'

// 导出职业和职业技能数据
export { CLASSES, CLASS_ABILITIES } from './classes'

// 导出物品类型和战利品数据
export { ITEM_TYPES, LOOT_ITEMS } from './items'

// 导出装备数据
export { EQUIPMENT_ITEMS, RARITY_CONFIG } from './equipment'

// 导出敌人数据
export { ENEMIES } from './enemies'

// 导出大陆和世界地点数据（使用别名 LOCATIONS 保持兼容性）
export { CONTINENTS, LOCATIONS } from './map'

// 导出任务数据
export { QUESTS } from './quests'

// 导出商店数据
export { SHOPS, ITEM_BASE_PRICES, RARITY_PRICE_MULTIPLIER, RARITY_SELL_DISCOUNT, ITEM_POOLS, SHOP_TYPE_ITEM_POOL } from './shops'

// 导出常量和计算函数
export { 
  MAX_LEVEL, 
  STAT_NAMES, 
  LEVEL_EXP_REQUIREMENTS,
  calculateAllAttributes,
  calculateMaxHp,
  calculateMaxMana,
  calculatePhysicalAttack,
  calculatePhysicalDefense,
  calculateMagicAttack,
  calculateMagicDefense,
  calculateCritChance,
  calculateDodgeChance,
  calculateHpBonus,
  calculateMpBonus,
  calculateHealBonus,
  getExpForLevel
} from './constants'
