/**
 * @fileoverview 敌人模块统一导出入口
 * @description 导出敌人模块的所有类型定义、数据层、服务层和状态管理
 * @module enemy
 */
export type {
  DangerLevel,
  AiStrategyType,
  BossIntroEffect,
  BossMechanicType,
  BossIntro,
  BossMechanic,
  BossPhase,
  EnemyData,
  EnemyDrop,
  EnemyInstance,
  EnemyStorage
} from './types';

export { EnemyDbService, fromStorageBase, enemyDbService } from './db';

export {
  generateEnemyStats,
  calculateEnemyDamage,
  createEnemyInstance,
  BOSS_DROP_TABLE
} from './service';

export { useEnemyStore } from './store';
