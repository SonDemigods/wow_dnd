/**
 * @fileoverview ConfigManager 表格元信息 composable
 *
 * 负责按当前选中的配置表类型分发：
 * - currentDbTable：当前表对应的 Dexie 表名
 * - currentColumns：当前表的列定义（注入字典翻译）
 * - currentFormFields：当前表的表单字段定义（注入下拉选项）
 *
 * 列定义、表单字段定义、字典映射已拆分到 config-meta/ 目录下独立文件。
 * 本文件仅保留调度逻辑：根据 store 状态动态注入翻译 format 和下拉选项。
 */
import { computed, type ComputedRef } from 'vue';
import { storeToRefs } from 'pinia';
import { useAdminStore } from '@/modules/admin';
import { CONFIG_TABLES, type ConfigTableName } from '@/modules/admin';
import type { AdminRecord } from '@/modules/admin';
import type { FormField } from '@/components/admin/fields/types';
import { tableColumns, type TableColumn } from '@/components/admin/config-meta/columns';
import { formFieldsMap } from '@/components/admin/config-meta/formFields';
import {
  FACTION_NAMES, STAT_NAMES, RARITY_NAMES,
  ITEM_TYPE_NAMES, EQUIP_TYPE_NAMES, LOCATION_TYPE_NAMES,
  QUEST_TYPE_NAMES, SKILL_TYPE_NAMES, SHOP_TYPE_NAMES,
  t, type CellValue,
} from '@/components/admin/config-meta/dictionaries';

// Re-export types for backward compatibility
export type { CellValue, TableColumn, FormField };
export type { AdminRecord };

/** useConfigTableMeta 返回值结构 */
export interface UseConfigTableMetaReturn {
  /** 当前表名 */
  currentTable: ComputedRef<ConfigTableName>;
  /** 当前表对应的 Dexie 表名 */
  currentDbTable: ComputedRef<string>;
  /** 当前列定义（注入字典翻译） */
  currentColumns: ComputedRef<TableColumn[]>;
  /** 当前表单字段（注入下拉选项） */
  currentFormFields: ComputedRef<FormField[]>;
}

/**
 * ConfigManager 表格元信息 composable
 *
 * 按 store.selectedConfigTable 动态分发当前表的列定义与表单字段定义。
 * 内部根据 store 的参考数据（factionOptions/raceOptions 等）为字段注入下拉选项。
 *
 * @returns 包含 currentTable / currentDbTable / currentColumns / currentFormFields 的计算属性
 */
