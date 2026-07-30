/**
 * @fileoverview 玩家暴击与荆棘反伤计算 helper（QA-12）
 *
 * 抽离自 usePlayerAction.ts 中 4 处重复的暴击判定 + 荆棘反伤计算模式：
 *   1. playerAttack（普通攻击）
 *   2. playerSkill AOE 分支（每个敌人独立判定）
 *   3. playerSkill single 分支
 *   4. playerUseItem 伤害型分支
 *
 * 统一收口暴击倍率常量（CRIT_DAMAGE_MULTIPLIER），避免散落的 1.5 魔法数字。
 * 荆棘反伤基于暴击后伤害计算（与 Boss 反击基数保持一致，见 P2-2）。
 *
 * 设计说明：直接依赖 Rng 接口而非 rollCritical，使 helper 成为纯函数模块，
 * 测试无需 mock service 模块，仅通过注入 rng 即可控制判定结果。
 *
 * @module combat/composables/helpers/critCalc
 */
import type { Attributes } from '@/modules/character';
import { CRIT_DAMAGE_MULTIPLIER } from '@/config/combat';
import { defaultRng, type Rng } from '@/utils/rng';

/**
 * 暴击判定结果
 *
 * @property isCrit - 是否触发暴击
 * @property multiplier - 暴击倍率（暴击时为 CRIT_DAMAGE_MULTIPLIER，否则 1）
 */
export interface PlayerCritResult {
  isCrit: boolean;
  multiplier: number;
}

/**
 * 玩家暴击判定
 *
 * 内部将角色 attrs.critChance（百分比，如 5 表示 5%）归一化为 0~1 小数后调用 rng.bool。
 * 倍率统一来自 `CRIT_DAMAGE_MULTIPLIER` 常量，避免硬编码 1.5。
 *
 * @param attrs - 角色属性（需包含 critChance 百分比值）
 * @param rng   - 可选 RNG 注入（用于测试与回放），默认使用 defaultRng
 */
export function rollPlayerCrit(
  attrs: Attributes,
  rng: Rng = defaultRng,
): PlayerCritResult {
  const critChance = attrs.critChance / 100;
  const isCrit = rng.bool(critChance);
  const multiplier = isCrit ? CRIT_DAMAGE_MULTIPLIER : 1;
  return { isCrit, multiplier };
}

/**
 * 计算荆棘反伤数值
 *
 * 荆棘反伤基于暴击后伤害计算（与 Boss 反击基数口径一致，见 P2-2）：
 *   thornsDamage = floor(thorns × multiplier)
 *
 * @param thorns     - 管线返回的荆棘基础值（pipeResult.thorns）
 * @param multiplier - 暴击倍率（来自 rollPlayerCrit 返回的 multiplier）
 */
export function computeThornsDamage(thorns: number, multiplier: number): number {
  return Math.floor(thorns * multiplier);
}
