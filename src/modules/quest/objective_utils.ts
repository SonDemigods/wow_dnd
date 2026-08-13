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
 * - 敌人名称：由 initEnemyNameMap() 从 IndexedDB（config_mobs + config_bosses）异步加载
 * - 物品名称：由调用方通过 itemNameProvider 回调提供
 *
 * @module quest/objective_utils
 */

import type { QuestObjective } from './types';
import { db } from '@/modules/data';

/**
 * 敌人ID → 名称映射表
 *
 * 由 initEnemyNameMap() 从 IndexedDB 异步加载后填充。
 * 加载完成前为空 Map，getEnemyName/getObjectiveText 降级返回 enemyId 本身。
 */
const ENEMY_NAME_MAP: Map<string, string> = new Map();

/**
 * 从 DB 加载敌人名称到映射表
 *
 * 合并 config_mobs 和 config_bosses 表，Boss 名称仅在 mobs 中不存在同 ID 时才覆盖。
 * 应在 GameBootstrap.initialize 中调用，确保 UI 渲染前映射表已就绪。
 */
export async function initEnemyNameMap(): Promise<void> {
  const [mobs, bosses] = await Promise.all([
    db.config_mobs.toArray(),
    db.config_bosses.toArray(),
  ]);
  ENEMY_NAME_MAP.clear();
  for (const mob of mobs) {
    ENEMY_NAME_MAP.set(mob.id, mob.name);
  }
  for (const boss of bosses) {
    if (!ENEMY_NAME_MAP.has(boss.id)) {
      ENEMY_NAME_MAP.set(boss.id, boss.name);
    }
  }
}

/**
 * 根据任务目标生成 UI 显示文本
 *
 * 根据 objective.type 自动选择文本模板：
 * - kill    → "消灭{敌人名称}"（从 ENEMY_NAME_MAP 查找）
 * - collect → "收集{物品名称}"（通过 itemNameProvider 查找，失败时回退到 itemId）
 * - explore → "探索{N}格区域"（N=target）；有 locationId 时 → "探索{locationId}区域"
 * - 其他    → "未知目标: {objective.key}"（防御性回退）
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

  // 探索目标：有 locationId 时显示区域名，否则显示需探索的格数
  if (objective.type === 'explore') {
    if (objective.locationId) {
      return `探索${objective.locationId}区域`;
    }
    return `探索${objective.target}格区域`;
  }

  // 防御性回退：当目标类型不在已知范围内时（如未来扩展新类型）
  return `未知目标: ${objective.key}`;
}

/**
 * 获取敌人中文名称
 *
 * 从 ENEMY_NAME_MAP 中按 enemyId 查找。
 *
 * @param enemyId - 敌人ID（如 "mob_poison_spider"、"mob_gnoll"）
 * @returns 敌人中文名称（如 "剧毒蜘蛛"、"豺狼人"），找不到时返回 enemyId 本身
 */
export function getEnemyName(enemyId: string): string {
  return ENEMY_NAME_MAP.get(enemyId) || enemyId;
}
