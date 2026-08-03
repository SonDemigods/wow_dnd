/**
 * @fileoverview 怪物 ID 迁移工具单元测试（P3-137）
 *
 * 覆盖 migration.ts 的：
 * 1. migrateExplorationGrid：网格中旧 ID → 新 ID 转换
 *    - 全旧 ID 网格
 *    - 全新 ID 网格（no-op）
 *    - 混合 ID 网格
 *    - undefined monsterId 跳过
 *    - 空网格
 * 2. migrateEnemyId：单个 ID 迁移
 * 3. migrateEnemyIdArray：数组迁移（返回新数组，不修改原数组）
 */
import { describe, it, expect } from 'vitest';
import {
  migrateExplorationGrid,
  migrateEnemyId,
  migrateEnemyIdArray,
} from '@/modules/enemy/migration';
import type { ExplorationCell } from '@/modules/exploration/types';

/** 构造测试用 ExplorationCell */
function makeCell(overrides: Partial<ExplorationCell> = {}): ExplorationCell {
  return {
    x: 0,
    y: 0,
    type: 'monster',
    explored: false,
    accessible: false,
    visited: false,
    ...overrides,
  };
}

describe('enemy/migration - 怪物 ID 迁移工具', () => {
  describe('migrateExplorationGrid - 网格迁移', () => {
    it('旧 ID 被转换为新 ID', () => {
      const grid: ExplorationCell[][] = [[
        makeCell({ x: 0, y: 0, monsterId: 'orc' }),
        makeCell({ x: 1, y: 0, monsterId: 'dragon' }),
        makeCell({ x: 2, y: 0, type: 'boss', monsterId: 'demon' }),
      ]];

      const result = migrateExplorationGrid(grid);

      expect(result[0][0].monsterId).toBe('mob_orc_grunt');
      expect(result[0][1].monsterId).toBe('mob_young_dragon');
      expect(result[0][2].monsterId).toBe('boss_abyss_guard');
    });

    it('新 ID 原样保留（no-op）', () => {
      const grid: ExplorationCell[][] = [[
        makeCell({ x: 0, y: 0, monsterId: 'mob_gnoll' }),
        makeCell({ x: 1, y: 0, monsterId: 'boss_dragon_whelp' }),
      ]];

      migrateExplorationGrid(grid);

      expect(grid[0][0].monsterId).toBe('mob_gnoll');
      expect(grid[0][1].monsterId).toBe('boss_dragon_whelp');
    });

    it('混合旧 ID 和新 ID 的网格正确迁移', () => {
      const grid: ExplorationCell[][] = [[
        makeCell({ x: 0, y: 0, monsterId: 'gnoll' }),
        makeCell({ x: 1, y: 0, monsterId: 'mob_kobold' }),
        makeCell({ x: 2, y: 0, monsterId: 'lich' }),
        makeCell({ x: 3, y: 0, monsterId: 'boss_frost_giant' }),
      ]];

      migrateExplorationGrid(grid);

      expect(grid[0][0].monsterId).toBe('mob_gnoll');
      expect(grid[0][1].monsterId).toBe('mob_kobold');
      expect(grid[0][2].monsterId).toBe('boss_lich');
      expect(grid[0][3].monsterId).toBe('boss_frost_giant');
    });

    it('undefined monsterId 的格子被跳过', () => {
      const grid: ExplorationCell[][] = [[
        makeCell({ x: 0, y: 0, type: 'empty', monsterId: undefined }),
        makeCell({ x: 1, y: 0, monsterId: 'orc' }),
      ]];

      migrateExplorationGrid(grid);

      expect(grid[0][0].monsterId).toBeUndefined();
      expect(grid[0][1].monsterId).toBe('mob_orc_grunt');
    });

    it('空网格不报错', () => {
      const grid: ExplorationCell[][] = [];
      expect(() => migrateExplorationGrid(grid)).not.toThrow();
    });

    it('返回同一网格引用（原地修改）', () => {
      const grid: ExplorationCell[][] = [[
        makeCell({ x: 0, y: 0, monsterId: 'orc' }),
      ]];

      const result = migrateExplorationGrid(grid);
      expect(result).toBe(grid);
    });
  });

  describe('migrateEnemyId - 单个 ID 迁移', () => {
    it('旧 ID 转换为新 ID', () => {
      expect(migrateEnemyId('orc')).toBe('mob_orc_grunt');
      expect(migrateEnemyId('demon')).toBe('boss_abyss_guard');
    });

    it('新 ID 原样返回', () => {
      expect(migrateEnemyId('mob_gnoll')).toBe('mob_gnoll');
      expect(migrateEnemyId('boss_lich')).toBe('boss_lich');
    });
  });

  describe('migrateEnemyIdArray - 数组迁移', () => {
    it('旧 ID 数组转换为新 ID 数组', () => {
      const ids = ['orc', 'spider', 'dragon'];
      const result = migrateEnemyIdArray(ids);
      expect(result).toEqual(['mob_orc_grunt', 'mob_poison_spider', 'mob_young_dragon']);
    });

    it('混合 ID 数组正确转换', () => {
      const ids = ['gnoll', 'mob_kobold', 'lich', 'boss_frost_giant'];
      const result = migrateEnemyIdArray(ids);
      expect(result).toEqual(['mob_gnoll', 'mob_kobold', 'boss_lich', 'boss_frost_giant']);
    });

    it('不修改原数组', () => {
      const ids = ['orc', 'gnoll'];
      const result = migrateEnemyIdArray(ids);
      expect(ids).toEqual(['orc', 'gnoll']);
      expect(result).not.toBe(ids);
    });

    it('空数组返回空数组', () => {
      const result = migrateEnemyIdArray([]);
      expect(result).toEqual([]);
    });
  });
});
