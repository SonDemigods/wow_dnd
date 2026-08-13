/**
 * @fileoverview 数据导入工具
 * @description 提供 JSON / CSV 格式的数据解析功能，供 Admin 模块批量导入使用。
 * @module utils/importData
 */

/** 导入结果 */
export interface ImportResult {
  /** 解析出的记录数组 */
  data: Record<string, unknown>[];
  /** 解析错误信息（空字符串表示成功） */
  error: string;
}

/**
 * 从 JSON 文本解析记录数组
 *
 * @param text - JSON 文本内容
 * @returns 解析结果
 */
export function parseJSON(text: string): ImportResult {
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) {
      return { data: [], error: 'JSON 内容必须是数组' };
    }
    return {
      data: parsed as Record<string, unknown>[],
      error: '',
    };
  } catch (e) {
    return { data: [], error: `JSON 解析失败: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * 从 CSV 文本解析记录数组
 *
 * 第一行为表头（列 key），后续行为数据。
 *
 * @param text - CSV 文本内容
 * @returns 解析结果
 */
export function parseCSV(text: string): ImportResult {
  try {
    // 移除 BOM
    const cleanText = text.replace(/^\uFEFF/, '');
    const lines = splitCSVLines(cleanText);
    if (lines.length < 2) {
      return { data: [], error: 'CSV 至少需要表头行和一行数据' };
    }

    const headers = parseCSVRow(lines[0]);
    const records: Record<string, unknown>[] = [];

    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      const values = parseCSVRow(lines[i]);
      const record: Record<string, unknown> = {};
      headers.forEach((header, idx) => {
        const value = values[idx] ?? '';
        // 尝试解析 JSON 值（数组/对象）
        if (value.startsWith('{') || value.startsWith('[')) {
          try {
            record[header] = JSON.parse(value);
            return;
          } catch {
            // 保持字符串
          }
        }
        // 尝试解析数字
        if (value !== '' && !isNaN(Number(value))) {
          record[header] = Number(value);
          return;
        }
        // 尝试解析布尔值
        if (value === 'true') {
          record[header] = true;
          return;
        }
        if (value === 'false') {
          record[header] = false;
          return;
        }
        record[header] = value;
      });
      records.push(record);
    }

    return { data: records, error: '' };
  } catch (e) {
    return { data: [], error: `CSV 解析失败: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/**
 * 将 CSV 文本拆分为行（处理引号内的换行）
 */
function splitCSVLines(text: string): string[] {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"') {
      // 检查是否为转义的双引号
      if (inQuotes && text[i + 1] === '"') {
        current += '""';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
      current += char;
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      // 跳过 \r\n 的 \r
      if (char === '\r' && text[i + 1] === '\n') continue;
      lines.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * 解析 CSV 行为字段数组（处理引号包裹和逗号转义）
 */
function parseCSVRow(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
        continue;
      }
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

/**
 * 从文件读取文本内容
 *
 * @param file - 用户选择的文件
 * @returns 文件文本内容
 */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
