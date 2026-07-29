/**
 * 玩家行动 Composable
 * 
 * 从 combat store 提取的玩家攻击、技能施放、物品使用、逃跑和掉落处理逻辑。
 * 依赖 useCombatState()、useCombatLog() 和 useInitiative() 返回的状态对象。
 */
import type { CombatActionResult, AoeHitInfo } from '../types';
import type { EnemyInstance } from '../../enemy/types';
import type { CombatResult } from '../types';
import type { ICombatContext } from '../combatContext';
import { eventBus, GameEvents } from '../../bus';
import { generateLogId } from '../../log/service';
import {
  rollCritical,
  rollDodge,
  calculateFleeChance,
  rollFleeSuccess,
} from '../service';
import {
  processDamagePipeline,
  createEmptyContainer,
  generateEffectId,
  addEffectToContainer,
  type Effect,
  type EffectType,
  type DamageType,
} from '../effects';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';
import type { useInitiative } from './useInitiative';
import type { usePassiveSkills } from './usePassiveSkills';

/** P3-1：AOE 技能对每个目标造成的伤害占面板值的比例（设计文档：AOE 每目标 70% 基础伤害） */
const AOE_DAMAGE_PENALTY = 0.7;

export function usePlayerAction(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  ctx: ICombatContext,
  initiative: ReturnType<typeof useInitiative>,
  endCombat: (result: CombatResult) => void,
  passive: ReturnType<typeof usePassiveSkills>,
) {
  // P3-82 修复说明：passive 参数为预留扩展点（未来玩家攻击触发 onAttack/onKill 被动钩子）。
  // 当前玩家行动不直接触发被动，被动触发集中在 useEnemyAction/useInitiative。
  // 保留参数而非移除，避免未来扩展时需修改函数签名和所有调用方。
  void passive;
  const { addCombatLog, saveLogs, createPlayerEffectContext, createEnemyEffectContext } = log;
  const { aliveEnemies, currentTarget, playerEffects, enemyEffects, effectRegistry, hasBossEnemy } = state;

  // ==================== 内部辅助：效果施加 ====================

  /**
   * 对单个敌人施加减益效果
   * @param e - 敌人实例
   * @param effects - 要施加的效果列表
   * @param sourceName - 技能名称（来源）
   */
  function applyDebuffToEnemy(e: EnemyInstance, effects: Array<{ type: string; value: number; turns: number }>, sourceName: string): void {
    // 确保该敌人有效果容器
    if (!enemyEffects.value[e.id]) {
      enemyEffects.value[e.id] = createEmptyContainer();
    }
    const container = enemyEffects.value[e.id]!;
    // P1-7 修复：重命名为 effectCtx，避免遮蔽外层 usePlayerAction 参数 ctx: ICombatContext
    const effectCtx = createEnemyEffectContext(e);

    for (const be of effects) {
      const effect: Effect = {
        id: generateEffectId(),
        type: be.type as EffectType,
        remainingTurns: be.turns,
        value: be.value,
        source: 'skill',
        sourceName
      };
      addEffectToContainer(container, effect);
      // 调用 handler.onApply 触发效果施加回调
      effectRegistry.get(effect.type)?.onApply?.(effect, effectCtx);
    }
  }

  /**
   * 根据技能 buffs 配置和目标类型施加效果（用于附带效果的伤害技能）
   * @param skill - 技能数据
   * @param targetType - 目标类型
   */
  function applySkillBuffs(
    skill: { name: string; buffs?: Array<{ type: string; value: number; turns: number }> },
    targetType: string
  ): void {
    if (!skill.buffs || skill.buffs.length === 0) return;

    const sourceName = skill.name;
    const isSelfBuff = skill.buffs.some(b =>
      ['attack_up', 'defense_up', 'speed_up', 'regen', 'shield', 'thorn'].includes(b.type)
    );

    if (isSelfBuff || targetType === 'self') {
      // 自身增益：应用到玩家
      const playerCtx = createPlayerEffectContext();
      for (const be of skill.buffs) {
        if (['attack_up', 'defense_up', 'speed_up', 'regen', 'shield', 'thorn'].includes(be.type)) {
          const effect: Effect = {
            id: generateEffectId(),
            type: be.type as EffectType,
            remainingTurns: be.turns,
            value: be.value,
            source: 'skill',
            sourceName
          };
          addEffectToContainer(playerEffects.value, effect);
          // 调用 handler.onApply 触发效果施加回调
          effectRegistry.get(effect.type)?.onApply?.(effect, playerCtx);
        }
      }
      return;
    }

    // 敌人减益
    if (targetType === 'all_enemies') {
      const livingEnemies = aliveEnemies.value;
      for (const e of livingEnemies) {
        applyDebuffToEnemy(e, skill.buffs, sourceName);
      }
    } else {
      // 单目标
      const target = currentTarget.value;
      if (target) {
        applyDebuffToEnemy(target, skill.buffs, sourceName);
      }
    }
  }

  // ==================== 玩家行动 ====================

  // P2-34 修复：BossRuntime 字段已显式声明到 EnemyInstance 接口中，
  // 不再需要本地类型断言。直接通过 target.xxx 访问运行时注入字段。

  /**
   * 应用 BOSS 防御机制（BIZ-6）
   *
   * 在玩家对敌人造成伤害前调用：
   * - invulnerable：无敌，伤害为 0
   * - shield：护盾吸收伤害（先扣护盾，剩余再扣 HP）
   *
   * @param target - 目标敌人
   * @param rawDamage - 原始伤害
   * @returns 实际伤害（扣完护盾后）和是否被完全挡住
   */
  function applyBossDefenseMechanics(target: EnemyInstance, rawDamage: number): { damage: number; blocked: boolean } {
    if (target.invulnerable) {
      addCombatLog({
        actorType: 'system', actorId: 'system', actorName: '系统',
        eventType: 'combat_event', targetType: 'enemy', targetId: target.id,
        targetName: target.name, isCrit: false, isDodge: false,
        message: `${target.name} 处于无敌状态，免疫伤害！`
      });
      return { damage: 0, blocked: true };
    }
    if (target.shield && target.shield > 0) {
      if (rawDamage <= target.shield) {
        target.shield -= rawDamage;
        addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'enemy', targetId: target.id,
          targetName: target.name, isCrit: false, isDodge: false,
          message: `${target.name} 的护盾吸收了 ${rawDamage} 点伤害！`
        });
        return { damage: 0, blocked: true };
      } else {
        const remaining = rawDamage - target.shield;
        addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'enemy', targetId: target.id,
          targetName: target.name, isCrit: false, isDodge: false,
          message: `${target.name} 的护盾被击破！吸收了 ${target.shield} 点伤害。`
        });
        target.shield = 0;
        return { damage: remaining, blocked: false };
      }
    }
    return { damage: rawDamage, blocked: false };
  }

  /**
   * 应用 BOSS 反击机制（BIZ-6）
   *
   * 在玩家对敌人造成伤害后调用：
   * - reflectDamage：按比例反弹伤害
   * - counterStance：反击姿态，造成 50% 伤害反击（一次性）
   *
   * @param target - 目标敌人
   * @param actualDamage - 实际造成的伤害
   */
  function applyBossCounterMechanics(target: EnemyInstance, actualDamage: number): void {
    if (actualDamage <= 0) return;

    if (target.reflectDamage && target.reflectDamage > 0) {
      const reflectAmount = Math.floor(actualDamage * target.reflectDamage);
      if (reflectAmount > 0) {
        ctx.character.takeDamage(reflectAmount);
        addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_damage', targetType: 'player', targetId: 'player',
          targetName: ctx.character.name, damage: reflectAmount,
          isCrit: false, isDodge: false,
          message: `${target.name} 反弹了 ${reflectAmount} 点伤害！`
        });
      }
    }

    if (target.counterStance) {
      const counterDamage = Math.floor(actualDamage * 0.5);
      if (counterDamage > 0) {
        ctx.character.takeDamage(counterDamage);
        addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_damage', targetType: 'player', targetId: 'player',
          targetName: ctx.character.name, damage: counterDamage,
          isCrit: false, isDodge: false,
          message: `${target.name} 反击对 ${ctx.character.name} 造成 ${counterDamage} 点伤害！`
        });
      }
      target.counterStance = false;
    }
  }

  /**
   * 检查 BOSS 复活机制（BIZ-6）
   *
   * 在敌人死亡时调用：如果 BOSS 有 canRevive 标记，恢复 50% HP 并清除标记。
   *
   * @param target - 目标敌人
   * @returns 是否复活了
   */
  function checkBossRevive(target: EnemyInstance): boolean {
    if (target.canRevive) {
      target.hp = Math.floor(target.maxHp * 0.5);
      target.canRevive = false;
      addCombatLog({
        actorType: 'system', actorId: 'system', actorName: '系统',
        eventType: 'combat_event', targetType: 'enemy', targetId: target.id,
        targetName: target.name, isCrit: false, isDodge: false,
        message: `${target.name} 复活了！恢复 50% 生命值！`
      });
      return true;
    }
    return false;
  }

  /**
   * 玩家普通攻击
   */
  function playerAttack(): CombatActionResult {
    const target = currentTarget.value;
    if (!target) {
      return { success: false, type: 'attack', message: '没有可攻击的目标！' };
    }

    // 检查敌人闪避（dodgeChance 是百分比，如 3 表示 3%）
    const enemyDodgeChance = (target.dodgeChance || 0) / 100;
    const isDodge = rollDodge(enemyDodgeChance);

    if (isDodge) {
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: ctx.character.name,
        eventType: 'combat_miss',
        targetType: 'enemy',
        targetId: target.id,
        targetName: target.name,
        isCrit: false,
        isDodge: true,
        message: `${ctx.character.name} 攻击被 ${target.name} 闪避了！`
      });

      // 发射闪避事件（音效 + 视觉特效）
      eventBus.emit(GameEvents.COMBAT_DODGE, {
        attackerName: ctx.character.name,
        dodgerName: target.name,
        dodgerType: 'enemy'
      });

      initiative.endPlayerTurn();
      saveLogs();

      return {
        success: true,
        type: 'attack',
        isDodge: true,
        message: `${target.name} 闪避了你的攻击！`
      };
    }

    // 构建效果上下文（统一使用工厂函数）
    const attackerCtx = createPlayerEffectContext();
    const defenderCtx = createEnemyEffectContext(target);

    // 使用新管线计算伤害
    const pipeResult = processDamagePipeline(
      effectRegistry,
      playerEffects.value,
      enemyEffects.value[target.id] || createEmptyContainer(),
      attackerCtx,
      defenderCtx,
      'physical'
    );

    // 暴击判定（在管线之后应用）
    const critChance = ctx.character.attributes.critChance / 100;
    const isCrit = rollCritical(critChance);
    const critMultiplier = isCrit ? 1.5 : 1;
    const finalDamage = Math.floor(pipeResult.finalDamage * critMultiplier);

    // 造成伤害
    // BIZ-6：应用 BOSS 防御机制（无敌/护盾）
    const { damage: actualDamage } = applyBossDefenseMechanics(target, finalDamage);
    let isDead = false;
    if (actualDamage > 0) {
      isDead = ctx.enemy.takeDamage(target.id, actualDamage);
    }

    // BIZ-6：应用 BOSS 反击机制（反弹/反击）
    applyBossCounterMechanics(target, actualDamage);

    // 荆棘反伤：对攻击者自身造成反弹伤害
    if (pipeResult.thorns > 0) {
      // P2-2：荆棘反伤基于暴击后伤害，与 Boss 反击基数保持一致
      const thornsDamage = Math.floor(pipeResult.thorns * critMultiplier);
      ctx.character.takeDamage(thornsDamage);
      addCombatLog({
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_damage',
        targetType: 'player',
        targetId: 'player',
        targetName: ctx.character.name,
        damage: thornsDamage,
        isCrit: false,
        isDodge: false,
        message: `荆棘反伤对 ${ctx.character.name} 造成 ${thornsDamage} 点伤害！`
      });
    }

    // 物理伤害音效事件
    eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
      amount: actualDamage,
      damageType: 'physical',
      targetName: target.name || '敌人',
      actorType: 'player'
    });

    // 暴击事件（视觉特效 + 暴击音效）
    if (isCrit) {
      eventBus.emit(GameEvents.COMBAT_CRITICAL_HIT, {
        amount: finalDamage,
        damageType: 'physical',
        targetName: target.name || '敌人',
        actorType: 'player'
      });
    }

    // 更新敌人状态
    const updatedTarget = ctx.enemy.getEnemyById(target.id);

    // 添加日志
    // P3-94 修复：damage 字段与 message 文本统一使用 actualDamage（实际扣血量，已扣 BOSS 护盾/无敌），
    // 避免日志记录的 finalDamage（暴击后未扣护盾）与实际造成的伤害不一致。
    addCombatLog({
      actorType: 'player',
      actorId: 'player',
      actorName: ctx.character.name,
      eventType: isCrit ? 'combat_critical' : 'combat_damage',
      targetType: 'enemy',
      targetId: updatedTarget?.id || '',
      targetName: updatedTarget?.name || '',
      damage: actualDamage,
      isCrit,
      isDodge: false,
      message: isCrit
        ? `${ctx.character.name} 暴击！对 ${updatedTarget?.name} 造成 ${actualDamage} 点伤害！`
        : `${ctx.character.name} 对 ${updatedTarget?.name} 造成 ${actualDamage} 点伤害！`
    });

    // 检查战斗是否结束
    if (isDead || !updatedTarget || aliveEnemies.value.length === 0) {
      // BIZ-6：检查 BOSS 复活机制
      if (isDead && checkBossRevive(target)) {
        initiative.endPlayerTurn();
      } else {
        endCombat('victory');
      }
    } else {
      initiative.endPlayerTurn();
    }

    saveLogs();

    return {
      success: true,
      type: 'attack',
      damage: finalDamage,
      isCrit,
      message: isCrit
        ? `暴击！造成 ${finalDamage} 点伤害！`
        : `造成 ${finalDamage} 点伤害！`
    };
  }

  /**
   * 玩家使用技能
   * @param skillId - 技能 ID
   */
  async function playerSkill(skillId: string): Promise<CombatActionResult> {
    const skill = ctx.skill.getSkill(skillId);

    // BIZ-10：检查专属资源（怒气/能量/连击点等）是否足够（MP 由 castSkill 内部检查）
    if (skill?.resourceType && skill?.resourceCost) {
      const resourceSys = state.resourceSystems.value.find(sys => sys.type === skill.resourceType);
      if (resourceSys && !resourceSys.hasEnough(skill.resourceCost)) {
        return {
          success: false,
          type: 'skill',
          message: '资源不足'
        };
      }
    }

    const result = await ctx.skill.castSkill(skillId, true);

    if (!result.success) {
      return {
        success: false,
        type: 'skill',
        message: result.message
      };
    }

    // BIZ-10：消耗专属资源（MP 已由 castSkill 内部消耗）
    if (skill?.resourceType && skill?.resourceCost) {
      const resourceSys = state.resourceSystems.value.find(sys => sys.type === skill.resourceType);
      if (resourceSys) {
        resourceSys.consume(skill.resourceCost);
      }
    }

    // 读取技能目标类型，默认单目标
    const targetType = skill?.targetType || 'single';

    // 添加技能施放日志
    addCombatLog({
      actorType: 'player',
      actorId: 'player',
      actorName: ctx.character.name,
      eventType: 'combat_skill_cast',
      skillId,
      skillName: skill?.name || '',
      isCrit: false,
      isDodge: false,
      message: `${ctx.character.name} 使用了 ${skill?.name || '技能'}！`
    });

    // 如果是伤害技能，根据目标类型决定影响范围
    if (result.damage && (result.type === 'physical_damage' || result.type === 'magic_damage')) {
      if (targetType === 'all_enemies') {
        // AOE：对所有活着的敌人使用管线计算伤害（每个敌人独立计算攻防修正效果）
        const livingEnemies = aliveEnemies.value;
        const damageType: DamageType = result.type === 'magic_damage' ? 'magical' : 'physical';
        const aoeHits: AoeHitInfo[] = [];

        for (const e of livingEnemies) {
          // AOE 惩罚在管线前应用，与攻防修正独立计算
          const aoeBaseDamage = Math.round(result.damage * AOE_DAMAGE_PENALTY);
          const pipeResult = processDamagePipeline(
            effectRegistry,
            playerEffects.value,
            enemyEffects.value[e.id] || createEmptyContainer(),
            createPlayerEffectContext(),
            createEnemyEffectContext(e),
            damageType,
            aoeBaseDamage
          );
          // BIZ-4：暴击判定（每个敌人独立判定，与 playerAttack 保持一致）
          const critChance = ctx.character.attributes.critChance / 100;
          const isCrit = rollCritical(critChance);
          const critMultiplier = isCrit ? 1.5 : 1;
          const aoeDamage = Math.floor(pipeResult.finalDamage * critMultiplier);
          // BIZ-6：应用 BOSS 防御机制（无敌/护盾）
          const { damage: actualAoeDamage } = applyBossDefenseMechanics(e, aoeDamage);
          if (actualAoeDamage > 0) {
            ctx.enemy.takeDamage(e.id, actualAoeDamage);
          }

          // BIZ-6：应用 BOSS 反击机制（反弹/反击）
          applyBossCounterMechanics(e, actualAoeDamage);

          // BIZ-1：荆棘反伤：对玩家自身造成反弹伤害（乘以暴击倍率，与 playerAttack 保持一致）
          if (pipeResult.thorns > 0) {
            const thornsDamage = Math.floor(pipeResult.thorns * critMultiplier);
            ctx.character.takeDamage(thornsDamage);
            addCombatLog({
              actorType: 'system', actorId: 'system', actorName: '系统',
              eventType: 'combat_damage', targetType: 'player', targetId: 'player',
              targetName: ctx.character.name, damage: thornsDamage,
              isCrit: false, isDodge: false,
              message: `荆棘反伤对 ${ctx.character.name} 造成 ${thornsDamage} 点伤害！`
            });
          }

          // P3-93 修复：补充 isCrit 字段，让 AOE 逐目标命中信息完整（供 UI 展示暴击特效/日志）
          aoeHits.push({ enemyId: e.id, enemyName: e.name, damage: actualAoeDamage, isCrit });

          eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
            amount: aoeDamage,
            damageType: damageType === 'magical' ? 'magic' : 'physical',
            targetName: e.name || '敌人',
            actorType: 'player'
          });

          // BIZ-4：暴击事件
          if (isCrit) {
            eventBus.emit(GameEvents.COMBAT_CRITICAL_HIT, {
              amount: aoeDamage,
              damageType: damageType === 'magical' ? 'magic' : 'physical',
              targetName: e.name || '敌人',
              actorType: 'player'
            });
          }

          addCombatLog({
            actorType: 'player',
            actorId: 'player',
            actorName: ctx.character.name,
            eventType: result.type === 'magic_damage' ? 'combat_skill_cast' : 'combat_damage',
            targetType: 'enemy',
            targetId: e.id,
            targetName: e.name || '',
            skillId,
            skillName: skill?.name || '',
            damage: aoeDamage,
            isCrit,
            isDodge: false,
            message: isCrit
              ? `${skill?.name || '技能'} 暴击！对 ${e.name} 造成 ${aoeDamage} 点${damageType === 'magical' ? '魔法' : '物理'}伤害！`
              : `${skill?.name || '技能'} 对 ${e.name} 造成 ${aoeDamage} 点${damageType === 'magical' ? '魔法' : '物理'}伤害！`
          });
        }

        // AOE 技能可能附带 buff/debuff 效果
        if (skill?.buffs && skill.buffs.length > 0) {
          applySkillBuffs(skill, targetType);
        }

        // 检查是否所有敌人死亡
        if (aliveEnemies.value.length === 0) {
          endCombat('victory');
        } else {
          initiative.endPlayerTurn();
        }

        saveLogs();

        return {
          success: true,
          type: 'skill',
          damage: result.damage,
          aoeHits,
          message: `${skill?.name || '技能'} 对所有敌人造成了范围伤害！`
        };
      } else if (targetType === 'self') {
        // 自伤技能在当前设计中不合理，返回错误
        return {
          success: false,
          type: 'skill',
          message: '不能对自己使用伤害技能！'
        };
      } else {
        // 单目标（默认）：使用伤害管线计算
        const target = currentTarget.value;
        if (!target) {
          return { success: false, type: 'skill', message: '没有可攻击的目标！' };
        }

        const damageType: DamageType = result.type === 'magic_damage' ? 'magical' : 'physical';

        const pipeResult = processDamagePipeline(
          effectRegistry,
          playerEffects.value,
          enemyEffects.value[target.id] || createEmptyContainer(),
          createPlayerEffectContext(),
          createEnemyEffectContext(target),
          damageType,
          result.damage  // baseDamageOverride：技能基础伤害直接传入
        );

        // BIZ-4：暴击判定（与 playerAttack 保持一致）
        const critChance = ctx.character.attributes.critChance / 100;
        const isCrit = rollCritical(critChance);
        const critMultiplier = isCrit ? 1.5 : 1;
        const skillDamage = Math.floor(pipeResult.finalDamage * critMultiplier);

        // BIZ-6：应用 BOSS 防御机制（无敌/护盾）
        const { damage: actualSkillDamage } = applyBossDefenseMechanics(target, skillDamage);
        let isDead = false;
        if (actualSkillDamage > 0) {
          isDead = ctx.enemy.takeDamage(target.id, actualSkillDamage);
        }
        const updatedTarget = ctx.enemy.getEnemyById(target.id);

        // BIZ-6：应用 BOSS 反击机制（反弹/反击）
        applyBossCounterMechanics(target, actualSkillDamage);

        // BIZ-1：荆棘反伤（与 playerAttack 保持一致，乘以暴击倍率）
        if (pipeResult.thorns > 0) {
          const thornsDamage = Math.floor(pipeResult.thorns * critMultiplier);
          ctx.character.takeDamage(thornsDamage);
          addCombatLog({
            actorType: 'system', actorId: 'system', actorName: '系统',
            eventType: 'combat_damage', targetType: 'player', targetId: 'player',
            targetName: ctx.character.name, damage: thornsDamage,
            isCrit: false, isDodge: false,
            message: `荆棘反伤对 ${ctx.character.name} 造成 ${thornsDamage} 点伤害！`
          });
        }

        // 伤害类型音效事件
        eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
          amount: actualSkillDamage,
          damageType: damageType === 'magical' ? 'magic' : 'physical',
          targetName: updatedTarget?.name || '敌人',
          actorType: 'player'
        });

        // BIZ-4：暴击事件
        if (isCrit) {
          eventBus.emit(GameEvents.COMBAT_CRITICAL_HIT, {
            amount: skillDamage,
            damageType: damageType === 'magical' ? 'magic' : 'physical',
            targetName: updatedTarget?.name || '敌人',
            actorType: 'player'
          });
        }

        addCombatLog({
          actorType: 'player',
          actorId: 'player',
          actorName: ctx.character.name,
          eventType: result.type === 'magic_damage' ? 'combat_skill_cast' : 'combat_damage',
          targetType: 'enemy',
          targetId: updatedTarget?.id || '',
          targetName: updatedTarget?.name || '',
          skillId,
          skillName: skill?.name || '',
          damage: skillDamage,
          isCrit,
          isDodge: false,
          message: isCrit
            ? `${skill?.name || '技能'} 暴击！对 ${updatedTarget?.name} 造成 ${skillDamage} 点${result.type === 'magic_damage' ? '魔法' : '物理'}伤害！`
            : `${skill?.name || '技能'} 对 ${updatedTarget?.name} 造成 ${skillDamage} 点${result.type === 'magic_damage' ? '魔法' : '物理'}伤害！`
        });

        // 附带 buff/debuff 效果（在 endCombat/endPlayerTurn 之前施加，防止效果添加到已清空的容器）
        if (skill?.buffs && skill.buffs.length > 0) {
          applySkillBuffs(skill, targetType);
        }

        if (isDead || !updatedTarget || aliveEnemies.value.length === 0) {
          // BIZ-6：检查 BOSS 复活机制
          if (isDead && checkBossRevive(target)) {
            initiative.endPlayerTurn();
          } else {
            endCombat('victory');
          }
        } else {
          initiative.endPlayerTurn();
        }
      }
    } else if (result.appliedEffects && result.appliedEffects.length > 0) {
      // buff/debuff 技能：将效果应用到目标
      const effectSourceName = skill?.name || '技能';

      if (result.type === 'buff') {
        // 增益技能：对玩家自身施加效果
        const playerCtx = createPlayerEffectContext();
        for (const be of result.appliedEffects) {
          const effect: Effect = {
            id: generateEffectId(),
            type: be.type,
            remainingTurns: be.turns,
            value: be.value,
            source: 'skill',
            sourceName: effectSourceName
          };
          addEffectToContainer(playerEffects.value, effect);
          // 调用 handler.onApply 触发效果施加回调
          effectRegistry.get(effect.type as EffectType)?.onApply?.(effect, playerCtx);
        }

        eventBus.emit(GameEvents.COMBAT_CAST_HEAL, {
          amount: result.appliedEffects[0]?.value || 0,
          healType: 'buff',
          targetName: ctx.character.name
        });

        addCombatLog({
          actorType: 'player', actorId: 'player', actorName: ctx.character.name,
          eventType: 'combat_skill_cast', skillId, skillName: effectSourceName,
          isCrit: false, isDodge: false,
          message: `${ctx.character.name} 使用了 ${effectSourceName}，获得增益效果！`
        });

        initiative.endPlayerTurn();
      } else if (result.type === 'debuff') {
        // 减益技能：对敌人施加效果
        if (targetType === 'all_enemies') {
          // 对全体敌人施加
          const livingEnemies = aliveEnemies.value;
          for (const e of livingEnemies) {
            applyDebuffToEnemy(e, result.appliedEffects, effectSourceName);
          }
          addCombatLog({
            actorType: 'player', actorId: 'player', actorName: ctx.character.name,
            eventType: 'combat_skill_cast', skillId, skillName: effectSourceName,
            isCrit: false, isDodge: false,
            message: `${ctx.character.name} 使用了 ${effectSourceName}，对所有敌人施加减益效果！`
          });
          initiative.endPlayerTurn();
        } else {
          // 单目标：对当前目标施加
          const target = currentTarget.value;
          if (!target) {
            return { success: false, type: 'skill', message: '没有可攻击的目标！' };
          }
          applyDebuffToEnemy(target, result.appliedEffects, effectSourceName);
          addCombatLog({
            actorType: 'player', actorId: 'player', actorName: ctx.character.name,
            eventType: 'combat_skill_cast', targetType: 'enemy',
            targetId: target.id, targetName: target.name,
            skillId, skillName: effectSourceName,
            isCrit: false, isDodge: false,
            message: `${ctx.character.name} 对 ${target.name} 使用了 ${effectSourceName}！`
          });
          initiative.endPlayerTurn();
        }
      }
    } else if (result.heal) {
      // 生命恢复技能音效事件（skillsStore.castSkill 已通过 characterStore.receiveHeal 应用生命恢复）
      eventBus.emit(GameEvents.COMBAT_CAST_HEAL, {
        amount: result.heal,
        healType: result.type === 'mana_restore' ? 'mana' : 'health',
        targetName: ctx.character.name
      });

      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: ctx.character.name,
        eventType: 'combat_heal',
        skillId,
        skillName: skill?.name || '',
        heal: result.heal,
        isCrit: false,
        isDodge: false,
        message: `${skill?.name || '技能'} 恢复了 ${result.heal} 点生命值！`
      });

      initiative.endPlayerTurn();
    }

    saveLogs();

    return {
      success: true,
      type: 'skill',
      damage: result.damage,
      heal: result.heal,
      message: result.message
    };
  }

  /**
   * 玩家使用物品
   * @param itemId - 物品 ID
   */
  async function playerUseItem(itemId: string): Promise<CombatActionResult> {
    // 先获取物品信息，判断是否为伤害型物品
    const itemInfo = ctx.inventory.getItemInfo(itemId);
    let damageResult: { damage: number; isCrit: boolean } | null = null;
    let itemKilledEnemy = false;

    if (itemInfo?.effect) {
      const { type, value } = itemInfo.effect;

      if ((type === 'magic_damage' || type === 'physical_damage') && typeof value === 'number' && value > 0) {
        // 伤害型物品：对当前目标造成伤害
        const target = currentTarget.value;
        if (!target) {
          return { success: false, type: 'item', message: '没有可攻击的目标！' };
        }

        const damageType: DamageType = type === 'magic_damage' ? 'magical' : 'physical';

        const pipeResult = processDamagePipeline(
          effectRegistry,
          playerEffects.value,
          enemyEffects.value[target.id] || createEmptyContainer(),
          createPlayerEffectContext(),
          createEnemyEffectContext(target),
          damageType,
          value  // baseDamageOverride：物品基础伤害直接传入
        );

        // 暴击判定
        const critChance = ctx.character.attributes.critChance / 100;
        const isCrit = rollCritical(critChance);
        const critMultiplier = isCrit ? 1.5 : 1;
        const finalDamage = Math.floor(pipeResult.finalDamage * critMultiplier);

        // BIZ-2：应用 BOSS 防御机制（无敌/护盾）
        const { damage: actualItemDamage } = applyBossDefenseMechanics(target, finalDamage);
        let isDead = false;
        if (actualItemDamage > 0) {
          isDead = ctx.enemy.takeDamage(target.id, actualItemDamage);
        }
        itemKilledEnemy = isDead;

        damageResult = { damage: finalDamage, isCrit };

        // BIZ-2：应用 BOSS 反击机制（反弹/反击）
        applyBossCounterMechanics(target, actualItemDamage);

        // BIZ-3：荆棘反伤（与 playerAttack 保持一致）
        if (pipeResult.thorns > 0) {
          const thornsDamage = Math.floor(pipeResult.thorns * critMultiplier);
          ctx.character.takeDamage(thornsDamage);
          addCombatLog({
            actorType: 'system', actorId: 'system', actorName: '系统',
            eventType: 'combat_damage', targetType: 'player', targetId: 'player',
            targetName: ctx.character.name, damage: thornsDamage,
            isCrit: false, isDodge: false,
            message: `荆棘反伤对 ${ctx.character.name} 造成 ${thornsDamage} 点伤害！`
          });
        }

        // 伤害音效事件
        eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
          amount: finalDamage,
          damageType: type === 'magic_damage' ? 'magic' : 'physical',
          targetName: target.name || '敌人',
          actorType: 'player'
        });

        // 暴击事件
        if (isCrit) {
          eventBus.emit(GameEvents.COMBAT_CRITICAL_HIT, {
            amount: finalDamage,
            damageType: type === 'magic_damage' ? 'magic' : 'physical',
            targetName: target.name || '敌人',
            actorType: 'player'
          });
        }
      }
    }

    // 调用 inventoryStore 使用物品（扣减数量 + 应用恢复/属性效果）
    await ctx.inventory.useItem(itemId);

    // 生命/法力恢复音效事件
    if (itemInfo?.effect) {
      const { type, value } = itemInfo.effect;
      if ((type === 'health_restore' || type === 'mana_restore') && typeof value === 'number' && value > 0) {
        eventBus.emit(GameEvents.COMBAT_CAST_HEAL, {
          amount: value,
          healType: type === 'mana_restore' ? 'mana' : 'health',
          targetName: ctx.character.name
        });
      }
    }

    // 战斗日志
    if (damageResult) {
      const target = currentTarget.value;
      const updatedTarget = target ? ctx.enemy.getEnemyById(target.id) : null;
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: ctx.character.name,
        eventType: damageResult.isCrit ? 'combat_critical' : 'combat_skill_cast',
        targetType: 'enemy',
        targetId: updatedTarget?.id || '',
        targetName: updatedTarget?.name || '',
        damage: damageResult.damage,
        isCrit: damageResult.isCrit,
        isDodge: false,
        message: damageResult.isCrit
          ? `${ctx.character.name} 使用 ${itemInfo?.name || '卷轴'}，暴击！对 ${updatedTarget?.name} 造成 ${damageResult.damage} 点伤害！`
          : `${ctx.character.name} 使用 ${itemInfo?.name || '卷轴'}，对 ${updatedTarget?.name} 造成 ${damageResult.damage} 点伤害！`
      });
    } else {
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: ctx.character.name,
        eventType: 'combat_item',
        isCrit: false,
        isDodge: false,
        message: `${ctx.character.name} 使用了 ${itemInfo?.name || '物品'}！`
      });
    }

    // 检查敌人是否全部死亡
    if (damageResult && aliveEnemies.value.length === 0) {
      const target = currentTarget.value;
      // P1-1：检查 BOSS 复活机制（与 playerAttack/playerSkill 保持一致）
      if (itemKilledEnemy && target && checkBossRevive(target)) {
        initiative.endPlayerTurn();
      } else {
        endCombat('victory');
      }
    } else {
      initiative.endPlayerTurn();
    }

    saveLogs();

    return {
      success: true,
      type: 'item',
      damage: damageResult?.damage,
      isCrit: damageResult?.isCrit,
      message: damageResult
        ? `使用 ${itemInfo?.name || '卷轴'} 造成 ${damageResult.damage} 点伤害！`
        : '使用了物品！'
    };
  }

  /**
   * 玩家逃跑
   */
  function playerFlee(): CombatActionResult {
    if (hasBossEnemy.value) {
      return { success: false, type: 'flee', message: '无法从Boss战中逃跑！' };
    }

    // 使用纯函数计算逃跑成功率
    const stats = ctx.character.effectiveStats;
    const fleeChance = calculateFleeChance(stats.dex);
    const success = rollFleeSuccess(fleeChance);

    if (success) {
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: ctx.character.name,
        eventType: 'combat_flee',
        isCrit: false,
        isDodge: false,
        message: `${ctx.character.name} 成功逃离了战斗！`
      });

      endCombat('fled');
      saveLogs();

      return {
        success: true,
        type: 'flee',
        message: '成功逃离了战斗！'
      };
    } else {
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: ctx.character.name,
        eventType: 'combat_miss',
        isCrit: false,
        isDodge: false,
        message: `${ctx.character.name} 逃跑失败！`
      });

      initiative.endPlayerTurn();
      saveLogs();

      return {
        success: false,
        type: 'flee',
        message: '逃跑失败！'
      };
    }
  }

  /**
   * 处理掉落（仅 Boss 掉落物品）
   * @param e - 敌人数据
   */
  function handleLoot(e: EnemyInstance): void {
    e.drops?.forEach(drop => {
      if (Math.random() < drop.dropRate) {
        // P2-4：校验 maxAmount >= minAmount，防止配置错误产生负数掉落数量
        const span = Math.max(0, drop.maxAmount - drop.minAmount);
        const amount = Math.floor(Math.random() * (span + 1)) + drop.minAmount;
        if (amount <= 0) return;

        // 获取物品模板信息
        const itemInfo = ctx.inventory.getItemInfo(drop.itemId);
        if (itemInfo) {
          // P2-2：检查 addItem 返回值，背包满时提示玩家
          // P2-42 修复：通过 EventBus 发射 INVENTORY_FULL 事件，由 UI 层监听并显示 toast，
          // 避免在 Composable 中直接调用 useToast 引入 UI 副作用
          const actualAmount = ctx.inventory.addItem(drop.itemId, amount);
          if (actualAmount < amount) {
            eventBus.emit(GameEvents.INVENTORY_FULL, {
              itemName: itemInfo.name,
              actualAmount,
              expectedAmount: amount,
            });
          }

          // BIZ-11：使用物品名称而非 itemId，与冒险日志保持一致
          // name 为空时回退到 itemId（防御性处理，正常配置不会出现空名称）
          const itemName = itemInfo.name || drop.itemId;
          addCombatLog({
            actorType: 'system',
            actorId: 'system',
            actorName: '系统',
            eventType: 'combat_item',
            isCrit: false,
            isDodge: false,
            message: `获得物品 ${itemName} x${actualAmount}！`
          });

          // 记录战利品到冒险日志
          ctx.log.addLogEntry({
            id: generateLogId(),
            timestamp: Date.now(),
            type: 'item',
            message: `从 ${e.name} 获得 ${itemName} x${actualAmount}`,
            icon: 'game-icons:backpack'
          });
        }
      }
    });
  }

  return {
    playerAttack,
    playerSkill,
    playerUseItem,
    playerFlee,
    handleLoot,
    applySkillBuffs,
    applyDebuffToEnemy,
  };
}
