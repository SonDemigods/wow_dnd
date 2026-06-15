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
import type { CombatState, CombatAction, CombatActionResult, CombatLog, CombatResult } from './types';
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
  calculatePlayerDamage,
  rollCritical,
  rollDodge,
  calculateFleeChance,
  rollFleeSuccess,
  generateCombatId,
  generateBattleLogId,
  isBossCombat
} from './service';
import {
  addEffect as addEffectToContainer,
  tickEffects,
  applyShield,
  getStatModifiers,
  getThornDamage,
  type Effect,
  type EffectContainer,
  type StatModifiers
} from './effects';
import { AggressiveStrategy, DefensiveStrategy, BalancedStrategy, BossPhaseStrategy } from './ai/strategies';
import type { IAiStrategy, BattleContext } from './ai/types';
import type { AiStrategyType } from '../enemy/types';
import { BossPhaseManager, processBossPhaseMechanics, applyPhaseStats } from '../boss/engine';
import type { BossIntro } from '../boss/types';

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
  const playerEffects = ref<EffectContainer>({ effects: [] });

  /** 敌人效果容器映射（敌人ID -> 效果容器，用于护盾等临时效果） */
  const enemyEffects = ref<Map<string, EffectContainer>>(new Map());

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
            // 敌人治疗自己
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

    // 使用纯函数计算伤害
    const { rawDamage } = calculatePlayerDamage(
      characterStore.attributes.physicalAttack,
      target.physicalDefense || 0
    );

    // 暴击判定
    const critChance = characterStore.attributes.critChance / 100;
    const isCrit = rollCritical(critChance);
    const critMultiplier = isCrit ? 1.5 : 1;
    const damage = Math.floor(rawDamage * critMultiplier);

    // 应用敌人护盾（临时处理）
    const enemyEff = enemyEffects.value.get(target.id);
    let finalDamage = damage;
    if (enemyEff) {
      const shieldResult = applyShield(enemyEff, damage);
      finalDamage = shieldResult.actualDamage;
    }

    // 造成伤害
    const isDead = enemiesStore.takeDamage(target.id, finalDamage);

    // 物理伤害音效事件
    eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
      amount: damage,
      damageType: 'physical',
      targetName: target.name || '敌人',
      actorType: 'player'
    });

    // 暴击事件（视觉特效 + 暴击音效）
    if (isCrit) {
      eventBus.emit(GameEvents.COMBAT_CRITICAL_HIT, {
        amount: damage,
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

        for (const e of livingEnemies) {
          enemiesStore.takeDamage(e.id, aoeDamage);

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
      } else if (targetType === 'self') {
        // 对自身生效（自伤技能，实际上不太合理，按治疗逻辑处理）
        endPlayerTurn();
      } else {
        // 单目标（默认）：现有逻辑
        const target = currentTarget.value;
        if (!target) {
          return { success: false, type: 'skill', message: '没有可攻击的目标！' };
        }

        const isDead = enemiesStore.takeDamage(target.id, result.damage);
        const updatedTarget = enemiesStore.getEnemyById(target.id);

        // 伤害类型音效事件
        eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
          amount: result.damage,
          damageType: result.type === 'magic_damage' ? 'magic' : 'physical',
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
          damage: result.damage,
          isCrit: false,
          isDodge: false,
          message: `${skill?.name || '技能'} 对 ${updatedTarget?.name} 造成 ${result.damage} 点${result.type === 'magic_damage' ? '魔法' : '物理'}伤害！`
        });

        if (isDead || !updatedTarget || aliveEnemies.value.length === 0) {
          endCombat('victory');
        } else {
          endPlayerTurn();
        }
      }
    } else if (result.heal) {
      // 治疗技能音效事件（skillsStore.castSkill 已通过 characterStore.receiveHeal 应用治疗）
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

    // 直接调用 inventoryStore 使用物品
    const inventoryStore = useInventoryStore();
    await inventoryStore.useItem(itemId);

    // 根据物品类型发出对应的治疗音效事件
    const itemInfo = inventoryStore.getItemInfo(itemId);
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

    addCombatLog({
      actorType: 'player',
      actorId: 'player',
      actorName: characterStore.name,
      eventType: 'combat_item',
      isCrit: false,
      isDodge: false,
      message: `${characterStore.name} 使用了物品！`
    });

    endPlayerTurn();
    saveLogs();

    return {
      success: true,
      type: 'item',
      message: '使用了物品！'
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
          icon: '🎒'
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
   * 构建先攻顺序（玩家 + 所有敌人按速度降序排列）
   * @param characterStore - 角色 Store 实例
   */
  function buildInitiativeOrder(characterStore: ReturnType<typeof useCharacterStore>): void {
    const units: { id: string; speed: number }[] = [];

    // 玩家速度
    const playerSpeed = characterStore.effectiveStats?.dex || 10;
    units.push({ id: 'player', speed: playerSpeed });

    // 所有敌人速度
    for (const e of enemies.value) {
      const enemySpeed = (e.stats as any)?.dex || e.dodgeChance || 5;
      units.push({ id: e.id, speed: enemySpeed });
    }

    // 按速度降序排列
    units.sort((a, b) => b.speed - a.speed);
    initiativeOrder.value = units.map(u => u.id);
    currentInitiativeIndex.value = 0;
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
          addCombatLog({
            actorType: 'system', actorId: 'system', actorName: '系统',
            eventType: 'combat_event', targetType: 'enemy', targetId: e.id,
            targetName: e.name, isCrit: false, isDodge: false,
            message: `【阶段转换】${e.name} 进入 "${transition.newPhase.name}" 阶段！`
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
          }
        }
      }
    }

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
    playerEffects.value = { effects: [] };
    enemyEffects.value = new Map();

    // 初始化 Boss 功能（阶段管理器 + 出场演出）
    initBossFeatures(enemiesData);

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
      icon: '⚔️'
    });

    // 触发战斗开始事件（UI 进入战斗界面 + 音效）
    eventBus.emit(GameEvents.COMBAT_START, { enemy: enemiesData[0] });

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
          icon: '🏆'
        });

        // 记录获得经验值到冒险日志
        if (totalExp > 0) {
          logStore.addLogEntry({
            id: generateLogId(),
            timestamp: Date.now(),
            type: 'combat',
            message: `获得 ${totalExp} 点经验值`,
            icon: '⭐'
          });
        }

        // 记录获得金币到冒险日志
        if (totalGold > 0) {
          logStore.addLogEntry({
            id: generateLogId(),
            timestamp: Date.now(),
            type: 'combat',
            message: `获得 ${totalGold} 金币`,
            icon: '💰'
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
          icon: '💀'
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
          icon: '🏃'
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
    playerEffects.value = { effects: [] };
    enemyEffects.value = new Map();
    bossPhaseManagers.clear();
    bossIntros.value = {};
  }

  // ==================== Action：效果操作 ====================

  /**
   * 为玩家添加效果（供外部模块直接调用）
   * @param effect - 效果实例
   */
  function addEffectToPlayer(effect: Effect): void {
    addEffectToContainer(playerEffects.value, effect);
  }

  /**
   * 获取玩家当前属性修正
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
