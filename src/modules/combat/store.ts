/**
 * 战斗模块状态管理层（Store 核心架构 — 组合入口）
 * 
 * Store 是战斗数据的唯一持有者，所有响应式状态集中管理。
 * 重构后，Store ~170 行，具体逻辑按职责拆分到 composables/ 子目录。
 * 
 * S2/S3 解耦：所有外部 Store 依赖通过 ICombatContext 单一接口收口，
 * combat ↔ boss 结构性耦合通过 IBossContext 接口注入，Store 是唯一引用
 * 外部 Store 的位置（createCombatContext 内部）。
 * 
 * EventBus 仅保留 UI/音效事件：
 * COMBAT_START, COMBAT_END, COMBAT_PLAYER_TURN, COMBAT_ENEMY_TURN,
 * COMBAT_DEAL_DAMAGE, COMBAT_CAST_HEAL, COMBAT_CRITICAL_HIT, COMBAT_DODGE,
 * COMBAT_SKIP_TURN
 */
import { defineStore } from 'pinia';
import type { CombatAction, CombatActionResult, CombatResult } from './types';
import type { EnemyInstance } from '@/modules/enemy/types';
import type { Skill } from '@/modules/skill/types';
import { eventBus, GameEvents } from '@/modules/bus';
import { generateLogId } from '@/modules/log/service';
import { isBossCombat, generateCombatId } from './service';
import { createEmptyContainer } from './effects';
import { ResourceSystemFactory } from './resources';

import { createCombatContext, type ICombatContext } from './combatContext';
import { useCombatState } from './composables/useCombatState';
import { useCombatLog } from './composables/useCombatLog';
import { useBossMechanics, type IBossContext } from './composables/useBossMechanics';
import { useEnemyAction } from './composables/useEnemyAction';
import type { Rng } from '@/utils/rng';
import { useInitiative } from './composables/useInitiative';
import { usePlayerAction } from './composables/usePlayerAction';
import { usePassiveSkills } from './composables/usePassiveSkills';

/**
 * 战斗状态存储
 */
