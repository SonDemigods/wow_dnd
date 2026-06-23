/**
 * @fileoverview 任务目标 —— UI 文本生成工具
 *
 * 提供敌人名称查询和目标描述文本自动生成能力。
 *
 * **设计意图**：
 * QuestObjective 不存储可读的 description 字符串，
 * 而是通过 enemyId / itemId 结合数据源动态生成中文文本。
 * 这样避免数据冗余，并保证显示文本始终与配置数据一致。
 *
 * ## 数据来源
 *
 * - 敌人名称：合并 MOBS（config_mobs.ts）和 BOSSES（config_bosses.ts）
 * - 物品名称：由调用方通过 itemNameProvider 回调提供
 *
 * @module quest/objective_utils
 */

import type { QuestObjective } from './types';
import { MOBS } from '@/data/config_mobs';
import { BOSSES } from '@/data/config_bosses';

/**
 * 敌人ID → 名称映射表
 *
 * 模块加载时通过 IIFE 一次性构建，合并普通怪物和 Boss 数据源。
 * Boss 名称仅在 MOBS 中不存在同 ID 时才覆盖（保留普通怪优先）。
 */
const ENEMY_NAME_MAP: Map<string, string> = (() => {
  const map = new Map<string, string>();
  // 先加载普通怪物
  for (const mob of MOBS) {
    map.set(mob.id, mob.name);
  }
  // 再加载 Boss（不覆盖已存在的普通怪 ID）
  for (const boss of BOSSES) {
    if (!map.has(boss.id)) {
      map.set(boss.id, boss.name);
    }
  }
  return map;
})();

/**
 * 根据任务目标生成 UI 显示文本
 *
 * 根据 objective.type 自动选择文本模板：
 * - kill    → "消灭{敌人名称}"（从 ENEMY_NAME_MAP 查找）
 * - collect → "收集{物品名称}"（通过 itemNameProvider 查找，失败时回退到 itemId）
 * - 其他    → "未知目标: {objective.key}"（防御性回退，当前 kill/collect 涵盖所有情况）
 *
 * @param objective        - 任务目标对象
 * @param itemNameProvider - 可选回调，传入 itemId 返回物品中文名（收集类任务需要）
 * @returns 目标描述文本，如 "消灭剧毒蜘蛛"、"收集生命药水"
 */
export function getObjectiveText(
  objective: QuestObjective,
  itemNameProvider?: (itemId: string) => string | null
): string {
  // 击杀目标：从预构建的敌人名称映射中查找
  if (objective.type === 'kill' && objective.enemyId) {
    const name = ENEMY_NAME_MAP.get(objective.enemyId) || objective.enemyId;
    return `消灭${name}`;
  }

  // 收集目标：通过调用方提供的物品名称解析器查找
  if (objective.type === 'collect' && objective.itemId) {
    if (itemNameProvider) {
      const name = itemNameProvider(objective.itemId);
      if (name) return `收集${name}`;
    }
    // 无法解析名称时回退到原始 itemId
    return `收集${objective.itemId}`;
  }

  // 防御性回退：当目标类型不在已知范围内时（如未来扩展新类型）
  return `未知目标: ${objective.key}`;
}

/**
 * 获取敌人中文名称
 *
 * 从 ENEMY_NAME_MAP 中按 enemyId 查找。
 *
 * @param enemyId - 敌人ID（如 "spider"、"gnoll"）
 * @returns 敌人中文名称（如 "剧毒蜘蛛"、"豺狼人"），找不到时返回 enemyId 本身
 */
export function getEnemyName(enemyId: string): string {
  return ENEMY_NAME_MAP.get(enemyId) || enemyId;
}
