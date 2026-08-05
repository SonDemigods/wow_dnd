/**
 * @fileoverview 游戏数据统一导出文件
 * @description 集中管理所有游戏相关的数据模块，方便其他组件统一导入
 * @module data
 */

// P1-31 修复：将开发环境校验的副作用 import 移至文件顶部 import 区域
// 数据完整性校验（开发环境自动执行，生产环境无副作用）
import './validate';

// 导出阵营数据
export { FACTIONS } from './config_factions';

// 导出种族数据
export { RACES } from './config_races';

// 导出职业数据
export { CLASSES } from './config_classes';

// 导出职业技能数据
export { CLASS_ABILITIES } from './config_skills';

// 导出怪物/首领技能数据
export { MONSTER_ABILITIES } from './config_skills';

// 导出职业被动技能数据（Phase 5.2）
export { CLASS_PASSIVES, getPassivesByClassId } from './config_class_passives';

// 导出职业专属装备数据（Phase 5.3，P3.1 升级：仅武器，不含护甲）
export { CLASS_EQUIPMENT, getClassEquipment } from './config_class_equipment';

// 导出套装定义数据（Phase 5.3，P3 套装扩展）
export { SET_DEFINITIONS, getSetDefinitionById, getSetDefinitionsByClassId } from './config_set_definitions';

// 导出套装部件数据（P3 套装扩展）
export { SET_PARTS } from './config_set_parts';

// 导出职业天赋树数据（Phase 6.2）
export { CLASS_TALENT_TREES, getTalentTreesByClassId, getTalentTreeById, getTalentById } from './config_class_talents';

// 导出物品和战利品数据
export { LOOT_ITEMS } from './config_items';

// 导出装备数据
export { EQUIPMENT_ITEMS } from './config_equipment_items';

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

export { validateLocationData } from './validate';

// P1-30 修复：移除 config 和 utils 的越层重新导出，调用方应直接从 @/config/character 或 @/utils/calculations 导入
