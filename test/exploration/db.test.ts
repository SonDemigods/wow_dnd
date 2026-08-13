/**
 * @fileoverview 探索模块数据层（exploration/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveExplorationData / getExplorationData：探索表 char_exploration 的 CRUD
 *  - getAllExplorationData：批量读取
 *  - deleteExplorationData / clearAllExplorationData：删除与清空
 *  - sealed/hint 字段保存与读回
 *
 * 版本基线重构后：db.ts 不再做旧字段兼容（currentShopId 迁移、discovered/sealed/hint
 * 默认值兜底、playerPosition 越界 clamp 均已移除），getExplorationData 直接返回原始数据。
 *
 * 设计说明（遵循 code_rule 红线）：
 *  - 顶部 `import 'fake-indexeddb/auto'` 注入 IndexedDB shim
 *  - beforeEach 清空 char_exploration 表
 *  - 不 mock db service，确保 put/get/delete/toArray 真实执行
 */
import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { explorationDbService } from '@/modules/exploration/db';
import { db } from '@/modules/data/core';
import type { ExplorationState, ExplorationCell } from '@/modules/exploration/types';

// ==================== 测试数据构造 helper ====================

function makeCell(o: Partial<ExplorationCell> = {}): ExplorationCell {
  return {
    x: 0,
    y: 0,
    type: 'empty',
    explored: false,
    accessible: false,
    visited: false,
    // discovered/sealed/hint 为标准字段，测试数据中显式赋 false 保证保存与读回一致
    discovered: false,
    sealed: false,
    hint: false,
    ...o,
  } as ExplorationCell;
}

function makeState(o: Partial<ExplorationState> = {}): ExplorationState {
  return {
    currentAreaId: 'forest-1',
    grid: [[makeCell({ x: 0, y: 0, type: 'start', accessible: true })]],
    campUsed: false,
    playerPosition: { x: 0, y: 0 },
    visitedCells: 1,
    bossDefeated: false,
    explorationComplete: false,
    ...o,
  } as ExplorationState;
}

/**
 * 构造 rows×cols 的全空地网格
 */
function makeFullGrid(rows: number, cols: number): ExplorationCell[][] {
  return Array.from({ length: rows }, (_, y) =>
    Array.from({ length: cols }, (_, x) => makeCell({ x, y, type: 'empty' }))
  );
}

// ==================== 测试用例 ====================

