/**
 * @fileoverview 技能模块服务层（纯函数集合）
 * @description 所有函数均为纯函数——无状态、无副作用、无异步操作、无外部依赖（仅依赖类型定义）。
 *              负责技能伤害计算、Buff 效果计算、施放条件校验等核心业务逻辑。
 *              状态管理、持久化、异步编排全部交由 Store 层处理。
 * @module skill
 */

import type { Skill, SkillBar, SkillBuffEffect } from './types';
import type { Stats } from '../character/types';

// ============================================================================
// 伤害/效果计算
// ============================================================================

/**
 * 计算技能伤害/效果值（综合核心算法）
 *
 * 根据技能类型选择对应的属性加成公式，计算最终效果值。
 * 公式通用结构：`基础值 + 属性 × 系数`，不同技能类型对应不同属性：
 *
 * | 技能类型         | 加成属性 | 系数来源                       |
 * |------------------|----------|-------------------------------|
 * | physical_damage  | STR(力量) | effect.coefficient 或等级系数  |
 * | magic_damage     | INT(智力) | effect.coefficient 或等级系数  |
 * | health_restore   | WIS(智慧) | effect.coefficient 或等级系数  |
 * | mana_restore     | INT(智力) | effect.coefficient 或等级系数  |
 * | buff / debuff    | —        | 固定返回 0（效果通过 buffs 字段计算） |
 *
 * 系数优先级：`skill.effect.coefficient`（手动指定）> `getSkillCoefficient(skill.unlockLevel, type)`（自动计算）
 *
 * @param skill - 技能数据（需要 effect.value、effect.coefficient、unlockLevel、type 字段）
 * @param stats - 角色核心属性（STR/INT/WIS/DEX 四维）
 * @returns 计算后的最终效果值（已 `Math.floor` 向下取整）
 *
 * @see getSkillCoefficient 自动系数计算逻辑
 * @see calculateBuffValue buff/debuff 类型使用此函数计算单个效果值
 *
 * @example
 * // 物理伤害技能：基础 50 + 力量 15 × 系数 0.5 = 57
 * calculateSkillDamage({ type: 'physical_damage', effect: { value: 50 } }, { str: 15 })
 */
export function calculateSkillDamage(skill: Skill, stats: Stats): number {
  switch (skill.type) {
    // 物理伤害：力量 STR 加成
    case 'physical_damage': {
      const coef = skill.effect.coefficient ?? getSkillCoefficient(skill.unlockLevel, 'damage');
      return Math.floor(skill.effect.value + stats.str * coef);
    }
    // 魔法伤害：智力 INT 加成
    case 'magic_damage': {
      const coef = skill.effect.coefficient ?? getSkillCoefficient(skill.unlockLevel, 'damage');
      return Math.floor(skill.effect.value + stats.int * coef);
    }
    // 生命恢复：智慧 WIS 加成
    case 'health_restore': {
      const coef = skill.effect.coefficient ?? getSkillCoefficient(skill.unlockLevel, 'heal');
      return Math.floor(skill.effect.value + stats.wis * coef);
    }
    // 法力恢复：智力 INT 加成
    case 'mana_restore': {
      const coef = skill.effect.coefficient ?? getSkillCoefficient(skill.unlockLevel, 'heal');
      return Math.floor(skill.effect.value + stats.int * coef);
    }
    // buff/debuff：不通过此函数计算伤害，返回 0 占位
    case 'buff':
    case 'debuff':
      return 0;
    // 兜底：直接返回基础值（理论上不会到达，TypeScript 编译时已校验所有 SkillType 分支）
    default:
      return skill.effect.value;
  }
}

/**
 * 按解锁等级获取技能属性加成系数（分层缩放算法）
 *
 * 系数随技能解锁等级阶梯式提升，模拟"高级技能受属性影响更大"的 RPG 设计。
 * 分层规则（按解锁等级 `unlockLevel`）：
 *
 * | 等级区间 | Tier | damage 系数 | heal 系数 |
 * |----------|------|-------------|-----------|
 * | 1-2      | 0    | 0.50        | 0.30      |
 * | 3-5      | 1    | 0.54        | 0.335     |
 * | 6-8      | 2    | 0.58        | 0.37      |
 * | 9-10     | 3    | 0.62        | 0.405     |
 *
 * @param unlockLevel - 技能解锁等级（1-10）
 * @param type - 计算类型（'damage' = 伤害/法力恢复，'heal' = 生命恢复，'buff' = 固定 0）
 * @returns 属性加成系数
 *
 * @remarks 此函数为模块内部辅助函数，不应被外部直接调用。外部应通过 `calculateSkillDamage` 间接使用。
 */
export function getSkillCoefficient(unlockLevel: number, type: 'damage' | 'heal' | 'buff'): number {
  // buff 类型不受属性影响，固定返回 0
  if (type === 'buff') return 0;

  // 基础系数：伤害类比恢复类高约 67%
  const baseCoef = type === 'heal' ? 0.30 : 0.50;
  // 每档增量：恢复类比伤害类平滑（更稳定的恢复节奏）
  const tierBonus = type === 'heal' ? 0.035 : 0.040;

  // 分层映射：Lv 1-2 / Lv 3-5 / Lv 6-8 / Lv 9-10
  const tier = unlockLevel <= 2 ? 0 : unlockLevel <= 5 ? 1 : unlockLevel <= 8 ? 2 : 3;
  return baseCoef + tier * tierBonus;
}

