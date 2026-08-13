/**
 * @fileoverview 数据导出工具
 * @description 提供 JSON / CSV 格式的数据导出功能，供 Admin 模块单表导出使用。
 * @module utils/exportData
 */
import { downloadBlob } from './fileDownload';
import type { TableColumn } from '@/components/admin/config-meta/columns';

/**
 * 导出数据为 JSON 文件
 *
 * @param data - 要导出的记录数组
 * @param filename - 文件名（不含扩展名）
 */
export function exportJSON(data: Record<string, unknown>[], filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
}

/**
 * 将值转换为 CSV 安全格式
 *
 * - 包含逗号、双引号、换行的值用双引号包裹
 * - 双引号转义为两个双引号
 */
function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * 导出数据为 CSV 文件
 *
 * @param data - 要导出的记录数组
 * @param columns - 列定义（决定导出的字段顺序和表头）
 * @param filename - 文件名（不含扩展名）
 */
export function exportCSV(
  data: Record<string, unknown>[],
  columns: TableColumn[],
  filename: string,
): void {
  const header = columns.map(c => csvEscape(c.label)).join(',');
  const rows = data.map(row =>
    columns.map(col => csvEscape(row[col.key])).join(','),
  );
  const csv = '\uFEFF' + [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  downloadBlob(blob, `${filename}.csv`);
}
