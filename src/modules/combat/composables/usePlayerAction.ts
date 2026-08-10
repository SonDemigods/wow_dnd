/**
 * 玩家行动 Composable（编排层）
 *
 * QA-9 重构后职责：
 *   - 持有 playerAttack / playerFlee（直接实现）
 *   - 持有 applySkillBuffs / applyDebuffToEnemy（被 usePlayerSkill 通过注入复用）
 *   - 编排 usePlayerSkill / usePlayerItem / useLootHandler 三个子 composable
 *
 * 公共 API 保持向后兼容：仍导出 7 个方法
 *   playerAttack / playerSkill / playerUseItem / playerFlee /
 *   handleLoot / applySkillBuffs / applyDebuffToEnemy
 *
 * 依赖 useCombatState()、useCombatLog() 和 useInitiative() 返回的状态对象。
 * 暴击判定统一使用 helpers/critCalc.ts（QA-12）。
 */
import type { CombatActionResult, CombatResult } from '../types';
import type { EnemyInstance } from '@/modules/enemy';
import type { ICombatContext } from '../combatContext';
import { eventBus, GameEvents } from '@/modules/bus';
import {
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
} from '../effects';
import { rollPlayerCrit } from './helpers/critCalc';
import { usePlayerSkill } from './usePlayerSkill';
import { usePlayerItem } from './usePlayerItem';
import { useLootHandler } from './useLootHandler';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';
import type { useInitiative } from './useInitiative';
import type { usePassiveSkills } from './usePassiveSkills';
import type { useBossMechanics } from './useBossMechanics';
import type { usePetAction } from './usePetAction';

