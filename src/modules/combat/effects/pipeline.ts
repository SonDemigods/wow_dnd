/**
 * @fileoverview 伤害计算管线
 * @description 4 阶段伤害计算：基础伤害 → 攻击方修正 → 防御方修正 → 护盾/反伤
 */

import type { EffectContainer, EffectContext, DamageType, DamagePipelineResult } from './types';
import { EffectHandlerRegistry } from './handler';
import { addEffectToContainer } from './container';

/**
 * 计算基础伤害（按伤害类型选择攻防属性）
 */
function calcBaseDamage(
  attackerStats: EffectContext['baseStats'],
  defenderStats: EffectContext['baseStats'],
  damageType: DamageType
): number {
  const attack = damageType === 'physical' ? attackerStats.physicalAttack : attackerStats.magicAttack;
  const defense = damageType === 'physical' ? defenderStats.physicalDefense : defenderStats.magicDefense;

  const baseDamage = Math.floor(attack * 0.4) + Math.floor(Math.random() * 10);
  const defenseReduction = Math.min(Math.floor(baseDamage * 0.3), defense);
  return Math.max(1, baseDamage - defenseReduction);
}

/**
 * 执行完整伤害计算管线
 *
 * 阶段 0: 计算基础伤害（按 damageType 选择物攻/魔攻 vs 物防/魔防）
 * 阶段 1: 攻击方效果修正 → 预期伤害
 * 阶段 2: 防御方效果修正 → 实际伤害
 * 阶段 3: 护盾吸收 → 最终伤害
 * 阶段 4: 荆棘反伤
 */
export function processDamagePipeline(
  registry: EffectHandlerRegistry,
  attackerEffects: EffectContainer,
  defenderEffects: EffectContainer,
  attackerCtx: EffectContext,
  defenderCtx: EffectContext,
  damageType: DamageType,
  baseDamageOverride?: number  // 技能伤害可直接传入跳过阶段 0
): DamagePipelineResult {
  // 阶段 0: 基础伤害
  const baseDamage = baseDamageOverride ?? calcBaseDamage(attackerCtx.baseStats, defenderCtx.baseStats, damageType);

  // 阶段 1: 攻击方修正 → 预期伤害
  const attackerMod = registry.reduceMultiplier(attackerEffects, 'getAttackerDamageMod', attackerCtx);
  const expectedDamage = Math.floor(baseDamage * attackerMod);

  // 阶段 2: 防御方修正 → 实际伤害
  const defenderMod = registry.reduceMultiplier(defenderEffects, 'getDefenderDamageMod', defenderCtx);
  const actualDamage = Math.floor(expectedDamage * defenderMod);

  // 阶段 3: 护盾吸收 → 最终伤害
  const absorbed = registry.reduceSum(defenderEffects, 'getDamageAbsorb', defenderCtx, actualDamage);
  const finalDamage = Math.max(0, actualDamage - absorbed);

  // 阶段 4: 荆棘反伤
  const thorns = registry.reduceSum(defenderEffects, 'getThornDamage', defenderCtx, finalDamage);

  return { expectedDamage, actualDamage, absorbed, finalDamage, thorns };
}

/**
 * 对目标施加效果（辅助函数，封装 addEffect + registry.onApply）
 */
export function applyEffect(
  registry: EffectHandlerRegistry,
  container: EffectContainer,
  effect: import('./types').Effect,
  ctx: EffectContext
): void {
  addEffectToContainer(container, effect);

  const handler = registry.get(effect.type);
  handler?.onApply?.(effect, ctx);
}
