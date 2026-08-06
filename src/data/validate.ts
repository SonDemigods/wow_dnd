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
import { SET_DEFINITIONS } from './config_set_definitions';
import { CLASS_EQUIPMENT } from './config_class_equipment';
import { CLASS_ABILITIES } from './config_skills';
import { CLASS_TALENT_TREES } from './config_class_talents';
import type { EffectType } from '@/modules/combat/effects';

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
 * P3-2：防止套装 ID 重复定义导致 setService.getAllSetProgresses 计算错误。
 *
 * @returns 校验通过的套装数量；若存在重复 ID，会在控制台输出错误日志
 */
export function validateItemSets(): number {
  const errors: string[] = [];
  const seenIds = new Set<string>();
  let duplicateCount = 0;

  for (const set of SET_DEFINITIONS) {
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
    console.log(`[数据校验] 套装数据校验通过：${SET_DEFINITIONS.length} 个套装 ID 均唯一`);
  }

  return SET_DEFINITIONS.length - duplicateCount;
}

/**
 * 校验 Boss 阶段配置的 hpThreshold 降序排列
 *
 * P2-81：Boss 的 phases 数组中 hpThreshold 必须严格降序（如 0.5 → 0.25 → 0），
 * 否则阶段切换逻辑可能跳过中间阶段或反复触发。此校验确保数据在开发期被发现。
 *
 * @returns 校验通过的 Boss 数量；若存在降序问题，会在控制台输出错误日志
 */
export function validateBossPhasesOrder(): number {
  const errors: string[] = [];
  let validCount = 0;

  for (const boss of BOSSES) {
    if (!boss.phases || boss.phases.length === 0) {
      validCount++;
      continue;
    }
    let prevThreshold = Infinity;
    let bossValid = true;
    for (let i = 0; i < boss.phases.length; i++) {
      const phase = boss.phases[i];
      if (phase.hpThreshold > prevThreshold) {
        errors.push(`Boss ${boss.id} (${boss.name}) 的 phases[${i}].hpThreshold=${phase.hpThreshold} 未降序（前一个为 ${prevThreshold}）`);
        bossValid = false;
      }
      prevThreshold = phase.hpThreshold;
    }
    if (bossValid) validCount++;
  }

  if (errors.length > 0) {
    console.error(`[数据校验] Boss 阶段数据存在 ${errors.length} 处降序问题:`);
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log(`[数据校验] Boss 阶段数据校验通过：${validCount}/${BOSSES.length} 个 Boss 的 phases hpThreshold 均降序`);
  }

  return validCount;
}

/**
 * 校验装备的 setId 引用是否存在于 SET_DEFINITIONS 定义
 *
 * P2-79：装备的 setId 必须能在 SET_DEFINITIONS 中找到对应套装，
 * 否则 setService.getAllSetProgresses 计算时会被静默忽略，玩家穿戴后无法激活套装奖励。
 *
 * 校验范围：CLASS_EQUIPMENT 中所有带 setId 的装备。
 *
 * @returns 校验通过的装备数量；若存在无效引用，会在控制台输出错误日志
 */
export function validateItemSetReferences(): number {
  const setIds = new Set(SET_DEFINITIONS.map(s => s.id));
  const errors: string[] = [];
  let validCount = 0;

  for (const item of CLASS_EQUIPMENT) {
    if (item.setId && !setIds.has(item.setId)) {
      errors.push(`装备 ${item.id} (${item.name}) 的 setId "${item.setId}" 不存在于 SET_DEFINITIONS`);
    } else {
      validCount++;
    }
  }

  if (errors.length > 0) {
    console.error(`[数据校验] 装备 setId 引用存在 ${errors.length} 处无效:`);
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log(`[数据校验] 装备 setId 引用校验通过：${validCount}/${CLASS_EQUIPMENT.length} 件装备的 setId 均有效`);
  }

  return validCount;
}

/**
 * 校验技能 buffs 的 type 字段是否为合法的 EffectType
 *
 * P2-79：技能 buffs 数组中每个元素的 type 必须是 EffectType 联合类型的一员，
 * 否则 effectRegistry.get(type) 会返回 undefined，导致 onApply 回调不执行，
 * 玩家施放的 buff/debuff 技能静默失效。
 *
 * 校验范围：CLASS_ABILITIES 中所有技能的 buffs 字段。
 *
 * @returns 校验通过的技能数量；若存在无效 type，会在控制台输出错误日志
 */
