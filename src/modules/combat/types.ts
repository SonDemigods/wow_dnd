/**
 * @fileoverview 战斗模块类型定义
 * @description 战斗系统的类型和接口定义
 * @module modules/combat/types
 */

import type { Enemy, Character } from '@/types';

/** 战斗状态 */
export type CombatState = 'idle' | 'preparing' | 'fighting' | 'ended';

/** 战斗结果 */
export type CombatResult = 'victory' | 'defeat' | 'fled';

/** 战斗伤害事件 */
export interface CombatDamageEvent {
  target: 'player' | 'enemy';
  amount: number;
  isCrit: boolean;
}

/** 战斗治疗事件 */
export interface CombatHealEvent {
  target: 'player' | 'enemy';
  amount: number;
}

/** 战斗开始事件 */
export interface CombatStartEvent {
  enemy: Enemy;
}

/** 战斗结束事件 */
export interface CombatEndEvent {
  result: CombatResult;
  enemy: Enemy;
  expGained: number;
  loot?: any[];
}

/** 战斗服务接口 */
export interface ICombatService {
  getState(): CombatState;
  getEnemy(): Enemy | null;
  getTurn(): 'player' | 'enemy';
  startCombat(enemy: Enemy): void;
  playerAttack(): void;
  enemyAttack(): void;
  endCombat(result: CombatResult): void;
  flee(): boolean;
  isInCombat(): boolean;
}