/**
 * 计算 Buff/Debuff 技能的实际效果值（受属性加成）
 *
 * 每种效果类型有不同的属性加成规则，根据游戏平衡需求手动调校。
 *
 * 效果分类及加成规则：
 *
 * **百分比类（影响攻防数值的百分比变化）**
 * - attack_up / attack_down：`value + WIS × 0.30`
 * - defense_up / defense_down：`value + WIS × 0.25`
 * - vulnerable（易伤）：`value + WIS × 0.20`
 *
 * **固定值类（HP 相关的持续效果，缩放匹配 HP 成长曲线）**
 * - poison（中毒）：`value + WIS × 0.50`
 * - burn（灼烧）：`value + WIS × 0.60`
 * - regen（再生）：`value + WIS × 0.50`
 * - shield（护盾）：`value + WIS × 0.80`
 *
 * **倍率类（返回百分比值，有上限保护）**
 * - thorn（荆棘反伤）：`min(0.60, value + WIS × 0.005)` → 最高 60%
 *
 * **控制类（不随属性缩放，稳定控制收益）**
 * - stun / freeze / silence：直接返回 `value`
 *
 * **速度类（敏捷 DEX 加成）**
 * - speed_up / speed_down：`value + DEX × 0.30`
 *
 * @param buffEffect - Buff/Debuff 效果配置（type + value）
 * @param stats - 角色核心属性
 * @returns 经过属性加成后的最终效果值
 *
 * @see SkillBuffEffect 效果配置类型定义
 * @see calculateSkillDamage buff/debuff 技能的伤害计算返回 0，实际效果通过此函数计算
 */
export function calculateBuffValue(buffEffect: SkillBuffEffect, stats: Stats): number {
  const { type, value } = buffEffect;

  switch (type) {
    // ===== 百分比类：value 即百分比点数，受 WIS 适度加成 =====
    case 'attack_up':
    case 'attack_down':
      return Math.floor(value + stats.wis * 0.30);

    case 'defense_up':
    case 'defense_down':
      return Math.floor(value + stats.wis * 0.25);

    case 'vulnerable':
      return Math.floor(value + stats.wis * 0.20);

    // ===== 固定值类：缩放匹配 HP 成长曲线，高额 WIS 加成使后期 buff 更有价值 =====
    case 'poison':
      return Math.floor(value + stats.wis * 0.50);

    case 'burn':
      return Math.floor(value + stats.wis * 0.60);

    case 'regen':
      return Math.floor(value + stats.wis * 0.50);

    case 'shield':
      return Math.floor(value + stats.wis * 0.80);

    // ===== 倍率类：微量 WIS 加成，上限保护防止反伤比例过高 =====
    case 'thorn':
      return Math.min(0.60, value + stats.wis * 0.005);

    // ===== 控制类：不缩放，保证控制效果的稳定性 =====
    case 'stun':
    case 'freeze':
    case 'silence':
      return value;

    // ===== 速度类：DEX（敏捷）加成 =====
    case 'speed_up':
    case 'speed_down':
      return Math.floor(value + stats.dex * 0.30);

    // 未知效果类型：安全兜底，返回原始值
    default:
      return value;
  }
}

// ============================================================================
// 条件校验
// ============================================================================

/**
 * 判断角色是否可以学习某个技能模板
 *
 * 两个必要条件：
 * 1. 角色等级 >= 技能解锁等级（`unlockLevel`）
 * 2. 角色尚未学习该技能（防重复学习）
 *
 * @param skillTemplate - 要检查的技能模板
 * @param characterLevel - 角色当前等级
 * @param currentSkills - 角色已学技能列表
 * @returns `true` = 可以学习，`false` = 不满足条件
 *
 * @see learnSkill Store 中调用此函数进行学习前校验
 */
export function canLearnSkill(
  skillTemplate: Skill,
  characterLevel: number,
  currentSkills: Skill[]
): boolean {
  // 等级不足 → 不可学习
  if (skillTemplate.unlockLevel > characterLevel) return false;
  // 已学习 → 不可重复学习
  return !currentSkills.some(s => s.id === skillTemplate.id);
}

/**
 * 验证技能栏槽位索引是否有效
 *
 * 技能栏固定 4 个槽位（0-3），此函数提供运行时边界检查。
 *
 * @param slotIndex - 待校验的槽位索引
 * @returns `true` = 索引在 0-3 范围内
 *
 * @see SkillSlotIndex 编译时类型约束（字面量联合类型 0|1|2|3）
 * @see equipSkill Store 中调用此函数校验槽位
 */
export function validateSkillBarSlot(slotIndex: number): boolean {
  return slotIndex >= 0 && slotIndex <= 3;
}

/**
 * 检查技能是否已装备在技能栏中
 *
 * 遍历 4 个槽位检查是否存在目标技能 ID。用于 UI 层高亮已装备技能。
 *
 * @param skillBar - 当前技能栏状态
 * @param skillId - 待检查的技能 ID
 * @returns `true` = 已装备在某个槽位中
 */
export function isSkillEquipped(skillBar: SkillBar, skillId: string): boolean {
  return skillBar.slots.includes(skillId);
}

/**
 * 校验技能是否可施放（法力校验）
 *
 * 当前仅检查法力值是否足够。未来可扩展：冷却检查、沉默状态检查等。
 *
 * @param skill - 技能数据
 * @param currentMana - 角色当前法力值
 * @returns 包含校验结果的对象：
 *   - `canCast: true`  → 可以施放（`reason` 为空字符串）
 *   - `canCast: false` → 不可施放（`reason` 为失败原因描述）
 *
 * @see castSkill Store 中调用此函数进行施放前校验
 */
export function canCastSkill(
  skill: Skill,
  currentMana: number
): { canCast: boolean; reason: string } {
  if (currentMana < skill.mpCost) {
    return { canCast: false, reason: '法力不足' };
  }
  return { canCast: true, reason: '' };
}
