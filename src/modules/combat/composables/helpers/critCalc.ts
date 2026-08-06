/**
 * @fileoverview 玩家暴击计算 helper（QA-12）
 *
 * 抽离自 usePlayerAction.ts 中 4 处重复的暴击判定模式：
 *   1. playerAttack（普通攻击）
 *   2. playerSkill AOE 分支（每个敌人独立判定）
 *   3. playerSkill single 分支
 *   4. playerUseItem 伤害型分支
 *
 * 统一收口暴击倍率常量（CRIT_DAMAGE_MULTIPLIER），避免散落的 1.5 魔法数字。
 *
 * P3-146：暴击判定接入 stat_modifier 类被动：
 *   - `crit_chance`：暴击率加成（value 为 0~1 小数，如 0.05 = +5% 暴击率）
 *   - `crit_damage_multiplier`：暴击伤害倍率加成（value 为 0~1 小数，如 0.5 = +50% 暴击伤害）
 *
 * 设计说明：直接依赖 Rng 接口而非 rollCritical，使 helper 成为纯函数模块，
 * 测试无需 mock service 模块，仅通过注入 rng 即可控制判定结果。
 *
 * @module combat/composables/helpers/critCalc
 */
import type { Attributes } from '@/modules/character';
import { CRIT_DAMAGE_MULTIPLIER } from '@/config/combat';
import { defaultRng, type Rng } from '@/utils/rng';
import type { StatModifierEntry } from '../../effects/pipeline';

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
 * 从 stat_modifier 列表中提取暴击相关加成
 *
 * P3-146：将 passive 的 crit_chance / crit_damage_multiplier 转换为暴击判定可用参数。
 * - `crit_chance`：value 为 0~1 小数（如 0.05 = +5% 暴击率），转换为百分比点数（+5）
 * - `crit_damage_multiplier`：value 为 0~1 小数（如 0.5 = +50% 暴击伤害），直接作为倍率增量
 *
 * @returns { critChanceBonus, critDamageMultiplierBonus } — 暴击率百分点加成与暴击伤害倍率加成
 */
function extractCritModifiers(
  modifiers: ReadonlyArray<StatModifierEntry> | undefined,
): { critChanceBonus: number; critDamageMultiplierBonus: number } {
  if (!modifiers || modifiers.length === 0) {
    return { critChanceBonus: 0, critDamageMultiplierBonus: 0 };
  }
  let critChanceBonus = 0;
  let critDamageMultiplierBonus = 0;
  for (const m of modifiers) {
    if (!Number.isFinite(m.value)) continue;
    if (m.stat === 'crit_chance') {
      // value 是 0~1 小数，乘 100 转换为百分点（与 attrs.critChance 同口径）
      critChanceBonus += m.value * 100;
    } else if (m.stat === 'crit_damage_multiplier') {
      critDamageMultiplierBonus += m.value;
    }
  }
  return { critChanceBonus, critDamageMultiplierBonus };
}

/**
 * 玩家暴击判定
 *
 * 内部将角色 attrs.critChance（百分比，如 5 表示 5%）归一化为 0~1 小数后调用 rng.bool。
 * 倍率统一来自 `CRIT_DAMAGE_MULTIPLIER` 常量，避免硬编码 1.5。
 *
 * P3-146：可选传入 statModifiers，叠加 crit_chance（暴击率）和 crit_damage_multiplier
 * （暴击伤害倍率）类被动加成。暴击率上限 100%，避免 rng.bool 接收 >1 的概率值。
 *
 * @param attrs - 角色属性（需包含 critChance 百分比值）
 * @param rng   - 可选 RNG 注入（用于测试与回放），默认使用 defaultRng
 * @param statModifiers - 可选的 stat_modifier 列表（来自被动技能 getStatModifiers()）
 */
export function rollPlayerCrit(
  attrs: Attributes,
  rng: Rng = defaultRng,
  statModifiers?: ReadonlyArray<StatModifierEntry>,
): PlayerCritResult {
  const { critChanceBonus, critDamageMultiplierBonus } = extractCritModifiers(statModifiers);
  // critChance 与 critChanceBonus 均为百分点（0~100），相加后归一化为 0~1
  // Math.min(100, ...) 防止暴击率超过 100% 时 rng.bool 接收 >1 概率
  const critChance = Math.min(100, attrs.critChance + critChanceBonus) / 100;
  const isCrit = rng.bool(critChance);
  const multiplier = isCrit
    ? CRIT_DAMAGE_MULTIPLIER * (1 + critDamageMultiplierBonus)
    : 1;
  return { isCrit, multiplier };
}
