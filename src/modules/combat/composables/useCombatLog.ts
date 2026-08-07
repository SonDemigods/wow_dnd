/**
 * 战斗日志 Composable
 *
 * 从 combat store 提取的日志记录和效果上下文创建函数。
 * 依赖 useCombatState() 返回的状态对象来访问 combatId、combatLogs、turnCount。
 *
 * ARCH-6 审计结果：本 composable 仅读取 ctx.character 的只读属性（attributes/
 * effectiveStats/hp/maxHp），不调用任何写入方法，因此 ctx 参数收窄为 ICombatQuery，
 * 在编译期保证无副作用。
 */
import type { CombatLog } from '../types';
import type { EnemyInstance } from '../../enemy/types';
import type { EffectContext } from '../effects';
import type { ICombatQuery } from '../combatContext';
import { combatDbService } from '../db';
import { generateBattleLogId } from '../service';
import type { useCombatState } from './useCombatState';

export function useCombatLog(state: ReturnType<typeof useCombatState>, ctx: ICombatQuery) {
  /**
   * 保存中的 Promise 引用（防重入锁）
   *
   * P3 BIZ-5 修复：战斗中一次回合可能触发 3-5 次 saveLogs()，每次都保存全量日志。
   * 如果并发调用各自启动 Promise.all，会导致 IndexedDB 事务队列堆积与重复 put。
   * 通过复用同一 Promise，并发调用方等待同一持久化任务完成。
   */
  let savingPromise: Promise<void> | null = null;

  /**
   * 已保存的日志索引指针（P3-174：增量保存）
   *
   * 每次 saveLogs 仅保存 combatLogs.value.slice(lastSavedIndex)，
   * 避免长战斗中每回合全量重保存导致的 O(n) 性能劣化。
   */
  let lastSavedIndex = 0;

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
   *
   * P3-174 优化：增量保存。
   * - 首次调用启动持久化任务，savingPromise 被赋值
   * - 并发调用直接返回同一 Promise，避免重复保存
   * - 任务完成后清除引用，下次调用将启动新任务
   *
   * P3 BIZ-5 修复：防重入设计，避免 IndexedDB 事务队列堆积与重复 put。
   *
   * @param forceAll - 是否全量保存剩余日志（endCombat/flush 时传 true）
   */
  async function saveLogs(forceAll: boolean = false): Promise<void> {
    if (savingPromise) {
      return savingPromise;
    }
    savingPromise = (async () => {
      try {
        const logs = state.combatLogs.value;
        // 增量：仅保存 [lastSavedIndex, length) 新增日志；forceAll 保存全部
        const start = forceAll ? 0 : lastSavedIndex;
        const logsToSave = logs.slice(start);
        await Promise.all(logsToSave.map(log => combatDbService.saveCombatLog(log)));
        // 保存成功后推进指针（forceAll 时同步全部指针到末尾）
        lastSavedIndex = forceAll ? logs.length : start + logsToSave.length;
      } catch (e) {
        console.error('[CombatStore] 保存战斗日志失败:', e);
      } finally {
        savingPromise = null;
      }
    })();
    return savingPromise;
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
        // P1-8 修复：使用实际速度值，与 useInitiative 中先攻计算速度来源一致
        speed: ctx.character.effectiveStats.dex || 0,
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
        // P3-88 修复：使用 ?? 替代 ||，避免 0 值被吞掉
        physicalAttack: enemy.physicalAttack ?? 0,
        physicalDefense: enemy.physicalDefense ?? 0,
        magicAttack: enemy.magicAttack ?? 0,
        magicDefense: enemy.magicDefense ?? 0,
        // P1-8 修复：使用实际速度值，与 useInitiative 中先攻计算速度来源一致
        speed: enemy.stats?.dex ?? 0,
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
    /** P3-174：重置增量指针（startCombat 清空日志时调用） */
    resetSaveIndex: () => { lastSavedIndex = 0; },
  };
}
