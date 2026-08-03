/**
 * @fileoverview 备份数据怪物 ID 迁移单元测试（P3-137 阶段 4.2）
 *
 * 覆盖 importer.ts 的 migrateBackupEnemyIds 函数：
 * 1. mobs[].id：普通怪物主键迁移
 * 2. bosses[].id：Boss 主键迁移
 * 3. map[].enemies[]/bosses[]：地点怪物分布池迁移
 * 4. exploration[].grid[][].monsterId：角色探索存档嵌套 ID 迁移
 * 5. v1.1 数据（新 ID）无副作用
 * 6. 空字段 / undefined 字段不报错
 *
 * 测试策略：
 * - 直接调用导出的 migrateBackupEnemyIds 纯函数，无需 fake-indexeddb
 * - 构造含旧 ID 的 BackupData，迁移后验证字段值
 */
import { describe, it, expect } from 'vitest';
import { migrateBackupEnemyIds } from '@/modules/data/importer';
import type { BackupData } from '@/modules/data/types';
import type { ExplorationCell } from '@/modules/exploration/types';

/** 构造最小化 BackupData，可选注入覆盖字段 */
function makeBackupData(overrides: Partial<BackupData> = {}): BackupData {
  return {
    characters: {},
    inventory: {},
    quests: {},
    equipment: {},
    skills: {},
    exploration: {},
    combat: {},
    adventureLog: {},
    map: [],
    shop: [],
    gameState: {},
    shopItems: {},
    ...overrides,
  };
}

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

describe('data/importer.migration - 备份数据怪物 ID 迁移', () => {
  describe('mobs[].id 迁移', () => {
    it('旧 ID 被转换为新 ID', () => {
      const data = makeBackupData({
        mobs: [
          { id: 'orc', name: '兽人' } as never,
          { id: 'dragon', name: '幼龙' } as never,
        ],
      });

      migrateBackupEnemyIds(data);

      expect(data.mobs![0].id).toBe('mob_orc_grunt');
      expect(data.mobs![1].id).toBe('mob_young_dragon');
    });

    it('新 ID 原样保留', () => {
      const data = makeBackupData({
        mobs: [
          { id: 'mob_gnoll', name: '豺狼人' } as never,
        ],
      });

      migrateBackupEnemyIds(data);

      expect(data.mobs![0].id).toBe('mob_gnoll');
    });
  });

  describe('bosses[].id 迁移', () => {
    it('旧 ID 被转换为新 ID', () => {
      const data = makeBackupData({
        bosses: [
          { id: 'demon', name: '深渊卫士' } as never,
          { id: 'lich', name: '亡灵大法师' } as never,
        ],
      });

      migrateBackupEnemyIds(data);

      expect(data.bosses![0].id).toBe('boss_abyss_guard');
      expect(data.bosses![1].id).toBe('boss_lich');
    });
  });

  describe('map[].enemies[]/bosses[] 迁移', () => {
    it('地点 enemies 数组中的旧 ID 被转换', () => {
      const data = makeBackupData({
        map: [
          {
            id: 'forest',
            name: '森林',
            enemies: ['orc', 'spider', 'wolf'],
            bosses: ['dragon_whelp'],
          } as never,
        ],
      });

      migrateBackupEnemyIds(data);

      expect(data.map![0].enemies).toEqual(['mob_orc_grunt', 'mob_poison_spider', 'mob_gray_wolf']);
      expect(data.map![0].bosses).toEqual(['boss_dragon_whelp']);
    });

    it('含新 ID 的地点原样保留', () => {
      const data = makeBackupData({
        map: [
          {
            id: 'forest',
            name: '森林',
            enemies: ['mob_gnoll', 'mob_kobold'],
            bosses: ['boss_frost_wyrm'],
          } as never,
        ],
      });

      migrateBackupEnemyIds(data);

      expect(data.map![0].enemies).toEqual(['mob_gnoll', 'mob_kobold']);
      expect(data.map![0].bosses).toEqual(['boss_frost_wyrm']);
    });
  });

  describe('exploration[].grid[][].monsterId 迁移', () => {
    it('探索存档网格中的旧 ID 被转换', () => {
      const grid: ExplorationCell[][] = [[
        makeCell({ x: 0, y: 0, monsterId: 'orc' }),
        makeCell({ x: 1, y: 0, monsterId: 'mob_gnoll' }),
        makeCell({ x: 2, y: 0, type: 'boss', monsterId: 'demon' }),
      ]];

      const data = makeBackupData({
        exploration: {
          'char_1': {
            characterId: 'char_1',
            currentAreaId: 'forest',
            grid,
            playerPosition: { x: 0, y: 0 },
            visitedCells: 1,
            bossDefeated: false,
            explorationComplete: false,
            campUsed: false,
          },
        },
      });

      migrateBackupEnemyIds(data);

      expect(data.exploration['char_1'].grid[0][0].monsterId).toBe('mob_orc_grunt');
      expect(data.exploration['char_1'].grid[0][1].monsterId).toBe('mob_gnoll');
      expect(data.exploration['char_1'].grid[0][2].monsterId).toBe('boss_abyss_guard');
    });

    it('多个角色存档均被迁移', () => {
      const data = makeBackupData({
        exploration: {
          'char_1': {
            characterId: 'char_1',
            currentAreaId: 'forest',
            grid: [[makeCell({ x: 0, y: 0, monsterId: 'gnoll' })]],
            playerPosition: { x: 0, y: 0 },
            visitedCells: 1,
            bossDefeated: false,
            explorationComplete: false,
            campUsed: false,
          },
          'char_2': {
            characterId: 'char_2',
            currentAreaId: 'cave',
            grid: [[makeCell({ x: 0, y: 0, monsterId: 'skeleton' })]],
            playerPosition: { x: 0, y: 0 },
            visitedCells: 1,
            bossDefeated: false,
            explorationComplete: false,
            campUsed: false,
          },
        },
      });

      migrateBackupEnemyIds(data);

      expect(data.exploration['char_1'].grid[0][0].monsterId).toBe('mob_gnoll');
      expect(data.exploration['char_2'].grid[0][0].monsterId).toBe('mob_skeleton');
    });
  });

  describe('边界情况', () => {
    it('空 BackupData 不报错', () => {
      const data = makeBackupData();
      expect(() => migrateBackupEnemyIds(data)).not.toThrow();
    });

    it('mobs/bosses/map 为 undefined 时不报错', () => {
      const data = makeBackupData();
      // mobs/bosses/map 是可选字段，不设置时为 undefined
      expect(() => migrateBackupEnemyIds(data)).not.toThrow();
    });

    it('v1.1 全新 ID 数据迁移后无变化', () => {
      const data = makeBackupData({
        mobs: [{ id: 'mob_gnoll', name: '豺狼人' } as never],
        bosses: [{ id: 'boss_lich', name: '亡灵大法师' } as never],
        map: [{
          id: 'forest',
          name: '森林',
          enemies: ['mob_gnoll'],
          bosses: ['boss_lich'],
        } as never],
      });

      const dataBefore = JSON.parse(JSON.stringify(data));
      migrateBackupEnemyIds(data);
      expect(data).toEqual(dataBefore);
    });
  });
});
