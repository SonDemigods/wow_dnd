/**
 * @fileoverview 怪物 ID 迁移工具（P3-137 迁移基础设施）
 * @description
 *   针对持久化存档中嵌入的旧怪物 ID，提供运行时透明迁移能力。
 *
 *   主要迁移目标：
 *   - char_exploration.grid[][]: ExplorationCell.monsterId（角色探索存档深度嵌套）
 *
 *   迁移时机：读取存档后、createEnemy 调用前。
 *   迁移策略：基于 alias-map 的 resolveEnemyId 单向转换（旧 → 新），新 ID 原样保留。
 *
 * @module enemy/migration
 */

import type { ExplorationCell } from '@/modules/exploration/types';
import { resolveEnemyId } from './alias-map';

/**
 * 迁移探索网格中所有格子的怪物 ID
 *
 * 遍历 grid 二维数组的每个 cell，将 cell.monsterId 经 resolveEnemyId 转换为新 ID。
 * 仅 monster/boss 类型格子携带 monsterId，但本函数不区分类型，统一转换（undefined 跳过）。
 *
 * 调用时机：getExplorationData 读取存档后立即调用，确保后续 triggerBattle/createEnemy
 * 拿到的 ID 始终是新 ID，避免旧存档出现悬空引用。
 *
 * @param grid - 探索网格（二维数组，会被原地修改并返回）
 * @returns 迁移后的同一网格引用（便于链式调用）
 */
export function migrateExplorationGrid(grid: ExplorationCell[][]): ExplorationCell[][] {
  for (const row of grid) {
    for (const cell of row) {
      if (cell.monsterId) {
        cell.monsterId = resolveEnemyId(cell.monsterId);
      }
    }
  }
  return grid;
}

/**
 * 迁移单个怪物 ID（便捷封装）
 *
 * 用于非网格场景的零散 ID 迁移，如任务目标 enemyId、地点怪物池等。
 *
 * @param id - 待迁移的怪物 ID
 * @returns 迁移后的新 ID
 */
export function migrateEnemyId(id: string): string {
  return resolveEnemyId(id);
}

/**
 * 批量迁移怪物 ID 数组
 *
 * 用于地点配置中的 enemies/bosses 怪物池数组迁移。
 * 返回新数组，不修改原数组。
 *
 * @param ids - 待迁移的怪物 ID 数组
 * @returns 迁移后的新 ID 数组
 */
export function migrateEnemyIdArray(ids: readonly string[]): string[] {
  return ids.map(id => resolveEnemyId(id));
}
