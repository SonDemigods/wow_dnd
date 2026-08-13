/**
 * @fileoverview 配置表默认数据映射
 * @description 将 config_*.ts 源文件中的静态常量映射到对应的 Dexie 表名，
 *              供"单表重置默认值"功能使用。
 *
 * 注意：config_skills 表的默认数据需要从 CLASS_ABILITIES + MONSTER_ABILITIES
 * 展平为 SkillTemplateStorage 格式，与 initializer.ts 的 initSkillTemplates 逻辑一致。
 * @module admin
 */

// 直接 import 静态常量
import { FACTIONS } from '@/data/config_factions';
import { RACES } from '@/data/config_races';
import { CLASSES } from '@/data/config_classes';
import { CONTINENTS } from '@/data/config_locations';
import { LOOT_ITEMS } from '@/data/config_items';
import { EQUIPMENT_ITEMS } from '@/data/config_equipment_items';
import { MOBS } from '@/data/config_mobs';
import { BOSSES } from '@/data/config_bosses';
import { QUESTS } from '@/data/config_quests';
import { CLASS_ABILITIES, MONSTER_ABILITIES } from '@/data/config_skills';
import { SHOPS } from '@/data/config_shops';
import { CLASS_EQUIPMENT } from '@/data/config_class_equipment';
import { CLASS_PASSIVES } from '@/data/config_class_passives';
import { CLASS_TALENT_TREES } from '@/data/config_class_talents';
import { SET_DEFINITIONS } from '@/data/config_set_definitions';

/** 技能默认数据：从 CLASS_ABILITIES + MONSTER_ABILITIES 展平 */
function buildDefaultSkills(): Record<string, unknown>[] {
  const allSkills: Record<string, unknown>[] = [];
  for (const entry of CLASS_ABILITIES) {
    for (const skill of entry.skills) {
      allSkills.push({
        ...skill,
        classRestriction: entry.class_id,
        usableBy: 'player',
      });
    }
  }
  for (const skill of MONSTER_ABILITIES) {
    allSkills.push({
      ...skill,
      classRestriction: null,
      usableBy: 'enemy',
    });
  }
  return allSkills;
}

/** 默认数据映射表：dbTable → 默认记录数组 */
export const DEFAULT_DATA_MAP: Record<string, () => Record<string, unknown>[]> = {
  config_factions: () => FACTIONS as unknown as Record<string, unknown>[],
  config_races: () => RACES as unknown as Record<string, unknown>[],
  config_classes: () => CLASSES as unknown as Record<string, unknown>[],
  config_locations: () => CONTINENTS as unknown as Record<string, unknown>[],
  config_items: () => LOOT_ITEMS as unknown as Record<string, unknown>[],
  config_equipment_items: () => EQUIPMENT_ITEMS as unknown as Record<string, unknown>[],
  config_mobs: () => MOBS as unknown as Record<string, unknown>[],
  config_bosses: () => BOSSES as unknown as Record<string, unknown>[],
  config_quests: () => QUESTS as unknown as Record<string, unknown>[],
  config_skills: buildDefaultSkills,
  config_shops: () => SHOPS as unknown as Record<string, unknown>[],
  config_class_equipment: () => CLASS_EQUIPMENT as unknown as Record<string, unknown>[],
  config_class_passives: () => CLASS_PASSIVES as unknown as Record<string, unknown>[],
  config_class_talents: () => CLASS_TALENT_TREES as unknown as Record<string, unknown>[],
  config_set_definitions: () => SET_DEFINITIONS as unknown as Record<string, unknown>[],
};
