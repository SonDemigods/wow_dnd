/**
 * @fileoverview 数据完整性校验模块
 * @description 在开发环境下校验各 data 文件之间的引用完整性（如地点的 enemies/bosses ID 是否存在于 MOBS/BOSSES）。
 *              生产环境构建时校验逻辑会被 tree-shaking 移除，不会产生运行时副作用。
 * @module data/validate
 */

import { LOCATIONS } from './config_locations';
import { MOBS } from './config_mobs';
import { BOSSES } from './config_bosses';

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

// 开发环境自动执行校验（生产环境构建时 import.meta.env.DEV 为 false，整段会被 tree-shaking）
if (import.meta.env.DEV) {
  validateLocationData();
}
