/**
 * @fileoverview 职业被动技能系统 Composable（Phase 5.2）
 *
 * 从 `src/data/class_passives.ts` 加载当前职业的被动技能，按触发时机执行。
 *
 * 设计要点：
 * 1. 被动技能在战斗开始时加载一次，缓存到 `passives` 数组
 * 2. 各触发时机对应一个公开方法（onCombatStart/onTurnStart/onAttack/onDamaged/onKill）
 * 3. 被动效果通过 effect.type 分发处理：
 *    - resource_gen：直接调用 resourceSystems.generate 生成资源
 *    - heal：on_attack 按伤害百分比吸血；on_turn_start/on_damaged/on_low_hp 按最大生命百分比治疗
 *    - stat_modifier：通过 getStatModifiers() 暴露给伤害管线与暴击判定（P3-146 已接入）
 *    - damage_reduction：通过 getDamageReduction() 暴露给 applyEnemyDamageToPlayer
 *    - buff：通过 applyBuff() 写入 EffectContainer（P3-146 已接入，如术士腐蚀术 DOT）
 *
 * 集成点：
 * - combatStore.startCombat：调用 passive.onCombatStart()
 * - combatStore.playerAction attack/skill：调用 passive.onAttack(damage, targetId)
 * - useEnemyAction.applyEnemyDamageToPlayer：调用 passive.onDamaged(amount)
 * - useInitiative.advanceToNextUnit：调用 passive.onTurnStart()
 * - combatStore.endCombat victory：调用 passive.onKill()
 *
 * @module combat/composables
 */
import type { PassiveSkill, PassiveEffect } from '@/modules/character/types';
import { configCache } from '@/modules/config';
import type { ICombatContext } from '../combatContext';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';
import { defaultRng, type Rng } from '@/utils/rng';
import { LOW_HP_PASSIVE_THRESHOLD } from '@/config/combat';
import {
  addEffectToContainer,
  createEmptyContainer,
  generateEffectId,
  type Effect,
  type EffectType,
} from '../effects';

/**
 * 被动触发上下文
 *
 * @property damage - 触发伤害值（吸血计算使用）
 * @property targetEnemyId - 当前攻击目标敌人 ID（buff 类被动对敌人施加效果使用）
 */
interface PassiveTriggerContext {
  damage?: number;
  targetEnemyId?: string;
}

