/**
 * @fileoverview Boss 模块统一导出入口
 * @description 导出 Boss 模块的所有类型定义、数据层、服务层
 * @module boss
 */
export type {
  AiStrategyType,
  BossIntroEffect,
  BossIntro,
  BossMechanicType,
  BossMechanic,
  BossPhase,
  BossStorage,
  BossTemplate,
  BossRuntimeState,
  BossInstance
} from './types';

export { BossDbService, bossDbService } from './db';

export { createBossInstance, wrapAsBossInstance } from './service';

export {
  executeBossMechanic,
  processBossPhaseMechanics,
  applyPhaseStats
} from './engine';

export { BossPhaseManager } from './phaseManager';
