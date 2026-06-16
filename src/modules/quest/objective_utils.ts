/**
 * @fileoverview 任务目标显示文本工具
 * @description 从 enemyId/itemId 自动生成目标描述文本，无需手写 description
 */

import type { QuestObjective } from './types';
import { MOBS } from '@/data/config_mobs';
import { BOSSES } from '@/data/config_bosses';

/** 敌人ID → 名称映射表（合并普通怪物和Boss） */
const ENEMY_NAME_MAP: Map<string, string> = (() => {
  const map = new Map<string, string>();
  for (const mob of MOBS) {
    map.set(mob.id, mob.name);
  }
  for (const boss of BOSSES) {
    if (!map.has(boss.id)) {
      map.set(boss.id, boss.name);
    }
  }
  return map;
})();

/**
 * 根据任务目标生成显示文本
 * 
 * @param objective - 任务目标对象
 * @param itemNameProvider - 可选，用于解析物品ID→名称的函数（收集类任务需要）
 * @returns 显示文本，如 "消灭剧毒蜘蛛"、"收集草药"
 */
export function getObjectiveText(
  objective: QuestObjective,
  itemNameProvider?: (itemId: string) => string | null
): string {
  if (objective.type === 'kill' && objective.enemyId) {
    const name = ENEMY_NAME_MAP.get(objective.enemyId) || objective.enemyId;
    return `消灭${name}`;
  }
  if (objective.type === 'collect' && objective.itemId) {
    if (itemNameProvider) {
      const name = itemNameProvider(objective.itemId);
      if (name) return `收集${name}`;
    }
    return `收集${objective.itemId}`;
  }
  return objective.key;
}

/**
 * 获取敌人名称
 * 
 * @param enemyId - 敌人ID
 * @returns 敌人名称，找不到时返回原始ID
 */
export function getEnemyName(enemyId: string): string {
  return ENEMY_NAME_MAP.get(enemyId) || enemyId;
}
