/**
 * 战斗模块服务层（纯函数）
 * 
 * 提供战斗相关的纯计算函数，不持有任何状态，不产生任何副作用。
 * 所有状态管理和副作用（持久化、事件通知）由 Store 层负责。
 */
import type { Enemy } from '../enemy/types';

/**
 * 计算玩家物理伤害
 * @param physicalAttack - 物理攻击力
 * @param enemyDefense - 敌人物理防御力
 * @returns 基础伤害和经过防御减免后的实际伤害
 */
export function calculatePlayerDamage(physicalAttack: number, enemyDefense: number): { baseDamage: number; rawDamage: number } {
  const baseDamage = Math.floor(physicalAttack * 0.4) + Math.floor(Math.random() * 10);
  const defense = enemyDefense || 0;
  const defenseReduction = Math.min(Math.floor(baseDamage * 0.3), defense);
  const rawDamage = Math.max(1, baseDamage - defenseReduction);
  return { baseDamage, rawDamage };
}

/**
 * 暴击判定
 * @param critChance - 暴击几率（0~1 之间的小数，如 0.05 表示 5%）
 * @returns 是否暴击
 */
export function rollCritical(critChance: number): boolean {
  return Math.random() < critChance;
}

/**
 * 闪避判定
 * @param dodgeChance - 闪避几率（0~1 之间的小数，如 0.03 表示 3%）
 * @returns 是否闪避
 */
export function rollDodge(dodgeChance: number): boolean {
  return Math.random() < dodgeChance;
}

/**
 * 计算逃跑成功率
 * @param dex - 敏捷值
 * @returns 逃跑成功率（0~1 之间的小数）
 */
export function calculateFleeChance(dex: number): number {
  return 0.5 + dex * 0.01;
}

/**
 * 逃跑成功判定
 * @param fleeChance - 逃跑成功率（0~1 之间的小数）
 * @returns 是否逃跑成功
 */
export function rollFleeSuccess(fleeChance: number): boolean {
  return Math.random() < fleeChance;
}

/**
 * 生成战斗 ID
 * @returns 战斗 ID 字符串
 */
export function generateCombatId(): string {
  return `combat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 生成战斗日志 ID
 * @returns 战斗日志 ID 字符串
 */
export function generateBattleLogId(): string {
  return `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 判断是否为 Boss 战
 * @param enemy - 敌人实例
 * @returns 是否为 Boss 战
 */
export function isBossCombat(enemy: Enemy): boolean {
  return Boolean(enemy.isBoss);
}