export function validateSkillBuffs(): number {
  const validEffectTypes: ReadonlySet<EffectType> = new Set<EffectType>([
    'poison', 'burn', 'stun', 'freeze', 'silence', 'shield',
    'attack_up', 'attack_down', 'defense_up', 'defense_down',
    'speed_up', 'speed_down', 'regen', 'vulnerable',
  ]);

  const errors: string[] = [];
  let validCount = 0;

  for (const group of CLASS_ABILITIES) {
    for (const skill of group.skills) {
      let skillValid = true;
      if (skill.buffs && skill.buffs.length > 0) {
        for (let i = 0; i < skill.buffs.length; i++) {
          const buff = skill.buffs[i];
          if (!validEffectTypes.has(buff.type)) {
            errors.push(`技能 ${skill.id} (${skill.name}) 的 buffs[${i}].type="${buff.type}" 不在 EffectType 联合中`);
            skillValid = false;
          }
        }
      }
      if (skillValid) validCount++;
    }
  }

  const totalSkills = CLASS_ABILITIES.reduce((sum, g) => sum + g.skills.length, 0);

  if (errors.length > 0) {
    console.error(`[数据校验] 技能 buffs type 存在 ${errors.length} 处无效:`);
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log(`[数据校验] 技能 buffs type 校验通过：${validCount}/${totalSkills} 个技能的 buffs type 均合法`);
  }

  return validCount;
}

/**
 * 校验天赋数据的结构完整性与效果合规性
 *
 * 校验范围：
 * 1. 每个职业恰好 1 棵树、18 节点（6 行 × 3 列）
 * 2. tier(1-6) 与 col(1-3) 范围合法
 * 3. requires 引用的天赋 ID 必须存在
 * 4. 效果字段完整性（stat_bonus 需 stat/value、resource_bonus 需 stat/value、skill_enhance 需 targetSkill/value 等）
 * 5. 禁用效果类型（crit_bonus / hp_multiplier / special / mana_max）数量必须为 0（效果合规约束）
 *
 * @returns 校验通过的树数量；若存在问题，会在控制台输出错误日志
 */
export function validateTalentData(): number {
  const errors: string[] = [];
  const validEffectTypes: ReadonlySet<string> = new Set([
    'stat_bonus', 'damage_multiplier', 'damage_reduction',
    'healing_multiplier', 'resource_bonus', 'skill_enhance', 'unlock_pet',
  ]);
  // 禁用效果类型（违反 2.1 合规约束）：crit_bonus / hp_multiplier / special
  const bannedEffectTypes: ReadonlySet<string> = new Set(['crit_bonus', 'hp_multiplier', 'special']);
  let validCount = 0;

  for (const tree of CLASS_TALENT_TREES) {
    let treeValid = true;
    const talentIds = new Set(tree.talents.map(t => t.id));

    // 1. 节点数量：18 个
    if (tree.talents.length !== 18) {
      errors.push(`树 ${tree.id} (${tree.name}) 节点数为 ${tree.talents.length}，应为 18`);
      treeValid = false;
    }

    for (const talent of tree.talents) {
      // 2. tier/col 范围
      if (![1, 2, 3, 4, 5, 6].includes(talent.tier)) {
        errors.push(`天赋 ${talent.id} tier=${talent.tier} 非法（应为 1-6）`);
        treeValid = false;
      }
      if (talent.col !== undefined && ![1, 2, 3].includes(talent.col)) {
        errors.push(`天赋 ${talent.id} col=${talent.col} 非法（应为 1-3）`);
        treeValid = false;
      }

      // 3. requires 引用有效性
      if (talent.requires) {
        for (const reqId of talent.requires) {
          if (!talentIds.has(reqId)) {
            errors.push(`天赋 ${talent.id} 的 requires 引用了不存在的天赋 ${reqId}`);
            treeValid = false;
          }
        }
      }

      // 4. 效果字段完整性
      for (const effect of talent.effects) {
        const et = effect.type as string;
        if (!validEffectTypes.has(et)) {
          if (bannedEffectTypes.has(et)) {
            errors.push(`天赋 ${talent.id} 使用禁用效果类型 ${et}（违反合规约束）`);
          } else {
            errors.push(`天赋 ${talent.id} 使用未知效果类型 ${et}`);
          }
          treeValid = false;
          continue;
        }
        // stat_bonus / resource_bonus：需 stat 字段
        if ((et === 'stat_bonus' || et === 'resource_bonus') && !('stat' in effect)) {
          errors.push(`天赋 ${talent.id} 的 ${et} 效果缺少 stat 字段`);
          treeValid = false;
        }
        // skill_enhance：需 targetSkill 字段
        if (et === 'skill_enhance' && !('targetSkill' in effect)) {
          errors.push(`天赋 ${talent.id} 的 skill_enhance 效果缺少 targetSkill 字段`);
          treeValid = false;
        }
      }
    }

    if (treeValid) validCount++;
  }

  if (errors.length > 0) {
    console.error(`[数据校验] 天赋数据存在 ${errors.length} 处问题:`);
    errors.forEach(e => console.error(`  - ${e}`));
  } else {
    console.log(`[数据校验] 天赋数据校验通过：${validCount}/${CLASS_TALENT_TREES.length} 棵树结构完整且效果合规`);
  }

  return validCount;
}

// 开发环境自动执行校验（生产环境构建时 import.meta.env.DEV 为 false，整段会被 tree-shaking）
if (import.meta.env.DEV) {
  validateLocationData();
  validateQuestData();
  validateItemSets();
  validateBossPhasesOrder();
  validateItemSetReferences();
  validateSkillBuffs();
  validateTalentData();
}
