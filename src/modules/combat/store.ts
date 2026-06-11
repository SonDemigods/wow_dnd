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

/**
 * 战斗状态存储
 */
export const useCombatStore = defineStore('combat', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================
  
  /** 当前战斗状态 */
  const state = ref<CombatState>('idle');
  
  /** 当前敌人 */
  const enemy = ref<Enemy | null>(null);
  
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

  /** 敌人回合延迟定时器 ID（非响应式，用于战斗提前结束时取消） */
  let turnTimerId: ReturnType<typeof setTimeout> | null = null;

  // ==================== 跨 Store 引用 ====================
  const enemiesStore = useEnemiesStore();
  const logStore = useLogStore();

  // ==================== 计算属性 ====================

  /** 是否正在战斗中 */
  const isInCombat = computed(() => state.value === 'fighting');

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
   * 设置敌人回合延迟定时器
   */
  function endPlayerTurn(): void {
    turn.value = 'enemy';

    addCombatLog({
      actorType: 'system',
      actorId: 'system',
      actorName: '系统',
      eventType: 'combat_turn_end',
      isCrit: false,
      isDodge: false,
      message: '玩家回合结束'
    });

    // 延迟执行敌人回合
    turnTimerId = setTimeout(() => {
      turnTimerId = null;
      enemyTurn();
    }, 500);
  }

  // ==================== 内部辅助：敌人行动 ====================

  /**
   * 敌人普通攻击（内部方法）
   */
  function enemyBasicAttack(): CombatActionResult {
    if (!enemy.value) {
      return { success: false, type: 'attack', message: '没有敌人！' };
    }

    const characterStore = useCharacterStore();
    const e = enemy.value;

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

    // 造成伤害 → 直接调用 characterStore Action
    characterStore.takeDamage(damage);

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
      damage,
      isCrit: false,
      isDodge: false,
      message: `${e.name} 对 ${characterStore.name} 造成 ${damage} 点伤害！`
    });

    return {
      success: true,
      type: 'attack',
      damage,
      message: `${e.name} 对你造成 ${damage} 点伤害！`
    };
  }

  /**
   * 敌人使用技能攻击（内部方法）
   * @param damage - 技能伤害值
   * @param skill - 技能信息
   */
  function enemyAttackWithSkill(damage: number, skill: { id: string; name: string }): CombatActionResult {
    if (!enemy.value) {
      return { success: false, type: 'skill', message: '没有敌人！' };
    }

    const characterStore = useCharacterStore();
    const e = enemy.value;

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

    // 造成伤害 → 直接调用 characterStore Action
    characterStore.takeDamage(damage);

    // 物理伤害音效（敌方技能）
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
      eventType: 'combat_skill_cast',
      targetType: 'player',
      targetId: 'player',
      targetName: characterStore.name,
      skillId: skill.id,
      skillName: skill.name,
      damage,
      isCrit: false,
      isDodge: false,
      message: `${e.name} 使用 ${skill.name}，对 ${characterStore.name} 造成 ${damage} 点伤害！`
    });

    return {
      success: true,
      type: 'skill',
      damage,
      message: `${e.name} 使用了 ${skill.name}，对你造成 ${damage} 点伤害！`
    };
  }

  /**
   * 敌人行动（内部方法）
   */
  function enemyAction(): CombatActionResult {
    if (!enemy.value) {
      return { success: false, type: 'attack', message: '没有敌人！' };
    }

    // 检查敌人是否有可用技能
    const availableSkills = enemiesStore.getAvailableSkills(enemy.value.id);

    // 决定使用技能还是普通攻击（30% 几率使用技能）
    const useSkill = availableSkills.length > 0 && Math.random() < 0.3;

    if (useSkill) {
      // 随机选择一个可用技能
      const skill = availableSkills[Math.floor(Math.random() * availableSkills.length)];
      const result = enemiesStore.useSkill(enemy.value.id, skill.id);

      if (result.success) {
        if (result.isHeal) {
          // 敌人治疗自己
          enemy.value = enemiesStore.getEnemyById(enemy.value.id);
          if (!enemy.value) {
            return { success: false, type: 'skill', message: '找不到敌人数据' };
          }

          addCombatLog({
            actorType: 'enemy',
            actorId: enemy.value.id,
            actorName: enemy.value.name,
            eventType: 'combat_heal',
            skillId: skill.id,
            skillName: skill.name,
            heal: -result.damage,
            isCrit: false,
            isDodge: false,
            message: `${enemy.value.name} 使用 ${skill.name}，恢复了 ${-result.damage} 点生命值！`
          });

          return {
            success: true,
            type: 'skill',
            heal: -result.damage,
            message: `${enemy.value.name} 使用了 ${skill.name}！`
          };
        } else {
          // 敌人使用攻击技能
          return enemyAttackWithSkill(result.damage, skill);
        }
      }
    }

    // 普通攻击
    return enemyBasicAttack();
  }

  // ==================== 内部辅助：玩家行动 ====================

  /**
   * 玩家普通攻击（内部方法）
   */
  function playerAttack(): CombatActionResult {
    if (!enemy.value) {
      return { success: false, type: 'attack', message: '没有敌人！' };
    }

    const characterStore = useCharacterStore();
    const e = enemy.value;

    // 检查敌人闪避（dodgeChance 是百分比，如 3 表示 3%）
    const enemyDodgeChance = (e.dodgeChance || 0) / 100;
    const isDodge = rollDodge(enemyDodgeChance);

    if (isDodge) {
      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterStore.name,
        eventType: 'combat_miss',
        targetType: 'enemy',
        targetId: e.id,
        targetName: e.name,
        isCrit: false,
        isDodge: true,
        message: `${characterStore.name} 攻击被 ${e.name} 闪避了！`
      });

      // 发射闪避事件（音效 + 视觉特效）
      eventBus.emit(GameEvents.COMBAT_DODGE, {
        attackerName: characterStore.name,
        dodgerName: e.name,
        dodgerType: 'enemy'
      });

      endPlayerTurn();
      saveLogs();

      return {
        success: true,
        type: 'attack',
        isDodge: true,
        message: `${e.name} 闪避了你的攻击！`
      };
    }

    // 使用纯函数计算伤害
    const { rawDamage } = calculatePlayerDamage(
      characterStore.attributes.physicalAttack,
      e.physicalDefense || 0
    );

    // 暴击判定
    const critChance = characterStore.attributes.critChance / 100;
    const isCrit = rollCritical(critChance);
    const critMultiplier = isCrit ? 1.5 : 1;
    const damage = Math.floor(rawDamage * critMultiplier);

    // 造成伤害
    const isDead = enemiesStore.takeDamage(e.id, damage);

    // 物理伤害音效事件
    eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
      amount: damage,
      damageType: 'physical',
      targetName: e.name || '敌人',
      actorType: 'player'
    });

    // 暴击事件（视觉特效 + 暴击音效）
    if (isCrit) {
      eventBus.emit(GameEvents.COMBAT_CRITICAL_HIT, {
        amount: damage,
        damageType: 'physical',
        targetName: e.name || '敌人',
        actorType: 'player'
      });
    }

    // 更新敌人状态
    enemy.value = enemiesStore.getEnemyById(e.id);

    // 添加日志
    addCombatLog({
      actorType: 'player',
      actorId: 'player',
      actorName: characterStore.name,
      eventType: isCrit ? 'combat_critical' : 'combat_damage',
      targetType: 'enemy',
      targetId: enemy.value?.id || '',
      targetName: enemy.value?.name || '',
      damage,
      isCrit,
      isDodge: false,
      message: isCrit
        ? `${characterStore.name} 暴击！对 ${enemy.value?.name} 造成 ${damage} 点伤害！`
        : `${characterStore.name} 对 ${enemy.value?.name} 造成 ${damage} 点伤害！`
    });

    // 检查战斗是否结束
    if (isDead || !enemy.value) {
      endCombat('victory');
    } else {
      endPlayerTurn();
    }

    saveLogs();

    return {
      success: true,
      type: 'attack',
      damage,
      isCrit,
      message: isCrit
        ? `暴击！造成 ${damage} 点伤害！`
        : `造成 ${damage} 点伤害！`
    };
  }

  /**
   * 玩家使用技能（内部方法）
   * @param skillId - 技能 ID
   */
  async function playerSkill(skillId: string): Promise<CombatActionResult> {
    const skillsStore = useSkillsStore();
    const characterStore = useCharacterStore();

    if (!enemy.value) {
      return { success: false, type: 'skill', message: '没有敌人！' };
    }

    const skill = skillsStore.getSkill(skillId);
    const result = await skillsStore.castSkill(skillId);

    if (!result.success) {
      return {
        success: false,
        type: 'skill',
        message: result.message
      };
    }

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

    // 如果是伤害技能，对敌人造成伤害
    if (result.damage && (result.type === 'physical_damage' || result.type === 'magic_damage')) {
      const e = enemy.value;
      const isDead = enemiesStore.takeDamage(e.id, result.damage);
      enemy.value = enemiesStore.getEnemyById(e.id);

      // 伤害类型音效事件
      eventBus.emit(GameEvents.COMBAT_DEAL_DAMAGE, {
        amount: result.damage,
        damageType: result.type === 'magic_damage' ? 'magic' : 'physical',
        targetName: enemy.value?.name || '敌人',
        actorType: 'player'
      });

      addCombatLog({
        actorType: 'player',
        actorId: 'player',
        actorName: characterStore.name,
        eventType: result.type === 'magic_damage' ? 'combat_skill_cast' : 'combat_damage',
        targetType: 'enemy',
        targetId: enemy.value?.id || '',
        targetName: enemy.value?.name || '',
        skillId,
        skillName: skill?.name || '',
        damage: result.damage,
        isCrit: false,
        isDodge: false,
        message: `${skill?.name || '技能'} 对 ${enemy.value?.name} 造成 ${result.damage} 点${result.type === 'magic_damage' ? '魔法' : '物理'}伤害！`
      });

      if (isDead || !enemy.value) {
        endCombat('victory');
      } else {
        endPlayerTurn();
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

    if (!enemy.value || isBossCombat(enemy.value)) {
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
   */
  function handleLoot(): void {
    if (!enemy.value) return;

    enemy.value.drops.forEach(drop => {
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
      }
    });
  }

  // ==================== Action：开始战斗 ====================

  /**
   * 开始战斗
   * @param enemyData - 敌人数据
   */
  function startCombat(enemyData: Enemy): void {
    // 创建战斗 ID
    combatId.value = generateCombatId();

    // 设置战斗状态
    state.value = 'fighting';
    enemy.value = enemyData;
    turn.value = 'player';
    turnCount.value = 1;
    combatLogs.value = [];

    // 重置 UI 结果状态（新一轮战斗开始）
    combatResult.value = null;
    expGained.value = 0;
    goldGained.value = 0;

    // 添加战斗开始日志
    addCombatLog({
      actorType: 'system',
      actorId: 'system',
      actorName: '系统',
      eventType: 'combat_start',
      message: `战斗开始！你遭遇了 ${enemyData.name}！`
    });

    // 记录到冒险日志
    logStore.addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'combat',
      message: `遭遇 ${enemyData.name}！`,
      icon: '⚔️'
    });

    // 触发战斗开始事件（UI 进入战斗界面 + 音效）
    eventBus.emit(GameEvents.COMBAT_START, { enemy: enemyData });

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

    if (!enemy.value) {
      return;
    }

    try {
      const characterStore = useCharacterStore();

      // 触发敌人回合开始事件
      eventBus.emit(GameEvents.COMBAT_ENEMY_TURN, null);

      // 添加回合开始日志
      addCombatLog({
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_turn_start',
        isCrit: false,
        isDodge: false,
        message: `${enemy.value.name} 的回合`
      });

      // 敌人行动
      const actionResult = enemyAction();

      if (actionResult.success) {
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

      addCombatLog({
        actorType: 'system',
        actorId: 'system',
        actorName: '系统',
        eventType: 'combat_turn_end',
        isCrit: false,
        isDodge: false,
        message: `${enemy.value.name} 的回合结束`
      });

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
    if (!enemy.value) return;

    try {
      const characterStore = useCharacterStore();

      // 设置战斗状态
      state.value = 'ended';

      const exp = enemy.value.expReward;
      const gold = enemy.value.goldReward;

      // 设置 UI 战斗结果（供弹窗展示）
      combatResult.value = result;
      expGained.value = exp;
      goldGained.value = gold;

      if (result === 'victory') {
        // 先记录击败怪物日志，再通过 Store Action 触发奖励
        logStore.addLogEntry({
          id: generateLogId(),
          timestamp: Date.now(),
          type: 'combat',
          message: `击败 ${enemy.value.name}！`,
          icon: '🏆'
        });

        // 内部战斗日志（战斗弹窗用）
        addCombatLog({
          actorType: 'system',
          actorId: 'system',
          actorName: '系统',
          eventType: 'combat_end',
          isCrit: false,
          isDodge: false,
          message: `战斗胜利！获得 ${exp} 经验值和 ${gold} 金币！`
        });

        // 胜利：直接调用 characterStore Action 获得经验和金币
        characterStore.gainExp(exp);
        characterStore.gainGold(gold);

        // 处理掉落（只有 Boss 才掉落物品）
        if (isBossCombat(enemy.value)) {
          handleLoot();
        }

        // 直接调用 questStore 更新击杀进度
        if (enemy.value.dataId) {
          const questStore = useQuestStore();
          questStore.onEnemyKilled(enemy.value.dataId);
        }
      } else if (result === 'defeat') {
        // 失败：损失经验
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
          message: `被 ${enemy.value.name} 击败！`,
          icon: '💀'
        });

        // 直接调用 characterStore Action 处理死亡
        characterStore.handleDeath();
      } else if (result === 'fled') {
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
          message: `从 ${enemy.value.name} 面前逃跑`,
          icon: '🏃'
        });
      }

      // 保存日志
      saveLogs();

      // 触发战斗结束事件（包含战斗结果信息，供探索等模块监听）
      eventBus.emit(GameEvents.COMBAT_END, {
        result,
        enemy: enemy.value,
        expGained: result === 'victory' ? exp : 0,
        goldGained: result === 'victory' ? gold : 0
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
    if (enemy.value && enemy.value.hp <= 0) {
      enemiesStore.deleteEnemy(enemy.value.id);
    }

    // 重置战斗状态
    enemy.value = null;
    turn.value = 'player';
    turnCount.value = 0;
    combatId.value = '';
    combatLogs.value = [];
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
    enemy.value = null;
    turn.value = 'player';
    turnCount.value = 0;
    combatId.value = '';
    combatLogs.value = [];
    combatResult.value = null;
    expGained.value = 0;
    goldGained.value = 0;
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
    enemy,
    turn,
    turnCount,
    combatLogs,
    combatResult,
    expGained,
    goldGained,

    // 计算属性
    isInCombat,

    // Action
    startCombat,
    playerAction,
    enemyTurn,
    skipTurn,
    endCombat,
    reset,

    // 生命周期
    setupCrossModuleListeners,
    dispose
  };
});