describe('ExplorationDbService - 探索数据层（fake-indexeddb 真实 CRUD）', () => {
  beforeEach(async () => {
    await db.char_exploration.clear();
  });

  // -------------------- saveExplorationData / getExplorationData --------------------

  describe('saveExplorationData / getExplorationData：探索数据读写', () => {
    it('保存探索数据后可读回完整数据', async () => {
      const state = makeState({
        currentAreaId: 'cave-1',
        grid: makeFullGrid(6, 6),
        campUsed: true,
        playerPosition: { x: 3, y: 5 },
        visitedCells: 12,
        bossDefeated: true,
        explorationComplete: false,
      });
      await explorationDbService.saveExplorationData('char-1', state, 'shop-1');

      const result = await explorationDbService.getExplorationData('char-1');
      expect(result).not.toBeNull();
      expect(result!.characterId).toBe('char-1');
      expect(result!.currentAreaId).toBe('cave-1');
      expect(result!.assignedShopId).toBe('shop-1');
      expect(result!.campUsed).toBe(true);
      expect(result!.playerPosition).toEqual({ x: 3, y: 5 });
      expect(result!.visitedCells).toBe(12);
      expect(result!.bossDefeated).toBe(true);
      expect(result!.explorationComplete).toBe(false);
      expect(result!.grid).toEqual(state.grid);
      expect(result!.updatedAt).toBeTypeOf('number');
    });

    it('playerPosition 越界时 clamp 到原点（P7-017 防御性校验）', async () => {
      // Arrange：3×3 网格，playerPosition {8,9} 明显越界
      const state = makeState({
        grid: makeFullGrid(3, 3),
        playerPosition: { x: 8, y: 9 },
      });
      await explorationDbService.saveExplorationData('char-1', state);

      // Act
      const result = await explorationDbService.getExplorationData('char-1');

      // Assert：P7-017 修复后越界位置被 clamp 到 {0,0}
      expect(result!.playerPosition).toEqual({ x: 0, y: 0 });
    });

    it('playerPosition 为负数时 clamp 到原点（P7-017 防御性校验）', async () => {
      // Arrange：playerPosition 含负数
      const state = makeState({
        grid: makeFullGrid(3, 3),
        playerPosition: { x: -1, y: -5 },
      });
      await explorationDbService.saveExplorationData('char-1', state);

      // Act
      const result = await explorationDbService.getExplorationData('char-1');

      // Assert：P7-017 修复后负数位置被 clamp 到 {0,0}
      expect(result!.playerPosition).toEqual({ x: 0, y: 0 });
    });

    it('未传 assignedShopId 时默认为空字符串', async () => {
      await explorationDbService.saveExplorationData('char-1', makeState());

      const result = await explorationDbService.getExplorationData('char-1');
      expect(result!.assignedShopId).toBe('');
    });

    it('角色不存在时返回 null', async () => {
      const result = await explorationDbService.getExplorationData('non-existent');
      expect(result).toBeNull();
    });

    it('覆盖保存：相同 characterId 再次保存，新数据替换旧数据', async () => {
      await explorationDbService.saveExplorationData('char-1', makeState({ currentAreaId: 'old', visitedCells: 1 }));
      await explorationDbService.saveExplorationData('char-1', makeState({ currentAreaId: 'new', visitedCells: 99 }));

      const result = await explorationDbService.getExplorationData('char-1');
      expect(result!.currentAreaId).toBe('new');
      expect(result!.visitedCells).toBe(99);
    });

    it('多角色并存：不同 characterId 各自独立', async () => {
      await explorationDbService.saveExplorationData('char-1', makeState({ currentAreaId: 'A' }));
      await explorationDbService.saveExplorationData('char-2', makeState({ currentAreaId: 'B' }));

      expect((await explorationDbService.getExplorationData('char-1'))!.currentAreaId).toBe('A');
      expect((await explorationDbService.getExplorationData('char-2'))!.currentAreaId).toBe('B');
    });

    it('网格数据完整保存与读回（含二维数组结构与单元格字段）', async () => {
      const grid: ExplorationCell[][] = [
        [makeCell({ x: 0, y: 0, type: 'start' }), makeCell({ x: 1, y: 0, type: 'monster', monsterId: 'mob_spider' })],
        [makeCell({ x: 0, y: 1, type: 'treasure' }), makeCell({ x: 1, y: 1, type: 'boss', monsterId: 'boss_dragon' })],
      ];
      await explorationDbService.saveExplorationData('char-1', makeState({ grid }));

      const result = await explorationDbService.getExplorationData('char-1');
      expect(result!.grid).toHaveLength(2);
      expect(result!.grid[0]).toHaveLength(2);
      expect(result!.grid[0][1].type).toBe('monster');
      expect(result!.grid[0][1].monsterId).toBe('mob_spider');
      expect(result!.grid[1][1].type).toBe('boss');
      expect(result!.grid[1][1].monsterId).toBe('boss_dragon');
    });
  });

  // -------------------- sealed/hint 字段保存与读回 --------------------

  describe('sealed/hint 字段保存与读回', () => {
    it('新存档 sealed=true / hint=true 正确保存与读回', async () => {
      const grid: ExplorationCell[][] = [[
        makeCell({ x: 0, y: 0, type: 'boss', sealed: true, monsterId: 'boss_dragon' }),
        makeCell({ x: 1, y: 0, type: 'trap', hint: true }),
      ]];
      await explorationDbService.saveExplorationData('new-char', makeState({ grid }));

      const result = await explorationDbService.getExplorationData('new-char');
      expect(result).not.toBeNull();
      expect(result!.grid[0][0].sealed).toBe(true);
      expect(result!.grid[0][1].hint).toBe(true);
    });

    it('sealed=false / hint=false 显式保存后读回保持 false', async () => {
      const grid: ExplorationCell[][] = [[
        makeCell({ x: 0, y: 0, type: 'boss', sealed: false, monsterId: 'boss_dragon' }),
        makeCell({ x: 1, y: 0, type: 'trap', hint: false }),
      ]];
      await explorationDbService.saveExplorationData('false-char', makeState({ grid }));

      const result = await explorationDbService.getExplorationData('false-char');
      expect(result).not.toBeNull();
      expect(result!.grid[0][0].sealed).toBe(false);
      expect(result!.grid[0][1].hint).toBe(false);
    });
  });

  // -------------------- getAllExplorationData --------------------

  describe('getAllExplorationData：批量读取', () => {
    it('空表返回空数组', async () => {
      const result = await explorationDbService.getAllExplorationData();
      expect(result).toEqual([]);
    });

    it('多角色探索数据全部返回', async () => {
      await explorationDbService.saveExplorationData('char-1', makeState({ currentAreaId: 'A' }));
      await explorationDbService.saveExplorationData('char-2', makeState({ currentAreaId: 'B' }));
      await explorationDbService.saveExplorationData('char-3', makeState({ currentAreaId: 'C' }));

      const result = await explorationDbService.getAllExplorationData();
      expect(result).toHaveLength(3);
      const areaIds = result.map(r => r.currentAreaId).sort();
      expect(areaIds).toEqual(['A', 'B', 'C']);
    });
  });

  // -------------------- deleteExplorationData --------------------

  describe('deleteExplorationData：删除探索数据', () => {
    it('删除已存在记录后，再读返回 null', async () => {
      await explorationDbService.saveExplorationData('char-1', makeState());
      expect(await explorationDbService.getExplorationData('char-1')).not.toBeNull();

      await explorationDbService.deleteExplorationData('char-1');
      expect(await explorationDbService.getExplorationData('char-1')).toBeNull();
    });

    it('删除不影响其他角色', async () => {
      await explorationDbService.saveExplorationData('char-1', makeState({ currentAreaId: 'A' }));
      await explorationDbService.saveExplorationData('char-2', makeState({ currentAreaId: 'B' }));

      await explorationDbService.deleteExplorationData('char-1');
      expect(await explorationDbService.getExplorationData('char-1')).toBeNull();
      expect((await explorationDbService.getExplorationData('char-2'))!.currentAreaId).toBe('B');
    });

    it('删除不存在的记录不抛错', async () => {
      await expect(explorationDbService.deleteExplorationData('non-existent')).resolves.toBeUndefined();
    });
  });

  // -------------------- clearAllExplorationData --------------------

  describe('clearAllExplorationData：清空全部', () => {
    it('清空后所有角色的探索数据均被删除', async () => {
      await explorationDbService.saveExplorationData('char-1', makeState());
      await explorationDbService.saveExplorationData('char-2', makeState());

      await explorationDbService.clearAllExplorationData();
      expect(await explorationDbService.getAllExplorationData()).toEqual([]);
      expect(await explorationDbService.getExplorationData('char-1')).toBeNull();
      expect(await explorationDbService.getExplorationData('char-2')).toBeNull();
    });
  });
});
