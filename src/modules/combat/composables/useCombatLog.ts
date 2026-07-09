/**
 * 战斗日志 Composable
 * 
 * 从 combat store 提取的日志记录和效果上下文创建函数。
 * 依赖 useCombatState() 返回的状态对象来访问 combatId、combatLogs、turnCount。
 */
import type { CombatLog } from '../types';
import type { EnemyInstance } from '../../enemy/types';
import type { EffectContext } from '../effects';
import type { ICombatContext } from '../combatContext';
import { combatDbService } from '../db';
import { generateBattleLogId } from '../service';
import type { useCombatState } from './useCombatState';

export function useCombatLog(state: ReturnType<typeof useCombatState>, ctx: ICombatContext) {
  /**
   * 添加战斗日志（内部方法）
   * @param data - 日志数据（不含自动生成字段）
   */
  function addCombatLog(data: Omit<CombatLog, 'combatId' | 'battleLogId' | 'timestamp' | 'turn'>): void {
    const log: CombatLog = {
      combatId: state.combatId.value,
      battleLogId: generateBattleLogId(),
      timestamp: Date.now(),
      turn: state.turnCount.value,
      ...data
    };
    state.combatLogs.value.push(log);
  }

  /**
   * 持久化战斗日志（内部方法）
   */
  async function saveLogs(): Promise<void> {
    try {
      const logsToSave = [...state.combatLogs.value];
      await Promise.all(logsToSave.map(log => combatDbService.saveCombatLog(log)));
    } catch (e) {
      console.error('[CombatStore] 保存战斗日志失败:', e);
    }
  }

  /**
   * 创建玩家效果上下文
   * 通过 ctx.character 读取角色属性（保持响应式）
   */
  function createPlayerEffectContext(): EffectContext {
    return {
      ownerId: 'player',
      ownerType: 'player',
      baseStats: {
        physicalAttack: ctx.character.attributes.physicalAttack,
        physicalDefense: ctx.character.attributes.physicalDefense,
        magicAttack: ctx.character.attributes.magicAttack,
        magicDefense: ctx.character.attributes.magicDefense,
        speed: 0,
      },
      currentHp: ctx.character.hp,
      maxHp: ctx.character.maxHp,
    };
  }

  /**
   * 创建敌人效果上下文
   * @param enemy - 敌人实例
   */
  function createEnemyEffectContext(enemy: EnemyInstance): EffectContext {
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

  return {
    addCombatLog,
    saveLogs,
    createPlayerEffectContext,
    createEnemyEffectContext,
  };
}
