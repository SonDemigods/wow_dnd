/**
 * @fileoverview 各配置表的列定义
 * @description 定义 15 张配置表在 AdminTable 中展示的列。
 * @module admin/config-meta
 */
import type { ConfigTableName } from '@/modules/admin';
import type { CellValue } from './dictionaries';

/** 列定义（对齐 AdminTable.vue 中的 TableColumn） */
export interface TableColumn {
  key: string;
  label: string;
  width?: string;
  format?: (value: CellValue, row: Record<string, unknown>) => string;
}

/** 各配置表的列定义 */
export const tableColumns: Record<ConfigTableName, TableColumn[]> = {
  factions: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'icon', label: '图标' },
    { key: 'color', label: '颜色', format: (v) => v == null ? '' : String(v) },
  ],
  races: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'icon', label: '图标' },
    { key: 'factionId', label: '阵营' },
  ],
  classes: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'icon', label: '图标' },
    { key: 'primaryStat', label: '主属性' },
    { key: 'color', label: '颜色' },
  ],
  items: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'subtype', label: '子类型' },
    { key: 'rarity', label: '稀有度' },
    { key: 'value', label: '价值' },
  ],
  equipmentItems: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'type', label: '类型' },
    { key: 'rarity', label: '稀有度' },
    { key: 'value', label: '价值' },
  ],
  mobs: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'dangerLevel', label: '危险等级' },
    { key: 'maxHp', label: '生命值' },
    { key: 'damage', label: '伤害范围' },
    { key: 'xp', label: '经验值' },
  ],
  bosses: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'dangerLevel', label: '危险等级' },
    { key: 'maxHp', label: '生命值' },
    { key: 'damage', label: '伤害范围' },
    { key: 'xp', label: '经验值' },
  ],
  quests: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'title', label: '标题' },
    { key: 'type', label: '类型' },
    { key: 'levelRequirement', label: '等级需求' },
    { key: 'xpReward', label: '经验奖励' },
  ],
  skills: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'type', label: '类型' },
    { key: 'mpCost', label: '法力消耗' },
    { key: 'unlockLevel', label: '解锁等级' },
    { key: 'classRestriction', label: '职业限制' },
  ],
  locations: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'type', label: '类型' },
    { key: 'continent', label: '大陆' },
    { key: 'levelRange', label: '等级范围' },
  ],
  shops: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'type', label: '类型' },
    { key: 'refreshInterval', label: '刷新间隔' },
  ],
  // -------- DATA-4 职业扩展系统 --------
  classEquipment: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'type', label: '类型' },
    { key: 'rarity', label: '稀有度' },
    { key: 'value', label: '价值' },
    { key: 'classRestriction', label: '职业限制' },
    { key: 'setId', label: '所属套装' },
  ],
  classPassives: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'classId', label: '职业' },
    { key: 'trigger', label: '触发时机' },
    { key: 'icon', label: '图标' },
  ],
  classTalents: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'classId', label: '职业' },
    { key: 'icon', label: '图标' },
  ],
  setDefinitions: [
    { key: 'id', label: 'ID', width: '180px' },
    { key: 'name', label: '名称' },
    { key: 'category', label: '分类' },
    { key: 'classRestriction', label: '职业限制' },
    { key: 'parts', label: '部件数' },
  ],
};
