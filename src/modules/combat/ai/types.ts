/**
 * @fileoverview AI 策略类型定义
 * @description 包含战斗上下文、AI 策略接口和决策结果类型
 */

import type { Enemy } from '@/modules/enemy/types';

/** 战斗上下文（AI 做决策需要感知的信息） */
export interface BattleContext {
  playerHp: number;
  playerMaxHp: number;
  enemyHp: number;
  enemyMaxHp: number;
  availableSkills: { id: string; name: string; isHeal?: boolean; damageMultiplier?: number }[];
  turnCount: number;
}

/** AI 策略接口 */
export interface IAiStrategy {
  readonly name: string;
  /** 决定下一步行动 */
  decideAction(enemy: Enemy, context: BattleContext): AiDecision;
}

/** AI 决策结果 */
export type AiDecision =
  | { type: 'basic_attack' }
  | { type: 'skill'; skillId: string }
  | { type: 'heal'; skillId: string };
