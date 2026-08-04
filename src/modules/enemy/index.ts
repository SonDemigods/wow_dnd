/**
 * @fileoverview 敌人模块统一导出入口
 * @description 导出敌人模块的所有类型定义、数据层、服务层和状态管理
 *
 *              enemy 模块不感知 Boss 专属类型（BossIntroEffect/BossIntro/
 *              BossMechanicType/BossMechanic/BossPhase），这些类型由 boss 模块
 *              独立定义并导出。外部代码应直接从 @/modules/boss 导入这些类型。
 *
 * @module enemy
 */
export type {
  DangerLevel,
  AiStrategyType,
  EnemyData,
  EnemyDrop,
  EnemyInstance,
  EnemyStorage
} from './types';

export { EnemyDbService, fromStorageBase, enemyDbService } from './db';

export {
  generateEnemyStats,
  calculateEnemyDamage,
  createEnemyInstance
} from './service';

export { useEnemyStore, setBossCreateFn } from './store';