export function usePassiveSkills(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  // ARCH-6：需完整上下文（读 character.classId/name/hp/maxHp/mana/maxMana；写 character.receiveHeal）
  ctx: ICombatContext,
  // P3-171：注入 RNG，替代 Math.random()，支持测试确定性回放
  rng: Rng = defaultRng
) {
  // P3-83 修复：直接解构，无需多余的中间对象
  // P3-146：增加 createPlayerEffectContext/createEnemyEffectContext 用于 buff 接入容器
  const { addCombatLog, createEnemyEffectContext } = log;
  const { resourceSystems, enemyEffects, effectRegistry } = state;

  /** 当前职业的被动技能列表（战斗开始时加载） */
  let passives: PassiveSkill[] = [];

  /**
   * 加载当前职业的被动技能
   * 应在 startCombat 中调用
   */
  async function loadPassives(): Promise<void> {
    await configCache.loadPassives();
    passives = configCache.getPassivesByClassId(ctx.character.classId);
  }

  /**
   * 战斗开始时触发的被动
   */
  function onCombatStart(): void {
    passives
      .filter(p => p.trigger === 'on_combat_start')
      .forEach(p => applyPassive(p));
  }

  /**
   * 玩家回合开始时触发的被动
   */
  function onTurnStart(): void {
    passives
      .filter(p => p.trigger === 'on_turn_start')
      .forEach(p => applyPassive(p));

    // 低血量被动在回合开始时也检查一次
    checkLowHpPassives();
  }

  /**
   * 玩家攻击命中后触发的被动
   * @param damage - 本次攻击造成的伤害值（用于吸血计算）
   * @param targetEnemyId - 当前攻击目标敌人 ID（P3-146：buff 类被动对敌人施加效果使用）
   */
  function onAttack(damage: number, targetEnemyId?: string): void {
    passives
      .filter(p => p.trigger === 'on_attack')
      .forEach(p => applyPassive(p, { damage, targetEnemyId }));

    // 攻击后可能血量变化（吸血），不触发低血量
  }

  /**
   * 玩家受伤后触发的被动
   * @param amount - 受到的伤害值
   */
  function onDamaged(amount: number): void {
    passives
      .filter(p => p.trigger === 'on_damaged')
      .forEach(p => applyPassive(p, { damage: amount }));

    // 受伤后检查低血量被动
    checkLowHpPassives();
  }

  /**
   * 击杀敌人后触发的被动
   */
  function onKill(): void {
    passives
      .filter(p => p.trigger === 'on_kill')
      .forEach(p => applyPassive(p));
  }

  /**
   * 检查并触发低血量被动（生命低于 LOW_HP_PASSIVE_THRESHOLD）
   */
  function checkLowHpPassives(): void {
    const hpRatio = ctx.character.hp / ctx.character.maxHp;
    // P9-070 修复：魔法数字 0.3 提取为配置常量 LOW_HP_PASSIVE_THRESHOLD
    if (hpRatio < LOW_HP_PASSIVE_THRESHOLD) {
      passives
        .filter(p => p.trigger === 'on_low_hp')
        .forEach(p => applyPassive(p));
    }
  }

  /**
   * 应用被动效果（内部核心方法）
   * @param passive - 被动技能数据
   * @param context - 触发上下文（含伤害值、目标敌人 ID 等信息）
   */
  function applyPassive(passive: PassiveSkill, context?: PassiveTriggerContext): void {
    // 概率检查：probability 仅对即时触发型效果生效（resource_gen/heal/buff）
    // stat_modifier/damage_reduction 不经过 applyPassive 实时触发，不受此字段影响
    const { probability } = passive.effect;
    if (probability !== undefined && probability < 1) {
      if (!rng.bool(probability)) {
        return; // 未触发，静默跳过
      }
    }

    // 记录被动触发日志
    addCombatLog({
      actorType: 'system',
      actorId: 'player',
      actorName: ctx.character.name,
      eventType: 'passive_trigger',
      isCrit: false,
      isDodge: false,
      message: `触发被动：${passive.name}`,
    });

    const effect = passive.effect;
    switch (effect.type) {
      case 'resource_gen':
        applyResourceGen(effect);
        break;
      case 'heal':
        applyHeal(effect, context, passive.trigger);
        break;
      case 'stat_modifier':
        // P3-146：stat_modifier 已通过 getStatModifiers() 接入伤害管线与暴击判定，
        // 此处仅记录日志（条件评估在 getStatModifiers 中实时计算）
        applyStatModifier(effect);
        break;
      case 'damage_reduction':
        // damage_reduction 通过 getDamageReduction() 暴露给 applyEnemyDamageToPlayer
        // 此处仅记录日志
        applyDamageReduction(effect);
        break;
      case 'buff':
        // P3-146：buff 类被动转换为 effect 写入对应容器（如术士腐蚀术 DOT）
        // P8-105 修复：传入 passive.name 作为 sourceName，避免硬编码
        applyBuff(effect, context, passive.name);
        break;
    }
  }

  /**
   * 应用资源生成效果
   * 直接调用对应资源系统的 generate 方法
   */
  function applyResourceGen(effect: PassiveEffect): void {
    const resourceType = effect.stat;
    const amount = effect.value;
    if (!resourceType || amount <= 0) return;

    // 遍历当前战斗中的资源系统，找到匹配类型的系统并生成资源
    resourceSystems.value.forEach(sys => {
      if (sys.type === resourceType) {
        // P2-43 修复：被动资源生成使用 'passive' 来源，不受 skill 上限限制
        sys.generate(amount, 'passive');
      }
    });
  }

  /**
   * 应用治疗效果
   * - on_attack 触发：按造成伤害的百分比吸血
   * - on_turn_start/on_damaged/on_low_hp 触发：按最大生命百分比治疗
   */
  function applyHeal(effect: PassiveEffect, context: PassiveTriggerContext | undefined, trigger: string): void {
    const amount = effect.value;
    if (amount <= 0) return;

    let healAmount: number;
    // P8-101 修复：仅 on_attack 走吸血分支（按伤害百分比），其余触发按最大生命百分比治疗
    if (trigger === 'on_attack' && context?.damage && context.damage > 0) {
      // 攻击吸血：按伤害百分比
      healAmount = Math.floor(context.damage * amount);
    } else {
      // 百分比最大生命治疗
      healAmount = Math.floor(ctx.character.maxHp * amount);
    }

    if (healAmount > 0) {
      ctx.character.receiveHeal(healAmount);
      addCombatLog({
        actorType: 'system',
        actorId: 'player',
        actorName: ctx.character.name,
        eventType: 'combat_heal',
        isCrit: false,
        isDodge: false,
        heal: healAmount,
        message: `恢复 ${healAmount} 点生命`,
      });
    }
  }

  /**
   * 应用属性修正效果（BIZ-5）
   *
   * stat_modifier 效果通过 getStatModifiers() 方法暴露给战斗计算管线，
   * 在伤害计算和暴击判定时读取并应用。此处仅记录日志。
   */
  function applyStatModifier(effect: PassiveEffect): void {
    if (effect.stat) {
      addCombatLog({
        actorType: 'system',
        actorId: 'player',
        actorName: ctx.character.name,
        eventType: 'passive_effect',
        isCrit: false,
        isDodge: false,
        message: `属性修正：${effect.stat} +${Math.round(effect.value * 100)}%`,
      });
    }
  }

  /**
   * 应用减伤效果（BIZ-5）
   *
   * damage_reduction 效果通过 getDamageReduction() 方法暴露给伤害管线，
   * 在 applyEnemyDamageToPlayer 中读取并应用。此处仅记录日志。
   */
  function applyDamageReduction(effect: PassiveEffect): void {
    addCombatLog({
      actorType: 'system',
      actorId: 'player',
      actorName: ctx.character.name,
      eventType: 'passive_effect',
      isCrit: false,
      isDodge: false,
      message: `减伤生效：受到伤害 -${Math.round(effect.value * 100)}%`,
    });
  }

  /**
   * 应用 buff 效果（P3-146 接入 EffectContainer）
   *
   * 根据 effect.target 与 effect.stat 将 buff 转换为对应 Effect 写入容器：
   * - `target='enemy'` + `stat='corruption_dot'`：对当前攻击目标施加 poison 效果（DOT）
   *   value 解释为按本次伤害百分比的额外 DOT 伤害（如 0.05 = 5% 本次伤害作为 poison value）
   * - `target='self'`：暂未配置此类被动，预留扩展点
   *
   * 写入容器后会调用对应 handler.onApply，与技能 buff 流程一致。
   *
   * @param effect  - 被动 effect 数据
   * @param context - 触发上下文（需含 targetEnemyId 才能对敌人施加效果）
   */
  function applyBuff(effect: PassiveEffect, context?: PassiveTriggerContext, passiveName?: string): void {
    if (effect.target === 'enemy') {
      // 敌方目标 buff：必须有 targetEnemyId 才能施加
      const targetId = context?.targetEnemyId;
      if (!targetId) {
        addCombatLog({
          actorType: 'system', actorId: 'player', actorName: ctx.character.name,
          eventType: 'passive_effect', isCrit: false, isDodge: false,
          message: `附加效果失败：未指定目标敌人（${effect.stat || '未知'}）`,
        });
        return;
      }

      // 确保敌人容器存在
      if (!enemyEffects.value[targetId]) {
        enemyEffects.value[targetId] = createEmptyContainer();
      }
      const container = enemyEffects.value[targetId]!;
      const enemy = ctx.enemy.getEnemyById(targetId);
      if (!enemy) return;
      const effectCtx = createEnemyEffectContext(enemy);

      // 按 stat 映射为 EffectType：corruption_dot → poison（持续伤害）
      const effectType = mapBuffStatToEffectType(effect.stat);
      if (!effectType) {
        addCombatLog({
          actorType: 'system', actorId: 'player', actorName: ctx.character.name,
          eventType: 'passive_effect', isCrit: false, isDodge: false,
          message: `附加效果未识别：${effect.stat || '未知'}`,
        });
        return;
      }

      // value 语义：按本次伤害百分比转换为 DOT 数值（与腐蚀术设计一致）
      // 若无 damage 上下文（如 on_combat_start 触发），用 1 作为最小值避免 0 DOT
      const baseDamage = context?.damage && context.damage > 0 ? context.damage : 1;
      const dotValue = Math.max(1, Math.floor(baseDamage * effect.value));

      const newEffect: Effect = {
        id: generateEffectId(),
        type: effectType,
        remainingTurns: effect.turns ?? 3,  // P3-184：从 PassiveEffect.turns 读取，默认 3
        value: dotValue,
        source: 'passive',
        // P8-105 修复：使用传入的 passiveName 替代硬编码 '被动：腐蚀术'
        sourceName: passiveName || '被动效果',
      };
      addEffectToContainer(container, newEffect, effectRegistry);
      effectRegistry.get(effectType)?.onApply?.(newEffect, effectCtx);

      addCombatLog({
        actorType: 'system', actorId: 'player', actorName: ctx.character.name,
        eventType: 'passive_effect', isCrit: false, isDodge: false,
        targetType: 'enemy', targetId, targetName: enemy.name,
        message: `附加效果：${effect.stat} 对 ${enemy.name} 造成持续伤害（${dotValue}/回合）`,
      });
      return;
    }

    // target === 'self'：自身 buff（暂未配置此类被动，预留扩展点）
    addCombatLog({
      actorType: 'system', actorId: 'player', actorName: ctx.character.name,
      eventType: 'passive_effect', isCrit: false, isDodge: false,
      message: `附加效果：${effect.stat || '未知'} ${Math.round(effect.value * 100)}%`,
    });
  }

  /**
   * 将被动 buff 的 stat 字段映射为 EffectType
   *
   * P3-146：目前仅支持 `corruption_dot` → `poison`（持续伤害）。
   * 后续新增 buff 类被动时在此扩展映射。
   */
  function mapBuffStatToEffectType(stat: string | undefined): EffectType | undefined {
    if (stat === 'corruption_dot') return 'poison';
    return undefined;
  }

  // ==================== 战斗计算接入方法（BIZ-5） ====================

  /**
   * 评估条件表达式
   *
   * 支持简单格式如 'hp < 0.3'，比较角色当前 HP 百分比与阈值。
   * 扩展支持 'target_hp < 0.2'，比较目标敌人 HP 百分比（需传入 targetId）。
   *
   * @param condition - 条件表达式字符串
   * @param targetId  - 可选目标敌人 ID（用于 target_hp 条件评估）
   * @returns 是否满足条件
   */
  function evaluateCondition(condition: string, targetId?: string): boolean {
    const match = condition.match(/(\w+)\s*([<>=!]+)\s*([\d.]+)/);
    if (!match) return true;
    const [, stat, op, valueStr] = match;
    const value = parseFloat(valueStr);
    let currentValue = 0;
    if (stat === 'hp') {
      currentValue = ctx.character.hp / ctx.character.maxHp;
    } else if (stat === 'mp') {
      // P1-9 修复：扩展支持 mp 属性条件判断
      currentValue = ctx.character.maxMana > 0 ? ctx.character.mana / ctx.character.maxMana : 0;
    } else if (stat === 'target_hp') {
      // 目标敌人生命百分比条件（如 'target_hp < 0.2' 用于战士斩杀本能）
      if (!targetId) return false;
      const target = ctx.enemy.getEnemyById(targetId);
      if (!target || target.maxHp <= 0) return false;
      currentValue = target.hp / target.maxHp;
    } else {
      // P1-9 修复：未知 stat 返回 false，避免基于初始值 0 误判（如 mp < 0.3 变成 0 < 0.3 = true）
      return false;
    }
    switch (op) {
      case '<': return currentValue < value;
      case '<=': return currentValue <= value;
      case '>': return currentValue > value;
      case '>=': return currentValue >= value;
      case '==': return currentValue === value;
      case '!=': return currentValue !== value;
      default: return true;
    }
  }

  /**
   * 获取当前应激活的减伤比例（BIZ-5）
   *
   * 检查所有 damage_reduction 类型的被动，满足条件时返回减伤比例。
   * 多个减伤效果取最大值（不叠加）。
   *
   * @returns 减伤比例（0-1，如 0.2 表示减伤 20%）
   */
  function getDamageReduction(): number {
    let maxReduction = 0;
    for (const p of passives) {
      if (p.effect.type !== 'damage_reduction') continue;
      if (p.effect.condition && !evaluateCondition(p.effect.condition)) continue;
      maxReduction = Math.max(maxReduction, p.effect.value);
    }
    return maxReduction;
  }

  /**
   * 获取当前激活的属性修正列表（BIZ-5）
   *
   * 返回所有满足条件的 stat_modifier 被动效果，供伤害计算和暴击判定使用。
   * 传入 targetId 后，含 'target_hp' 条件的被动会按目标敌人生命百分比评估。
   *
   * @param targetId - 可选目标敌人 ID（用于 target_hp 条件评估，AOE 场景应按每个目标传入）
   * @returns 属性修正数组（含 stat 和 value）
   */
  function getStatModifiers(targetId?: string): Array<{ stat: string; value: number }> {
    const result: Array<{ stat: string; value: number }> = [];
    for (const p of passives) {
      if (p.effect.type !== 'stat_modifier') continue;
      if (p.effect.condition && !evaluateCondition(p.effect.condition, targetId)) continue;
      if (p.effect.stat) {
        result.push({ stat: p.effect.stat, value: p.effect.value });
      }
    }
    return result;
  }

  return {
    loadPassives,
    onCombatStart,
    onTurnStart,
    onAttack,
    onDamaged,
    onKill,
    /** 获取当前已加载的被动列表（供 UI 或调试使用） */
    getPassives: () => passives,
    /** BIZ-5：获取当前减伤比例（供 applyEnemyDamageToPlayer 调用） */
    getDamageReduction,
    /** BIZ-5：获取当前激活的属性修正列表（供伤害计算和暴击判定使用） */
    getStatModifiers,
  };
}
