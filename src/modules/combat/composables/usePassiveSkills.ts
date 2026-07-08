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
 *    - stat_modifier/damage_reduction/buff：记录日志，实际效果由战斗计算管线预留扩展点支持
 *
 * 集成点：
 * - combatStore.startCombat：调用 passive.onCombatStart()
 * - combatStore.playerAction attack/skill：调用 passive.onAttack(damage)
 * - useEnemyAction.applyEnemyDamageToPlayer：调用 passive.onDamaged(amount)
 * - useInitiative.advanceToNextUnit：调用 passive.onTurnStart()
 * - combatStore.endCombat victory：调用 passive.onKill()
 *
 * @module combat/composables
 */
import type { PassiveSkill, PassiveEffect } from '@/modules/character/types';
import type { ResourceSource } from '../resources/types';
import { getPassivesByClassId } from '@/data/config_class_passives';
import { useCharacterStore } from '@/modules/character/store';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';

export function usePassiveSkills(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>
) {
  const characterStore = useCharacterStore();
  const { addCombatLog, resourceSystems } = { addCombatLog: log.addCombatLog, resourceSystems: state.resourceSystems };

  /** 当前职业的被动技能列表（战斗开始时加载） */
  let passives: PassiveSkill[] = [];

  /**
   * 加载当前职业的被动技能
   * 应在 startCombat 中调用
   */
  function loadPassives(): void {
    passives = getPassivesByClassId(characterStore.classId);
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
   */
  function onAttack(damage: number): void {
    passives
      .filter(p => p.trigger === 'on_attack')
      .forEach(p => applyPassive(p, { damage }));

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
   * 检查并触发低血量被动（生命低于 30%）
   */
  function checkLowHpPassives(): void {
    const hpRatio = characterStore.hp / characterStore.maxHp;
    if (hpRatio < 0.3) {
      passives
        .filter(p => p.trigger === 'on_low_hp')
        .forEach(p => applyPassive(p));
    }
  }

  /**
   * 应用被动效果（内部核心方法）
   * @param passive - 被动技能数据
   * @param context - 触发上下文（含伤害值等信息）
   */
  function applyPassive(passive: PassiveSkill, context?: { damage?: number }): void {
    // 记录被动触发日志
    addCombatLog({
      actorType: 'system',
      actorId: 'player',
      actorName: characterStore.name,
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
        applyHeal(effect, context);
        break;
      case 'stat_modifier':
        // 属性修正效果由战斗计算管线预留扩展点支持
        // 当前仅记录日志，实际效果待战斗计算模块扩展 stat_modifier_hooks 后自动生效
        applyStatModifier(effect);
        break;
      case 'damage_reduction':
        // 减伤效果由伤害管线预留扩展点支持
        // 当前仅记录日志，实际效果待 processDamagePipeline 扩展后自动生效
        applyDamageReduction(effect);
        break;
      case 'buff':
        // buff 效果由效果系统预留扩展点支持
        // 当前仅记录日志，实际效果待效果系统扩展后自动生效
        applyBuff(effect);
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
        sys.generate(amount, 'skill' as ResourceSource);
      }
    });
  }

  /**
   * 应用治疗效果
   * - on_attack 触发：按造成伤害的百分比吸血
   * - on_turn_start/on_damaged/on_low_hp 触发：按最大生命百分比治疗
   */
  function applyHeal(effect: PassiveEffect, context?: { damage?: number }): void {
    const amount = effect.value;
    if (amount <= 0) return;

    let healAmount: number;
    if (context?.damage && context.damage > 0) {
      // 攻击吸血：按伤害百分比
      healAmount = Math.floor(context.damage * amount);
    } else {
      // 百分比最大生命治疗
      healAmount = Math.floor(characterStore.maxHp * amount);
    }

    if (healAmount > 0) {
      characterStore.receiveHeal(healAmount);
      addCombatLog({
        actorType: 'system',
        actorId: 'player',
        actorName: characterStore.name,
        eventType: 'combat_heal',
        isCrit: false,
        isDodge: false,
        heal: healAmount,
        message: `恢复 ${healAmount} 点生命`,
      });
    }
  }

  /**
   * 应用属性修正效果（预留扩展点）
   *
   * 当前仅记录日志。实际属性修正需要战斗计算管线支持：
   * - 在 calculatePhysicalAttack / calculateMagicAttack 等函数中
   *   查询已激活的 stat_modifier 被动并叠加
   * - 或在 EffectContext 中注入 passive_modifiers 字段
   *
   * 待扩展点：在 useCombatState 中添加 `activePassiveModifiers` 状态，
   * 战斗计算函数读取该状态应用修正。
   */
  function applyStatModifier(effect: PassiveEffect): void {
    // 预留扩展点：实际属性修正逻辑待战斗计算管线扩展后实现
    // 当前通过日志记录被动已触发，便于调试和验证
    if (effect.stat) {
      addCombatLog({
        actorType: 'system',
        actorId: 'player',
        actorName: characterStore.name,
        eventType: 'passive_effect',
        isCrit: false,
        isDodge: false,
        message: `属性修正：${effect.stat} +${Math.round(effect.value * 100)}%`,
      });
    }
  }

  /**
   * 应用减伤效果（预留扩展点）
   *
   * 当前仅记录日志。实际减伤需要 processDamagePipeline 扩展：
   * - 在伤害管线中查询玩家已激活的 damage_reduction 被动
   * - 满足条件（如 hp < 0.3）时按 value 百分比减少最终伤害
   *
   * 待扩展点：在 useEnemyAction.applyEnemyDamageToPlayer 中
   * 调用 passive.getDamageReductionMultiplier() 获取减伤系数。
   */
  function applyDamageReduction(effect: PassiveEffect): void {
    addCombatLog({
      actorType: 'system',
      actorId: 'player',
      actorName: characterStore.name,
      eventType: 'passive_effect',
      isCrit: false,
      isDodge: false,
      message: `减伤生效：受到伤害 -${Math.round(effect.value * 100)}%`,
    });
  }

  /**
   * 应用 buff 效果（预留扩展点）
   *
   * 当前仅记录日志。实际 buff 需要效果系统扩展：
   * - 在 EffectRegistry 中注册被动产生的 buff 效果
   * - 战斗计算时查询玩家的 buff 列表
   *
   * 待扩展点：在 effectRegistry 中添加 addPassiveBuff 方法。
   */
  function applyBuff(effect: PassiveEffect): void {
    addCombatLog({
      actorType: 'system',
      actorId: 'player',
      actorName: characterStore.name,
      eventType: 'passive_effect',
      isCrit: false,
      isDodge: false,
      message: `附加效果：${effect.stat || '未知'} ${Math.round(effect.value * 100)}%`,
    });
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
  };
}
