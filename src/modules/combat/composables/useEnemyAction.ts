/**
 * 敌人行动 Composable
 * 
 * 从 combat store 提取的敌人 AI 策略、伤害施加、攻击和行动决策逻辑。
 * 依赖 useCombatState() 和 useCombatLog() 返回的状态对象。
 */
import type { CombatActionResult } from '../types';
import type { EnemyInstance } from '../../enemy/types';
import type { BattleContext, IAiStrategy } from '../ai/types';
import type { AiStrategyType } from '../../enemy/types';
import type { ICombatContext } from '../combatContext';
import { eventBus, GameEvents } from '../../bus';
import { rollDodge } from '../service';
import { AggressiveStrategy, DefensiveStrategy, BalancedStrategy, BossPhaseStrategy } from '../ai/strategies';
import {
  createEmptyContainer,
  addEffectToContainer,
  generateEffectId,
  processDamagePipeline,
  type Effect,
  type EffectType,
  type DamageType,
} from '../effects';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';
import type { usePassiveSkills } from './usePassiveSkills';

/**
 * 根据敌人技能 type 字段映射到伤害类型
 * @param skillType - 技能类型（physical_damage/magic_damage 等），未提供时默认物理
 * @returns 伤害类型：魔法技能返回 'magical'，其他返回 'physical'
 */
function mapSkillTypeToDamageType(skillType?: string): DamageType {
  if (skillType === 'magic_damage') return 'magical';
  return 'physical';
}

