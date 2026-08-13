/**
 * @fileoverview 伤害计算管线
 * @description 4 阶段伤害计算：基础伤害 → 攻击方修正 → 防御方修正 → 护盾/反伤
 *
 * P3-146：阶段 1 接入 stat_modifier 类被动（physical/magic_attack_multiplier、
 * bonus_physical/magic_damage_percent），让法师奥术精通、猎手精准等被动生效。
 */

import type { EffectContainer, EffectContext, DamageType, DamagePipelineResult, Effect } from './types';
import { EffectHandlerRegistry } from './handler';
import { addEffectToContainer } from './container';
import { defaultRng, type Rng } from '@/utils/rng';
import { DAMAGE_BASE_COEFFICIENT, DAMAGE_RANDOM_RANGE, PHYSICAL_DEFENSE_REDUCTION_COEFFICIENT, MAGICAL_DEFENSE_REDUCTION_COEFFICIENT, DEFENSE_REDUCTION_MAX_RATIO } from '@/config/combat';

/**
 * 被动 stat_modifier 条目
 *
 * 由 usePassiveSkills.getStatModifiers() 返回，pipeline 在阶段 1 合并到攻击方修正。
 * - `physical_attack_multiplier` / `magic_attack_multiplier`：面板攻击力倍率（如 0.1 = +10%）
 * - `bonus_physical_damage_percent` / `bonus_magic_damage_percent`：额外伤害百分比（如 0.05 = +5% 最终伤害）
 */
export interface StatModifierEntry {
  stat: string;
  value: number;
}

/**
 * 计算攻击方原始伤害（不含防御）
 *
 * 按伤害类型选择对应攻击属性（物攻/魔攻），不含防御减免。
 * 防御减免由 applyDefenseReduction 独立处理，确保技能伤害也受防御影响。
 *
 * @param rng - 随机数生成器，用于伤害浮动（0~9 的整数增量）
 */
function calcAttackDamage(
  attackerStats: EffectContext['baseStats'],
  damageType: DamageType,
  rng: Rng
): number {
  const attack = damageType === 'physical' ? attackerStats.physicalAttack : attackerStats.magicAttack;
  return Math.floor(attack * DAMAGE_BASE_COEFFICIENT) + rng.int(0, DAMAGE_RANDOM_RANGE - 1);
}

/**
 * 减伤公式：按伤害类型选择对应防御属性（物防/魔防），独立计算减伤
 *
 * 取大值：防御可全额生效，coefficient × 伤害 作为最低保底减免。
 * 无论伤害来源是技能还是普攻，减伤公式始终应用。
 */
function applyDefenseReduction(
  rawDamage: number,
  defenderStats: EffectContext['baseStats'],
  damageType: DamageType
): number {
  const defense = damageType === 'physical' ? defenderStats.physicalDefense : defenderStats.magicDefense;
  const coefficient = damageType === 'physical'
    ? PHYSICAL_DEFENSE_REDUCTION_COEFFICIENT
    : MAGICAL_DEFENSE_REDUCTION_COEFFICIENT;
  // B-002 修复：限制防御减伤不超过伤害的 DEFENSE_REDUCTION_MAX_RATIO（70%），
  // 防止高防御在低伤害区间完全压制攻击（原公式 max(floor(dmg×0.3), defense) 可导致减伤 > 伤害）。
  const maxDefenseReduction = Math.floor(rawDamage * DEFENSE_REDUCTION_MAX_RATIO);
  const cappedDefense = Math.min(defense, maxDefenseReduction);
  const defenseReduction = Math.max(Math.floor(rawDamage * coefficient), cappedDefense);
  return Math.max(1, rawDamage - defenseReduction);
}

/**
 * 从 stat_modifier 列表中提取与当前伤害类型相关的攻击方倍率
 *
 * P3-146：将 passive 的 stat_modifier 转换为管线可用的 multiplier：
 * - `*_attack_multiplier`：作为面板攻击力倍率，减伤前乘入 baseDamage
 * - `bonus_*_damage_percent`：作为最终伤害额外百分比，减伤后乘入预期伤害
 *
 * @returns { attackMultiplier, bonusPercent } — 攻击力倍率与额外伤害百分比
 */
function extractAttackerModifiers(
  modifiers: ReadonlyArray<StatModifierEntry> | undefined,
  damageType: DamageType,
): { attackMultiplier: number; bonusPercent: number } {
  if (!modifiers || modifiers.length === 0) {
    return { attackMultiplier: 1, bonusPercent: 0 };
  }
  let attackMultiplier = 1;
  let bonusPercent = 0;
  const attackKey = damageType === 'physical' ? 'physical_attack_multiplier' : 'magic_attack_multiplier';
  const bonusKey = damageType === 'physical' ? 'bonus_physical_damage_percent' : 'bonus_magic_damage_percent';
  for (const m of modifiers) {
    if (m.stat === attackKey && Number.isFinite(m.value)) {
      attackMultiplier *= (1 + m.value);
    } else if (m.stat === bonusKey && Number.isFinite(m.value)) {
      bonusPercent += m.value;
    }
  }
  return { attackMultiplier, bonusPercent };
}