export function useConfigTableMeta(): UseConfigTableMetaReturn {
  const store = useAdminStore();

  // 参考数据缓存 —— 供下拉选择使用
  const {
    referenceFactions: factionOptions,
    referenceRaces: raceOptions,
    referenceClasses: classOptions,
    referenceLocations: locationOptions,
    referenceContinents: continentOptions,
  } = storeToRefs(store);

  /** 当前表名 */
  const currentTable = computed<ConfigTableName>(() => store.selectedConfigTable);

  /** 当前表对应的 Dexie 表名 */
  const currentDbTable = computed(() => {
    const meta = CONFIG_TABLES.find(item => item.key === currentTable.value);
    return meta?.dbTable || '';
  });

  /** 当前列定义（注入字典翻译） */
  const currentColumns = computed<TableColumn[]>(() => {
    return (tableColumns[currentTable.value] || []).map(col => {
      // factionId → 中文阵营名
      if (col.key === 'factionId' && factionOptions.value.length > 0) {
        return { ...col, format: (v: CellValue) => t(FACTION_NAMES, v) };
      }
      // 种族/职业 ID → 中文名（从数据库加载的映射）
      if (col.key === 'raceId' && raceOptions.value.length > 0) {
        const map = Object.fromEntries(raceOptions.value.map(o => [o.value, o.label]));
        return { ...col, format: (v: CellValue) => map[String(v)] ?? String(v ?? '-') };
      }
      if (col.key === 'classId' && classOptions.value.length > 0) {
        const map = Object.fromEntries(classOptions.value.map(o => [o.value, o.label]));
        return { ...col, format: (v: CellValue) => map[String(v)] ?? String(v ?? '-') };
      }
      // 字典字段翻译
      if (col.key === 'primaryStat') return { ...col, format: (v: CellValue) => t(STAT_NAMES, v) };
      if (col.key === 'rarity') return { ...col, format: (v: CellValue) => t(RARITY_NAMES, v) };
      if (col.key === 'dangerLevel') return { ...col, format: (v: CellValue) => String(v ?? '-') };
      // P12-036 修复：短数组（length < 2）时用现有值或 '-'，避免渲染 "undefined"
      if (col.key === 'damage') return { ...col, format: (v: CellValue) => Array.isArray(v) && v.length >= 2 ? `${v[0]} ~ ${v[1]}` : (Array.isArray(v) && v.length === 1 ? String(v[0]) : String(v ?? '-')) };
      if (col.key === 'levelRange') return { ...col, format: (v: CellValue) => Array.isArray(v) && v.length >= 2 ? `${v[0]} ~ ${v[1]}` : (Array.isArray(v) && v.length === 1 ? String(v[0]) : String(v ?? '-')) };
      if (col.key === 'classRestriction') {
        if (classOptions.value.length > 0) {
          const map = Object.fromEntries(classOptions.value.map(o => [o.value, o.label]));
          return { ...col, format: (v: CellValue) => v ? (map[String(v)] ?? String(v)) : '无限制' };
        }
        return { ...col, format: (v: CellValue) => v ? String(v) : '无限制' };
      }
      if (col.key === 'continent') {
        if (continentOptions.value.length > 0) {
          const map = Object.fromEntries(continentOptions.value.map(o => [o.value, o.label]));
          return { ...col, format: (v: CellValue) => map[String(v)] ?? String(v ?? '-') };
        }
        return { ...col, format: (v: CellValue) => String(v ?? '-') };
      }
      // subtype 字段翻译（items 表用 subtype 而非 type）
      if (col.key === 'subtype') {
        return { ...col, format: (v: CellValue) => t(ITEM_TYPE_NAMES, v) };
      }
      // type 字段按表名区分翻译
      if (col.key === 'type') {
        const tn = currentTable.value;
        if (tn === 'equipmentItems') return { ...col, format: (v: CellValue) => t(EQUIP_TYPE_NAMES, v) };
        if (tn === 'locations') return { ...col, format: (v: CellValue) => t(LOCATION_TYPE_NAMES, v) };
        if (tn === 'quests') return { ...col, format: (v: CellValue) => t(QUEST_TYPE_NAMES, v) };
        if (tn === 'skills') return { ...col, format: (v: CellValue) => t(SKILL_TYPE_NAMES, v) };
        if (tn === 'shops') return { ...col, format: (v: CellValue) => t(SHOP_TYPE_NAMES, v) };
      }
      return col;
    });
  });

  /** 当前表单字段（注入下拉选项的最终版本） */
  const currentFormFields = computed<FormField[]>(() => {
    const baseFields = formFieldsMap[currentTable.value] || [];
    return baseFields.map(field => {
      // 为阵营、种族、职业等关联字段注入下拉选项
      if (field.key === 'factionId' && factionOptions.value.length > 0) {
        return { ...field, type: 'select' as const, options: factionOptions.value };
      }
      if (field.key === 'factionsIds' && factionOptions.value.length > 0) {
        return { ...field, type: 'multiselect' as const, options: factionOptions.value };
      }
      if (field.key === 'raceId' && raceOptions.value.length > 0) {
        return { ...field, type: 'select' as const, options: raceOptions.value };
      }
      if (field.key === 'raceIds' && raceOptions.value.length > 0) {
        return { ...field, type: 'multiselect' as const, options: raceOptions.value };
      }
      if (field.key === 'classId' && classOptions.value.length > 0) {
        return { ...field, type: 'select' as const, options: classOptions.value };
      }
      if (field.key === 'slots') {
        return {
          ...field,
          type: 'multiselect' as const,
          options: [
            { value: 'weapon1', label: '主手 (weapon1)' },
            { value: 'weapon2', label: '副手 (weapon2)' },
            { value: 'helm', label: '头部 (helm)' },
            { value: 'chest', label: '胸部 (chest)' },
            { value: 'gloves', label: '手套 (gloves)' },
            { value: 'legs', label: '腿部 (legs)' },
            { value: 'boots', label: '鞋子 (boots)' },
          ],
        };
      }
      if (field.key === 'classRestriction' && classOptions.value.length > 0) {
        // P12-030 修复：保留 multiselect 类型不被降级为 select
        if (field.type === 'multiselect') {
          return {
            ...field,
            type: 'multiselect' as const,
            options: classOptions.value,
          };
        }
        return {
          ...field,
          type: 'select' as const,
          options: [{ value: '', label: '无限制' }, ...classOptions.value],
        };
      }
      if (field.key === 'boardId' && locationOptions.value.length > 0) {
        return {
          ...field,
          type: 'select' as const,
          options: locationOptions.value,
        };
      }
      if (field.key === 'continent' && continentOptions.value.length > 0) {
        return {
          ...field,
          type: 'select' as const,
          options: continentOptions.value,
        };
      }
      // 稀有度下拉
      if (field.key === 'rarity') {
        return {
          ...field,
          type: 'select' as const,
          options: [
            { value: 'common', label: '普通 (common)' },
            { value: 'uncommon', label: '优秀 (uncommon)' },
            { value: 'rare', label: '稀有 (rare)' },
            { value: 'epic', label: '史诗 (epic)' },
            { value: 'legendary', label: '传说 (legendary)' },
          ],
        };
      }
      // 敌人危险等级下拉（对齐 DB 实际值）
      if (field.key === 'dangerLevel') {
        return {
          ...field,
          type: 'select' as const,
          options: [
            { value: '普通', label: '普通' },
            { value: '困难', label: '困难' },
            { value: '危险', label: '危险' },
            { value: '极危险', label: '极危险' },
            { value: '致命', label: '致命' },
          ],
        };
      }
      return field;
    });
  });

  return {
    currentTable,
    currentDbTable,
    currentColumns,
    currentFormFields,
  };
}