export function useEnemyAction(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  ctx: ICombatContext,
  passive?: ReturnType<typeof usePassiveSkills>
) {
  const { addCombatLog, createPlayerEffectContext, createEnemyEffectContext } = log;
  const { playerEffects, enemyEffects, effectRegistry, resourceSystems } = state;

  // ==================== AI 策略 ====================

  /** AI 策略注册表 */
  const strategyRegistry: Record<AiStrategyType, IAiStrategy> = {
    aggressive: new AggressiveStrategy(),
    defensive: new DefensiveStrategy(),
    balanced: new BalancedStrategy(),
    boss_phase: new BossPhaseStrategy(),
  };

  /**
   * 根据策略类型获取 AI 策略实例
   */
  function getStrategy(type: AiStrategyType): IAiStrategy {
    return strategyRegistry[type] || strategyRegistry.balanced;
  }

  // ==================== 敌人行动 ====================

  /**
   * 对玩家造成敌人伤害（公共逻辑：管线计算 → 扣血 → 事件 → 日志 → 荆棘）
   * 使用 processDamagePipeline 统一处理伤害、护盾和荆棘反伤。
   * @param damageType - 伤害类型（默认 'physical'，魔法技能应传入 'magical'）
   * @returns actualDamage 和 shieldAbsorbed，供调用方补充返回值
   */
  function applyEnemyDamageToPlayer(
    e: EnemyInstance,
    rawDamage: number,
    skill?: { id: string; name: string },
    damageType: DamageType = 'physical'
  ): { actualDamage: number; shieldAbsorbed: number } {
    const attackerCtx = createEnemyEffectContext(e);
    const defenderCtx = createPlayerEffectContext();

    const pipeResult = processDamagePipeline(
      effectRegistry,
      enemyEffects.value[e.id] || createEmptyContainer(),
      playerEffects.value,
      attackerCtx,
      defenderCtx,
      damageType,
      rawDamage
    );

    const actualDamage = pipeResult.finalDamage;
    const shieldAbsorbed = pipeResult.absorbed;

    // BIZ-5：应用被动减伤效果（如战士钢铁意志：低血减伤 20%）
    const damageReduction = passive?.getDamageReduction() || 0;
    const finalDamage = damageReduction > 0
      ? Math.floor(actualDamage * (1 - damageReduction))
      : actualDamage;

    // 扣血
    ctx.character.takeDamage(finalDamage);

    // 玩家受伤时触发资源系统 onDamaged 钩子（如战士怒气获取）
    if (actualDamage > 0) {
      resourceSystems.value.forEach(sys => sys.onDamaged?.(actualDamage));
      // 触发被动技能 onDamaged 钩子（如影刃猎手复仇：受伤恢复生命）
      passive?.onDamaged(actualDamage);
    }

    // 伤害事件
    eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
      amount: rawDamage,
      damageType: 'physical',
      targetName: ctx.character.name,
      actorType: 'enemy'
    });

    // 战斗日志
    addCombatLog({
      actorType: 'enemy',
      actorId: e.id,
      actorName: e.name,
      eventType: skill ? 'combat_skill_cast' : 'combat_damage',
      targetType: 'player',
      targetId: 'player',
      targetName: ctx.character.name,
      ...(skill ? { skillId: skill.id, skillName: skill.name } : {}),
      damage: finalDamage,
      isCrit: false,
      isDodge: false,
      message: shieldAbsorbed > 0
        ? `${e.name}${skill ? ' 使用 ' + skill.name : ''}对 ${ctx.character.name} 造成 ${finalDamage} 点伤害（护盾吸收 ${shieldAbsorbed}）！`
        : `${e.name}${skill ? ' 使用 ' + skill.name : ''}对 ${ctx.character.name} 造成 ${finalDamage} 点伤害！`
    });

    // 荆棘反伤（管线已计算）
    if (pipeResult.thorns > 0) {
      ctx.enemy.takeDamage(e.id, pipeResult.thorns);
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: ctx.character.name,
        eventType: 'combat_damage',
        targetType: 'enemy',
        targetId: e.id,
        targetName: e.name,
        damage: pipeResult.thorns,
        isCrit: false,
        isDodge: false,
        message: `荆棘反伤对 ${e.name} 造成 ${pipeResult.thorns} 点伤害！`
      });
    }

    return { actualDamage: finalDamage, shieldAbsorbed };
  }

  /**
   * 敌人普通攻击（内部方法）
   * @param e - 执行攻击的敌人
   */
  function enemyBasicAttack(e: EnemyInstance): CombatActionResult {
    // 计算伤害
    const damage = ctx.enemy.calculateDamage(e, ctx.character.attributes.physicalDefense);

    // 检查玩家闪避
    const dodgeChance = ctx.character.attributes.dodgeChance / 100;
    const isDodge = rollDodge(dodgeChance);

    if (isDodge) {
      addCombatLog({
        actorType: 'enemy',
        actorId: e.id,
        actorName: e.name,
        eventType: 'combat_miss',
        targetType: 'player',
        targetId: 'player',
        targetName: ctx.character.name,
        isCrit: false,
        isDodge: true,
        message: `${e.name} 的攻击被 ${ctx.character.name} 闪避了！`
      });

      eventBus.emit(GameEvents.COMBAT_DODGE, {
        attackerName: e.name,
        dodgerName: ctx.character.name,
        dodgerType: 'player'
      });

      return {
        success: true,
        type: 'attack',
        isDodge: true,
        message: '你闪避了敌人的攻击！'
      };
    }

    const { actualDamage } = applyEnemyDamageToPlayer(e, damage);

    return {
      success: true,
      type: 'attack',
      damage: actualDamage,
      message: `${e.name} 对你造成 ${actualDamage} 点伤害！`
    };
  }

  /**
   * 敌人使用技能攻击（内部方法）
   * @param damage - 技能伤害值
   * @param skill - 技能信息（含可选 type 字段，用于决定伤害类型）
   * @param e - 执行攻击的敌人
   */
  function enemyAttackWithSkill(damage: number, skill: { id: string; name: string; type?: string }, e: EnemyInstance): CombatActionResult {
    // 检查玩家闪避
    const dodgeChance = ctx.character.attributes.dodgeChance / 100;
    const isDodge = rollDodge(dodgeChance);

    if (isDodge) {
      addCombatLog({
        actorType: 'enemy',
        actorId: e.id,
        actorName: e.name,
        eventType: 'combat_miss',
        targetType: 'player',
        targetId: 'player',
        targetName: ctx.character.name,
        skillId: skill.id,
        skillName: skill.name,
        isCrit: false,
        isDodge: true,
        message: `${e.name} 的 ${skill.name} 被 ${ctx.character.name} 闪避了！`
      });

      eventBus.emit(GameEvents.COMBAT_DODGE, {
        attackerName: e.name,
        dodgerName: ctx.character.name,
        dodgerType: 'player'
      });

      return {
        success: true,
        type: 'skill',
        isDodge: true,
        message: '你闪避了敌人的技能！'
      };
    }

    // 通过管线计算实际伤害（管线统一处理攻防修正、护盾和荆棘）
    // 根据技能类型动态决定伤害类型（魔法技能走魔法防御减免）
    const damageType = mapSkillTypeToDamageType(skill.type);
    const { actualDamage } = applyEnemyDamageToPlayer(e, damage, skill, damageType);

    return {
      success: true,
      type: 'skill',
      damage: actualDamage,
      message: `${e.name} 使用 ${skill.name}，对你造成 ${actualDamage} 点伤害！`
    };
  }

  /**
   * 敌人行动（内部方法，使用 AI 策略模式决定行动）
   * @param e - 执行行动的敌人
   */
  function enemyAction(e: EnemyInstance): CombatActionResult {
    if (state.state.value !== 'fighting') {
      return { success: false, type: 'attack', message: '战斗已结束' };
    }

    // 检查 Boss 多目标攻击标记
    const isAoeAttack = e.aoeNextAttack === true;
    if (isAoeAttack) {
      e.aoeNextAttack = false;
      // 多目标攻击：使用管线统一处理伤害、护盾和荆棘反伤
      const rawDamage = ctx.enemy.calculateDamage(e, ctx.character.attributes.physicalDefense);
      const aoeMultiplier = 1.3;
      const aoeDamage = Math.round(rawDamage * aoeMultiplier);

      // 检查玩家闪避
      const dodgeChance = ctx.character.attributes.dodgeChance / 100;
      const isDodge = rollDodge(dodgeChance);

      if (isDodge) {
        addCombatLog({
          actorType: 'enemy', actorId: e.id, actorName: e.name,
          eventType: 'combat_miss', targetType: 'player', targetId: 'player',
          targetName: ctx.character.name, isCrit: false, isDodge: true,
          message: `${e.name} 的范围攻击被 ${ctx.character.name} 闪避了！`
        });
        eventBus.emit(GameEvents.COMBAT_DODGE, {
          attackerName: e.name, dodgerName: ctx.character.name, dodgerType: 'player'
        });
        return { success: true, type: 'attack', isDodge: true, message: '你闪避了敌人的范围攻击！' };
      }

      // 通过管线统一处理伤害（含护盾吸收 + 荆棘反伤 + 攻防修正 + 日志）
      const { actualDamage: actualAoeDamage } = applyEnemyDamageToPlayer(e, aoeDamage);

      // 补充 AOE 特殊日志
      addCombatLog({
        actorType: 'system', actorId: 'system', actorName: '系统',
        eventType: 'combat_event', isCrit: false, isDodge: false,
        message: `${e.name} 发动范围攻击，对 ${ctx.character.name} 造成 ${actualAoeDamage} 点伤害！`
      });

      return {
        success: true, type: 'attack', damage: actualAoeDamage,
        message: `${e.name} 发动了范围攻击！`
      };
    }

    // 获取敌人可用技能
    const availableSkills = ctx.enemy.getAvailableSkills(e.id);

    // 构建战斗上下文
    const context: BattleContext = {
      playerHp: ctx.character.hp,
      playerMaxHp: ctx.character.maxHp,
      enemyHp: e.hp,
      enemyMaxHp: e.maxHp,
      availableSkills,
      turnCount: state.turnCount.value,
    };

    // 根据敌人 AI 策略类型选择策略
    const strategy = getStrategy(e.aiStrategy || 'balanced');
    const decision = strategy.decideAction(e, context);

    switch (decision.type) {
      case 'skill': {
        const result = ctx.enemy.useSkill(e.id, decision.skillId);
        if (result.success) {
          if (result.isHeal) {
            // 敌人恢复生命值
            const updatedEnemy = ctx.enemy.getEnemyById(e.id);
            if (!updatedEnemy) {
              return { success: false, type: 'skill', message: '找不到敌人数据' };
            }

            addCombatLog({
              actorType: 'enemy',
              actorId: updatedEnemy.id,
              actorName: updatedEnemy.name,
              eventType: 'combat_heal',
              skillId: decision.skillId,
              skillName: decision.skillId,
              heal: result.damage,
              isCrit: false,
              isDodge: false,
              message: `${updatedEnemy.name} 恢复生命值 (+${Math.abs(result.damage)})！`
            });

            return {
              success: true,
              type: 'skill',
              heal: result.damage,
              message: `${e.name} 恢复了生命值 (+${Math.abs(result.damage)})！`
            };
          } else if (result.isBuff && result.buffs) {
            // 敌人使用 buff/debuff 技能：区分自身增益（buff）和对玩家减益（debuff）
            const skillData = availableSkills.find(s => s.id === decision.skillId);
            const skillName = skillData?.name || decision.skillId;
            // 通过完整技能数据判断是否为减益技能
            const fullSkill = ctx.skill.getSkill(decision.skillId);
            const isDebuff = fullSkill?.type === 'debuff';

            if (isDebuff) {
              // 减益技能：效果施加到玩家身上
              const playerCtx = createPlayerEffectContext();
              for (const b of result.buffs) {
                const debuffEffect: Effect = {
                  id: generateEffectId(),
                  type: b.type as EffectType,
                  remainingTurns: b.turns,
                  value: b.value,
                  source: 'enemy',
                  sourceName: e.name
                };
                addEffectToContainer(playerEffects.value, debuffEffect);
                effectRegistry.get(debuffEffect.type as EffectType)?.onApply?.(debuffEffect, playerCtx);
              }

              addCombatLog({
                actorType: 'enemy',
                actorId: e.id,
                actorName: e.name,
                eventType: 'combat_skill_cast',
                skillId: decision.skillId,
                skillName,
                isCrit: false,
                isDodge: false,
                message: `${e.name} 使用了 ${skillName}，对 ${ctx.character.name} 施加了减益效果！`
              });

              return {
                success: true,
                type: 'skill',
                message: `${e.name} 使用了 ${skillName}！`
              };
            }

            // 增益技能：效果施加到敌人自身
            if (!enemyEffects.value[e.id]) {
              enemyEffects.value[e.id] = createEmptyContainer();
            }
            const container = enemyEffects.value[e.id]!;
            const enemyCtx = createEnemyEffectContext(e);

            for (const b of result.buffs) {
              const effect: Effect = {
                id: generateEffectId(),
                type: b.type as EffectType,
                remainingTurns: b.turns,
                value: b.value,
                source: 'enemy',
                sourceName: e.name
              };
              addEffectToContainer(container, effect);
              effectRegistry.get(effect.type as EffectType)?.onApply?.(effect, enemyCtx);
            }

            addCombatLog({
              actorType: 'enemy',
              actorId: e.id,
              actorName: e.name,
              eventType: 'combat_skill_cast',
              skillId: decision.skillId,
              skillName,
              isCrit: false,
              isDodge: false,
              message: `${e.name} 使用了 ${skillName}，获得增益效果！`
            });

            return {
              success: true,
              type: 'skill',
              message: `${e.name} 使用了 ${skillName}！`
            };
          } else {
            // 敌人使用攻击技能
            const skillData = availableSkills.find(s => s.id === decision.skillId);
            const fullSkill = ctx.skill.getSkill(decision.skillId);
            return enemyAttackWithSkill(
              result.damage,
              { id: decision.skillId, name: skillData?.name || decision.skillId, type: fullSkill?.type },
              e
            );
          }
        }
        break;
      }
      case 'heal': {
        const result = ctx.enemy.useSkill(e.id, decision.skillId);
        if (result.success) {
          const updatedEnemy = ctx.enemy.getEnemyById(e.id);
          if (!updatedEnemy) {
            return { success: false, type: 'skill', message: '找不到敌人数据' };
          }

          addCombatLog({
            actorType: 'enemy',
            actorId: updatedEnemy.id,
            actorName: updatedEnemy.name,
            eventType: 'combat_heal',
            skillId: decision.skillId,
            skillName: decision.skillId,
            heal: result.damage,
            isCrit: false,
            isDodge: false,
            message: `${updatedEnemy.name} 恢复生命值 (+${Math.abs(result.damage)})！`
          });

          return {
            success: true,
            type: 'skill',
            heal: result.damage,
            message: `${e.name} 恢复了生命值 (+${Math.abs(result.damage)})！`
          };
        }
        break;
      }
      case 'basic_attack':
      default:
        return enemyBasicAttack(e);
    }

    // 所有分支失败时的兜底
    return enemyBasicAttack(e);
  }

  return {
    applyEnemyDamageToPlayer,
    enemyBasicAttack,
    enemyAttackWithSkill,
    enemyAction,
    getStrategy,
  };
}