/**
 * 执行完整伤害计算管线
 *
 * 阶段 0: 计算原始伤害（技能传 baseDamageOverride 跳过，普攻打 calcAttackDamage）
 * 阶段 0.5: 攻击方攻击力倍率（passive attack_multiplier + effect attack_up/attack_down 合并，减伤前应用）
 * 阶段 1: 减伤公式（始终应用，无论来源是技能还是普攻）
 * 阶段 1.5: 攻击方最终伤害加成 → 预期伤害（stat_modifier 的 bonus_damage_percent，减伤后应用）
 * 阶段 2: 防御方修正 → 实际伤害
 * 阶段 3: 护盾吸收 → 最终伤害
 *
 * @param rng - 随机数生成器，默认 `defaultRng`。仅在未传 baseDamageOverride 时用于阶段 0 基础伤害浮动
 * @param attackerStatModifiers - 攻击方 stat_modifier 列表（来自被动技能），可选
 */
export function processDamagePipeline(
  registry: EffectHandlerRegistry,
  attackerEffects: EffectContainer,
  defenderEffects: EffectContainer,
  attackerCtx: EffectContext,
  defenderCtx: EffectContext,
  damageType: DamageType,
  baseDamageOverride?: number,
  rng: Rng = defaultRng,
  attackerStatModifiers?: ReadonlyArray<StatModifierEntry>,
): DamagePipelineResult {
  // 阶段 0: 原始伤害（技能传 override，普攻打 calcAttackDamage）
  const rawDamage = baseDamageOverride ?? calcAttackDamage(attackerCtx.baseStats, damageType, rng);

  // 提取 passive stat_modifier 的攻击力倍率与最终伤害加成
  const { attackMultiplier, bonusPercent } = extractAttackerModifiers(attackerStatModifiers, damageType);

  // 阶段 0.5: 攻击方攻击力倍率（减伤前应用）
  // P9-041 修复：attackMultiplier 在防御减免前应用（影响"面板攻击力"层），
  // 否则当防御值大于 coefficient×伤害 时，攻击力倍率被过度削减
  // P10-039 修复：effect 系统的 attack_up/attack_down（attackerMod）与 passive 的
  // attack_multiplier 同属"攻击加成"，统一在减伤前合并应用，避免同类修正被拆到减伤两侧
  const attackerMod = registry.reduceMultiplier(attackerEffects, 'getAttackerDamageMod', attackerCtx);
  // P2-5：NaN 防御，效果系统返回 NaN（除零/未初始化）时归零，防止腐蚀 HP 状态
  const safeAttackerMod = Number.isFinite(attackerMod) ? attackerMod : 1;
  const combinedAttackMultiplier = attackMultiplier * safeAttackerMod;
  const scaledDamage = Math.floor(rawDamage * combinedAttackMultiplier);

  // 阶段 1: 减伤公式（始终应用，无论来源是技能还是普攻）
  const defendedDamage = applyDefenseReduction(scaledDamage, defenderCtx.baseStats, damageType);

  // 阶段 1.5: 攻击方最终伤害加成 → 预期伤害
  // bonus_percent 是独立最终伤害加成，保持在减伤后（如猎手鹰眼 +5% 物理伤害）
  const baseDamage = defendedDamage;
  const expectedDamage = Math.floor(baseDamage * (1 + bonusPercent));

  // 阶段 2: 防御方修正 → 实际伤害
  const defenderMod = registry.reduceMultiplier(defenderEffects, 'getDefenderDamageMod', defenderCtx);
  const safeDefenderMod = Number.isFinite(defenderMod) ? defenderMod : 1;
  const actualDamage = Math.floor(expectedDamage * safeDefenderMod);

  // 阶段 3: 护盾吸收 → 最终伤害
  const absorbed = registry.reduceSum(defenderEffects, 'getDamageAbsorb', defenderCtx, actualDamage);
  const rawFinal = actualDamage - absorbed;
  const finalDamage = Number.isFinite(rawFinal) ? Math.max(0, rawFinal) : 0;

  return { expectedDamage, actualDamage, absorbed, finalDamage };
}

/**
 * 对目标施加效果（辅助函数，封装 addEffect + registry.onApply）
 */
export function applyEffect(
  registry: EffectHandlerRegistry,
  container: EffectContainer,
  effect: Effect,
  ctx: EffectContext
): void {
  // P4-004：传入 registry 使 addEffectToContainer 能调用旧 effect 的 onRemove 回调
  // P10-017 修复：透传 ctx，使 onRemove 回调能读取真实上下文
  addEffectToContainer(container, effect, registry, ctx);

  const handler = registry.get(effect.type);
  handler?.onApply?.(effect, ctx);
}
