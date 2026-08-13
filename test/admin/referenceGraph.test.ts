/**
 * @fileoverview referenceGraph 关联完整性检查单元测试
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { adminDbService } from '@/modules/admin/db';
import { db } from '@/modules/data/core';
import { checkReferences, formatReferenceWarning } from '@/modules/admin/referenceGraph';

describe('referenceGraph 关联完整性检查', () => {
  beforeEach(async () => {
    await Promise.all([
      db.config_factions.clear(),
      db.config_races.clear(),
      db.config_classes.clear(),
      db.config_skills.clear(),
    ]);
  });

  describe('checkReferences', () => {
    it('无引用关系的表返回 hasReferences=false', async () => {
      // config_items 没有被其他表引用
      const result = await checkReferences('config_items', 'item_1');
      expect(result.hasReferences).toBe(false);
      expect(result.details).toEqual([]);
    });

    it('阵营被种族引用时返回 hasReferences=true', async () => {
      // 插入一条引用 alliance 阵营的种族
      await adminDbService.add('config_races', {
        id: 'human',
        name: '人类',
        factionId: 'alliance',
      }, 'human');

      const result = await checkReferences('config_factions', 'alliance');
      expect(result.hasReferences).toBe(true);
      expect(result.details).toHaveLength(1);
      expect(result.details[0].table).toBe('config_races');
      expect(result.details[0].field).toBe('factionId');
      expect(result.details[0].count).toBe(1);
    });

    it('阵营被职业引用（数组字段 factionsIds）', async () => {
      await adminDbService.add('config_classes', {
        id: 'warrior',
        name: '战士',
        factionsIds: ['alliance', 'horde'],
      }, 'warrior');

      const result = await checkReferences('config_factions', 'alliance');
      expect(result.hasReferences).toBe(true);
      // config_races + config_classes 都可能引用
      const classRefs = result.details.find(d => d.table === 'config_classes');
      expect(classRefs).toBeDefined();
      expect(classRefs!.count).toBe(1);
    });

    it('未被任何表引用的记录返回 hasReferences=false', async () => {
      await adminDbService.add('config_races', {
        id: 'human',
        name: '人类',
        factionId: 'alliance',
      }, 'human');

      const result = await checkReferences('config_factions', 'horde');
      expect(result.hasReferences).toBe(false);
    });

    it('职业被技能引用（classRestriction 字段）', async () => {
      await adminDbService.add('config_skills', {
        id: 'skill_1',
        name: '斩击',
        classRestriction: 'warrior',
      }, 'skill_1');

      const result = await checkReferences('config_classes', 'warrior');
      expect(result.hasReferences).toBe(true);
      expect(result.details[0].table).toBe('config_skills');
    });
  });

  describe('formatReferenceWarning', () => {
    it('无引用时返回空字符串', () => {
      expect(formatReferenceWarning({ hasReferences: false, details: [] })).toBe('');
    });

    it('有引用时返回可读文本', () => {
      const text = formatReferenceWarning({
        hasReferences: true,
        details: [
          { table: 'config_races', field: 'factionId', count: 2 },
          { table: 'config_classes', field: 'factionsIds', count: 1 },
        ],
      });
      expect(text).toContain('种族');
      expect(text).toContain('职业');
      expect(text).toContain('2');
      expect(text).toContain('1');
    });
  });
});