export function usePlayerAction(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  // ARCH-6：需完整上下文（读 character.name/attributes/effectiveStats、enemy.getEnemyById；写 enemy.takeDamage、character.takeDamage）
  ctx: ICombatContext,
  initiative: ReturnType<typeof useInitiative>,
  endCombat: (result: CombatResult) => void,
  passive: ReturnType<typeof usePassiveSkills>,
  boss: ReturnType<typeof useBossMechanics>,
  // P3-156 M4-4：注入宠物行动层，传递给 usePlayerSkill 用于狩猎指令联动与召唤/解散技能
  pet: ReturnType<typeof usePetAction>,
) {
  // P3-146：passive.getStatModifiers() 用于将 stat_modifier 类被动接入伤害管线与暴击判定。
  // P3-82 修复说明：passive 参数原本为预留扩展点，现已用于 stat_modifier 接入。
  // onAttack/onKill 等触发钩子仍由 store.ts 在玩家行动完成后调用。
  const { addCombatLog, createPlayerEffectContext, createEnemyEffectContext } = log;
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
      addEffectToContainer(container, effect, effectRegistry);
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
    // P6-003 修复：按单个 buff.type 逐条判断目标（self vs enemy），
    // 而非整段技能级二选一。混合 buff+debuff 技能应同时施加自身增益和敌方减益。
    const selfBuffTypes = ['attack_up', 'defense_up', 'speed_up', 'regen', 'shield'];
    const hasSelfBuffs = skill.buffs.some(b => selfBuffTypes.includes(b.type));
    const enemyBuffs = skill.buffs.filter(b => !selfBuffTypes.includes(b.type));

    // 施加自身增益
    if (hasSelfBuffs || targetType === 'self') {
      const playerCtx = createPlayerEffectContext();
      for (const be of skill.buffs) {
        if (selfBuffTypes.includes(be.type)) {
          const effect: Effect = {
            id: generateEffectId(),
            type: be.type as EffectType,
            remainingTurns: be.turns,
            value: be.value,
            source: 'skill',
            sourceName
          };
          addEffectToContainer(playerEffects.value, effect, effectRegistry);
          effectRegistry.get(effect.type)?.onApply?.(effect, playerCtx);
        }
      }
    }

    // 施加敌方减益（不 return，混合技能的 debuff 也需生效）
    // P7-009 修复：移除 targetType !== 'self' 限制，自施放型混合技能的敌方减益也需生效
    if (enemyBuffs.length > 0) {
      if (targetType === 'all_enemies') {
        const livingEnemies = aliveEnemies.value;
        for (const e of livingEnemies) {
          applyDebuffToEnemy(e, enemyBuffs, sourceName);
        }
      } else {
        const target = currentTarget.value;
        if (target) {
          applyDebuffToEnemy(target, enemyBuffs, sourceName);
        }
      }
    }
  }

  // ==================== 玩家行动：直接实现 ====================
  // 阶段九：Boss 防御/反击/复活机制已迁移到 useBossMechanics，通过 boss 参数调用：
  //   boss.boss.applyBossDefenseMechanics(target, rawDamage)
  //   boss.boss.applyBossCounterMechanics(target, actualDamage)
  //   boss.boss.checkBossRevive(target)

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
      // P2 BIZ-4 修复：移除重复 saveLogs，endPlayerTurn 内部已调用（若仍战斗中）

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

    // P3-146：读取 stat_modifier 类被动（如法师奥术精通 +10% 魔攻、猎手精准 +8% 暴击率）
    // 传 target.id 支持 target_hp 条件评估（如战士斩杀本能：目标低血时增伤）
    const statModifiers = passive.getStatModifiers(target.id);

    // 使用新管线计算伤害
    const pipeResult = processDamagePipeline(
      effectRegistry,
      playerEffects.value,
      enemyEffects.value[target.id] || createEmptyContainer(),
      attackerCtx,
      defenderCtx,
      'physical',
      undefined,
      undefined,
      statModifiers,
    );

    // 暴击判定（在管线之后应用）
    // P3-146：传入 statModifiers 让 crit_chance / crit_damage_multiplier 生效
    const { isCrit, multiplier: critMultiplier } = rollPlayerCrit(ctx.character.attributes, undefined, statModifiers);
    // 天赋 damage_multiplier 加成（通过 ctx.talent 统一访问，保持测试隔离）
    const talentDmgMult = ctx.talent.damageMultiplier;
    const preCritDamage = talentDmgMult > 0
      ? Math.floor(pipeResult.finalDamage * (1 + talentDmgMult))
      : pipeResult.finalDamage;
    const finalDamage = Math.floor(preCritDamage * critMultiplier);

    // 造成伤害
    // BIZ-6：应用 BOSS 防御机制（无敌/护盾）
    const { damage: actualDamage } = boss.applyBossDefenseMechanics(target, finalDamage);
    let isDead = false;
    if (actualDamage > 0) {
      isDead = ctx.enemy.takeDamage(target.id, actualDamage);
    }

    // BIZ-6：应用 BOSS 反击机制（反弹/反击）
    boss.applyBossCounterMechanics(target, actualDamage);

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
    // P6-001 修复：胜利条件改为仅当所有敌人均已死亡（aliveEnemies.length === 0），
    // isDead 仅表示当前目标被击杀，不意味着整场战斗胜利（多敌场景下其他敌人可能仍存活）
    // BIZ-6：先检查 BOSS 复活机制（复活后 aliveEnemies 不再为空，不会误判胜利）
    if (isDead && boss.checkBossRevive(target)) {
      initiative.endPlayerTurn();
    } else if (aliveEnemies.value.length === 0) {
      endCombat('victory');
    } else {
      initiative.endPlayerTurn();
    }
    // P2 BIZ-4 修复：移除重复 saveLogs，endPlayerTurn/endCombat 内部已调用

    return {
      success: true,
      type: 'attack',
      // P6-007 修复：返回值统一使用 actualDamage（实际扣血量），与日志一致
      damage: actualDamage,
      isCrit,
      message: isCrit
        ? `暴击！造成 ${actualDamage} 点伤害！`
        : `造成 ${actualDamage} 点伤害！`
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
      // P2 BIZ-4 修复：移除重复 saveLogs，endCombat 内部已调用

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
      // P2 BIZ-4 修复：移除重复 saveLogs，endPlayerTurn 内部已调用（若仍战斗中）

      return {
        success: false,
        type: 'flee',
        message: '逃跑失败！'
      };
    }
  }

  // ==================== 玩家行动：委托子 composable ====================

  const skillComposable = usePlayerSkill(
    state,
    log,
    ctx,
    initiative,
    endCombat,
    boss,
    { applySkillBuffs, applyDebuffToEnemy },
    passive,
    pet,
  );

  const itemComposable = usePlayerItem(
    state,
    log,
    ctx,
    initiative,
    endCombat,
    boss,
    passive,
  );

  const lootComposable = useLootHandler(log, ctx);

  return {
    playerAttack,
    playerSkill: skillComposable.playerSkill,
    playerUseItem: itemComposable.playerUseItem,
    playerFlee,
    handleLoot: lootComposable.handleLoot,
    applySkillBuffs,
    applyDebuffToEnemy,
  };
}
