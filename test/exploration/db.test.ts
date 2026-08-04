/**
 * @fileoverview 探索模块数据层（exploration/db.ts）内存级 CRUD 测试
 *
 * 使用 fake-indexeddb 在内存中真实执行 Dexie 操作，覆盖：
 *  - saveExplorationData / getExplorationData：探索表 char_exploration 的 CRUD
 *  - getAllExplorationData：批量读取
 *  - deleteExplorationData / clearAllExplorationData：删除与清空
 *  - 旧版 currentShopId 字段兼容迁移到 assignedShopId
 *  - 缺失字段使用安全默认值兜底
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
import type { ExplorationState, ExplorationStorage, ExplorationCell } from '@/modules/exploration/types';

// ==================== 测试数据构造 helper ====================

function makeCell(o: Partial<ExplorationCell> = {}): ExplorationCell {
  return {
    x: 0,
    y: 0,
    type: 'empty',
    explored: false,
    accessible: false,
    visited: false,
    // 阶段三：discovered 为标准字段，默认 false（未发现），
    // 使保存与读回数据一致（db.ts 读取时会补 discovered ?? explored ?? false）
    discovered: false,
    // 阶段四：sealed/hint 为标准字段，默认 false（无封印/无线索），
    // 使保存与读回数据一致（db.ts 读取时会补 sealed ?? false / hint ?? false）
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
 * 构造 rows×cols 的全空地网格（阶段二：db 越界防御测试需要足够大的网格容纳指定 playerPosition）
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
        // 阶段二：传 6×6 网格使 playerPosition {3,5} 在范围内（db 越界防御不 clamp）
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

    it('阶段二：playerPosition 越界时 clamp 到网格范围', async () => {
      // Arrange：3×3 网格，playerPosition {8,9} 明显越界
      const state = makeState({
        grid: makeFullGrid(3, 3),
        playerPosition: { x: 8, y: 9 },
      });
      await explorationDbService.saveExplorationData('char-1', state);

      // Act
      const result = await explorationDbService.getExplorationData('char-1');

      // Assert：clamp 到 [0, 2]（3×3 网格最大索引）
      expect(result!.playerPosition).toEqual({ x: 2, y: 2 });
    });

    it('阶段二：playerPosition 为负数时 clamp 到 0', async () => {
      // Arrange：playerPosition 含负数
      const state = makeState({
        grid: makeFullGrid(3, 3),
        playerPosition: { x: -1, y: -5 },
      });
      await explorationDbService.saveExplorationData('char-1', state);

      // Act
      const result = await explorationDbService.getExplorationData('char-1');

      // Assert：clamp 到 {0, 0}
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
        [makeCell({ x: 0, y: 0, type: 'start' }), makeCell({ x: 1, y: 0, type: 'monster', monsterId: 'spider' })],
        [makeCell({ x: 0, y: 1, type: 'treasure' }), makeCell({ x: 1, y: 1, type: 'boss', monsterId: 'boss-1' })],
      ];
      await explorationDbService.saveExplorationData('char-1', makeState({ grid }));

      const result = await explorationDbService.getExplorationData('char-1');
      expect(result!.grid).toHaveLength(2);
      expect(result!.grid[0]).toHaveLength(2);
      expect(result!.grid[0][1].type).toBe('monster');
      expect(result!.grid[0][1].monsterId).toBe('spider');
      expect(result!.grid[1][1].type).toBe('boss');
      expect(result!.grid[1][1].monsterId).toBe('boss-1');
    });
  });

  describe('getExplorationData：旧版数据兼容与默认值兜底', () => {
    it('旧版 currentShopId 字段自动迁移到 assignedShopId', async () => {
      // 直接写入仅含 currentShopId 的旧版数据（模拟升级前存档）
      await db.char_exploration.put({
        characterId: 'old-char',
        currentAreaId: 'forest',
        currentShopId: 'legacy-shop',
        grid: [],
        playerPosition: { x: 0, y: 0 },
        visitedCells: 0,
        bossDefeated: false,
        explorationComplete: false,
        campUsed: false,
      } as ExplorationStorage);

      const result = await explorationDbService.getExplorationData('old-char');
      expect(result).not.toBeNull();
      expect(result!.assignedShopId).toBe('legacy-shop');
    });

    it('缺失字段使用安全默认值', async () => {
      // 写入仅含必需字段的残缺数据
      await db.char_exploration.put({
        characterId: 'minimal',
        currentAreaId: 'area-1',
      } as ExplorationStorage);

      const result = await explorationDbService.getExplorationData('minimal');
      expect(result).not.toBeNull();
      expect(result!.assignedShopId).toBe('');
      expect(result!.grid).toEqual([]);
      expect(result!.playerPosition).toEqual({ x: 0, y: 0 });
      expect(result!.visitedCells).toBe(0);
      expect(result!.bossDefeated).toBe(false);
      expect(result!.explorationComplete).toBe(false);
      expect(result!.campUsed).toBe(false);
      expect(result!.updatedAt).toBeTypeOf('number');
    });
  });

  // -------------------- 阶段四：sealed/hint 字段兼容 --------------------

  describe('阶段四：sealed/hint 字段兼容', () => {
    it('旧存档 sealed/hint 字段缺失时默认为 false', async () => {
      // 直接写入不含 sealed/hint 的旧版网格数据（模拟阶段四升级前存档）
      await db.char_exploration.put({
        characterId: 'old-v3-char',
        currentAreaId: 'forest',
        grid: [[
          { x: 0, y: 0, type: 'boss', explored: false, accessible: false, visited: false, completed: false, monsterId: 'dragon' },
          { x: 1, y: 0, type: 'trap', explored: false, accessible: false, visited: false, completed: false },
        ]],
        playerPosition: { x: 0, y: 0 },
        visitedCells: 0,
        bossDefeated: false,
        explorationComplete: false,
        campUsed: false,
      } as ExplorationStorage);

      const result = await explorationDbService.getExplorationData('old-v3-char');
      expect(result).not.toBeNull();
      // 旧存档缺失 sealed/hint 时，db.ts 读取兼容为 false
      expect(result!.grid[0][0].sealed).toBe(false);
      expect(result!.grid[0][1].hint).toBe(false);
    });

    it('新存档 sealed=true / hint=true 正确保存与读回', async () => {
      // 阶段四新生成的网格：Boss 格 sealed=true，陷阱格 hint=true
      const grid: ExplorationCell[][] = [[
        makeCell({ x: 0, y: 0, type: 'boss', sealed: true, monsterId: 'dragon' }),
        makeCell({ x: 1, y: 0, type: 'trap', hint: true }),
      ]];
      await explorationDbService.saveExplorationData('new-v4-char', makeState({ grid }));

      const result = await explorationDbService.getExplorationData('new-v4-char');
      expect(result).not.toBeNull();
      expect(result!.grid[0][0].sealed).toBe(true);
      expect(result!.grid[0][1].hint).toBe(true);
    });

    it('sealed=false / hint=false 显式保存后读回保持 false', async () => {
      // 显式 false 不应被兼容逻辑误转为 true
      const grid: ExplorationCell[][] = [[
        makeCell({ x: 0, y: 0, type: 'boss', sealed: false, monsterId: 'dragon' }),
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
