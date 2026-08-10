/**
 * 先攻排序和回合推进 Composable
 * 
 * 从 combat store 提取的先攻排序、回合切换和敌人回合调度逻辑。
 * 依赖 useCombatState（状态持有）、useCombatLog（日志记录）、
 * useEnemyAction（敌人行动）和 useBossMechanics（Boss 机制效果）。
 */
import type { CombatResult } from '../types';
import type { EnemyInstance } from '@/modules/enemy';
import type { ICombatContext } from '../combatContext';
import { eventBus, GameEvents } from '../../bus';
import { processBossPhaseMechanics, applyPhaseStats } from '@/modules/boss';
import { INITIATIVE_DEFAULT_SPEED } from '@/config/combat';
import { createEmptyContainer } from '../effects';
import type { useCombatState } from './useCombatState';
import type { useCombatLog } from './useCombatLog';
import type { useEnemyAction } from './useEnemyAction';
import type { useBossMechanics } from './useBossMechanics';
import type { usePassiveSkills } from './usePassiveSkills';
import type { usePetAction } from './usePetAction';

export function useInitiative(
  state: ReturnType<typeof useCombatState>,
  log: ReturnType<typeof useCombatLog>,
  // ARCH-6：需完整上下文（读 character.effectiveStats/name/hp、enemy.getEnemyById；写 character.takeDamage/receiveHeal、enemy.takeDamage/tickCooldowns、skill.tickCooldowns）
  ctx: ICombatContext,
  enemyAction: ReturnType<typeof useEnemyAction>,
  boss: ReturnType<typeof useBossMechanics>,
  endCombat: (result: CombatResult) => void,
  passive?: ReturnType<typeof usePassiveSkills>,
  // P3-156：宠物行动层（可选，术士/猎人战斗中注入）
  pet?: ReturnType<typeof usePetAction>,
) {
  // ==================== 内部辅助：先攻排序 ====================

  /**
   * 分配敌人位置到 3×2 网格（前排 3 格 + 后排 3 格）
   * Boss 优先放在后排中间，普通敌人优先填满前排
   * @param enemiesData - 敌人数据数组
   */
  function assignEnemyPositions(enemiesData: EnemyInstance[]): void {
    const positions: Record<string, { row: 'front' | 'back'; col: number }> = {};
    const frontSlots: number[] = [0, 1, 2]; // 前排 3 个位置
    const backSlots: number[] = [0, 1, 2];  // 后排 3 个位置

    // 分离 Boss 和普通敌人
    const bosses = enemiesData.filter(e => e.isBoss);
    const normals = enemiesData.filter(e => !e.isBoss);

    // Boss 优先占后排中间位置
    for (const bossEnemy of bosses) {
      const col = backSlots.shift() ?? 0;
      positions[bossEnemy.id] = { row: 'back', col };
    }

    // 普通敌人优先填满前排，再填后排
    for (const enemy of normals) {
      if (frontSlots.length > 0) {
        const col = frontSlots.shift()!;
        positions[enemy.id] = { row: 'front', col };
      } else if (backSlots.length > 0) {
        const col = backSlots.shift()!;
        positions[enemy.id] = { row: 'back', col };
      }
    }

    state.enemyPositions.value = positions;
  }

  /**
   * 构建先攻顺序（玩家 + 宠物 + 所有敌人，按速度降序排列）
   *
   * 玩家速度与敌人速度均通过 effectRegistry.reduceSum 应用 getSpeedMod 效果修正，
   * 使减速/冰冻效果能正确影响先攻顺序（P2-1）。
   *
   * P3-156：若宠物行动层已注入且有激活的召唤物，将 'pet' 插入先攻序列。
   */
  function buildInitiativeOrder(): void {
    const units: { id: string; speed: number }[] = [];

    // 玩家速度（含效果修正）
    const playerCtx = log.createPlayerEffectContext();
    const speedMod = state.effectRegistry.reduceSum(state.playerEffects.value, 'getSpeedMod', playerCtx);
    // P2-45 修复：统一使用 ?? 操作符，避免 dex=0 时被 || 吞掉
    const playerSpeed = (ctx.character.effectiveStats.dex ?? 0) + speedMod;
    units.push({ id: 'player', speed: playerSpeed });

    // P3-156：宠物先攻（仅当有激活的召唤物时插入）
    if (pet?.petStore.hasActivePet) {
      const petInstance = pet.petStore.activePet;
      if (petInstance) {
        units.push({ id: 'pet', speed: petInstance.speed });
      }
    }

    // 所有敌人速度（P2-1：与玩家侧一致，应用 getSpeedMod 效果修正，使减速/冰冻影响先攻顺序）
    for (const e of state.enemies.value) {
      const enemyCtx = log.createEnemyEffectContext(e);
      const enemySpeedMod = state.effectRegistry.reduceSum(
        state.enemyEffects.value[e.id] || createEmptyContainer(),
        'getSpeedMod',
        enemyCtx
      );
      const enemySpeed = (e.stats?.dex ?? INITIATIVE_DEFAULT_SPEED) + enemySpeedMod;
      units.push({ id: e.id, speed: enemySpeed });
    }

    // 按速度降序排列
    units.sort((a, b) => b.speed - a.speed);
    state.initiativeOrder.value = units.map(u => u.id);
    // 找到玩家在排序后的实际位置，确保 advanceTurn 能正确推进到下一个单位
    const playerIndex = state.initiativeOrder.value.indexOf('player');
    state.currentInitiativeIndex.value = playerIndex >= 0 ? playerIndex : 0;
  }

  /**
   * 推进到下一个行动者
   * @returns 下一个行动者的 ID 和是否为玩家
   */
  function advanceTurn(): { unitId: string; isPlayer: boolean } {
    // P3-8：空先攻数组防御，防止取模得 NaN 导致 advanceToNextUnit 无限递归栈溢出
    if (state.initiativeOrder.value.length === 0) {
      return { unitId: '', isPlayer: false };
    }
    state.currentInitiativeIndex.value = (state.currentInitiativeIndex.value + 1) % state.initiativeOrder.value.length;
    if (state.currentInitiativeIndex.value === 0) {
      state.turnCount.value++;
    }
    const unitId = state.initiativeOrder.value[state.currentInitiativeIndex.value];
    return { unitId, isPlayer: unitId === 'player' };
  }

  /**
   * 切换战斗速度（1x / 2x）
   */
  function toggleCombatSpeed(): void {
    state.combatSpeed.value = state.combatSpeed.value === 1 ? 2 : 1;
  }

  /**
   * 推进到先攻序列中的下一个行动者
   * 如果是玩家则设置玩家回合；'pet' 走宠物回合；否则延迟调用敌人回合。
   * 当先攻索引回绕到 0（新一轮开始）时，对所有效果执行一次 tick。
   *
   * P3-156：新增 'pet' 分支，调用 singlePetTurn 执行宠物行动。
   */
  function advanceToNextUnit(): void {
    if (state.state.value !== 'fighting') return;
    const next = advanceTurn();

    // P3-186：空先攻数组防御，advanceTurn 返回空 unitId 时直接中止，防止无限递归
    if (!next.unitId) return;

    // 新一轮开始时，对所有效果执行一次 tick（不再每个敌人回合 tick）
    if (state.currentInitiativeIndex.value === 0) {
      tickAllEffects();
      // P3-170：tickAllEffects 可能因 DOT 击杀触发 endCombat，需在继续前检查战斗状态
      if (state.state.value !== 'fighting') return;
      // P3-156：宠物状态推进（技能冷却、持续时间、死亡清理），与效果 tick 同步
      pet?.petTickTurn();
    }

    if (next.unitId === 'player') {
      state.turn.value = 'player';
      ctx.skill.tickCooldowns();
      // 玩家回合开始时触发资源系统 onTurnStart 钩子（如怒气/能量回复）
      state.resourceSystems.value.forEach(sys => sys.onTurnStart?.());
      // 触发被动技能 onTurnStart 钩子（如法师法力涌动、德鲁伊自然治愈、牧师神圣冥想）
      passive?.onTurnStart();
      eventBus.emit(GameEvents.COMBAT_PLAYER_TURN, null);
    } else if (next.unitId === 'pet') {
      // P3-156：宠物回合
      state.turn.value = 'pet';
      state.turnTimerId.value = window.setTimeout(() => {
        state.turnTimerId.value = null;
        singlePetTurn();
      }, Math.round(500 / Math.max(0.1, state.combatSpeed.value)));
    } else {
      state.turn.value = 'enemy';
      state.turnTimerId.value = window.setTimeout(() => {
        state.turnTimerId.value = null;
        singleEnemyTurn(next.unitId);
      }, Math.round(500 / Math.max(0.1, state.combatSpeed.value)));
    }
  }

  /**
   * 对所有效果执行一次 tick（每回合一次，在新一轮开始时调用）
   * 处理玩家和所有敌人的持续伤害、生命恢复效果。
   */
  function tickAllEffects(): void {
    // ===== 阶段 1：收集所有效果的 tick 结果 =====
    const playerTickResult = state.effectRegistry.tickAll(
      state.playerEffects.value,
      log.createPlayerEffectContext()
    );

    const enemyTickResults: Map<string, { dotDamage: number; regenAmount: number }> = new Map();
    const deadEnemyIds: string[] = [];
    for (const [eId, container] of Object.entries(state.enemyEffects.value)) {
      const enemy = ctx.enemy.getEnemyById(eId);
      if (!enemy || enemy.hp <= 0) {
        deadEnemyIds.push(eId);
        continue;
      }
      enemyTickResults.set(eId, state.effectRegistry.tickAll(container, log.createEnemyEffectContext(enemy)));
    }

    // ===== 阶段 2：统一应用伤害/恢复 =====
    // 玩家
    if (playerTickResult.dotDamage > 0) {
      ctx.character.takeDamage(playerTickResult.dotDamage);
      log.addCombatLog({
        actorType: 'system', actorId: 'system', actorName: '系统',
        eventType: 'combat_damage', targetType: 'player', targetId: 'player',
        targetName: ctx.character.name, damage: playerTickResult.dotDamage,
        isCrit: false, isDodge: false,
        message: `持续伤害对 ${ctx.character.name} 造成 ${playerTickResult.dotDamage} 点伤害！`
      });
    }
    if (playerTickResult.regenAmount > 0) {
      ctx.character.receiveHeal(playerTickResult.regenAmount);
      log.addCombatLog({
        actorType: 'system', actorId: 'system', actorName: '系统',
        eventType: 'combat_heal', targetType: 'player', targetId: 'player',
        targetName: ctx.character.name, heal: playerTickResult.regenAmount,
        isCrit: false, isDodge: false,
        message: `生命恢复为 ${ctx.character.name} 恢复了 ${playerTickResult.regenAmount} 点生命值！`
      });
    }
    // 敌人
    for (const [eId, tickRes] of enemyTickResults) {
      if (tickRes.dotDamage > 0) {
        ctx.enemy.takeDamage(eId, tickRes.dotDamage);
        const enemy = ctx.enemy.getEnemyById(eId);
        if (enemy) {
          log.addCombatLog({
            actorType: 'system', actorId: 'system', actorName: '系统',
            eventType: 'combat_damage', targetType: 'enemy', targetId: eId,
            targetName: enemy.name, damage: tickRes.dotDamage,
            isCrit: false, isDodge: false,
            message: `持续伤害对 ${enemy.name} 造成 ${tickRes.dotDamage} 点伤害！`
          });
        }
      }
      if (tickRes.regenAmount > 0) {
        const enemy = ctx.enemy.getEnemyById(eId);
        if (enemy) {
          // P3-184：使用 receiveHeal 替代 takeDamage(负值)，语义清晰且避免误触发"受伤时"逻辑
          ctx.enemy.receiveHeal(eId, tickRes.regenAmount);
          log.addCombatLog({
            actorType: 'system', actorId: 'system', actorName: '系统',
            eventType: 'combat_heal', targetType: 'enemy', targetId: eId,
            targetName: enemy.name, heal: tickRes.regenAmount,
            isCrit: false, isDodge: false,
            message: `生命恢复为 ${enemy.name} 恢复了 ${tickRes.regenAmount} 点生命值！`
          });
        }
      }
    }

    // 清理已死亡敌人的效果容器
    for (const deadId of deadEnemyIds) {
      delete state.enemyEffects.value[deadId];
    }

    // ===== 阶段 3：统一检查死亡 =====
    if (ctx.character.hp <= 0) {
      endCombat('defeat');
      // P2-37 修复：移除重复的 saveLogs 调用，endCombat 内部已调用 log.saveLogs()
      return;
    }
    // 检查敌人是否全部死亡（DOT 杀敌触发胜利判定，BIZ-4 修复）
    // P9-008 修复：DOT 击杀 Boss 时检查复活机制
    for (const eId of enemyTickResults.keys()) {
      const tickRes = enemyTickResults.get(eId);
      if (tickRes?.dotDamage && tickRes.dotDamage > 0) {
        const enemy = ctx.enemy.getEnemyById(eId);
        if (enemy && enemy.hp <= 0) {
          boss.checkBossRevive(enemy);
        }
      }
    }
    const allEnemiesDead = state.enemies.value.every(e => e.hp <= 0);
    if (allEnemiesDead && state.enemies.value.length > 0) {
      endCombat('victory');
      // P2-37 修复：移除重复的 saveLogs 调用，endCombat 内部已调用 log.saveLogs()
      return;
    }
  }

  /**
   * 宠物回合（P3-156 新增）
   *
   * 执行该宠物的行动，然后推进到下一个行动者。
   * 结构参照 singleEnemyTurn 但简化（无 Boss 阶段、无 AI 策略注册表）。
   *
   * 宠物死亡/被解散时从先攻序列移除并推进，与敌人死亡清理逻辑一致。
   */
  function singlePetTurn(): void {
    if (state.state.value !== 'fighting') return;

    // 宠物已死亡或被解散，从先攻序列移除
    if (!pet?.petStore.hasActivePet) {
      const removedIndex = state.initiativeOrder.value.indexOf('pet');
      if (removedIndex !== -1) {
        state.initiativeOrder.value = state.initiativeOrder.value.filter(id => id !== 'pet');
        // P3-11：若移除位置在当前索引之前，递减当前索引防止跳过下一个单位回合
        if (removedIndex < state.currentInitiativeIndex.value) {
          state.currentInitiativeIndex.value--;
        }
        if (state.currentInitiativeIndex.value >= state.initiativeOrder.value.length) {
          state.currentInitiativeIndex.value = 0;
        }
      }
      advanceToNextUnit();
      return;
    }

    const petInstance = pet.petStore.activePet;
    if (!petInstance) {
      advanceToNextUnit();
      return;
    }

    // 记录宠物回合开始
    log.addCombatLog({
      actorType: 'system',
      actorId: 'system',
      actorName: '系统',
      eventType: 'combat_turn_start',
      isCrit: false,
      isDodge: false,
      message: `${petInstance.name} 的回合`,
    });

    // 执行宠物行动
    pet.petTakeTurn();

    // 检查敌人是否全部死亡（宠物击杀触发胜利判定）
    const allEnemiesDead = state.enemies.value.length > 0 && state.enemies.value.every(e => e.hp <= 0);
    if (allEnemiesDead) {
      endCombat('victory');
      return;
    }

    // 推进到下一个行动者
    advanceToNextUnit();
    // 与 singleEnemyTurn 保持一致：仅在仍在战斗中时保存日志
    if (state.state.value === 'fighting') {
      log.saveLogs();
    }
  }

  /**
   * 单个敌人回合（速度制先攻调度用）
   * 执行该敌人的行动，然后推进到下一个行动者。
   * 如果下一个仍是敌人则继续链式调用，直到回合回到玩家。
   * 效果 tick 已提升到 advanceToNextUnit 中新轮开始时统一执行。
   * @param enemyId - 敌人 ID
   */
  function singleEnemyTurn(enemyId: string): void {
    if (state.state.value !== 'fighting') return;

    const e = state.enemies.value.find(en => en.id === enemyId);
    if (!e || e.hp <= 0) {
      // 敌人已死亡，从先攻序列中移除并清理效果容器
      if (e) {
        // P3-11：记录被移除元素的索引，若在当前索引之前则递减当前索引，防止跳过下一个单位回合
        const removedIndex = state.initiativeOrder.value.indexOf(enemyId);
        state.initiativeOrder.value = state.initiativeOrder.value.filter(id => id !== enemyId);
        delete state.enemyEffects.value[enemyId];
        if (removedIndex !== -1 && removedIndex < state.currentInitiativeIndex.value) {
          state.currentInitiativeIndex.value--;
        }
        // 修正当前索引，防止因移除元素导致索引越界
        if (state.currentInitiativeIndex.value >= state.initiativeOrder.value.length) {
          state.currentInitiativeIndex.value = 0;
        }
      }
      advanceToNextUnit();
      return;
    }

    // 记录敌人行动开始
    log.addCombatLog({
      actorType: 'system',
      actorId: 'system',
      actorName: '系统',
      eventType: 'combat_turn_start',
      isCrit: false,
      isDodge: false,
      message: `${e.name} 的回合`
    });

    // 处理 Boss 阶段转换和机制
    // 阶段四：EnemyData 已移除 phases 字段，通过 bossInstance.phases 访问
    if (e.isBoss) {
      const phaseManager = state.bossPhaseManagers.get(e.id);
      const bossInstance = state.bossInstances.get(e.id);
      if (phaseManager && bossInstance && bossInstance.phases.length > 0) {
        const result = phaseManager.getCurrentPhase(bossInstance.phases, e.hp, e.maxHp);
        const currentPhase = result.phase;
        if (result.changed && currentPhase) {
          applyPhaseStats(bossInstance, currentPhase);
          // 同步更新 AI 策略为当前阶段的策略
          if (currentPhase.aiStrategy) {
            // P3-175：通过 Store action 修改，替代直接修改 e.aiStrategy
            ctx.enemy.setAiStrategy(e.id, currentPhase.aiStrategy);
          }
          log.addCombatLog({
            actorType: 'system', actorId: 'system', actorName: '系统',
            eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
            targetName: e.name, isCrit: false, isDodge: false,
            message: `【阶段转换】${e.name} 进入 "${currentPhase.name}" 阶段！`
          });
          // 发射阶段转换事件（UI 特效）
          eventBus.emit(GameEvents.COMBAT_BOSS_PHASE, {
            enemyId: e.id,
            enemyName: e.name,
            phaseName: currentPhase.name,
            effect: currentPhase.transitionEffect || 'darken'
          });
          if (currentPhase.dialogue && currentPhase.dialogue.length > 0) {
            for (const line of currentPhase.dialogue) {
              log.addCombatLog({
                actorType: 'system', actorId: 'system', actorName: e.name,
                eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
                targetName: e.name, isCrit: false, isDodge: false,
                message: `"${line}"`
              });
            }
          }
        }
        if (currentPhase) {
          const triggered = processBossPhaseMechanics(bossInstance, currentPhase, state.turnCount.value);
          for (const mechType of triggered) {
            const mechNames: Record<string, string> = {
              enrage: '狂暴', damage_shield: '伤害护盾', aoe_attack: '范围攻击',
              summon_minions: '召唤小怪', stun_player: '眩晕玩家', debuff_aura: '减益光环'
            };
            log.addCombatLog({
              actorType: 'system', actorId: 'system', actorName: '系统',
              eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
              targetName: e.name, isCrit: false, isDodge: false,
              message: `${e.name} 触发了【${mechNames[mechType] || mechType}】机制！`
            });

            // 实际应用机制效果（阶段十：triggered 已为 BossMechanicType[]，无需断言）
            boss.applyMechanicEffect(bossInstance, mechType, currentPhase);
          }
        }
      }
    }

    // 推进该敌人的技能冷却
    ctx.enemy.tickCooldowns(e.id);

    // P3-168：检查敌人是否被控制（stun/freeze 导致跳过回合）
    const enemyContainer = state.enemyEffects.value[e.id] || createEmptyContainer();
    const disableResult = state.effectRegistry.getDisabledActions(enemyContainer);
    if (disableResult.skipTurn) {
      log.addCombatLog({
        actorType: 'system', actorId: 'system', actorName: '系统',
        eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
        targetName: e.name, isCrit: false, isDodge: false,
        message: `${e.name} 被控制，无法行动！`
      });
      advanceToNextUnit();
      if (state.state.value === 'fighting') {
        log.saveLogs();
      }
      return;
    }

    // 执行敌人行动
    enemyAction.enemyAction(e);

    // 检查玩家是否死亡
    if (ctx.character.hp <= 0) {
      endCombat('defeat');
      // P2 BIZ-3 修复：移除重复的 saveLogs 调用，endCombat 内部已调用 log.saveLogs()
      return;
    }

    // 推进到下一个行动者
    advanceToNextUnit();
    // P2 BIZ-3 修复：仅在仍在战斗中时保存日志，避免与 endCombat 内部的 saveLogs 重复
    if (state.state.value === 'fighting') {
      log.saveLogs();
    }
  }

  /**
   * 结束玩家回合
   * 推进到先攻序列中的下一个行动者后持久化日志。
   */
  function endPlayerTurn(): void {
    advanceToNextUnit();
    // P2 BIZ-2 修复：先推进回合再保存日志，确保 tickAllEffects 产生的新日志（DOT/恢复）被保存
    // 若 advanceToNextUnit 触发了 endCombat，则 endCombat 内部已调用 saveLogs，此处跳过避免重复
    if (state.state.value === 'fighting') {
      log.saveLogs();
    }
  }

  return {
    assignEnemyPositions,
    buildInitiativeOrder,
    advanceTurn,
    toggleCombatSpeed,
    advanceToNextUnit,
    singleEnemyTurn,
    endPlayerTurn,
  };
}
