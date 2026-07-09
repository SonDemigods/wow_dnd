/**
 * @fileoverview 战斗模块统一导出入口
 * @description 导出战斗模块的所有类型定义、数据层、服务层和状态管理
 * @module combat
 */
export type {
  CombatState,
  CombatResult,
  CombatActionType,
  CombatEventType,
  CombatAction,
  AoeHitInfo,
  CombatActionResult,
  CombatLog,
  CombatLogStorage
} from './types';

export { CombatDbService, combatDbService } from './db';

export {
  rollCritical,
  rollDodge,
  calculateFleeChance,
  rollFleeSuccess,
  generateCombatId,
  generateBattleLogId,
  isBossCombat
} from './service';

export { useCombatStore } from './store';
export type { ICombatContext, ICombatQuery, ICombatCommand } from './combatContext';
export { createCombatContext } from './combatContext';
