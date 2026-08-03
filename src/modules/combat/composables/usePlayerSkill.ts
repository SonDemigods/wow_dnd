/**
 * @fileoverview 玩家技能施放 Composable（QA-9 拆分自 usePlayerAction.ts）
 *
 * 承载 playerSkill 函数的完整分支逻辑：
 *   - 伤害技能（AOE / single / self 拒绝）
 *   - buff/debuff 技能（自身增益 / 敌人减益 / 全体敌人减益）
 *   - heal 技能（生命/法力恢复）
 *
 * 依赖注入保持与 usePlayerAction 一致：
 *   - state/log/ctx/initiative/endCombat/boss 五大上下文
 *   - applySkillBuffs/applyDebuffToEnemy 通过 helpers 参数注入（仍由 usePlayerAction 持有）
 *
 * 暴击判定 / 荆棘反伤统一使用 helpers/critCalc.ts（QA-12）。
 */
import type { CombatActionResult, AoeHitInfo, CombatResult } from '../types';
import type { EnemyInstance } from '@/modules/enemy';
import type { ICombatContext } from '../combatContext';
import { eventBus, GameEvents } from '@/modules/bus';
import { PLAYER_AOE_DAMAGE_PENALTY } from '@/config/combat';
import {
  processDamagePipeline,
  createEmptyContainer,
  generateEffectId,
  addEffectToContainer,
  type Effect,
  type EffectType,
  type DamageType,
} from '../effects';
import { rollPlayerCrit, computeThornsDamage } from './helpers/critCalc';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';
import type { useInitiative } from './useInitiative';
import type { usePassiveSkills } from './usePassiveSkills';
import type { useBossMechanics } from './useBossMechanics';

/** P3-1：AOE 技能对每个目标造成的伤害占面板值的比例（设计文档：AOE 每目标 70% 基础伤害）
 * P3-147：常量已抽离至 @/config/combat，此处仅保留导入。 */


/**
 * applySkillBuffs / applyDebuffToEnemy 注入接口
 *
 * 这两个函数由 usePlayerAction 持有并暴露为公共 API（保持向后兼容），
 * usePlayerSkill 通过此接口复用，避免逻辑重复。
 */
export interface SkillHelpers {
  /** 施加技能附带 buff（自身增益 / 敌人减益分发） */
  applySkillBuffs: (
    skill: { name: string; buffs?: Array<{ type: string; value: number; turns: number }> },
    targetType: string,
  ) => void;
  /** 对单个敌人施加减益效果 */
  applyDebuffToEnemy: (
    e: EnemyInstance,
    effects: Array<{ type: string; value: number; turns: number }>,
    sourceName: string,
  ) => void;
}

