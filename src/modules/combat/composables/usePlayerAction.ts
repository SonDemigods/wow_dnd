/**
 * 玩家行动 Composable
 * 
 * 从 combat store 提取的玩家攻击、技能施放、物品使用、逃跑和掉落处理逻辑。
 * 依赖 useCombatState()、useCombatLog() 和 useInitiative() 返回的状态对象。
 */
import type { CombatActionResult, AoeHitInfo } from '../types';
import type { EnemyInstance } from '../../enemy/types';
import type { CombatResult } from '../types';
import { useCharacterStore } from '../../character/store';
import { useEnemiesStore } from '../../enemy/store';
import { useSkillsStore } from '../../skill/store';
import { useInventoryStore } from '../../inventory/store';
import { eventBus, GameEvents } from '../../bus';
import { useLogStore } from '../../log/store';
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

export function usePlayerAction(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  initiative: ReturnType<typeof useInitiative>,
  endCombat: (result: CombatResult) => void,
) {
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
    const ctx = createEnemyEffectContext(e);

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
      effectRegistry.get(effect.type)?.onApply?.(effect, ctx);
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
      const characterStore = useCharacterStore();
      const playerCtx = createPlayerEffectContext(characterStore);
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

  /**
   * 玩家普通攻击
   */
  function playerAttack(): CombatActionResult {
    const target = currentTarget.value;
    if (!target) {
      return { success: false, type: 'attack', message: '没有可攻击的目标！' };
    }

    const characterStore = useCharacterStore();

    // 检查敌人闪避（dodgeChance 是百分比，如 3 表示 3%）
    const enemyDodgeChance = (target.dodgeChance || 0) / 100;
    const isDodge = rollDodge(enemyDodgeChance);

    if (isDodge) {
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterStore.name,
        eventType: 'combat_miss',
        targetType: 'enemy',
        targetId: target.id,
        targetName: target.name,
        isCrit: false,
        isDodge: true,
        message: `${characterStore.name} 攻击被 ${target.name} 闪避了！`
      });

      // 发射闪避事件（音效 + 视觉特效）
      eventBus.emit(GameEvents.COMBAT_DODGE, {
        attackerName: characterStore.name,
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
    const attackerCtx = createPlayerEffectContext(characterStore);
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
    const critChance = characterStore.attributes.critChance / 100;
    const isCrit = rollCritical(critChance);
    const critMultiplier = isCrit ? 1.5 : 1;
    const finalDamage = Math.floor(pipeResult.finalDamage * critMultiplier);

    // 造成伤害
    const enemiesStore = useEnemiesStore();
    const isDead = enemiesStore.takeDamage(target.id, finalDamage);

    // 荆棘反伤：对攻击者自身造成反弹伤害
    if (pipeResult.thorns > 0) {
      characterStore.takeDamage(pipeResult.thorns);
      addCombatLog({
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_damage',
        targetType: 'player',
        targetId: 'player',
        targetName: characterStore.name,
        damage: pipeResult.thorns,
        isCrit: false,
        isDodge: false,
        message: `荆棘反伤对 ${characterStore.name} 造成 ${pipeResult.thorns} 点伤害！`
      });
    }

    // 物理伤害音效事件
    eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
      amount: finalDamage,
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
    const updatedTarget = enemiesStore.getEnemyById(target.id);

    // 添加日志
    addCombatLog({
      actorType: 'player',
      actorId: 'player',
      actorName: characterStore.name,
      eventType: isCrit ? 'combat_critical' : 'combat_damage',
      targetType: 'enemy',
      targetId: updatedTarget?.id || '',
      targetName: updatedTarget?.name || '',
      damage: finalDamage,
      isCrit,
      isDodge: false,
      message: isCrit
        ? `${characterStore.name} 暴击！对 ${updatedTarget?.name} 造成 ${finalDamage} 点伤害！`
        : `${characterStore.name} 对 ${updatedTarget?.name} 造成 ${finalDamage} 点伤害！`
    });

    // 检查战斗是否结束
    if (isDead || !updatedTarget || aliveEnemies.value.length === 0) {
      endCombat('victory');
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
    const skillsStore = useSkillsStore();
    const characterStore = useCharacterStore();

    const skill = skillsStore.getSkill(skillId);
    const result = await skillsStore.castSkill(skillId, true);

    if (!result.success) {
      return {
        success: false,
        type: 'skill',
        message: result.message
      };
    }

    // 读取技能目标类型，默认单目标
    const targetType = skill?.targetType || 'single';

    // 添加技能施放日志
    addCombatLog({
      actorType: 'player',
      actorId: 'player',
      actorName: characterStore.name,
      eventType: 'combat_skill_cast',
      skillId,
      skillName: skill?.name || '',
      isCrit: false,
      isDodge: false,
      message: `${characterStore.name} 使用了 ${skill?.name || '技能'}！`
    });

    // 如果是伤害技能，根据目标类型决定影响范围
    if (result.damage && (result.type === 'physical_damage' || result.type === 'magic_damage')) {
      if (targetType === 'all_enemies') {
        // AOE：对所有活着的敌人使用管线计算伤害（每个敌人独立计算攻防修正效果）
        const livingEnemies = aliveEnemies.value;
        const damageType: DamageType = result.type === 'magic_damage' ? 'magical' : 'physical';
        const aoeHits: AoeHitInfo[] = [];
        const enemiesStore = useEnemiesStore();

        for (const e of livingEnemies) {
          // AOE 惩罚在管线前应用，与攻防修正独立计算
          const aoeBaseDamage = Math.round(result.damage * 0.7);
          const pipeResult = processDamagePipeline(
            effectRegistry,
            playerEffects.value,
            enemyEffects.value[e.id] || createEmptyContainer(),
            createPlayerEffectContext(characterStore),
            createEnemyEffectContext(e),
            damageType,
            aoeBaseDamage
          );
          const aoeDamage = pipeResult.finalDamage;
          enemiesStore.takeDamage(e.id, aoeDamage);

          // 荆棘反伤：对玩家自身造成反弹伤害
          if (pipeResult.thorns > 0) {
            characterStore.takeDamage(pipeResult.thorns);
            addCombatLog({
              actorType: 'system', actorId: 'system', actorName: '系统',
              eventType: 'combat_damage', targetType: 'player', targetId: 'player',
              targetName: characterStore.name, damage: pipeResult.thorns,
              isCrit: false, isDodge: false,
              message: `荆棘反伤对 ${characterStore.name} 造成 ${pipeResult.thorns} 点伤害！`
            });
          }

          aoeHits.push({ enemyId: e.id, enemyName: e.name, damage: aoeDamage });

          eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
            amount: aoeDamage,
            damageType: damageType === 'magical' ? 'magic' : 'physical',
            targetName: e.name || '敌人',
            actorType: 'player'
          });

          addCombatLog({
            actorType: 'player',
            actorId: 'player',
            actorName: characterStore.name,
            eventType: result.type === 'magic_damage' ? 'combat_skill_cast' : 'combat_damage',
            targetType: 'enemy',
            targetId: e.id,
            targetName: e.name || '',
            skillId,
            skillName: skill?.name || '',
            damage: aoeDamage,
            isCrit: false,
            isDodge: false,
            message: `${skill?.name || '技能'} 对 ${e.name} 造成 ${aoeDamage} 点${damageType === 'magical' ? '魔法' : '物理'}伤害！`
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
          createPlayerEffectContext(characterStore),
          createEnemyEffectContext(target),
          damageType,
          result.damage  // baseDamageOverride：技能基础伤害直接传入
        );

        const enemiesStore = useEnemiesStore();
        const isDead = enemiesStore.takeDamage(target.id, pipeResult.finalDamage);
        const updatedTarget = enemiesStore.getEnemyById(target.id);

        // 伤害类型音效事件
        eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
          amount: pipeResult.finalDamage,
          damageType: damageType === 'magical' ? 'magic' : 'physical',
          targetName: updatedTarget?.name || '敌人',
          actorType: 'player'
        });

        addCombatLog({
          actorType: 'player',
          actorId: 'player',
          actorName: characterStore.name,
          eventType: result.type === 'magic_damage' ? 'combat_skill_cast' : 'combat_damage',
          targetType: 'enemy',
          targetId: updatedTarget?.id || '',
          targetName: updatedTarget?.name || '',
          skillId,
          skillName: skill?.name || '',
          damage: pipeResult.finalDamage,
          isCrit: false,
          isDodge: false,
          message: `${skill?.name || '技能'} 对 ${updatedTarget?.name} 造成 ${pipeResult.finalDamage} 点${result.type === 'magic_damage' ? '魔法' : '物理'}伤害！`
        });

        // 附带 buff/debuff 效果（在 endCombat/endPlayerTurn 之前施加，防止效果添加到已清空的容器）
        if (skill?.buffs && skill.buffs.length > 0 && result.damage) {
          applySkillBuffs(skill, targetType);
        }

        if (isDead || !updatedTarget || aliveEnemies.value.length === 0) {
          endCombat('victory');
        } else {
          initiative.endPlayerTurn();
        }
      }
    } else if (result.appliedEffects && result.appliedEffects.length > 0) {
      // buff/debuff 技能：将效果应用到目标
      const effectSourceName = skill?.name || '技能';

      if (result.type === 'buff') {
        // 增益技能：对玩家自身施加效果
        const playerCtx = createPlayerEffectContext(characterStore);
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
          targetName: characterStore.name
        });

        addCombatLog({
          actorType: 'player', actorId: 'player', actorName: characterStore.name,
          eventType: 'combat_skill_cast', skillId, skillName: effectSourceName,
          isCrit: false, isDodge: false,
          message: `${characterStore.name} 使用了 ${effectSourceName}，获得增益效果！`
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
            actorType: 'player', actorId: 'player', actorName: characterStore.name,
            eventType: 'combat_skill_cast', skillId, skillName: effectSourceName,
            isCrit: false, isDodge: false,
            message: `${characterStore.name} 使用了 ${effectSourceName}，对所有敌人施加减益效果！`
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
            actorType: 'player', actorId: 'player', actorName: characterStore.name,
            eventType: 'combat_skill_cast', targetType: 'enemy',
            targetId: target.id, targetName: target.name,
            skillId, skillName: effectSourceName,
            isCrit: false, isDodge: false,
            message: `${characterStore.name} 对 ${target.name} 使用了 ${effectSourceName}！`
          });
          initiative.endPlayerTurn();
        }
      }
    } else if (result.heal) {
      // 生命恢复技能音效事件（skillsStore.castSkill 已通过 characterStore.receiveHeal 应用生命恢复）
      eventBus.emit(GameEvents.COMBAT_CAST_HEAL, {
        amount: result.heal,
        healType: result.type === 'mana_restore' ? 'mana' : 'health',
        targetName: characterStore.name
      });

      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterStore.name,
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
    const characterStore = useCharacterStore();
    const inventoryStore = useInventoryStore();

    // 先获取物品信息，判断是否为伤害型物品
    const itemInfo = inventoryStore.getItemInfo(itemId);
    let damageResult: { damage: number; isCrit: boolean } | null = null;

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
          createPlayerEffectContext(characterStore),
          createEnemyEffectContext(target),
          damageType,
          value  // baseDamageOverride：物品基础伤害直接传入
        );

        // 暴击判定
        const critChance = characterStore.attributes.critChance / 100;
        const isCrit = rollCritical(critChance);
        const critMultiplier = isCrit ? 1.5 : 1;
        const finalDamage = Math.floor(pipeResult.finalDamage * critMultiplier);

        // 造成伤害
        const enemiesStore = useEnemiesStore();
        enemiesStore.takeDamage(target.id, finalDamage);

        damageResult = { damage: finalDamage, isCrit };

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
    await inventoryStore.useItem(itemId);

    // 生命/法力恢复音效事件
    if (itemInfo?.effect) {
      const { type, value } = itemInfo.effect;
      if ((type === 'health_restore' || type === 'mana_restore') && typeof value === 'number' && value > 0) {
        eventBus.emit(GameEvents.COMBAT_CAST_HEAL, {
          amount: value,
          healType: type === 'mana_restore' ? 'mana' : 'health',
          targetName: characterStore.name
        });
      }
    }

    // 战斗日志
    if (damageResult) {
      const target = currentTarget.value;
      const enemiesStore = useEnemiesStore();
      const updatedTarget = target ? enemiesStore.getEnemyById(target.id) : null;
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterStore.name,
        eventType: damageResult.isCrit ? 'combat_critical' : 'combat_skill_cast',
        targetType: 'enemy',
        targetId: updatedTarget?.id || '',
        targetName: updatedTarget?.name || '',
        damage: damageResult.damage,
        isCrit: damageResult.isCrit,
        isDodge: false,
        message: damageResult.isCrit
          ? `${characterStore.name} 使用 ${itemInfo?.name || '卷轴'}，暴击！对 ${updatedTarget?.name} 造成 ${damageResult.damage} 点伤害！`
          : `${characterStore.name} 使用 ${itemInfo?.name || '卷轴'}，对 ${updatedTarget?.name} 造成 ${damageResult.damage} 点伤害！`
      });
    } else {
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterStore.name,
        eventType: 'combat_item',
        isCrit: false,
        isDodge: false,
        message: `${characterStore.name} 使用了 ${itemInfo?.name || '物品'}！`
      });
    }

    // 检查敌人是否全部死亡
    if (damageResult && aliveEnemies.value.length === 0) {
      endCombat('victory');
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
    const characterStore = useCharacterStore();

    if (hasBossEnemy.value) {
      return { success: false, type: 'flee', message: '无法从Boss战中逃跑！' };
    }

    // 使用纯函数计算逃跑成功率
    const stats = characterStore.effectiveStats;
    const fleeChance = calculateFleeChance(stats.dex);
    const success = rollFleeSuccess(fleeChance);

    if (success) {
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterStore.name,
        eventType: 'combat_flee',
        isCrit: false,
        isDodge: false,
        message: `${characterStore.name} 成功逃离了战斗！`
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
        actorName: characterStore.name,
        eventType: 'combat_miss',
        isCrit: false,
        isDodge: false,
        message: `${characterStore.name} 逃跑失败！`
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
        const amount = Math.floor(Math.random() * (drop.maxAmount - drop.minAmount + 1)) + drop.minAmount;

        // 获取物品模板信息
        const itemInfo = useInventoryStore().getItemInfo(drop.itemId);
        if (itemInfo) {
          // 直接调用 inventoryStore 添加物品
          useInventoryStore().addItem(drop.itemId, amount);
        }

        addCombatLog({
          actorType: 'system',
          actorId: 'system',
          actorName: '系统',
          eventType: 'combat_item',
          isCrit: false,
          isDodge: false,
          message: `获得物品 ${drop.itemId} x${amount}！`
        });

        // 记录战利品到冒险日志
        const itemName = itemInfo?.name || drop.itemId;
        useLogStore().addLogEntry({
          id: generateLogId(),
          timestamp: Date.now(),
          type: 'item',
          message: `从 ${e.name} 获得 ${itemName} x${amount}`,
          icon: 'game-icons:backpack'
        });
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
