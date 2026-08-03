/**
 * @fileoverview 怪物 ID 别名映射层（P3-137 迁移基础设施）
 * @description
 *   旧怪物 ID → 新 ID 的映射表，用于兼容旧存档、旧备份与旧配置引用。
 *   在 enemy/store.createEnemy 与 GameBootstrap 的 Boss 创建回调入口处，
 *   通过 resolveEnemyId() 透明地将任意 ID 规范化为新 ID。
 *
 *   阶段 0：映射表为空，运行时行为零变化。
 *   阶段 1-3：逐步填充映射，实现旧 ID → 新 ID 的平滑迁移。
 *   阶段 4 后：保留至少一个版本周期，供旧备份导入使用。
 *
 * @module enemy/alias-map
 */

/**
 * 怪物 ID 别名映射表（旧 ID → 新 ID）
 *
 * 阶段 0 保持为空对象：resolveEnemyId 对任意 ID 原样返回，行为不变。
 * 后续阶段按 P3-137 升级计划逐步填充：
 *   - 阶段 1：冲突类（orc/undead/troll/dark_iron_dwarf）✅ 已填充
 *   - 阶段 2：歧义类（dragon/demon/spider/bandit/wolf/bear）✅ 已填充
 *   - 阶段 3：规范化类（其余全部 + 删除孤儿 gnoll_raider）✅ 已填充
 */
export const ENEMY_ID_ALIAS: Readonly<Record<string, string>> = {
  // 阶段 1：冲突类（与 RaceType 联合类型冲突，加 mob_ 前缀消除歧义）
  // 注意：troll 同时属阶段 2（名称匹配），此处一并完成
  'orc': 'mob_orc_grunt',
  'undead': 'mob_undead',
  'troll': 'mob_jungle_troll',
  'dark_iron_dwarf': 'mob_dark_iron_dwarf',

  // 阶段 2：歧义类（名称匹配 + 消除与 Boss 名称重复）
  // dragon（普通怪"幼龙"）消除与 Boss dragon_whelp（"幼龙"）名称重复
  // demon（Boss"深渊卫士"）旧 ID 名不副实，改为 boss_abyss_guard
  'spider': 'mob_poison_spider',
  'bandit': 'mob_shadow_bandit',
  'wolf': 'mob_gray_wolf',
  'bear': 'mob_brown_bear',
  'dragon': 'mob_young_dragon',
  'demon': 'boss_abyss_guard',

  // 阶段 3：规范化类（统一加 mob_/boss_ 前缀）
  // 普通怪物
  'gnoll': 'mob_gnoll',
  'kobold': 'mob_kobold',
  'murloc': 'mob_murloc',
  'skeleton': 'mob_skeleton',
  'ghoul': 'mob_ghoul',
  'iron_dwarf': 'mob_iron_dwarf',
  'elemental': 'mob_elemental',
  'nerubian': 'mob_nerubian',
  'vrykul': 'mob_vrykul',
  'boar': 'mob_boar',
  'centaur': 'mob_centaur',
  'harpy': 'mob_harpy',
  'naga': 'mob_naga',
  'ogre': 'mob_ogre',
  'quilboar': 'mob_quilboar',
  'scorpid': 'mob_scorpid',
  'silithid': 'mob_silithid',
  'tiger': 'mob_tiger',
  'imp': 'mob_imp',
  // Boss
  'dragon_whelp': 'boss_dragon_whelp',
  'frost_wyrm': 'boss_frost_wyrm',
  'undead_knight': 'boss_undead_knight',
  'lich': 'boss_lich',
  'frost_giant': 'boss_frost_giant',
};

/**
 * 将任意怪物 ID 规范化为新 ID
 *
 * 规则：
 * - 若 ID 存在于 ENEMY_ID_ALIAS，返回对应新 ID
 * - 否则原样返回（已是新 ID 或尚未迁移的 ID）
 *
 * @param id - 任意来源的怪物 ID（存档、配置、备份、运行时事件等）
 * @returns 规范化后的新 ID
 */
export function resolveEnemyId(id: string): string {
  return ENEMY_ID_ALIAS[id] ?? id;
}

/**
 * 判断是否为旧 ID（存在别名映射）
 *
 * 用于迁移判断与调试：当需要区分"原样保留的新 ID"与"经转换的旧 ID"时使用。
 *
 * @param id - 待判断的怪物 ID
 * @returns 是否为旧 ID（即存在于别名映射表中）
 */
export function isLegacyEnemyId(id: string): boolean {
  return id in ENEMY_ID_ALIAS;
}
