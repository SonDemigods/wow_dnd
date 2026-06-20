/**
 * 战斗模块状态管理层（Store 核心架构）
 * 
 * Store 是战斗数据的唯一持有者，所有响应式状态集中管理。
 * Action 直接管理状态，不依赖外部 Service。
 * 
 * 跨模块通信：
 * - characterStore: 直接调用 Action（takeDamage, gainExp, gainGold, handleDeath）
 * - skillsStore: 直接调用 Action（castSkill, getSkill）
 * - enemiesStore: 直接调用 Store Action（敌人创建、伤害计算）
 * - inventoryStore: 直接调用 Store（物品模板查询与物品添加）
 * - logStore: 直接调用 Store Action（日志记录）
 * - combatDbService: 直接调用持久化日志
 * 
 * EventBus 仅保留 UI/音效事件：
 * COMBAT_START, COMBAT_END, COMBAT_PLAYER_TURN, COMBAT_ENEMY_TURN,
 * COMBAT_DEAL_DAMAGE, COMBAT_CAST_HEAL, COMBAT_CRITICAL_HIT, COMBAT_DODGE,
 * COMBAT_SKIP_TURN
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { CombatState, CombatAction, CombatActionResult, CombatLog, CombatResult, AoeHitInfo } from './types';
import type { Enemy } from '../enemy/types';
import { useEnemiesStore } from '../enemy/store';
import { combatDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';
import { useLogStore } from '../log/store';
import { generateLogId } from '../log/service';
import { useCharacterStore } from '../character/store';
import { useSkillsStore } from '../skill/store';
import { useInventoryStore } from '../inventory/store';
import { useQuestStore } from '../quest/store';
import {
  rollCritical,
  rollDodge,
  calculateFleeChance,
  rollFleeSuccess,
  generateCombatId,
  generateBattleLogId,
  isBossCombat
} from './service';
import {
  // 新效果系统
  EffectHandlerRegistry,
  processDamagePipeline,
  createEmptyContainer,
  addEffectToContainer,
  createDefaultRegistry,
  // 旧兼容（逐步迁移）
  tickEffects,
  applyShield,
  getStatModifiers,
  getThornDamage,
  isDisabled,
  generateEffectId,
  type Effect,
  type EffectType,
  type EffectContainer,
  type EffectContext,
  type DamageType,
  type StatModifiers
} from './effects';
import { AggressiveStrategy, DefensiveStrategy, BalancedStrategy, BossPhaseStrategy } from './ai/strategies';
import type { IAiStrategy, BattleContext } from './ai/types';
import type { AiStrategyType } from '../enemy/types';
import { BossPhaseManager, processBossPhaseMechanics, applyPhaseStats } from '../boss/engine';
import type { BossIntro, BossPhase, BossMechanicType } from '../boss/types';

/**
 * 战斗状态存储
 */
