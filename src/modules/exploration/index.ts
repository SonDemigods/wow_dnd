/**
 * @fileoverview 探索模块统一导出入口
 * @description 导出探索模块的所有类型定义、数据层、服务层和状态管理
 * @module exploration
 */
export type {
  CellType,
  GridEventType,
  RandomEventEffectType,
  ExplorationCell,
  ExplorationState,
  GridEventProbability,
  AreaConfig,
  RandomEventResult,
  EventChoice,
  MultiOptionEventResult,
  GridGenerationConfig,
  ExplorationUICallbacks,
  ExplorationStorage
} from './types';

export { ExplorationDbService, explorationDbService } from './db';

export {
  EVENT_TO_CELL_TYPE,
  pickRandomFromArray,
  computeEventProbability,
  buildItemPool,
  determineCellEvent,
  generateTrapDamage,
  generateCampHeal,
  generateItemForCell,
  generateEnemyForCell,
  generateRandomEvent,
  generateMultiOptionEvent,
  generateGrid,
  findStartPosition,
  updateAccessibleCells,
  isPassable,
  computeVision,
  applyVision,
  shouldShowEnemyAlert,
  GRID_SIZE
} from './service';

export { useExplorationStore } from './store';