export function usePlayerSkill(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  // ARCH-6：需完整上下文（读 skill.getSkill、character.name/attributes、enemy.getEnemyById；写 skill.castSkill、enemy.takeDamage、character.takeDamage）
  ctx: ICombatContext,
  initiative: ReturnType<typeof useInitiative>,
  endCombat: (result: CombatResult) => void,
  boss: ReturnType<typeof useBossMechanics>,
  helpers: SkillHelpers,
  // P3-146：注入被动技能，用于读取 stat_modifier 接入伤害管线与暴击判定
  passive: ReturnType<typeof usePassiveSkills>,
) {
  const { addCombatLog, createPlayerEffectContext, createEnemyEffectContext } = log;
  const { aliveEnemies, currentTarget, playerEffects, enemyEffects, effectRegistry, resourceSystems } = state;
  const { applySkillBuffs, applyDebuffToEnemy } = helpers;

  /**
   * 玩家使用技能
   * @param skillId - 技能 ID
   */
  async function playerSkill(skillId: string): Promise<CombatActionResult> {
    const skill = ctx.skill.getSkill(skillId);

    // BIZ-10：检查专属资源（怒气/能量/连击点等）是否足够（MP 由 castSkill 内部检查）
    if (skill?.resourceType && skill?.resourceCost) {
      const resourceSys = resourceSystems.value.find(sys => sys.type === skill.resourceType);
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
      const resourceSys = resourceSystems.value.find(sys => sys.type === skill.resourceType);
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
        // P3-146：读取 stat_modifier 类被动，AOE 与单目标共用同一份 modifier（条件在战斗期间稳定）
        const statModifiers = passive.getStatModifiers();

        for (const e of livingEnemies) {
          // AOE 惩罚在管线前应用，与攻防修正独立计算
          const aoeBaseDamage = Math.round(result.damage * PLAYER_AOE_DAMAGE_PENALTY);
          const pipeResult = processDamagePipeline(
            effectRegistry,
            playerEffects.value,
            enemyEffects.value[e.id] || createEmptyContainer(),
            createPlayerEffectContext(),
            createEnemyEffectContext(e),
            damageType,
            aoeBaseDamage,
            undefined,
            statModifiers,
          );
          // BIZ-4：暴击判定（每个敌人独立判定，与 playerAttack 保持一致）
          // P3-146：传入 statModifiers 让 crit_chance / crit_damage_multiplier 生效
          const { isCrit, multiplier: critMultiplier } = rollPlayerCrit(ctx.character.attributes, undefined, statModifiers);
          const aoeDamage = Math.floor(pipeResult.finalDamage * critMultiplier);
          // BIZ-6：应用 BOSS 防御机制（无敌/护盾）
          const { damage: actualAoeDamage } = boss.applyBossDefenseMechanics(e, aoeDamage);
          if (actualAoeDamage > 0) {
            ctx.enemy.takeDamage(e.id, actualAoeDamage);
          }

          // BIZ-6：应用 BOSS 反击机制（反弹/反击）
          boss.applyBossCounterMechanics(e, actualAoeDamage);

          // BIZ-1：荆棘反伤：对玩家自身造成反弹伤害（乘以暴击倍率，与 playerAttack 保持一致）
          if (pipeResult.thorns > 0) {
            const thornsDamage = computeThornsDamage(pipeResult.thorns, critMultiplier);
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
        // P2 BIZ-4 修复：移除重复 saveLogs，endPlayerTurn/endCombat 内部已调用

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

        // P3-146：读取 stat_modifier 类被动
        const statModifiers = passive.getStatModifiers();

        const pipeResult = processDamagePipeline(
          effectRegistry,
          playerEffects.value,
          enemyEffects.value[target.id] || createEmptyContainer(),
          createPlayerEffectContext(),
          createEnemyEffectContext(target),
          damageType,
          result.damage,  // baseDamageOverride：技能基础伤害直接传入
          undefined,
          statModifiers,
        );

        // BIZ-4：暴击判定（与 playerAttack 保持一致）
        // P3-146：传入 statModifiers 让 crit_chance / crit_damage_multiplier 生效
        const { isCrit, multiplier: critMultiplier } = rollPlayerCrit(ctx.character.attributes, undefined, statModifiers);
        const skillDamage = Math.floor(pipeResult.finalDamage * critMultiplier);

        // BIZ-6：应用 BOSS 防御机制（无敌/护盾）
        const { damage: actualSkillDamage } = boss.applyBossDefenseMechanics(target, skillDamage);
        let isDead = false;
        if (actualSkillDamage > 0) {
          isDead = ctx.enemy.takeDamage(target.id, actualSkillDamage);
        }
        const updatedTarget = ctx.enemy.getEnemyById(target.id);

        // BIZ-6：应用 BOSS 反击机制（反弹/反击）
        boss.applyBossCounterMechanics(target, actualSkillDamage);

        // BIZ-1：荆棘反伤（与 playerAttack 保持一致，乘以暴击倍率）
        if (pipeResult.thorns > 0) {
          const thornsDamage = computeThornsDamage(pipeResult.thorns, critMultiplier);
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
          if (isDead && boss.checkBossRevive(target)) {
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
    // P2 BIZ-4 修复：移除重复 saveLogs，endPlayerTurn/endCombat 内部已调用

    return {
      success: true,
      type: 'skill',
      damage: result.damage,
      heal: result.heal,
      message: result.message
    };
  }

  return { playerSkill };
}