export const useCombatStore = defineStore('combat', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================
  
  /** 当前战斗状态 */
  const state = ref<CombatState>('idle');
  
  /** 当前敌人 ID 列表（数据存在 enemiesStore 缓存中） */
  const enemyIds = ref<string[]>([]);

  /** 当前目标敌人 ID */
  const targetEnemyId = ref<string | null>(null);

  /** Boss 阶段管理器（按敌人 ID 索引） */
  const bossPhaseManagers = new Map<string, BossPhaseManager>();
  /** Boss 出场演出数据（按敌人 ID 索引，战斗开始后立即清空） */
  const bossIntros = ref<Record<string, BossIntro>>({});
  /** 敌人位置映射（enemyId -> { row: 'front'|'back', col: 0-2 }），3×2 网格布局 */
  const enemyPositions = ref<Record<string, { row: 'front' | 'back'; col: number }>>({});
  
  /** 当前回合 */
  const turn = ref<'player' | 'enemy'>('player');
  
  /** 当前回合数 */
  const turnCount = ref(0);
  
  /** 当前战斗 ID */
  const combatId = ref('');
  
  /** 战斗日志 */
  const combatLogs = ref<CombatLog[]>([]);

  /** 战斗结果（供 UI 结果弹窗展示） */
  const combatResult = ref<CombatResult | null>(null);

  /** 获得经验值（供 UI 结果弹窗展示） */
  const expGained = ref(0);

  /** 获得金币（供 UI 结果弹窗展示） */
  const goldGained = ref(0);

  /** 行动顺序（按速度排序的单位ID列表） */
  const initiativeOrder = ref<string[]>([]);

  /** 当前行动序号索引 */
  const currentInitiativeIndex = ref(0);

  /** 战斗速度倍率 */
  const combatSpeed = ref<1 | 2>(1);

  /** 玩家当前效果容器（Buff/Debuff） */
  const playerEffects = ref<EffectContainer>(createEmptyContainer());

  /** 敌人效果容器映射（敌人ID -> 效果容器，用于护盾等临时效果） */
  const enemyEffects = ref<Map<string, EffectContainer>>(new Map());

  /** 效果系统注册表（单例，注册全部 15 种处理器） */
  const effectRegistry = new EffectHandlerRegistry();
  createDefaultRegistry(effectRegistry);

  /** 敌人回合延迟定时器 ID（非响应式，用于战斗提前结束时取消） */
  let turnTimerId: ReturnType<typeof setTimeout> | null = null;

  // ==================== 跨 Store 引用 ====================
  const enemiesStore = useEnemiesStore();
  const logStore = useLogStore();

  // ==================== 计算属性 ====================

  /** 是否正在战斗中 */
  const isInCombat = computed(() => state.value === 'fighting');

  /**
   * 敌人列表（从 enemiesStore 缓存实时读取，自动响应 HP 变化）
   * 不再维护本地副本，数据源唯一
   */
  const enemies = computed<Enemy[]>(() =>
    enemyIds.value.map(id => enemiesStore.getEnemyById(id)).filter((e): e is Enemy => e !== null && e !== undefined)
  );

  /** 存活敌人列表 */
  const aliveEnemies = computed(() => enemies.value.filter(e => e.hp > 0));

  /** 是否存在 Boss 敌人 */
  const hasBossEnemy = computed(() => enemies.value.some(e => isBossCombat(e)));

  /** 当前攻击目标（优先选择的目标 > 第一个存活敌人） */
  const currentTarget = computed(() => enemies.value.find(e => e.id === targetEnemyId.value) || aliveEnemies.value[0] || null);

  // ==================== 内部辅助：战斗日志 ====================

  /**
   * 添加战斗日志（内部方法）
   * @param data - 日志数据（不含自动生成字段）
   */
  function addCombatLog(data: Omit<CombatLog, 'combatId' | 'battleLogId' | 'timestamp' | 'turn'>): void {
    const log: CombatLog = {
      combatId: combatId.value,
      battleLogId: generateBattleLogId(),
      timestamp: Date.now(),
      turn: turnCount.value,
      ...data
    };
    combatLogs.value.push(log);
  }

  /**
   * 持久化战斗日志（内部方法）
   */
  async function saveLogs(): Promise<void> {
    try {
      const logsToSave = [...combatLogs.value];
      await Promise.all(logsToSave.map(log => combatDbService.saveCombatLog(log)));
    } catch (e) {
      console.error('[CombatStore] 保存战斗日志失败:', e);
    }
  }

  /**
   * 创建玩家效果上下文
   * @param characterStore - 角色 Store 实例
   */
  function createPlayerEffectContext(characterStore: ReturnType<typeof useCharacterStore>): EffectContext {
    return {
      ownerId: 'player',
      ownerType: 'player',
      baseStats: {
        physicalAttack: characterStore.attributes.physicalAttack,
        physicalDefense: characterStore.attributes.physicalDefense,
        magicAttack: characterStore.attributes.magicAttack,
        magicDefense: characterStore.attributes.magicDefense,
        speed: 0,
      },
      currentHp: characterStore.hp,
      maxHp: characterStore.maxHp,
    };
  }

  /**
   * 创建敌人效果上下文
   * @param enemy - 敌人实例
   */
  function createEnemyEffectContext(enemy: Enemy): EffectContext {
    return {
      ownerId: enemy.id,
      ownerType: 'enemy',
      baseStats: {
        physicalAttack: enemy.physicalAttack || 0,
        physicalDefense: enemy.physicalDefense || 0,
        magicAttack: enemy.magicAttack || 0,
        magicDefense: enemy.magicDefense || 0,
        speed: 0,
      },
      currentHp: enemy.hp,
      maxHp: enemy.maxHp,
    };
  }

  /**
   * 结束玩家回合（内部方法）
   * 使用速度制先攻排序，通过 advanceTurn 决定下一个行动者
   */
  function endPlayerTurn(): void {
    const next = advanceTurn();
    if (next.isPlayer) {
      // 玩家再次行动（速度极快的情况）
      turn.value = 'player';
      useSkillsStore().tickCooldowns();
      eventBus.emit(GameEvents.COMBAT_PLAYER_TURN, null);
    } else {
      turn.value = 'enemy';
      turnTimerId = setTimeout(() => {
        turnTimerId = null;
        singleEnemyTurn(next.unitId);
      }, Math.round(500 / combatSpeed.value));
    }
  }

  // ==================== 内部辅助：AI 策略 ====================

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

  // ==================== 内部辅助：敌人行动 ====================

  /**
   * 敌人普通攻击（内部方法）
   * @param e - 执行攻击的敌人
   */
  function enemyBasicAttack(e: Enemy): CombatActionResult {
    const characterStore = useCharacterStore();

    // 计算伤害
    const damage = enemiesStore.calculateDamage(e, characterStore.attributes.physicalDefense);

    // 检查玩家闪避
    const dodgeChance = characterStore.attributes.dodgeChance / 100;
    const isDodge = rollDodge(dodgeChance);

    if (isDodge) {
      addCombatLog({
        actorType: 'enemy',
        actorId: e.id,
        actorName: e.name,
        eventType: 'combat_miss',
        targetType: 'player',
        targetId: 'player',
        targetName: characterStore.name,
        isCrit: false,
        isDodge: true,
        message: `${e.name} 的攻击被 ${characterStore.name} 闪避了！`
      });

      // 发射闪避事件（音效 + 视觉特效）
      eventBus.emit(GameEvents.COMBAT_DODGE, {
        attackerName: e.name,
        dodgerName: characterStore.name,
        dodgerType: 'player'
      });

      return {
        success: true,
        type: 'attack',
        isDodge: true,
        message: '你闪避了敌人的攻击！'
      };
    }

    // 应用玩家护盾（伤害计算后、实际扣血前）
    const { actualDamage, absorbed } = applyShield(playerEffects.value, damage);

    // 造成伤害 → 直接调用 characterStore Action
    characterStore.takeDamage(actualDamage);

    // 物理伤害音效（敌方攻击）
    eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
      amount: damage,
      damageType: 'physical',
      targetName: characterStore.name,
      actorType: 'enemy'
    });

    addCombatLog({
      actorType: 'enemy',
      actorId: e.id,
      actorName: e.name,
      eventType: 'combat_damage',
      targetType: 'player',
      targetId: 'player',
      targetName: characterStore.name,
      damage: actualDamage,
      isCrit: false,
      isDodge: false,
      message: absorbed > 0
        ? `${e.name} 对 ${characterStore.name} 造成 ${actualDamage} 点伤害（护盾吸收 ${absorbed}）！`
        : `${e.name} 对 ${characterStore.name} 造成 ${actualDamage} 点伤害！`
    });

    // 荆棘反伤
    const thorns = getThornDamage(playerEffects.value, damage);
    if (thorns > 0) {
      enemiesStore.takeDamage(e.id, thorns);
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterStore.name,
        eventType: 'combat_damage',
        targetType: 'enemy',
        targetId: e.id,
        targetName: e.name,
        damage: thorns,
        isCrit: false,
        isDodge: false,
        message: `荆棘反伤对 ${e.name} 造成 ${thorns} 点伤害！`
      });
    }

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
   * @param skill - 技能信息
   * @param e - 执行攻击的敌人
   */
  function enemyAttackWithSkill(damage: number, skill: { id: string; name: string }, e: Enemy): CombatActionResult {
    const characterStore = useCharacterStore();

    // 检查玩家闪避
    const dodgeChance = characterStore.attributes.dodgeChance / 100;
    const isDodge = rollDodge(dodgeChance);

    if (isDodge) {
      addCombatLog({
        actorType: 'enemy',
        actorId: e.id,
        actorName: e.name,
        eventType: 'combat_miss',
        targetType: 'player',
        targetId: 'player',
        targetName: characterStore.name,
        skillId: skill.id,
        skillName: skill.name,
        isCrit: false,
        isDodge: true,
        message: `${e.name} 的 ${skill.name} 被 ${characterStore.name} 闪避了！`
      });

      // 发射闪避事件（音效 + 视觉特效）
      eventBus.emit(GameEvents.COMBAT_DODGE, {
        attackerName: e.name,
        dodgerName: characterStore.name,
        dodgerType: 'player'
      });

      return {
        success: true,
        type: 'skill',
        isDodge: true,
        message: '你闪避了敌人的技能！'
      };
    }

    // 应用防御减免计算实际伤害
    const defense = characterStore.attributes.physicalDefense;
    const mitigated = Math.max(1, Math.floor(damage - defense * 0.3));

    // 应用玩家护盾（伤害计算后、实际扣血前）
    const { actualDamage, absorbed } = applyShield(playerEffects.value, mitigated);

    // 造成伤害 → 直接调用 characterStore Action
    characterStore.takeDamage(actualDamage);

    // 物理伤害音效（敌方技能）
    eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
      amount: mitigated,
      damageType: 'physical',
      targetName: characterStore.name,
      actorType: 'enemy'
    });

    addCombatLog({
      actorType: 'enemy',
      actorId: e.id,
      actorName: e.name,
      eventType: 'combat_skill_cast',
      targetType: 'player',
      targetId: 'player',
      targetName: characterStore.name,
      skillId: skill.id,
      skillName: skill.name,
      damage: actualDamage,
      isCrit: false,
      isDodge: false,
      message: absorbed > 0
        ? `${e.name} 使用 ${skill.name}，对 ${characterStore.name} 造成 ${actualDamage} 点伤害（护盾吸收 ${absorbed}）！`
        : `${e.name} 使用 ${skill.name}，对 ${characterStore.name} 造成 ${actualDamage} 点伤害！`
    });

    // 荆棘反伤
    const thorns = getThornDamage(playerEffects.value, mitigated);
    if (thorns > 0) {
      enemiesStore.takeDamage(e.id, thorns);
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterStore.name,
        eventType: 'combat_damage',
        targetType: 'enemy',
        targetId: e.id,
        targetName: e.name,
        damage: thorns,
        isCrit: false,
        isDodge: false,
        message: `荆棘反伤对 ${e.name} 造成 ${thorns} 点伤害！`
      });
    }

    return {
      success: true,
      type: 'skill',
      damage: actualDamage,
      message: `${e.name} 使用了 ${skill.name}，对你造成 ${actualDamage} 点伤害！`
    };
  }

  /**
   * 敌人行动（内部方法，使用 AI 策略模式决定行动）
   * @param e - 执行行动的敌人
   */
  function enemyAction(e: Enemy): CombatActionResult {
    if (state.value !== 'fighting') {
      return { success: false, type: 'attack', message: '战斗已结束' };
    }

    const characterStore = useCharacterStore();

    // 检查 Boss 多目标攻击标记
    const isAoeAttack = (e as any).aoeNextAttack === true;
    if (isAoeAttack) {
      (e as any).aoeNextAttack = false;
      // 多目标攻击标记：对玩家造成额外伤害
      const damage = enemiesStore.calculateDamage(e, characterStore.attributes.physicalDefense);
      const aoeMultiplier = 1.3;
      const aoeDamage = Math.round(damage * aoeMultiplier);

      // 检查玩家闪避
      const dodgeChance = characterStore.attributes.dodgeChance / 100;
      const isDodge = rollDodge(dodgeChance);

      if (isDodge) {
        addCombatLog({
          actorType: 'enemy', actorId: e.id, actorName: e.name,
          eventType: 'combat_miss', targetType: 'player', targetId: 'player',
          targetName: characterStore.name, isCrit: false, isDodge: true,
          message: `${e.name} 的范围攻击被 ${characterStore.name} 闪避了！`
        });
        eventBus.emit(GameEvents.COMBAT_DODGE, {
          attackerName: e.name, dodgerName: characterStore.name, dodgerType: 'player'
        });
        return { success: true, type: 'attack', isDodge: true, message: '你闪避了敌人的范围攻击！' };
      }

      const { actualDamage, absorbed } = applyShield(playerEffects.value, aoeDamage);
      characterStore.takeDamage(actualDamage);

      eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
        amount: aoeDamage, damageType: 'physical', targetName: characterStore.name, actorType: 'enemy'
      });

      addCombatLog({
        actorType: 'enemy', actorId: e.id, actorName: e.name,
        eventType: 'combat_damage', targetType: 'player', targetId: 'player',
        targetName: characterStore.name, damage: actualDamage, isCrit: false, isDodge: false,
        message: absorbed > 0
          ? `${e.name} 发动范围攻击，对 ${characterStore.name} 造成 ${actualDamage} 点伤害（护盾吸收 ${absorbed}）！`
          : `${e.name} 发动范围攻击，对 ${characterStore.name} 造成 ${actualDamage} 点伤害！`
      });

      return {
        success: true, type: 'attack', damage: actualDamage,
        message: `${e.name} 发动了范围攻击！`
      };
    }

    // 获取敌人可用技能
    const availableSkills = enemiesStore.getAvailableSkills(e.id);

    // 构建战斗上下文
    const context: BattleContext = {
      playerHp: characterStore.hp,
      playerMaxHp: characterStore.maxHp,
      enemyHp: e.hp,
      enemyMaxHp: e.maxHp,
      availableSkills,
      turnCount: turnCount.value,
    };

    // 根据敌人 AI 策略类型选择策略
    const strategy = getStrategy(e.aiStrategy || 'balanced');
    const decision = strategy.decideAction(e, context);

    switch (decision.type) {
      case 'skill': {
        const result = enemiesStore.useSkill(e.id, decision.skillId);
        if (result.success) {
          if (result.isHeal) {
            // 敌人恢复生命值
            const updatedEnemy = enemiesStore.getEnemyById(e.id);
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
              heal: -result.damage,
              isCrit: false,
              isDodge: false,
              message: `${updatedEnemy.name} 恢复了生命值！`
            });

            return {
              success: true,
              type: 'skill',
              heal: -result.damage,
              message: `${e.name} 恢复了生命值！`
            };
          } else if (result.isBuff && result.buffs) {
            // 敌人使用 buff/debuff 技能：区分自身增益（buff）和对玩家减益（debuff）
            const skillData = availableSkills.find(s => s.id === decision.skillId);
            const skillName = skillData?.name || decision.skillId;
            // 通过完整技能数据判断是否为减益技能
            const fullSkill = useSkillsStore().getSkill(decision.skillId);
            const isDebuff = fullSkill?.type === 'debuff';

            if (isDebuff) {
              // 减益技能：效果施加到玩家身上
              const playerCtx = createPlayerEffectContext(characterStore);
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
                message: `${e.name} 使用了 ${skillName}，对 ${characterStore.name} 施加了减益效果！`
              });

              return {
                success: true,
                type: 'skill',
                message: `${e.name} 使用了 ${skillName}！`
              };
            }

            // 增益技能：效果施加到敌人自身
            if (!enemyEffects.value.has(e.id)) {
              enemyEffects.value.set(e.id, createEmptyContainer());
            }
            const container = enemyEffects.value.get(e.id)!;
            const ctx = createEnemyEffectContext(e);

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
              effectRegistry.get(effect.type as EffectType)?.onApply?.(effect, ctx);
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
            return enemyAttackWithSkill(result.damage, { id: decision.skillId, name: skillData?.name || decision.skillId }, e);
          }
        }
        break;
      }
      case 'heal': {
        const result = enemiesStore.useSkill(e.id, decision.skillId);
        if (result.success) {
          const updatedEnemy = enemiesStore.getEnemyById(e.id);
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
            heal: -result.damage,
            isCrit: false,
            isDodge: false,
            message: `${updatedEnemy.name} 恢复了生命值！`
          });

          return {
            success: true,
            type: 'skill',
            heal: -result.damage,
            message: `${e.name} 恢复了生命值！`
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

  // ==================== 内部辅助：玩家行动 ====================

  /**
   * 玩家普通攻击（内部方法）
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

      endPlayerTurn();
      saveLogs();

      return {
        success: true,
        type: 'attack',
        isDodge: true,
        message: `${target.name} 闪避了你的攻击！`
      };
    }

    // 构建效果上下文
    const attackerCtx: EffectContext = {
      ownerId: 'player',
      ownerType: 'player',
      baseStats: {
        physicalAttack: characterStore.attributes.physicalAttack,
        physicalDefense: characterStore.attributes.physicalDefense,
        magicAttack: characterStore.attributes.magicAttack,
        magicDefense: characterStore.attributes.magicDefense,
        speed: characterStore.attributes.dodgeChance,
      },
      currentHp: characterStore.hp,
      maxHp: characterStore.maxHp,
    };

    const defenderCtx: EffectContext = {
      ownerId: target.id,
      ownerType: 'enemy',
      baseStats: {
        physicalAttack: target.physicalAttack || 0,
        physicalDefense: target.physicalDefense || 0,
        magicAttack: target.magicAttack || 0,
        magicDefense: target.magicDefense || 0,
        speed: 0,
      },
      currentHp: target.hp,
      maxHp: target.maxHp,
    };

    // 使用新管线计算伤害
    const pipeResult = processDamagePipeline(
      effectRegistry,
      playerEffects.value,
      enemyEffects.value.get(target.id) || createEmptyContainer(),
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
    const isDead = enemiesStore.takeDamage(target.id, finalDamage);

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
      endPlayerTurn();
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
   * 玩家使用技能（内部方法）
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
        // AOE：对所有活着的敌人造成 70% 伤害
        const livingEnemies = aliveEnemies.value;
        const aoeDamage = Math.round(result.damage * 0.7);
        const aoeHits: AoeHitInfo[] = [];

        for (const e of livingEnemies) {
          enemiesStore.takeDamage(e.id, aoeDamage);

          aoeHits.push({
            enemyId: e.id,
            enemyName: e.name,
            damage: aoeDamage
          });

          // 伤害类型音效事件
          eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
            amount: aoeDamage,
            damageType: result.type === 'magic_damage' ? 'magic' : 'physical',
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
            message: `${skill?.name || '技能'} 对 ${e.name} 造成 ${aoeDamage} 点${result.type === 'magic_damage' ? '魔法' : '物理'}伤害！`
          });
        }

        // 检查是否所有敌人死亡
        if (aliveEnemies.value.length === 0) {
          endCombat('victory');
        } else {
          endPlayerTurn();
        }

        saveLogs();

        return {
          success: true,
          type: 'skill',
          damage: result.damage,
          aoeHits,
          message: `${skill?.name || '技能'} 对所有敌人造成了 ${aoeDamage} 点伤害！`
        };
      } else if (targetType === 'self') {
        // 对自身生效（自伤技能，实际上不太合理，按生命恢复逻辑处理）
        endPlayerTurn();
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
          enemyEffects.value.get(target.id) || createEmptyContainer(),
          createPlayerEffectContext(characterStore),
          createEnemyEffectContext(target),
          damageType,
          result.damage  // baseDamageOverride：技能基础伤害直接传入
        );

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

        if (isDead || !updatedTarget || aliveEnemies.value.length === 0) {
          endCombat('victory');
        } else {
          endPlayerTurn();
        }
      }

      // 伤害技能可能附带 buff/debuff 效果（如雷霆一击带降防）
      if (skill?.buffs && skill.buffs.length > 0 && result.damage) {
        applySkillBuffs(skill, targetType);
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

        endPlayerTurn();
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
          endPlayerTurn();
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
          endPlayerTurn();
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

      endPlayerTurn();
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
   * 玩家使用物品（内部方法）
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
          enemyEffects.value.get(target.id) || createEmptyContainer(),
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
      endPlayerTurn();
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
   * 玩家逃跑（内部方法）
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

      endPlayerTurn();
      saveLogs();

      return {
        success: false,
        type: 'flee',
        message: '逃跑失败！'
      };
    }
  }

  /**
   * 处理掉落（内部方法，仅 Boss 掉落物品）
   * @param e - 敌人数据
   */
  function handleLoot(e: Enemy): void {
    e.drops.forEach(drop => {
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
        logStore.addLogEntry({
          id: generateLogId(),
          timestamp: Date.now(),
          type: 'item',
          message: `从 ${e.name} 获得 ${itemName} x${amount}`,
          icon: 'game-icons:backpack'
        });
      }
    });
  }

  // ==================== 内部辅助：先攻排序 ====================

  /**
   * 初始化 Boss 专属功能（阶段管理器、出场演出）
   */
  function initBossFeatures(enemiesData: Enemy[]): void {
    bossPhaseManagers.clear();
    const intros: Record<string, BossIntro> = {};
    for (const e of enemiesData) {
      if (e.isBoss && e.phases && e.phases.length > 0) {
        bossPhaseManagers.set(e.id, new BossPhaseManager(e as any));
      }
      if (e.isBoss && e.intro) {
        intros[e.id] = e.intro;
      }
    }
    bossIntros.value = intros;
  }

  /**
   * 分配敌人位置到 3×2 网格（前排 3 格 + 后排 3 格）
   * Boss 优先放在后排中间，普通敌人优先填满前排
   * @param enemiesData - 敌人数据数组
   */
  function assignEnemyPositions(enemiesData: Enemy[]): void {
    const positions: Record<string, { row: 'front' | 'back'; col: number }> = {};
    const frontSlots: number[] = [0, 1, 2]; // 前排 3 个位置
    const backSlots: number[] = [0, 1, 2];  // 后排 3 个位置

    // 分离 Boss 和普通敌人
    const bosses = enemiesData.filter(e => e.isBoss);
    const normals = enemiesData.filter(e => !e.isBoss);

    // Boss 优先占后排中间位置
    for (const boss of bosses) {
      const col = backSlots.shift() ?? 0;
      positions[boss.id] = { row: 'back', col };
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

    enemyPositions.value = positions;
  }

  /**
   * 对单个敌人施加减益效果
   * @param e - 敌人实例
   * @param effects - 要施加的效果列表
   * @param sourceName - 技能名称（来源）
   */
  function applyDebuffToEnemy(e: Enemy, effects: Array<{ type: string; value: number; turns: number }>, sourceName: string): void {
    // 确保该敌人有效果容器
    if (!enemyEffects.value.has(e.id)) {
      enemyEffects.value.set(e.id, createEmptyContainer());
    }
    const container = enemyEffects.value.get(e.id)!;
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
    skill: import('../../modules/skill/types').Skill,
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

  /**
   * 按 Boss 等级缩放效果值（线性增长，公式：baseValue × (1 + (level-1) × 0.08)）
   * @param baseValue - 配置中的基础效果值
   * @param bossLevel - Boss 等级
   * @returns 缩放后的效果值
   */
  function scaleBossEffectValue(baseValue: number, bossLevel: number): number {
    return Math.floor(baseValue * (1 + (bossLevel - 1) * 0.08));
  }

  /**
   * 应用 Boss 机制的实际效果到玩家或敌人
   * @param e - Boss 敌人
   * @param mechType - 机制类型
   * @param phase - 当前阶段（用于获取参数）
   */
  function applyMechanicEffect(e: Enemy, mechType: BossMechanicType, phase: BossPhase): void {
    const characterStore = useCharacterStore();
    const mechanic = phase.mechanics.find(m => m.type === mechType);
    const params = mechanic?.params || {};

    switch (mechType) {
      case 'stun_player': {
        const stunEffect: Effect = {
          id: generateEffectId(),
          type: 'stun',
          remainingTurns: params?.turns as number || 1,
          value: 1,
          source: 'enemy',
          sourceName: e.name
        };
        addEffectToContainer(playerEffects.value, stunEffect);
        addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: characterStore.name, isCrit: false, isDodge: false,
          message: `${characterStore.name} 被 ${e.name} 眩晕了 ${stunEffect.remainingTurns} 回合！`
        });
        break;
      }
      case 'silence_player': {
        const silenceEffect: Effect = {
          id: generateEffectId(),
          type: 'silence',
          remainingTurns: params?.turns as number || 2,
          value: 1,
          source: 'enemy',
          sourceName: e.name
        };
        addEffectToContainer(playerEffects.value, silenceEffect);
        addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: characterStore.name, isCrit: false, isDodge: false,
          message: `${characterStore.name} 被 ${e.name} 沉默了 ${silenceEffect.remainingTurns} 回合！`
        });
        break;
      }
      case 'debuff_aura': {
        const debuffType = (params?.debuffType as string) || 'attack_down';
        const baseValue = params?.value as number || 10;
        const scaledValue = scaleBossEffectValue(baseValue, e.level);
        const debuffEffect: Effect = {
          id: generateEffectId(),
          type: debuffType as any,
          remainingTurns: params?.turns as number || 3,
          value: scaledValue,
          source: 'enemy',
          sourceName: e.name
        };
        addEffectToContainer(playerEffects.value, debuffEffect);
        addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_event', targetType: 'player', targetId: 'player',
          targetName: characterStore.name, isCrit: false, isDodge: false,
          message: `${characterStore.name} 受到 ${e.name} 的减益光环影响！`
        });
        break;
      }
      case 'aoe_attack': {
        // aoe_attack 标记已由 engine 设置，在 enemyAction 中通过 (e as any).aoeNextAttack 读取
        // 这里记录日志即可
        break;
      }
      case 'summon_minions': {
        // summon_minions 标记已由 engine 设置，需要实际创建小怪
        const count = (e as any).pendingSummons || 0;
        if (count > 0) {
          // 异步创建小怪
          (async () => {
            for (let i = 0; i < count; i++) {
              try {
                const minion = await enemiesStore.createEnemy('slime', e.level);
                if (minion) {
                  // 分配前排位置
                  const existingPos = Object.values(enemyPositions.value);
                  const usedCols = existingPos.filter(p => p.row === 'front').map(p => p.col);
                  const availableCol = [0, 1, 2].find(c => !usedCols.includes(c)) ?? 0;
                  enemyPositions.value = {
                    ...enemyPositions.value,
                    [minion.id]: { row: 'front', col: availableCol }
                  };
                  enemyIds.value.push(minion.id);
                  // 重新计算先攻顺序
                  buildInitiativeOrder(characterStore);
                  addCombatLog({
                    actorType: 'system', actorId: 'system', actorName: '系统',
                    eventType: 'combat_event', targetType: 'enemy', targetId: minion.id,
                    targetName: minion.name, isCrit: false, isDodge: false,
                    message: `${e.name} 召唤了 ${minion.name}！`
                  });
                }
              } catch {
                // 创建小怪失败，静默处理
              }
            }
            (e as any).pendingSummons = 0;
          })();
        }
        break;
      }
      case 'healing_zone': {
        const healAmount = params?.healPerTurn as number || 5;
        e.hp = Math.min(e.maxHp, e.hp + healAmount);
        addCombatLog({
          actorType: 'system', actorId: 'system', actorName: '系统',
          eventType: 'combat_heal', targetType: 'enemy', targetId: e.id,
          targetName: e.name, isCrit: false, isDodge: false,
          message: `${e.name} 从生命恢复区域恢复了 ${healAmount} 点生命值！`
        });
        break;
      }
      default:
        // 其他机制（enrage, damage_shield, reflect_damage 等）已在 engine 中处理
        break;
    }
  }

  /**
   * 构建先攻顺序（玩家 + 所有敌人按速度降序排列）
   * @param characterStore - 角色 Store 实例
   */
  function buildInitiativeOrder(characterStore: ReturnType<typeof useCharacterStore>): void {
    const units: { id: string; speed: number }[] = [];

    // 玩家速度（含效果修正）
    const playerCtx = createPlayerEffectContext(characterStore);
    const speedMod = effectRegistry.reduceSum(playerEffects.value, 'getSpeedMod', playerCtx);
    const playerSpeed = (characterStore.attributes.dodgeChance || 0) + speedMod;
    units.push({ id: 'player', speed: playerSpeed });

    // 所有敌人速度
    for (const e of enemies.value) {
      const enemySpeed = (e.stats as any)?.dex || e.dodgeChance || 5;
      units.push({ id: e.id, speed: enemySpeed });
    }

    // 按速度降序排列
    units.sort((a, b) => b.speed - a.speed);
    initiativeOrder.value = units.map(u => u.id);
    // 找到玩家在排序后的实际位置，确保 advanceTurn 能正确推进到下一个单位
    const playerIndex = initiativeOrder.value.indexOf('player');
    currentInitiativeIndex.value = playerIndex >= 0 ? playerIndex : 0;
  }

  /**
   * 推进到下一个行动者
   * @returns 下一个行动者的 ID 和是否为玩家
   */
  function advanceTurn(): { unitId: string; isPlayer: boolean } {
    currentInitiativeIndex.value = (currentInitiativeIndex.value + 1) % initiativeOrder.value.length;
    if (currentInitiativeIndex.value === 0) {
      turnCount.value++;
    }
    const unitId = initiativeOrder.value[currentInitiativeIndex.value];
    return { unitId, isPlayer: unitId === 'player' };
  }

  /**
   * 切换战斗速度（1x / 2x）
   */
  function toggleCombatSpeed(): void {
    combatSpeed.value = combatSpeed.value === 1 ? 2 : 1;
  }

  /**
   * 单个敌人回合（速度制先攻调度用）
   * 执行该敌人的行动，然后推进到下一个行动者。
   * 如果下一个仍是敌人则继续链式调用，直到回合回到玩家。
   * @param enemyId - 敌人 ID
   */
  function singleEnemyTurn(enemyId: string): void {
    if (state.value !== 'fighting') return;

    // 推进玩家效果（持续伤害、恢复等）
    const characterStore = useCharacterStore();
    const tickResult = tickEffects(playerEffects.value);
    if (tickResult.dotDamage > 0) {
      characterStore.takeDamage(tickResult.dotDamage);
      addCombatLog({
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_damage',
        targetType: 'player',
        targetId: 'player',
        targetName: characterStore.name,
        damage: tickResult.dotDamage,
        isCrit: false,
        isDodge: false,
        message: `持续伤害对 ${characterStore.name} 造成 ${tickResult.dotDamage} 点伤害！`
      });
    }
    if (tickResult.regenAmount > 0) {
      characterStore.receiveHeal(tickResult.regenAmount);
      addCombatLog({
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_heal',
        targetType: 'player',
        targetId: 'player',
        targetName: characterStore.name,
        heal: tickResult.regenAmount,
        isCrit: false,
        isDodge: false,
        message: `生命恢复为 ${characterStore.name} 恢复了 ${tickResult.regenAmount} 点生命值！`
      });
    }

    // 检查玩家是否因持续伤害死亡
    if (characterStore.hp <= 0) {
      endCombat('defeat');
      saveLogs();
      return;
    }

    // 推进所有敌方效果（持续伤害、恢复等）
    for (const [enemyId, container] of enemyEffects.value) {
      const enemy = enemiesStore.getEnemyById(enemyId);
      if (enemy) {
        const enemyTickResult = effectRegistry.tickAll(container, createEnemyEffectContext(enemy));
        // 应用 DoT 伤害到敌人
        if (enemyTickResult.dotDamage > 0) {
          enemiesStore.takeDamage(enemyId, enemyTickResult.dotDamage);
          addCombatLog({
            actorType: 'system',
            actorId: 'system',
            actorName: '系统',
            eventType: 'combat_damage',
            targetType: 'enemy',
            targetId: enemyId,
            targetName: enemy.name,
            damage: enemyTickResult.dotDamage,
            isCrit: false,
            isDodge: false,
            message: `持续伤害对 ${enemy.name} 造成 ${enemyTickResult.dotDamage} 点伤害！`
          });
        }
        // 应用 HoT 生命恢复到敌人
        if (enemyTickResult.regenAmount > 0) {
          const updatedEnemy = enemiesStore.getEnemyById(enemyId);
          if (updatedEnemy) {
            updatedEnemy.hp = Math.min(updatedEnemy.maxHp, updatedEnemy.hp + enemyTickResult.regenAmount);
            addCombatLog({
              actorType: 'system',
              actorId: 'system',
              actorName: '系统',
              eventType: 'combat_heal',
              targetType: 'enemy',
              targetId: enemyId,
              targetName: updatedEnemy.name,
              heal: enemyTickResult.regenAmount,
              isCrit: false,
              isDodge: false,
              message: `生命恢复为 ${updatedEnemy.name} 恢复了 ${enemyTickResult.regenAmount} 点生命值！`
            });
          }
        }
      }
    }

    const e = enemies.value.find(en => en.id === enemyId);
    if (!e || e.hp <= 0) {
      // 敌人已死亡，跳过到下一个行动者
      const next = advanceTurn();
      if (next.isPlayer) {
        turn.value = 'player';
        useSkillsStore().tickCooldowns();
        eventBus.emit(GameEvents.COMBAT_PLAYER_TURN, null);
      } else {
        turn.value = 'enemy';
        turnTimerId = setTimeout(() => {
          turnTimerId = null;
          singleEnemyTurn(next.unitId);
        }, Math.round(500 / combatSpeed.value));
      }
      return;
    }

    // 记录敌人行动开始
    addCombatLog({
      actorType: 'system',
      actorId: 'system',
      actorName: '系统',
      eventType: 'combat_turn_start',
      isCrit: false,
      isDodge: false,
      message: `${e.name} 的回合`
    });

    // 处理 Boss 阶段转换和机制
    if (e.isBoss && e.phases && e.phases.length > 0) {
      const phaseManager = bossPhaseManagers.get(e.id);
      if (phaseManager) {
        const currentPhase = phaseManager.getCurrentPhase(e.phases, e.hp, e.maxHp);
        const transition = phaseManager.checkPhaseTransition(e.phases, e.hp, e.maxHp);
        if (transition.changed && transition.newPhase) {
          applyPhaseStats(e, transition.newPhase);
          // 同步更新 AI 策略为当前阶段的策略
          if (transition.newPhase.aiStrategy) {
            e.aiStrategy = transition.newPhase.aiStrategy;
          }
          addCombatLog({
            actorType: 'system', actorId: 'system', actorName: '系统',
            eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
            targetName: e.name, isCrit: false, isDodge: false,
            message: `【阶段转换】${e.name} 进入 "${transition.newPhase.name}" 阶段！`
          });
          // 发射阶段转换事件（UI 特效）
          eventBus.emit(GameEvents.COMBAT_BOSS_PHASE, {
            enemyId: e.id,
            enemyName: e.name,
            phaseName: transition.newPhase.name,
            effect: transition.newPhase.transitionEffect || 'darken'
          });
          if (transition.newPhase.dialogue && transition.newPhase.dialogue.length > 0) {
            for (const line of transition.newPhase.dialogue) {
              addCombatLog({
                actorType: 'system', actorId: 'system', actorName: e.name,
                eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
                targetName: e.name, isCrit: false, isDodge: false,
                message: `"${line}"`
              });
            }
          }
        }
        if (currentPhase) {
          const triggered = processBossPhaseMechanics(e, currentPhase, turnCount.value);
          for (const mechType of triggered) {
            const mechNames: Record<string, string> = {
              enrage: '狂暴', damage_shield: '伤害护盾', aoe_attack: '范围攻击',
              summon_minions: '召唤小怪', stun_player: '眩晕玩家', debuff_aura: '减益光环'
            };
            addCombatLog({
              actorType: 'system', actorId: 'system', actorName: '系统',
              eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
              targetName: e.name, isCrit: false, isDodge: false,
              message: `${e.name} 触发了【${mechNames[mechType] || mechType}】机制！`
            });

            // 实际应用机制效果
            applyMechanicEffect(e, mechType as BossMechanicType, currentPhase);
          }
        }
      }
    }

    // 推进该敌人的技能冷却
    enemiesStore.tickCooldowns(e.id);

    // 执行敌人行动
    enemyAction(e);

    // 检查玩家是否死亡
    if (characterStore.hp <= 0) {
      endCombat('defeat');
      saveLogs();
      return;
    }

    // 推进到下一个行动者
    const next = advanceTurn();
    if (next.isPlayer) {
      turn.value = 'player';
      useSkillsStore().tickCooldowns();
      eventBus.emit(GameEvents.COMBAT_PLAYER_TURN, null);
    } else {
      turn.value = 'enemy';
      turnTimerId = setTimeout(() => {
        turnTimerId = null;
        singleEnemyTurn(next.unitId);
      }, Math.round(500 / combatSpeed.value));
    }

    saveLogs();
  }

  // ==================== Action：开始战斗 ====================

  /**
   * 开始战斗
   * @param enemiesData - 敌人数据数组
   */
  function startCombat(enemiesData: Enemy[]): void {
    // 创建战斗 ID
    combatId.value = generateCombatId();

    // 设置战斗状态
    state.value = 'fighting';
    enemyIds.value = enemiesData.map(e => e.id);
    targetEnemyId.value = null;
    turn.value = 'player';
    turnCount.value = 1;
    combatLogs.value = [];

    // 重置 UI 结果状态（新一轮战斗开始）
    combatResult.value = null;
    expGained.value = 0;
    goldGained.value = 0;

    // 重置效果容器
    playerEffects.value = createEmptyContainer();
    enemyEffects.value = new Map();

    // 初始化 Boss 功能（阶段管理器 + 出场演出）
    initBossFeatures(enemiesData);

    // 分配敌人位置（3×2 网格，前排优先）
    assignEnemyPositions(enemiesData);

    // 计算先攻顺序（玩家 + 所有敌人按速度排序）
    const characterStore = useCharacterStore();
    buildInitiativeOrder(characterStore);

    // 构建敌人名称列表
    const enemyNames = enemiesData.map(e => e.name).join('、');

    // 添加战斗开始日志
    addCombatLog({
      actorType: 'system',
      actorId: 'system',
      actorName: '系统',
      eventType: 'combat_start',
      message: `战斗开始！你遭遇了 ${enemyNames}！`
    });

    // 记录到冒险日志
    logStore.addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'combat',
      message: `遭遇 ${enemyNames}！`,
      icon: 'game-icons:crossed-swords'
    });

    // 触发战斗开始事件（UI 进入战斗界面 + 音效）
    eventBus.emit(GameEvents.COMBAT_START, { enemy: enemiesData[0] });

    // 触发 Boss 出场演出事件（有 Boss 时延迟触发）
    const bossIntroEntries = Object.entries(bossIntros.value);
    if (bossIntroEntries.length > 0) {
      const [bossId, intro] = bossIntroEntries[0];
      const bossEnemy = enemiesData.find(e => e.id === bossId);
      if (bossEnemy) {
        setTimeout(() => {
          eventBus.emit(GameEvents.COMBAT_BOSS_INTRO, {
            enemyId: bossId,
            enemyName: bossEnemy.name,
            icon: bossEnemy.icon,
            effect: intro.effect,
            lines: intro.lines,
            duration: intro.duration
          });
        }, 300);
      }
    }

    // 触发玩家回合事件
    eventBus.emit(GameEvents.COMBAT_PLAYER_TURN, null);

    // 持久化日志
    saveLogs();
  }

  // ==================== Action：玩家行动 ====================

  /**
   * 玩家行动
   * @param action - 行动数据
   * @returns 行动结果
   */
  async function playerAction(action: CombatAction): Promise<CombatActionResult> {
    if (state.value !== 'fighting' || turn.value !== 'player') {
      return {
        success: false,
        type: action.type,
        message: '不是你的回合！'
      };
    }

    // 检查控制效果（眩晕/冰冻则完全跳过回合，沉默则禁止技能）
    const disableResult = isDisabled(playerEffects.value);
    if (disableResult.skipTurn) {
      addCombatLog({
        actorType: 'player', actorId: 'player', actorName: useCharacterStore().name,
        eventType: 'combat_event', isCrit: false, isDodge: false,
        message: `${useCharacterStore().name} 无法行动！`
      });
      endPlayerTurn();
      return { success: false, type: action.type, message: '你被控制了，无法行动！' };
    }
    if (action.type === 'skill' && disableResult.types.includes('skill')) {
      return { success: false, type: 'skill', message: '你被沉默了，无法使用技能！' };
    }

    try {
      switch (action.type) {
        case 'attack':
          return playerAttack();
        case 'skill':
          if (!action.skillId) {
            return { success: false, type: 'skill', message: '未指定技能！' };
          }
          return await playerSkill(action.skillId);
        case 'item':
          if (!action.itemId) {
            return { success: false, type: 'item', message: '未指定物品！' };
          }
          return await playerUseItem(action.itemId);
        case 'flee':
          return playerFlee();
        default:
          return { success: false, type: action.type, message: '未知行动类型！' };
      }
    } catch (e) {
      console.error('[CombatStore] 玩家行动异常:', e);
      return { success: false, type: action.type, message: '行动执行失败' };
    }
  }

  // ==================== Action：跳过回合 ====================

  /**
   * 跳过玩家回合（不执行任何操作，直接切换回合控制权）
   */
  function skipTurn(): void {
    if (state.value !== 'fighting' || turn.value !== 'player') {
      return;
    }

    const characterStore = useCharacterStore();

    addCombatLog({
      actorType: 'player',
      actorId: 'player',
      actorName: characterStore.name,
      eventType: 'combat_turn_end',
      message: `${characterStore.name} 跳过了回合`,
      isCrit: false,
      isDodge: false
    });

    // 触发跳过回合事件（音效）
    eventBus.emit(GameEvents.COMBAT_SKIP_TURN, null);

    // 转入敌人回合（由 endPlayerTurn 统一调度延迟和敌人行动）
    endPlayerTurn();
  }

  // ==================== Action：敌人回合 ====================

  /**
   * 敌人回合
   */
  function enemyTurn(): void {
    if (state.value !== 'fighting' || turn.value !== 'enemy') {
      return;
    }

    try {
      const characterStore = useCharacterStore();

      // 触发敌人回合开始事件
      eventBus.emit(GameEvents.COMBAT_ENEMY_TURN, null);

      // 获取存活敌人列表
      const livingEnemies = aliveEnemies.value;
      for (const e of livingEnemies) {
        // 战斗可能已经结束（上一个敌人行动导致玩家死亡）
        if (state.value !== 'fighting') return;

        addCombatLog({
          actorType: 'system',
          actorId: 'system',
          actorName: '系统',
          eventType: 'combat_turn_start',
          isCrit: false,
          isDodge: false,
          message: `${e.name} 的回合`
        });

        enemyAction(e);

        // 检查玩家是否死亡（characterStore.hp 是 computed，默认 0）
        if (characterStore.hp <= 0) {
          endCombat('defeat');
          saveLogs();
          return;
        }
      }

      // 结束敌人回合
      turn.value = 'player';
      turnCount.value++;

      // 触发玩家回合开始事件
      eventBus.emit(GameEvents.COMBAT_PLAYER_TURN, null);

      saveLogs();
    } catch (e) {
      console.error('[CombatStore] 敌人回合异常:', e);
      // 异常时恢复为玩家回合，避免战斗卡死
      turn.value = 'player';
    }
  }

  // ==================== Action：结束战斗 ====================

  /**
   * 结束战斗
   * @param result - 战斗结果
   */
  function endCombat(result: CombatResult): void {
    // 先清空效果容器，防止守卫提前返回导致效果残留，影响角色数据显示
    playerEffects.value = createEmptyContainer();
    enemyEffects.value = new Map();

    if (enemies.value.length === 0) return;

    try {
      const characterStore = useCharacterStore();

      // 设置战斗状态
      state.value = 'ended';

      // 构建敌人名称列表
      const enemyNames = enemies.value.map(e => e.name).join('、');

      // 计算总经验和金币
      let totalExp = 0;
      let totalGold = 0;

      if (result === 'victory') {
        totalExp = enemies.value.reduce((sum, e) => sum + (e.expReward || 0), 0);
        totalGold = enemies.value.reduce((sum, e) => sum + (e.goldReward || 0), 0);

        // 设置 UI 战斗结果（供弹窗展示）
        combatResult.value = result;
        expGained.value = totalExp;
        goldGained.value = totalGold;

        // 先记录击败怪物日志
        logStore.addLogEntry({
          id: generateLogId(),
          timestamp: Date.now(),
          type: 'combat',
          message: `击败 ${enemyNames}！`,
          icon: 'game-icons:laurel-crown'
        });

        // 记录获得经验值到冒险日志
        if (totalExp > 0) {
          logStore.addLogEntry({
            id: generateLogId(),
            timestamp: Date.now(),
            type: 'combat',
            message: `获得 ${totalExp} 点经验值`,
            icon: 'game-icons:star-formation'
          });
        }

        // 记录获得金币到冒险日志
        if (totalGold > 0) {
          logStore.addLogEntry({
            id: generateLogId(),
            timestamp: Date.now(),
            type: 'combat',
            message: `获得 ${totalGold} 金币`,
            icon: 'game-icons:coins'
          });
        }

        // 内部战斗日志（战斗弹窗用）
        addCombatLog({
          actorType: 'system',
          actorId: 'system',
          actorName: '系统',
          eventType: 'combat_end',
          isCrit: false,
          isDodge: false,
          message: `战斗胜利！获得 ${totalExp} 经验值和 ${totalGold} 金币！`
        });

        // 胜利：直接调用 characterStore Action 获得经验和金币
        characterStore.gainExp(totalExp);
        characterStore.gainGold(totalGold);

        // 处理掉落（遍历所有敌人，只有 Boss 才掉落物品）
        for (const e of enemies.value) {
          if (isBossCombat(e)) {
            handleLoot(e);
          }
        }

        // 直接调用 questStore 更新击杀进度
        for (const e of enemies.value) {
          if (e.dataId) {
            const questStore = useQuestStore();
            questStore.onEnemyKilled(e.dataId);
          }
        }
      } else if (result === 'defeat') {
        combatResult.value = result;
        expGained.value = 0;
        goldGained.value = 0;

        addCombatLog({
          actorType: 'system',
          actorId: 'system',
          actorName: '系统',
          eventType: 'combat_end',
          isCrit: false,
          isDodge: false,
          message: '战斗失败！'
        });

        // 记录到冒险日志
        logStore.addLogEntry({
          id: generateLogId(),
          timestamp: Date.now(),
          type: 'combat',
          message: `被 ${enemyNames} 击败！`,
          icon: 'game-icons:death-zone'
        });

        // 直接调用 characterStore Action 处理死亡
        characterStore.handleDeath();
      } else if (result === 'fled') {
        combatResult.value = result;
        expGained.value = 0;
        goldGained.value = 0;

        addCombatLog({
          actorType: 'system',
          actorId: 'system',
          actorName: '系统',
          eventType: 'combat_end',
          isCrit: false,
          isDodge: false,
          message: '战斗以逃跑结束'
        });

        // 记录到冒险日志
        logStore.addLogEntry({
          id: generateLogId(),
          timestamp: Date.now(),
          type: 'combat',
          message: `从 ${enemyNames} 面前逃跑`,
          icon: 'game-icons:run'
        });
      }

      // 保存日志
      saveLogs();

      // 触发战斗结束事件（包含战斗结果信息，供探索等模块监听）
      eventBus.emit(GameEvents.COMBAT_END, {
        result,
        enemy: enemies.value[0] || null,
        expGained: result === 'victory' ? totalExp : 0,
        goldGained: result === 'victory' ? totalGold : 0
      });

      // 清理战斗状态
      cleanup();
    } catch (e) {
      console.error('[CombatStore] 结束战斗异常:', e);
      // 即使异常也要清理状态，避免卡死
      cleanup();
    }
  }

  // ==================== 内部：清理 ====================

  /**
   * 清理战斗状态（内部方法）
   */
  function cleanup(): void {
    // 取消待执行的敌人回合定时器
    if (turnTimerId !== null) {
      clearTimeout(turnTimerId);
      turnTimerId = null;
    }

    // 清理敌人（如果敌人已死亡）
    for (const e of enemies.value) {
      if (e.hp <= 0) {
        enemiesStore.deleteEnemy(e.id);
      }
    }

    // 重置战斗状态
    enemyIds.value = [];
    targetEnemyId.value = null;
    turn.value = 'player';
    turnCount.value = 0;
    combatId.value = '';
    combatLogs.value = [];
    bossPhaseManagers.clear();
    bossIntros.value = {};
    enemyPositions.value = {};
    // 清空效果容器
    playerEffects.value = createEmptyContainer();
    enemyEffects.value = new Map();
  }

  // ==================== Action：重置 ====================

  /**
   * 重置战斗状态（公开方法）
   */
  function reset(): void {
    // 取消待执行的敌人回合定时器
    if (turnTimerId !== null) {
      clearTimeout(turnTimerId);
      turnTimerId = null;
    }

    state.value = 'idle';
    enemyIds.value = [];
    targetEnemyId.value = null;
    turn.value = 'player';
    turnCount.value = 0;
    combatId.value = '';
    combatLogs.value = [];
    combatResult.value = null;
    expGained.value = 0;
    goldGained.value = 0;
    playerEffects.value = createEmptyContainer();
    enemyEffects.value = new Map();
    bossPhaseManagers.clear();
    bossIntros.value = {};
    enemyPositions.value = {};
  }

  // ==================== Action：效果操作 ====================

  /**
   * 为玩家添加效果（供外部模块直接调用）
   * @param effect - 效果实例
   */
  function addEffectToPlayer(effect: Effect): void {
    // 战斗作用域约束：效果仅在战斗期间生效
    if (state.value !== 'fighting') {
      console.warn('[Combat] 非战斗状态，忽略效果施加');
      return;
    }
    addEffectToContainer(playerEffects.value, effect);
  }

  /**
   * 获取玩家当前属性修正
   * @deprecated 已被 processDamagePipeline 管线替代，请使用效果系统注册表获取修饰值
   */
  function getPlayerStatModifiers(): StatModifiers {
    return getStatModifiers(playerEffects.value);
  }

  // ==================== 跨模块事件监听（新架构下无需监听） ====================

  function setupCrossModuleListeners(): void {
    // 在新架构下，Store 之间通过直接调用 Action 通信，
    // 不再通过 EventBus 监听数据变更事件。
  }

  function dispose(): void {
    // 无事件监听器需要清理
  }

  // ==================== 导出 ====================

  return {
    // 状态
    state,
    enemies,
    targetEnemyId,
    turn,
    turnCount,
    combatLogs,
    combatResult,
    expGained,
    goldGained,
    initiativeOrder,
    currentInitiativeIndex,
    combatSpeed,
    playerEffects,
    enemyEffects,
    enemyPositions,

    // 计算属性
    isInCombat,
    aliveEnemies,
    hasBossEnemy,
    bossIntros,
    currentTarget,

    // Action
    startCombat,
    playerAction,
    enemyTurn,
    skipTurn,
    endCombat,
    reset,
    advanceTurn,
    toggleCombatSpeed,
    addEffectToPlayer,
    getPlayerStatModifiers,

    // 生命周期
    setupCrossModuleListeners,
    dispose
  };
});
