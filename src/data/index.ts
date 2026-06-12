/**
 * @fileoverview 游戏数据统一导出文件
 * @description 集中管理所有游戏相关的数据模块，方便其他组件统一导入
 * @module data
 */

// 导出阵营数据
export { FACTIONS } from './config_factions';

// 导出种族数据
export { RACES } from './config_races';

// 导出职业数据
export { CLASSES } from './config_classes';

// 导出职业技能数据
export { CLASS_ABILITIES } from './config_skills';

// 导出物品和战利品数据
export { LOOT_ITEMS } from './config_items';

// 导出装备数据
export { EQUIPMENT_ITEMS } from './config_equipmentItems';

// 导出普通怪物数据
export { MOBS } from './config_mobs';

// 导出 Boss 怪物数据
export { BOSSES } from './config_bosses';

// 导出世界地图数据（大陆 + 地点）
export { CONTINENTS, LOCATIONS } from './config_locations';

// 导出任务数据
export { QUESTS } from './config_quests';

// 导出商店数据
export { SHOPS } from './config_shops';

// 导出配置常量
export { MAX_LEVEL, STAT_NAMES, LEVEL_EXP_REQUIREMENTS } from '@/config/character';

// 导出计算函数
export {
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
} from '@/utils/calculations';
