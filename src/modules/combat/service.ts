/**
 * 战斗模块服务层（纯函数）
 * 
 * 提供战斗相关的纯计算函数，不持有任何状态，不产生任何副作用。
 * 所有状态管理和副作用（持久化、事件通知）由 Store 层负责。
 */
import type { EnemyInstance } from '../enemy/types';
import { generateId } from '@/utils/db-helpers';
import { defaultRng, type Rng } from '@/utils/rng';
import { FLEE_BASE_CHANCE, FLEE_DEX_COEFFICIENT } from '@/config/combat';

/**
 * 暴击判定
 * @param critChance - 暴击几率（0~1 之间的小数，如 0.05 表示 5%）
 * @param rng - 随机数生成器，默认 `defaultRng`。传入确定性 RNG 可复现战斗
 * @returns 是否暴击
 */
export function rollCritical(critChance: number, rng: Rng = defaultRng): boolean {
  return rng.bool(critChance);
}

/**
 * 闪避判定
 * @param dodgeChance - 闪避几率（0~1 之间的小数，如 0.03 表示 3%）
 * @param rng - 随机数生成器，默认 `defaultRng`
 * @returns 是否闪避
 */
export function rollDodge(dodgeChance: number, rng: Rng = defaultRng): boolean {
  return rng.bool(dodgeChance);
}

/**
 * 计算逃跑成功率
 * @param dex - 敏捷值
 * @returns 逃跑成功率（0~1 之间的小数）
 */
export function calculateFleeChance(dex: number): number {
  return FLEE_BASE_CHANCE + dex * FLEE_DEX_COEFFICIENT;
}

/**
 * 逃跑成功判定
 * @param fleeChance - 逃跑成功率（0~1 之间的小数）
 * @param rng - 随机数生成器，默认 `defaultRng`
 * @returns 是否逃跑成功
 */
export function rollFleeSuccess(fleeChance: number, rng: Rng = defaultRng): boolean {
  return rng.bool(fleeChance);
}

/**
 * 生成战斗 ID
 * @returns 战斗 ID 字符串
 */
export function generateCombatId(): string {
  return generateId('combat');
}

/**
 * 生成战斗日志 ID
 * @returns 战斗日志 ID 字符串
 */
export function generateBattleLogId(): string {
  return generateId('log');
}

/**
 * 判断是否为 Boss 战
 * @param enemy - 敌人实例
 * @returns 是否为 Boss 战
 */
export function isBossCombat(enemy: EnemyInstance): boolean {
  return Boolean(enemy.isBoss);
}
