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

// QA-5 拆分后的 4 个 composable，供 CombatPopup.vue 等组件使用
export { useCombatSpeed } from './composables/useCombatSpeed';
export { useCombatAutoClose } from './composables/useCombatAutoClose';
export { useBossIntroOverlay } from './composables/useBossIntroOverlay';
/**
 * P3-183：仅供 CombatPopup.vue 内部使用，大量 DOM 操作（document.querySelector），
 * 外部模块不应导入。如需动画能力，应通过事件总线订阅而非直接调用。
 */
export { useCombatAnimations } from './composables/useCombatAnimations';
