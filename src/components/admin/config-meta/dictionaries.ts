/**
 * @fileoverview 配置表字典映射
 * @description 字典值 → 中文翻译映射表，供列定义和表单字段共用。
 * @module admin/config-meta
 */

/** 单元格值类型（对齐 AdminTable.vue 中的 CellValue） */
export type CellValue = string | number | boolean | null | unknown[];

/** 阵营名称 */
export const FACTION_NAMES: Record<string, string> = {
  alliance: '光辉盟约', horde: '铁血盟约', neutral: '中立',
};

/** 属性名称 */
export const STAT_NAMES: Record<string, string> = {
  str: '力量', dex: '敏捷', con: '体质', int: '智力', wis: '感知', cha: '魅力',
};

/** 稀有度名称（与 src/config/inventory.ts 的 RARITY_CONFIG 保持一致） */
export const RARITY_NAMES: Record<string, string> = {
  common: '普通', uncommon: '优秀', rare: '稀有', epic: '史诗', legendary: '传说',
};

/** 物品类型名称 */
export const ITEM_TYPE_NAMES: Record<string, string> = {
  potion: '药水', scroll: '卷轴', food: '食物', material: '材料', quest: '任务物品', misc: '杂项',
};

/** 装备类型名称 */
export const EQUIP_TYPE_NAMES: Record<string, string> = {
  weapon: '武器', armor: '护甲',
};

/** 地点类型名称 */
export const LOCATION_TYPE_NAMES: Record<string, string> = {
  location: '地点', continent: '大陆',
};

/** 任务类型名称 */
export const QUEST_TYPE_NAMES: Record<string, string> = {
  kill: '击杀', collect: '收集',
};

/** 技能类型名称 */
export const SKILL_TYPE_NAMES: Record<string, string> = {
  physical_damage: '物理伤害', magic_damage: '魔法伤害', health_restore: '生命恢复', mana_restore: '法力恢复',
  buff: '增益', debuff: '减益',
};

/** 商店类型名称 */
export const SHOP_TYPE_NAMES: Record<string, string> = {
  general: '杂货', potion: '药水', scroll: '卷轴', food: '食品', material: '材料',
};

/** 获取字典翻译，若未匹配则原样返回 */
export function t(map: Record<string, string>, val: CellValue): string {
  if (val === null || val === undefined) return '-';
  return map[String(val)] ?? String(val);
}
