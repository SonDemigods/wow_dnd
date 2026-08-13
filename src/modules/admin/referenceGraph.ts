/**
 * @fileoverview 配置表间引用关系图
 * @description 定义哪些配置表的记录被其他表引用，删除前检查关联完整性。
 * @module admin
 */
import { adminDbService } from './db';

/** 引用关系：被引用表 → 引用方列表 */
const REFERENCE_GRAPH: Record<string, Array<{ table: string; field: string }>> = {
  config_factions: [
    { table: 'config_races', field: 'factionId' },
    { table: 'config_classes', field: 'factionsIds' },
  ],
  config_races: [
    { table: 'config_classes', field: 'raceIds' },
  ],
  config_classes: [
    { table: 'config_skills', field: 'classRestriction' },
    { table: 'config_class_equipment', field: 'classRestriction' },
    { table: 'config_class_passives', field: 'classId' },
    { table: 'config_class_talents', field: 'classId' },
    { table: 'config_set_definitions', field: 'classRestriction' },
  ],
  config_locations: [
    { table: 'config_quests', field: 'boardId' },
  ],
  config_set_definitions: [
    { table: 'config_class_equipment', field: 'setId' },
  ],
};

/** 引用检查结果 */
export interface ReferenceCheckResult {
  /** 是否存在引用 */
  hasReferences: boolean;
  /** 引用详情 */
  details: Array<{ table: string; field: string; count: number }>;
}

/**
 * 检查指定表的某条记录是否被其他表引用
 *
 * @param tableName - 被删除记录所属的表名
 * @param recordId - 被删除记录的 ID
 * @returns 引用检查结果
 */
export async function checkReferences(
  tableName: string,
  recordId: string,
): Promise<ReferenceCheckResult> {
  const refs = REFERENCE_GRAPH[tableName];
  if (!refs || refs.length === 0) {
    return { hasReferences: false, details: [] };
  }

  const details: Array<{ table: string; field: string; count: number }> = [];

  for (const ref of refs) {
    try {
      const allRecords = await adminDbService.getAll<Record<string, unknown>>(ref.table as never);
      const matching = allRecords.filter(r => {
        const val = r[ref.field];
        // 字段值可能是 string 或 string[]
        if (Array.isArray(val)) {
          return val.includes(recordId);
        }
        return val === recordId;
      });
      if (matching.length > 0) {
        details.push({ table: ref.table, field: ref.field, count: matching.length });
      }
    } catch {
      // 表不存在或查询失败时跳过
    }
  }

  return {
    hasReferences: details.length > 0,
    details,
  };
}

/** 获取表的中文名称 */
const TABLE_LABELS: Record<string, string> = {
  config_races: '种族',
  config_classes: '职业',
  config_skills: '技能',
  config_class_equipment: '职业专属装备',
  config_class_passives: '职业被动',
  config_class_talents: '职业天赋',
  config_set_definitions: '套装定义',
  config_quests: '任务',
};

/**
 * 格式化引用检查结果为可读文本
 */
export function formatReferenceWarning(result: ReferenceCheckResult): string {
  if (!result.hasReferences) return '';
  const parts = result.details.map(d => `${TABLE_LABELS[d.table] || d.table}(${d.count}条)`);
  return `该记录被以下表引用：${parts.join('、')}。删除后这些引用将失效。`;
}
