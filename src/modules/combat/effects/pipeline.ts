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
import { DAMAGE_BASE_COEFFICIENT, DAMAGE_RANDOM_RANGE, PHYSICAL_DEFENSE_REDUCTION_COEFFICIENT, MAGICAL_DEFENSE_REDUCTION_COEFFICIENT } from '@/config/combat';

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
  const defenseReduction = Math.max(Math.floor(rawDamage * coefficient), defense);
  return Math.max(1, rawDamage - defenseReduction);
}

/**
 * 从 stat_modifier 列表中提取与当前伤害类型相关的攻击方倍率
 *
 * P3-146：将 passive 的 stat_modifier 转换为管线可用的 multiplier：
 * - `*_attack_multiplier`：作为面板攻击力倍率，乘入 baseDamage
 * - `bonus_*_damage_percent`：作为最终伤害额外百分比，乘入 attackerMod
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
 * 阶段 0.5: 减伤公式（始终应用，无论来源是技能还是普攻）
 * 阶段 1: 攻击方效果修正 → 预期伤害
 *   - 1a: 应用 stat_modifier 的 attack_multiplier 到 baseDamage
 *   - 1b: 应用 effect 系统的 attackerMod（attack_up/attack_down 等）
 *   - 1c: 应用 stat_modifier 的 bonus_damage_percent
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

  // 阶段 0.5: 减伤公式（始终应用，无论来源是技能还是普攻）
  const defendedDamage = applyDefenseReduction(rawDamage, defenderCtx.baseStats, damageType);

  // 阶段 1: 攻击方修正 → 预期伤害
  // P3-146：先应用 stat_modifier 中的 attack_multiplier（影响"面板攻击力"层）
  const { attackMultiplier, bonusPercent } = extractAttackerModifiers(attackerStatModifiers, damageType);
  const baseDamage = Math.floor(defendedDamage * attackMultiplier);

  // 1b: effect 系统修正（attack_up/attack_down 等效果）
  const attackerMod = registry.reduceMultiplier(attackerEffects, 'getAttackerDamageMod', attackerCtx);
  // P2-5：NaN 防御，效果系统返回 NaN（除零/未初始化）时归零，防止腐蚀 HP 状态
  const safeAttackerMod = Number.isFinite(attackerMod) ? attackerMod : 1;
  // 1c: stat_modifier 中的 bonus_damage_percent（如猎手鹰眼 +5% 物理伤害）
  const expectedDamage = Math.floor(baseDamage * safeAttackerMod * (1 + bonusPercent));

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
  addEffectToContainer(container, effect, registry);

  const handler = registry.get(effect.type);
  handler?.onApply?.(effect, ctx);
}
