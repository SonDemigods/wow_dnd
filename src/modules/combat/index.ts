/**
 * @fileoverview 战斗服务类
 * @description 提供战斗管理、伤害计算、AI行为等核心功能
 * @module modules/combat/index
 */

import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { configManager } from '@/services/configManager';
import { characterService } from '../character';
import { inventoryService } from '../inventory';
import type { Enemy, Attributes } from '@/types';
import type {
  CombatState,
  CombatResult,
  CombatDamageEvent,
  CombatStartEvent,
  CombatEndEvent,
  ICombatService
} from './types';

/**
 * 战斗状态管理Store
 */
export const useCombatStore = defineStore('combat', () => {
  /** 战斗状态 */
  const state = ref<CombatState>('idle');
  /** 当前敌人 */
  const currentEnemy = ref<Enemy | null>(null);
  /** 当前回合 */
  const turn = ref<'player' | 'enemy'>('player');
  /** 战斗日志 */
  const combatLog = ref<string[]>([]);

  /** 是否正在战斗 */
  const isInCombat = computed(() => state.value === 'fighting');

  /**
   * 添加战斗日志
   */
  const addLog = (message: string) => {
    combatLog.value.push(message);
    if (combatLog.value.length > 50) {
      combatLog.value.shift();
    }
  };

  /**
   * 计算伤害
   */
  const calculateDamage = (
    attackerAttributes: Attributes,
    defenderAttributes: Attributes
  ): { damage: number; isCrit: boolean } => {
    const config = configManager.getConfig();
    
    // 基础伤害
    let baseDamage = attackerAttributes.attackBonus + Math.floor(Math.random() * 10);
    
    // 检查暴击
    const critChance = config.combat.baseCritChance + attackerAttributes.critBonus;
    const isCrit = Math.random() * 100 < critChance;
    if (isCrit) {
      baseDamage = Math.floor(baseDamage * 1.5);
    }

    // 检查闪避
    const dodgeChance = config.combat.baseDodgeChance + defenderAttributes.dodgeBonus;
    if (Math.random() * 100 < dodgeChance) {
      return { damage: 0, isCrit: false };
    }

    // 应用护甲减免
    const armor = defenderAttributes.armor;
    const damage = Math.max(1, baseDamage - Math.floor(armor * 0.5));

    return { damage, isCrit };
  };

  /**
   * 开始战斗
   */
  const startCombat = (enemy: Enemy) => {
    state.value = 'preparing';
    currentEnemy.value = { ...enemy, currentHp: enemy.hp };
    turn.value = 'player';
    combatLog.value = [];

    addLog(`遭遇了 ${enemy.name}！`);
    
    setTimeout(() => {
      state.value = 'fighting';
      const event: CombatStartEvent = { enemy };
      eventBus.emit(GameEvents.COMBAT_START, event);
    }, 500);
  };

  /**
   * 玩家攻击
   */
  const playerAttack = () => {
    if (!isInCombat.value || !currentEnemy.value) return;

    const playerAttributes = characterService.getAttributes();
    const enemyAttributes: Attributes = {
      hpBonus: 0,
      mpBonus: 0,
      attackBonus: currentEnemy.value.attack,
      armor: currentEnemy.value.armor,
      healBonus: 0,
      dodgeBonus: currentEnemy.value.dodge,
      critBonus: 5,
    };

    const { damage, isCrit } = calculateDamage(playerAttributes, enemyAttributes);

    if (damage === 0) {
      addLog(`你的攻击被 ${currentEnemy.value.name} 闪避了！`);
    } else {
      currentEnemy.value.currentHp -= damage;
      const criticalText = isCrit ? ' (暴击！)' : '';
      addLog(`你对 ${currentEnemy.value.name} 造成了 ${damage} 点伤害${criticalText}`);

      const damageEvent: CombatDamageEvent = {
        target: 'enemy',
        amount: damage,
        isCrit,
      };
      eventBus.emit(GameEvents.COMBAT_DAMAGE, damageEvent);
      eventBus.emit(GameEvents.COMBAT_PLAYER_ATTACK, damageEvent);

      // 检查敌人是否死亡
      if (currentEnemy.value.currentHp <= 0) {
        setTimeout(() => endCombat('victory'), 500);
        return;
      }
    }

    // 切换到敌人回合
    turn.value = 'enemy';
    setTimeout(() => enemyAttack(), 800);
  };

  /**
   * 敌人攻击
   */
  const enemyAttack = () => {
    if (!isInCombat.value || !currentEnemy.value) return;

    const enemyAttributes: Attributes = {
      hpBonus: 0,
      mpBonus: 0,
      attackBonus: currentEnemy.value.attack,
      armor: currentEnemy.value.armor,
      healBonus: 0,
      dodgeBonus: currentEnemy.value.dodge,
      critBonus: 5,
    };

    const playerAttributes = characterService.getAttributes();
    const { damage, isCrit } = calculateDamage(enemyAttributes, playerAttributes);

    if (damage === 0) {
      addLog(`你闪避了 ${currentEnemy.value.name} 的攻击！`);
    } else {
      characterService.addHp(-damage);
      const criticalText = isCrit ? ' (暴击！)' : '';
      addLog(`${currentEnemy.value.name} 对你造成了 ${damage} 点伤害${criticalText}`);

      const damageEvent: CombatDamageEvent = {
        target: 'player',
        amount: damage,
        isCrit,
      };
      eventBus.emit(GameEvents.COMBAT_DAMAGE, damageEvent);
      eventBus.emit(GameEvents.COMBAT_ENEMY_ATTACK, damageEvent);

      // 检查玩家是否死亡
      const characterStore = characterService;
      const character = {
        hp: characterStore.addHp,
        currentHp: 0, // 这里需要从store获取
      };
      // 简化处理，在实际使用中应该从store获取实际值
    }

    turn.value = 'player';
  };

  /**
   * 尝试逃跑
   */
  const flee = (): boolean => {
    if (!isInCombat.value) return false;

    const fleeChance = 50; // 50% 基础逃跑概率
    if (Math.random() * 100 < fleeChance) {
      addLog('成功逃跑了！');
      endCombat('fled');
      return true;
    }

    addLog('逃跑失败！');
    turn.value = 'enemy';
    setTimeout(() => enemyAttack(), 800);
    return false;
  };

  /**
   * 结束战斗
   */
  const endCombat = (result: CombatResult) => {
    if (!currentEnemy.value) return;

    state.value = 'ended';

    let expGained = 0;
    if (result === 'victory') {
      expGained = currentEnemy.value.exp;
      characterService.addExp(expGained);
      addLog(`战斗胜利！获得了 ${expGained} 点经验`);

      // 给予战利品
      if (currentEnemy.value.loot) {
        for (const item of currentEnemy.value.loot) {
          inventoryService.addItem(item);
        }
      }
    }

    const event: CombatEndEvent = {
      result,
      enemy: currentEnemy.value,
      expGained,
    };
    eventBus.emit(GameEvents.COMBAT_END, event);

    // 清理战斗状态
    setTimeout(() => {
      state.value = 'idle';
      currentEnemy.value = null;
      combatLog.value = [];
    }, 1500);
  };

  return {
    // 状态
    state,
    currentEnemy,
    turn,
    combatLog,
    isInCombat,
    // 方法
    startCombat,
    playerAttack,
    enemyAttack,
    flee,
    endCombat,
    addLog,
  };
});

/**
 * 战斗服务实现
 */
export const combatService: ICombatService = {
  getState: () => useCombatStore().state,
  getEnemy: () => useCombatStore().currentEnemy,
  getTurn: () => useCombatStore().turn,
  startCombat: (enemy: Enemy) => useCombatStore().startCombat(enemy),
  playerAttack: () => useCombatStore().playerAttack(),
  enemyAttack: () => useCombatStore().enemyAttack(),
  endCombat: (result: CombatResult) => useCombatStore().endCombat(result),
  flee: () => useCombatStore().flee(),
  isInCombat: () => useCombatStore().isInCombat,
};
