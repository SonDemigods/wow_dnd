/**
 * @fileoverview 游戏模块统一导出
 * @description 集中导出所有业务模块，便于其他文件导入使用
 * @module modules/index
 */

// 角色模块
export { useCharacterStore, characterService } from './character'
export type {
  CharacterStatsChangeEvent,
  CharacterHpChangeEvent,
  CharacterMpChangeEvent,
  CharacterLevelUpEvent,
  ICharacterService
} from './character/types'

// 背包模块
export { useInventoryStore, inventoryService } from './inventory'
export type {
  InventoryItemAddedEvent,
  InventoryItemRemovedEvent,
  InventoryItemUsedEvent,
  InventoryUpdatedEvent,
  IInventoryService
} from './inventory/types'

// 战斗模块
export { useCombatStore, combatService } from './combat'
export type {
  CombatState,
  CombatResult,
  CombatDamageEvent,
  CombatHealEvent,
  CombatStartEvent,
  CombatEndEvent,
  ICombatService
} from './combat/types'

// 技能模块
export { useSkillsStore, skillsService } from './skills'
export type {
  SkillType,
  Skill,
  SkillCooldown,
  SkillCastEvent,
  SkillCooldownEvent,
  SkillReadyEvent,
  ISkillsService
} from './skills/types'

// 地图模块
export { useMapStore, mapService } from './map'
export type {
  MapMode,
  MapMarkerType,
  MapMarker,
  MapView,
  MapState,
  LocationHistory,
  IMapService
} from './map/types'

// 探索模块
export { useExplorationStore, explorationService } from './exploration'
export type {
  ExplorationStatus,
  LocationExploration,
  ContinentExploration,
  ExplorationReward,
  ExplorationEvent,
  ExplorationState,
  IExplorationService
} from './exploration/types'
