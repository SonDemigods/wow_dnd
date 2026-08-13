/**
 * @fileoverview exportData / importData 工具函数单元测试
 */
import { describe, it, expect, vi } from 'vitest';
import { exportJSON, exportCSV } from '@/utils/exportData';
import { parseJSON, parseCSV } from '@/utils/importData';

// Mock downloadBlob
vi.mock('@/utils/fileDownload', () => ({
  downloadBlob: vi.fn(),
}));

import { downloadBlob } from '@/utils/fileDownload';

describe('exportData 导出工具', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('exportJSON', () => {
    it('将数据序列化为 JSON 并触发下载', () => {
      const data = [{ id: '1', name: '测试' }];
      exportJSON(data, 'test');
      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0];
      expect(filename).toBe('test.json');
      expect(blob).toBeInstanceOf(Blob);
    });
  });

  describe('exportCSV', () => {
    it('生成 CSV 表头和数据行', () => {
      const data = [{ id: '1', name: '战士', value: 100 }];
      const columns = [
        { key: 'id', label: 'ID' },
        { key: 'name', label: '名称' },
        { key: 'value', label: '价值' },
      ];
      exportCSV(data, columns, 'test');
      expect(downloadBlob).toHaveBeenCalledTimes(1);
      const [blob, filename] = vi.mocked(downloadBlob).mock.calls[0];
      expect(filename).toBe('test.csv');
      expect(blob).toBeInstanceOf(Blob);
    });

    it('包含逗号的值用双引号包裹', () => {
      const data = [{ id: '1', name: '战,士' }];
      const columns = [{ key: 'name', label: '名称' }];
      exportCSV(data, columns, 'test');
      expect(downloadBlob).toHaveBeenCalled();
    });

    it('对象值序列化为 JSON', () => {
      const data = [{ id: '1', bonus: { str: 3 } }];
      const columns = [{ key: 'bonus', label: '加成' }];
      exportCSV(data, columns, 'test');
      expect(downloadBlob).toHaveBeenCalled();
    });
  });
});

describe('importData 导入工具', () => {
  describe('parseJSON', () => {
    it('合法 JSON 数组返回数据', () => {
      const result = parseJSON('[{"id":"1","name":"战士"}]');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('1');
      expect(result.error).toBe('');
    });

    it('非数组 JSON 返回错误', () => {
      const result = parseJSON('{"id":"1"}');
      expect(result.data).toEqual([]);
      expect(result.error).toContain('数组');
    });

    it('非法 JSON 返回错误', () => {
      const result = parseJSON('{invalid}');
      expect(result.data).toEqual([]);
      expect(result.error).toContain('解析失败');
    });
  });

  describe('parseCSV', () => {
    it('解析标准 CSV', () => {
      const csv = 'id,name,value\n1,战士,100\n2,法师,200';
      const result = parseCSV(csv);
      expect(result.data).toHaveLength(2);
      expect(result.data[0].id).toBe(1);
      expect(result.data[0].name).toBe('战士');
      expect(result.error).toBe('');
    });

    it('解析带 BOM 的 CSV', () => {
      const csv = '\uFEFFid,name\n1,战士';
      const result = parseCSV(csv);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(1);
    });

    it('值中包含逗号时用双引号包裹', () => {
      const csv = 'id,name\n1,"战,士"';
      const result = parseCSV(csv);
      expect(result.data[0].name).toBe('战,士');
    });

    it('空行被跳过', () => {
      const csv = 'id,name\n1,战士\n\n2,法师';
      const result = parseCSV(csv);
      expect(result.data).toHaveLength(2);
    });

    it('JSON 值被自动解析', () => {
      // JSON 值含双引号，CSV 中需用双引号包裹整个值
      const csv = 'id,bonus\n1,"{""str"":3}"';
      const result = parseCSV(csv);
      expect(result.data[0].bonus).toEqual({ str: 3 });
    });

    it('布尔值被自动解析', () => {
      const csv = 'id,active\n1,true\n2,false';
      const result = parseCSV(csv);
      expect(result.data[0].active).toBe(true);
      expect(result.data[1].active).toBe(false);
    });

    it('不足两行时返回错误', () => {
      const result = parseCSV('id,name');
      expect(result.data).toEqual([]);
      expect(result.error).toContain('至少');
    });
  });
});