export const useCombatStore = defineStore('combat', () => {
  // ==================== 组合所有模块 ====================

  // 0. 上下文层（S2：集中所有外部 Store 引用，combat 模块唯一引用外部 Store 的位置）
  const ctx: ICombatContext = createCombatContext();

  // P2-35 修复：延迟绑定容器（替代 let + null hack）
  // 结构性循环依赖：useInitiative 依赖 useBossMechanics（通过 boss 参数），
  // 而 bossCtx.rebuildInitiativeOrder 需要调用 initiative.buildInitiativeOrder。
  // 使用 holder 对象承载延迟绑定的引用，语义比 let + null 更清晰：
  // - holder.current 显式表达"延迟赋值"意图
  // - 避免裸 let 变量被误用为可变状态
  // - 调用方通过 holder.current?.fn() 安全访问
  const initiativeHolder: { current: { buildInitiativeOrder: () => void } | null } = { current: null };

  // 1. 状态层（ref/conputed/生命周期）
  const state = useCombatState(ctx);

  // 2. 日志层（addCombatLog / saveLogs / EffectContext 工厂）
  const log = useCombatLog(state, ctx);

  // 3. Boss 上下文（S3：实现 IBossContext，注入 useBossMechanics）
  const bossCtx: IBossContext = {
    getPlayerName: () => ctx.character.name,
    createMinion: (dataId, level) => ctx.enemy.createEnemy(dataId, level),
    rebuildInitiativeOrder: () => initiativeHolder.current?.buildInitiativeOrder(),
    applyDamageToPlayer: (amount) => ctx.character.takeDamage(amount),
  };

  // 4. Boss 机制层（通过 bossCtx 接口访问玩家名称、创建小怪、重建先攻）
  const boss = useBossMechanics(state, log, bossCtx);

  // 5. 被动技能层（需在 enemy 之前创建以便注入）
  const passive = usePassiveSkills(state, log, ctx);

  // 6. 敌人行动层（注入 passive 以便在玩家受伤时触发 onDamaged 被动）
  const enemy = useEnemyAction(state, log, ctx, passive);

  // P2-36 修复：player 延迟绑定容器
  // 结构性循环依赖：endCombat 调用 player.handleLoot，而 player 又依赖 endCombat（用于 playerFlee 等）。
  // 使用 holder 对象避免 TDZ 风险（player 是 const，定义在 endCombat 之后），
  // 同时显式表达"延迟绑定"意图，避免阅读 endCombat 时困惑 player 的来源。
  const playerHolder: { current: { handleLoot: (e: EnemyInstance, rng?: Rng) => void } | null } = { current: null };

  // ==================== endCombat ====================

  /**
   * 结束战斗
   * @param result - 战斗结果
   */
  async function endCombat(result: CombatResult): Promise<void> {
    // 防止重入：已在结算中或战斗已结束时直接忽略
    if (state.state.value === 'ended' || state.state.value === 'idle') return;

    if (state.enemies.value.length === 0) {
      // 无敌人时直接标记结束并清理效果
      state.state.value = 'ended';
      state.playerEffects.value = createEmptyContainer();
      state.enemyEffects.value = {};
      return;
    }

    // 清空效果容器
    state.playerEffects.value = createEmptyContainer();
    state.enemyEffects.value = {};

    try {
      // 双日志职责说明（CMB-3）：
      // - ctx.log（useLogStore）：冒险日志，记录战斗结果的摘要（击败/获得经验/逃跑等），面向玩家回顾
      // - log（useCombatLog）：战斗日志，记录详细的逐回合战斗事件，面向战斗回放与调试
      // 两者独立写入，互不干扰，避免职责混乱
      state.state.value = 'ended';

      const enemyNames = state.enemies.value.map(e => e.name).join('、');
      let totalExp = 0;
      let totalGold = 0;

      if (result === 'victory') {
        totalExp = state.enemies.value.reduce((sum, e) => sum + (e.expReward || 0), 0);
        totalGold = state.enemies.value.reduce((sum, e) => sum + (e.goldReward || 0), 0);

        state.combatResult.value = result;
        state.expGained.value = totalExp;
        state.goldGained.value = totalGold;

        ctx.log.addLogEntry({
          id: generateLogId(), timestamp: Date.now(), type: 'combat',
          message: `击败 ${enemyNames}！`, icon: 'game-icons:laurel-crown'
        });

        if (totalExp > 0) {
          ctx.log.addLogEntry({
            id: generateLogId(), timestamp: Date.now(), type: 'combat',
            message: `获得 ${totalExp} 点经验值`, icon: 'game-icons:star-formation'
          });
        }
        if (totalGold > 0) {
          ctx.log.addLogEntry({
            id: generateLogId(), timestamp: Date.now(), type: 'combat',
            message: `获得 ${totalGold} 金币`, icon: 'game-icons:two-coins'
          });
        }

        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_end', isCrit: false, isDodge: false,
          message: `战斗胜利！获得 ${totalExp} 经验值和 ${totalGold} 金币！`
        });

        await Promise.all([
          ctx.character.gainExp(totalExp),
          ctx.character.gainGold(totalGold)
        ]);

        // 战斗胜利时触发资源系统 onKill 钩子（击杀获取资源，如怒气/连击点/灵魂碎片）
        state.resourceSystems.value.forEach(sys => sys.onKill?.());

        // 触发被动技能 onKill 钩子（如术士灵魂虹吸：击杀获得额外灵魂碎片）
        passive.onKill();

        // 处理掉落（仅 Boss）
        // P2-36 修复：通过 playerHolder 延迟引用 player，避免 TDZ 风险
        for (const e of state.enemies.value) {
          if (isBossCombat(e)) {
            playerHolder.current?.handleLoot(e);
          }
        }

        // 更新击杀进度
        for (const e of state.enemies.value) {
          if (e.dataId) {
            ctx.quest.onEnemyKilled(e.dataId);
          }
        }
      } else if (result === 'defeat') {
        state.combatResult.value = result;
        state.expGained.value = 0;
        state.goldGained.value = 0;

        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_end', isCrit: false, isDodge: false,
          message: '战斗失败！'
        });

        ctx.log.addLogEntry({
          id: generateLogId(), timestamp: Date.now(), type: 'combat',
          message: `被 ${enemyNames} 击败！`, icon: 'game-icons:death-zone'
        });

        ctx.character.handleDeath();
      } else if (result === 'fled') {
        state.combatResult.value = result;
        state.expGained.value = 0;
        state.goldGained.value = 0;

        log.addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_end', isCrit: false, isDodge: false,
          message: '战斗以逃跑结束'
        });

        ctx.log.addLogEntry({
          id: generateLogId(), timestamp: Date.now(), type: 'combat',
          message: `从 ${enemyNames} 面前逃跑`, icon: 'game-icons:run'
        });
      }

      // P2-46 修复：await saveLogs，避免 dispose/角色切换时日志写入丢失
      await log.saveLogs();

      // P3-89 修复：COMBAT_END 事件载荷补充敌人摘要（enemyCount/enemyNames），
      // 同时保留首个敌人引用 `enemy` 以向后兼容既有消费者（仅读取首敌信息的 UI/音效）。
      eventBus.emit(GameEvents.COMBAT_END, {
        result,
        enemy: state.enemies.value[0] || null,
        enemyCount: state.enemies.value.length,
        enemyNames: state.enemies.value.map(e => e.name),
        expGained: result === 'victory' ? totalExp : 0,
        goldGained: result === 'victory' ? totalGold : 0
      });

      state.cleanup();
      // cleanup 会重置所有状态（含 combatResult），需在 cleanup 后重新设置结果，
      // 供 UI 结果弹窗展示（v-if="combatStore.combatResult"）及自动关闭逻辑使用
      state.combatResult.value = result;
      state.expGained.value = result === 'victory' ? totalExp : 0;
      state.goldGained.value = result === 'victory' ? totalGold : 0;
    } catch (e) {
      console.error('[CombatStore] 结束战斗异常:', e);
      state.cleanup();
    }
  }

  // 7. 先攻/调度层（依赖 endCombat）
  const initiative = useInitiative(state, log, ctx, enemy, boss, endCombat, passive);

  // P2-35 修复：initiative 已就位，绑定到 initiativeHolder 供 bossCtx.rebuildInitiativeOrder 使用
  initiativeHolder.current = initiative;

  // 8. 玩家行动层（注入 endCombat 和 passive，消除 (state as any) 依赖）
  // BIZ-5：注入 passive 以便在伤害计算中应用 stat_modifier 和 buff 效果
  // 阶段九：注入 boss 以便调用 Boss 防御/反击/复活机制（已从 usePlayerAction 迁出到 useBossMechanics）
  const player = usePlayerAction(state, log, ctx, initiative, endCombat, passive, boss);

  // P2-36 修复：player 已就位，绑定到 playerHolder 供 endCombat.handleLoot 使用
  playerHolder.current = player;

  // ==================== Action：开始战斗 ====================

  function startCombat(enemiesData: EnemyInstance[]): void {
    // P3-1：防御性重置，防止上一场战斗未正常 endCombat（组件异常卸载等）时
    // 旧的 turnTimerId/bossIntroTimerId 残留并向新战斗 UI 推送过期数据
    state.reset();
    state.combatId.value = generateCombatId();
    state.state.value = 'fighting';
    state.enemyIds.value = enemiesData.map(e => e.id);
    state.targetEnemyId.value = null;
    state.turn.value = 'player';
    state.turnCount.value = 1;
    state.combatLogs.value = [];
    state.combatResult.value = null;
    state.expGained.value = 0;
    state.goldGained.value = 0;
    state.playerEffects.value = createEmptyContainer();
    state.enemyEffects.value = {};

    // P2-3：重置技能冷却，防止跨战斗冷却残留
    ctx.skill.resetCooldowns();

    // 初始化玩家资源系统（根据职业创建，空数组表示使用默认 MP 系统）
    state.resourceSystems.value = ResourceSystemFactory.create(ctx.character.classId);
    // 战斗开始钩子：重置资源到初始值
    state.resourceSystems.value.forEach(sys => sys.reset());

    // 加载当前职业的被动技能并触发战斗开始钩子（Phase 5.2）
    passive.loadPassives();
    passive.onCombatStart();

    boss.initBossFeatures(enemiesData);
    initiative.assignEnemyPositions(enemiesData);

    initiative.buildInitiativeOrder();

    const enemyNames = enemiesData.map(e => e.name).join('、');

    log.addCombatLog({
      actorType: 'system', actorId: 'system', actorName: '系统',
      eventType: 'combat_start', message: `战斗开始！你遭遇了 ${enemyNames}！`
    });

    ctx.log.addLogEntry({
      id: generateLogId(), timestamp: Date.now(), type: 'combat',
      message: `遭遇 ${enemyNames}！`, icon: 'game-icons:crossed-swords'
    });

    eventBus.emit(GameEvents.COMBAT_START, { enemy: enemiesData[0] });

    const bossIntroEntries = Object.entries(state.bossIntros.value);
    if (bossIntroEntries.length > 0) {
      const [bossId, intro] = bossIntroEntries[0];
      const bossEnemy = enemiesData.find(e => e.id === bossId);
      if (bossEnemy) {
        // 保存定时器 ID 到 state，战斗提前结束时由 resetState/cleanup 清理，
        // 避免向已结束的战斗 UI 推送 Boss 介绍数据
        state.bossIntroTimerId.value = window.setTimeout(() => {
          state.bossIntroTimerId.value = null;
          eventBus.emit(GameEvents.COMBAT_BOSS_INTRO, {
            enemyId: bossId, enemyName: bossEnemy.name, icon: bossEnemy.icon,
            effect: intro.effect, lines: intro.lines, duration: intro.duration
          });
        }, 300);
      }
    }

    eventBus.emit(GameEvents.COMBAT_PLAYER_TURN, null);
    // P2-46 修复：startCombat 为同步函数，使用 .catch 显式处理 saveLogs 错误，避免 unhandled rejection
    log.saveLogs().catch(err => console.error('[CombatStore] startCombat 保存日志失败:', err));
  }

  // ==================== Action：玩家行动 ====================

  async function playerAction(action: CombatAction): Promise<CombatActionResult> {
    if (state.state.value !== 'fighting' || state.turn.value !== 'player') {
      return { success: false, type: action.type, message: '不是你的回合！' };
    }

    // 控制效果检查
    const disableResult = state.effectRegistry.getDisabledActions(state.playerEffects.value);
    if (disableResult.skipTurn) {
      log.addCombatLog({
        actorType: 'player', actorId: 'player', actorName: ctx.character.name,
        eventType: 'combat_event', isCrit: false, isDodge: false,
        message: `${ctx.character.name} 无法行动！`
      });
      initiative.endPlayerTurn();
      return { success: false, type: action.type, isControlled: true, message: '你被控制了，无法行动！' };
    }
    if (action.type === 'skill' && disableResult.types.includes('skill')) {
      return { success: false, type: 'skill', isControlled: true, message: '你被沉默了，无法使用技能！' };
    }

    try {
      let result: CombatActionResult;
      switch (action.type) {
        case 'attack':
          result = player.playerAttack();
          // 攻击命中（非闪避）后触发资源系统 onAttack 钩子
          if (result.success && !result.isDodge) {
            state.resourceSystems.value.forEach(sys => sys.onAttack?.());
            // 触发被动技能 onAttack 钩子（如战士嗜血吸血、术士腐蚀术）
            passive.onAttack(result.damage || 0);
          }
          return result;
        case 'skill':
          if (!action.skillId) return { success: false, type: 'skill', message: '未指定技能！' };
          result = await player.playerSkill(action.skillId);
          // 技能施放成功后触发资源系统 onAttack（技能也算攻击行为）和 onSkill 生成
          if (result.success && !result.isDodge) {
            state.resourceSystems.value.forEach(sys => {
              sys.onAttack?.();
              sys.generate(1, 'skill');
            });
            // 触发被动技能 onAttack 钩子（技能也算攻击行为）
            passive.onAttack(result.damage || 0);
          }
          return result;
        case 'item':
          if (!action.itemId) return { success: false, type: 'item', message: '未指定物品！' };
          return await player.playerUseItem(action.itemId);
        case 'flee':
          return player.playerFlee();
        default:
          return { success: false, type: action.type, message: '未知行动类型！' };
      }
    } catch (e) {
      console.error('[CombatStore] 玩家行动异常:', e);
      return { success: false, type: action.type, message: '行动执行失败' };
    }
  }

  // ==================== Action：跳过回合 ====================

  function skipTurn(): void {
    if (state.state.value !== 'fighting' || state.turn.value !== 'player') return;

    log.addCombatLog({
      actorType: 'player', actorId: 'player', actorName: ctx.character.name,
      eventType: 'combat_turn_end', message: `${ctx.character.name} 跳过了回合`,
      isCrit: false, isDodge: false
    });
    eventBus.emit(GameEvents.COMBAT_SKIP_TURN, null);
    initiative.endPlayerTurn();
  }

  // ==================== 资源系统辅助方法 ====================

  /**
   * 检查技能资源是否足够（MP 仍由 skillsStore.castSkill 内部检查，此方法仅检查专属资源）
   * @param skill - 技能数据（含可选 resourceType/resourceCost 字段）
   * @returns 是否有足够资源施放
   */
  function canCastSkill(skill: Skill): boolean {
    const resourceType = skill.resourceType;
    const resourceCost = skill.resourceCost;
    if (!resourceType || !resourceCost) return true;
    for (const sys of state.resourceSystems.value) {
      if (resourceType === sys.type) {
        return sys.hasEnough(resourceCost);
      }
    }
    return true;
  }

  /**
   * 消耗技能专属资源（MP 由 skillsStore.castSkill 内部处理）
   * @param skill - 技能数据
   * @returns 是否消耗成功
   */
  function consumeSkillResource(skill: Skill): boolean {
    const resourceType = skill.resourceType;
    const resourceCost = skill.resourceCost;
    if (!resourceType || !resourceCost) return true;
    for (const sys of state.resourceSystems.value) {
      if (resourceType === sys.type) {
        return sys.consume(resourceCost);
      }
    }
    return true;
  }

  // ==================== 资源释放 ====================

  /**
   * 释放 Store 持有的资源（角色切换时由 GameBootstrap.dispose 调用）
   *
   * 调用 cleanup 清理战斗定时器（turnTimerId / bossIntroTimerId），
   * 避免角色切换时战斗仍在进行导致定时器回调指向已销毁的 Store 实例。
   * cleanup 同时会删除已死亡敌人数据并重置全部战斗状态。
   */
  function dispose(): void {
    state.cleanup();
  }

  // ==================== 导出 ====================

  return {
    // 状态
    state: state.state,
    enemies: state.enemies,
    targetEnemyId: state.targetEnemyId,
    turn: state.turn,
    turnCount: state.turnCount,
    combatLogs: state.combatLogs,
    combatResult: state.combatResult,
    expGained: state.expGained,
    goldGained: state.goldGained,
    initiativeOrder: state.initiativeOrder,
    currentInitiativeIndex: state.currentInitiativeIndex,
    combatSpeed: state.combatSpeed,
    playerEffects: state.playerEffects,
    enemyEffects: state.enemyEffects,
    enemyPositions: state.enemyPositions,
    resourceSystems: state.resourceSystems,

    // 计算属性
    isInCombat: state.isInCombat,
    aliveEnemies: state.aliveEnemies,
    hasBossEnemy: state.hasBossEnemy,
    bossIntros: state.bossIntros,
    currentTarget: state.currentTarget,

    // Action
    startCombat,
    playerAction,
    skipTurn,
    endCombat,
    reset: state.reset,
    advanceTurn: initiative.advanceTurn,
    toggleCombatSpeed: initiative.toggleCombatSpeed,
    addEffectToPlayer: state.addEffectToPlayer,
    // 资源系统辅助方法
    canCastSkill,
    consumeSkillResource,
    // 资源释放
    dispose,
  };
});
