/**
 * @fileoverview 数据完整性校验模块
 * @description 在开发环境下校验各 data 文件之间的引用完整性（如地点的 enemies/bosses ID、
 *              任务目标的 enemyId/itemId、套装 ID 唯一性等）。
 *              生产环境构建时校验逻辑会被 tree-shaking 移除，不会产生运行时副作用。
 * @module data/validate
 */

import { LOCATIONS } from './config_locations';
import { MOBS } from './config_mobs';
import { BOSSES } from './config_bosses';
import { QUESTS } from './config_quests';
import { LOOT_ITEMS } from './config_items';
import { ITEM_SETS } from './config_item_sets';

/**
 * 校验所有地点的 enemies/bosses ID 是否存在于 MOBS/BOSSES 数据集
 *
 * 校验规则：
 * - LOCATIONS 中每个地点的 `enemies` 数组中的 ID 必须存在于 MOBS
 * - LOCATIONS 中每个地点的 `bosses` 数组中的 ID 必须存在于 BOSSES
 *
 * 校验结果通过 console 输出，仅在开发环境（import.meta.env.DEV）执行。
 *
 * @returns 校验通过的地点数量；若存在无效引用，会在控制台输出错误日志
 */
export function validateLocationData(): number {
  const mobIds = new Set(MOBS.map(m => m.id));
  const bossIds = new Set(BOSSES.map(b => b.id));

  const errors: string[] = [];
  let validLocationCount = 0;

  for (const loc of LOCATIONS) {
    let locValid = true;

    // 校验 enemies 引用
    if (loc.enemies) {
      for (const enemyId of loc.enemies) {
        if (!mobIds.has(enemyId)) {
          errors.push(`地点 ${loc.id} (${loc.name}) 的 enemy ID "${enemyId}" 不存在于 MOBS`);
          locValid = false;
        }
      }
    }

    // 校验 bosses 引用
    if (loc.bosses) {
      for (const bossId of loc.bosses) {
        if (!bossIds.has(bossId)) {
          errors.push(`地点 ${loc.id} (${loc.name}) 的 boss ID "${bossId}" 不存在于 BOSSES`);
          locValid = false;
        }
      }
    }

    if (locValid) validLocationCount++;
  }

  if (errors.length > 0) {
    console.error(`[数据校验] 地点数据存在 ${errors.length} 处无效引用:`);
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log(`[数据校验] 地点数据校验通过：${validLocationCount}/${LOCATIONS.length} 个地点的 enemies/bosses ID 均有效`);
  }

  return validLocationCount;
}

/**
 * 校验任务目标的引用完整性
 *
 * P3-2：扩展校验范围，覆盖任务 objectives 的 enemyId（kill 类型）和 itemId（collect 类型）。
 * 防止任务引用不存在的敌人/物品导致任务永远无法完成（如 P3-5 的 goblin 引用问题）。
 *
 * @returns 校验通过的任务数量；若存在无效引用，会在控制台输出错误日志
 */
export function validateQuestData(): number {
  const mobIds = new Set(MOBS.map(m => m.id));
  const itemIds = new Set(LOOT_ITEMS.map(i => i.id));

  const errors: string[] = [];
  let validQuestCount = 0;

  for (const quest of QUESTS) {
    let questValid = true;
    for (const obj of quest.objectives) {
      if (obj.type === 'kill' && obj.enemyId && !mobIds.has(obj.enemyId)) {
        errors.push(`任务 ${quest.id} (${quest.title}) 的 objective "${obj.key}" 引用了不存在的 enemyId "${obj.enemyId}"`);
        questValid = false;
      }
      if (obj.type === 'collect' && obj.itemId && !itemIds.has(obj.itemId)) {
        errors.push(`任务 ${quest.id} (${quest.title}) 的 objective "${obj.key}" 引用了不存在的 itemId "${obj.itemId}"`);
        questValid = false;
      }
    }
    if (questValid) validQuestCount++;
  }

  if (errors.length > 0) {
    console.error(`[数据校验] 任务数据存在 ${errors.length} 处无效引用:`);
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log(`[数据校验] 任务数据校验通过：${validQuestCount}/${QUESTS.length} 个任务的 objectives 引用均有效`);
  }

  return validQuestCount;
}

/**
 * 校验套装定义的 ID 唯一性
 *
 * P3-2：防止套装 ID 重复定义导致 getActiveSetBonuses 计算错误。
 *
 * @returns 校验通过的套装数量；若存在重复 ID，会在控制台输出错误日志
 */
export function validateItemSets(): number {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  let duplicateCount = 0;

  for (const set of ITEM_SETS) {
    if (seenIds.has(set.id)) {
      errors.push(`套装 ID "${set.id}" 重复定义`);
      duplicateCount++;
    }
    seenIds.add(set.id);
  }

  if (errors.length > 0) {
    console.error(`[数据校验] 套装数据存在 ${errors.length} 处问题:`);
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log(`[数据校验] 套装数据校验通过：${ITEM_SETS.length} 个套装 ID 均唯一`);
  }

  return ITEM_SETS.length - duplicateCount;
}

// 开发环境自动执行校验（生产环境构建时 import.meta.env.DEV 为 false，整段会被 tree-shaking）
if (import.meta.env.DEV) {
  validateLocationData();
  validateQuestData();
  validateItemSets();
}
