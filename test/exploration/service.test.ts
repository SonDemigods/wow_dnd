/**
 * @fileoverview 探索模块纯函数单元测试
 *
 * 覆盖范围：
 * 1. EVENT_TO_CELL_TYPE —— GridEventType → CellType 映射表
 * 2. pickRandomFromArray —— 随机选取元素
 * 3. computeEventProbability —— 根据等级生成归一化概率分布
 * 4. buildItemPool —— 按等级筛选物品池
 * 5. determineCellEvent —— 累积概率区间法选择事件
 * 6. generateTrapDamage —— 陷阱伤害计算
 * 7. generateCampHeal —— 营地恢复量
 * 8. generateItemForCell / generateEnemyForCell —— 池中随机选取
 * 9. generateRandomEvent —— 随机事件生成（6 种效果类型）
 * 10. generateMultiOptionEvent —— 多选项事件生成
 * 11. generateGrid —— 网格生成
 * 12. findStartPosition —— 起点定位
 * 13. updateAccessibleCells —— 可访问性扩散
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  EVENT_TO_CELL_TYPE,
  pickRandomFromArray,
  computeEventProbability,
  buildItemPool,
  determineCellEvent,
  generateTrapDamage,
  generateCampHeal,
  generateItemForCell,
  generateEnemyForCell,
  generateRandomEvent,
  generateMultiOptionEvent,
  generateGrid,
  findStartPosition,
  updateAccessibleCells,
  isPassable,
  generateMazeWalls,
  computeVision,
  applyVision,
  shouldShowEnemyAlert,
  GRID_SIZE,
} from '@/modules/exploration/service';
import type { GridEventProbability, GridGenerationConfig, ExplorationCell, AreaEventTemplate } from '@/modules/exploration/types';
import { createSeededRng } from '@/utils/rng';
import {
  CAMP_HEAL_HP,
  CAMP_HEAL_MANA,
  TRAP_DAMAGE_BASE,
  TRAP_DAMAGE_MIN,
  ITEM_POOL_FALLBACK_ID,
  HIDDEN_ROOM_MIN_COUNT,
  HIDDEN_ROOM_MAX_COUNT,
  VISION_RANGE,
  TRAP_HINT_PROBABILITY,
  AREA_EVENT_MIX_PROBABILITY,
} from '@/config/exploration';

afterEach(() => {
  vi.restoreAllMocks();
});

/** 构造测试用概率分布（总和=100） */
function makeProbability(overrides: Partial<GridEventProbability> = {}): GridEventProbability {
  return {
    monster: 20,
    item: 25,
    trap: 15,
    event: 15,
    empty: 25,
    ...overrides,
  };
}

/** 构造测试用网格生成配置 */
function makeGridConfig(overrides: Partial<GridGenerationConfig> = {}): GridGenerationConfig {
  return {
    size: 5,
    eventProbability: makeProbability(),
    monsterPool: ['goblin', 'spider'],
    bossPool: ['boss_dragon'],
    questNormalMonsters: [],
    ...overrides,
  };
}

describe('EVENT_TO_CELL_TYPE 映射表', () => {
  it('monster → monster', () => {
    expect(EVENT_TO_CELL_TYPE.monster).toBe('monster');
  });
  it('item → treasure', () => {
    expect(EVENT_TO_CELL_TYPE.item).toBe('treasure');
  });
  it('trap → trap', () => {
    expect(EVENT_TO_CELL_TYPE.trap).toBe('trap');
  });
  it('event → event', () => {
    expect(EVENT_TO_CELL_TYPE.event).toBe('event');
  });
  it('empty → empty', () => {
    expect(EVENT_TO_CELL_TYPE.empty).toBe('empty');
  });
  it('camp → rest', () => {
    expect(EVENT_TO_CELL_TYPE.camp).toBe('rest');
  });
  it('shop → shop', () => {
    expect(EVENT_TO_CELL_TYPE.shop).toBe('shop');
  });
  it('board → board', () => {
    expect(EVENT_TO_CELL_TYPE.board).toBe('board');
  });
  it('boss → boss', () => {
    expect(EVENT_TO_CELL_TYPE.boss).toBe('boss');
  });
});

describe('pickRandomFromArray 随机选取', () => {
  it('空数组返回 undefined', () => {
    expect(pickRandomFromArray([])).toBeUndefined();
  });

  it('单元素数组返回该元素', () => {
    expect(pickRandomFromArray(['only'])).toBe('only');
  });

  it('Math.random=0 时返回首元素', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(pickRandomFromArray(['a', 'b', 'c'])).toBe('a');
  });

  it('Math.random=0.99 时返回末元素', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(pickRandomFromArray(['a', 'b', 'c'])).toBe('c');
  });

  it('Math.random=0.5 时返回中间元素', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(pickRandomFromArray(['a', 'b', 'c'])).toBe('b');
  });
});

describe('computeEventProbability 概率分布计算', () => {
  it('返回的概率五项之和为 100', () => {
    const prob = computeEventProbability(10);
    const total = prob.monster + prob.item + prob.trap + prob.event + prob.empty;
    expect(total).toBe(100);
  });

  it('低等级区域物品概率较高', () => {
    const low = computeEventProbability(1);
    const high = computeEventProbability(20);
    expect(low.item).toBeGreaterThan(high.item);
  });

  it('高等级区域怪物概率较高', () => {
    const low = computeEventProbability(1);
    const high = computeEventProbability(20);
    expect(high.monster).toBeGreaterThanOrEqual(low.monster);
  });

  it('高等级区域陷阱概率较高', () => {
    const low = computeEventProbability(1);
    const high = computeEventProbability(20);
    expect(high.trap).toBeGreaterThanOrEqual(low.trap);
  });

  it('event 概率固定为 15', () => {
    const prob = computeEventProbability(10);
    expect(prob.event).toBe(15);
  });

  it('怪物概率在归一化前受上限 30 约束（归一化后可能略高）', () => {
    // 源码 clamp 仅作用于归一化前，归一化重新分配后可能略微超过 30
    // 如 avgLevel=100 时：raw.monster=30, total=97, 归一化后 round(30/97*100)=31
    const prob = computeEventProbability(100);
    expect(prob.monster).toBeLessThanOrEqual(35);
  });

  it('物品概率不低于下限 15', () => {
    const prob = computeEventProbability(100);
    expect(prob.item).toBeGreaterThanOrEqual(15);
  });

  it('陷阱概率在归一化前受上限 22 约束（归一化后可能略高）', () => {
    // 同上，归一化后可能略微超过 22
    const prob = computeEventProbability(100);
    expect(prob.trap).toBeLessThanOrEqual(25);
  });

  it('空地概率不低于下限 15', () => {
    const prob = computeEventProbability(100);
    expect(prob.empty).toBeGreaterThanOrEqual(15);
  });

  it('等级 0 时也能正常计算', () => {
    const prob = computeEventProbability(0);
    const total = prob.monster + prob.item + prob.trap + prob.event + prob.empty;
    expect(total).toBe(100);
  });
});

describe('buildItemPool 物品池构建', () => {
  it('返回满足等级范围的物品 ID 列表', () => {
    const items = [
      { id: 'item1', level: 1, rarity: 'common' },
      { id: 'item2', level: 5, rarity: 'uncommon' },
      { id: 'item3', level: 10, rarity: 'rare' },
    ];
    const pool = buildItemPool(items, 1, 5);
    expect(pool).toContain('item1');
    expect(pool).toContain('item2');
  });

  it('结果数量不超过 maxPoolSize', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `item_${i}`,
      level: 1,
      rarity: 'common',
    }));
    const pool = buildItemPool(items, 1, 5, 5);
    expect(pool.length).toBeLessThanOrEqual(5);
  });

  it('无合适物品时返回兜底物品 ID', () => {
    const items = [{ id: 'high_level', level: 100, rarity: 'epic' }];
    const pool = buildItemPool(items, 1, 5);
    expect(pool).toEqual([ITEM_POOL_FALLBACK_ID]);
  });

  it('空物品列表返回兜底物品 ID', () => {
    const pool = buildItemPool([], 1, 5);
    expect(pool).toEqual([ITEM_POOL_FALLBACK_ID]);
  });

  it('未提供 level 时使用 rarity 推算等级', () => {
    const items = [
      { id: 'common_item', rarity: 'common' },     // level 推算为 1
      { id: 'rare_item', rarity: 'rare' },         // level 推算为 5
    ];
    const pool = buildItemPool(items, 1, 5);
    expect(pool).toContain('common_item');
  });

  it('默认 maxPoolSize 为 ITEM_POOL_DEFAULT_MAX_SIZE', () => {
    const items = Array.from({ length: 20 }, (_, i) => ({
      id: `item_${i}`,
      level: 1,
      rarity: 'common',
    }));
    const pool = buildItemPool(items, 1, 5);
    expect(pool.length).toBeLessThanOrEqual(5);
  });
});

describe('determineCellEvent 事件选择', () => {
  it('Math.random=0 时返回首项 monster', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const prob = makeProbability({ monster: 20 });
    expect(determineCellEvent(prob)).toBe('monster');
  });

  it('random 落在 monster 区间内返回 monster', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.19);
    const prob = makeProbability({ monster: 20 });
    // random * 100 = 19, monster=20, 19 < 20 → monster
    expect(determineCellEvent(prob)).toBe('monster');
  });

  it('random 落在 item 区间返回 item', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const prob = makeProbability({ monster: 20, item: 25 });
    // total=100, random*100=30, 30-20=10 < 25 → item
    expect(determineCellEvent(prob)).toBe('item');
  });

  it('random 落在 trap 区间返回 trap', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.55);
    const prob = makeProbability();
    // random*100=55, 55-20-25=10 < 15 → trap
    expect(determineCellEvent(prob)).toBe('trap');
  });

  it('random 落在 event 区间返回 event', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.7);
    const prob = makeProbability();
    // random*100=70, 70-20-25-15=10 < 15 → event
    expect(determineCellEvent(prob)).toBe('event');
  });

  it('random 落在 empty 区间返回 empty', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    const prob = makeProbability();
    // random*100=99, 99-20-25-15-15=24 ≥ 0 → empty（兜底）
    expect(determineCellEvent(prob)).toBe('empty');
  });

  it('全部概率为 0 时（除 empty）返回 empty', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const prob = makeProbability({
      monster: 0, item: 0, trap: 0, event: 0, empty: 100,
    });
    expect(determineCellEvent(prob)).toBe('empty');
  });
});

describe('generateTrapDamage 陷阱伤害', () => {
  it('Math.random=0.5 时返回基础伤害（无波动）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const damage = generateTrapDamage(5);
    // baseDamage = 5 * 5 = 25, variance = 0, floor(25) = 25
    expect(damage).toBe(25);
  });

  it('伤害不低于最小值 TRAP_DAMAGE_MIN', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const damage = generateTrapDamage(0);
    expect(damage).toBeGreaterThanOrEqual(TRAP_DAMAGE_MIN);
  });

  it('等级越高伤害越高', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const low = generateTrapDamage(2);
    const high = generateTrapDamage(20);
    expect(high).toBeGreaterThan(low);
  });

  it('基础伤害 = areaLevel * TRAP_DAMAGE_BASE', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const damage = generateTrapDamage(10);
    // baseDamage = 10 * 5 = 50, variance = 0
    expect(damage).toBe(10 * TRAP_DAMAGE_BASE);
  });
});

describe('generateCampHeal 营地恢复', () => {
  it('返回固定 HP 恢复值 CAMP_HEAL_HP', () => {
    const heal = generateCampHeal(5);
    expect(heal.hp).toBe(CAMP_HEAL_HP);
  });

  it('返回固定 MP 恢复值 CAMP_HEAL_MANA', () => {
    const heal = generateCampHeal(5);
    expect(heal.mana).toBe(CAMP_HEAL_MANA);
  });

  it('忽略 areaLevel 参数', () => {
    const heal1 = generateCampHeal(1);
    const heal10 = generateCampHeal(10);
    expect(heal1).toEqual(heal10);
  });
});

describe('generateItemForCell 物品选取', () => {
  it('非空池返回池中元素', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(generateItemForCell(['a', 'b', 'c'])).toBe('a');
  });

  it('空池返回空字符串', () => {
    expect(generateItemForCell([])).toBe('');
  });

  it('单元素池返回该元素', () => {
    expect(generateItemForCell(['only'])).toBe('only');
  });
});

describe('generateEnemyForCell 怪物选取', () => {
  it('非空池返回池中元素', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.99);
    expect(generateEnemyForCell(['goblin', 'spider'])).toBe('spider');
  });

  it('空池返回空字符串', () => {
    expect(generateEnemyForCell([])).toBe('');
  });
});

describe('generateRandomEvent 随机事件生成', () => {
  it('random < 0.3 → heal 事件', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const result = generateRandomEvent(5);
    expect(result.effect.type).toBe('heal');
    expect(result.message).toContain('生命值');
  });

  it('0.3 ≤ random < 0.5 → mana 事件', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.4);
    const result = generateRandomEvent(5);
    expect(result.effect.type).toBe('mana');
    expect(result.message).toContain('魔法值');
  });

  it('0.5 ≤ random < 0.65 → exp 事件', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    const result = generateRandomEvent(5);
    expect(result.effect.type).toBe('exp');
    expect(result.message).toContain('经验值');
  });

  it('0.65 ≤ random < 0.8 → damage 事件', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.7);
    const result = generateRandomEvent(5);
    expect(result.effect.type).toBe('damage');
    expect(result.message).toContain('伤害');
  });

  it('0.8 ≤ random < 0.9 → mpLoss 事件', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.85);
    const result = generateRandomEvent(5);
    expect(result.effect.type).toBe('mpLoss');
    expect(result.message).toContain('魔法值');
  });

  it('random ≥ 0.9 → gold 事件', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.95);
    const result = generateRandomEvent(5);
    expect(result.effect.type).toBe('gold');
    expect(result.message).toContain('金币');
  });

  it('返回结果包含 message 和 icon', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const result = generateRandomEvent(5);
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
    expect(typeof result.icon).toBe('string');
    expect(result.icon.length).toBeGreaterThan(0);
  });

  it('效果数值随等级增长', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    // 第二次 random 用于 amount 计算，固定为 0
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const low = generateRandomEvent(1);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const high = generateRandomEvent(20);
    expect(high.effect.amount).toBeGreaterThan(low.effect.amount);
  });

  it('amount 为非负整数', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const result = generateRandomEvent(5);
    expect(result.effect.amount).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(result.effect.amount)).toBe(true);
  });
});

describe('generateMultiOptionEvent 多选项事件', () => {
  it('返回包含 message 和 icon', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = generateMultiOptionEvent(5);
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
    expect(typeof result.icon).toBe('string');
  });

  it('choices 数组长度至少为 2', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = generateMultiOptionEvent(5);
    expect(result.choices.length).toBeGreaterThanOrEqual(2);
  });

  it('每个 choice 包含 label 和 effect', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const result = generateMultiOptionEvent(5);
    for (const choice of result.choices) {
      expect(typeof choice.label).toBe('string');
      expect(choice.label.length).toBeGreaterThan(0);
      expect(choice.effect).toHaveProperty('type');
      expect(choice.effect).toHaveProperty('amount');
    }
  });

  it('等级越高选项效果数值越大', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const low = generateMultiOptionEvent(1);
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const high = generateMultiOptionEvent(20);
    // 至少有一个选项的 amount 应随等级增长
    const lowMax = Math.max(...low.choices.map(c => c.effect.amount));
    const highMax = Math.max(...high.choices.map(c => c.effect.amount));
    expect(highMax).toBeGreaterThan(lowMax);
  });
});

describe('generateGrid 网格生成', () => {
  it('生成指定尺寸的二维网格', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({ size: 5 }));
    expect(grid).toHaveLength(5);
    expect(grid[0]).toHaveLength(5);
  });

  it('使用默认尺寸 GRID_SIZE', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({ size: undefined }));
    expect(grid).toHaveLength(GRID_SIZE);
    expect(grid[0]).toHaveLength(GRID_SIZE);
  });

  it('每个格子包含 x/y/type/explored/accessible/visited 字段', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({ size: 5 }));
    const cell = grid[0][0];
    expect(cell).toHaveProperty('x');
    expect(cell).toHaveProperty('y');
    expect(cell).toHaveProperty('type');
    expect(cell).toHaveProperty('explored');
    expect(cell).toHaveProperty('accessible');
    expect(cell).toHaveProperty('visited');
  });

  it('网格中包含一个起点（start）格子', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({ size: 5 }));
    let startCount = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'start') startCount++;
      }
    }
    expect(startCount).toBe(1);
  });

  it('网格中包含一个商店（shop）格子', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({ size: 5 }));
    let shopCount = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'shop') shopCount++;
      }
    }
    expect(shopCount).toBe(1);
  });

  it('网格中包含一个任务板（board）格子', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({ size: 5 }));
    let boardCount = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'board') boardCount++;
      }
    }
    expect(boardCount).toBe(1);
  });

  it('网格中包含一个 Boss 格子', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({ size: 5 }));
    let bossCount = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'boss') bossCount++;
      }
    }
    expect(bossCount).toBe(1);
  });

  it('questNormalMonsters 优先放置为 monster 格子', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({
      size: 5,
      questNormalMonsters: ['quest_mob_1', 'quest_mob_2'],
    }));
    const monsterIds: string[] = [];
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'monster' && cell.monsterId) {
          monsterIds.push(cell.monsterId);
        }
      }
    }
    expect(monsterIds).toContain('quest_mob_1');
    expect(monsterIds).toContain('quest_mob_2');
  });

  it('Boss 格子分配 bossPool 中的 ID', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({
      size: 5,
      bossPool: ['boss_a', 'boss_b'],
    }));
    let bossId: string | undefined;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'boss') {
          bossId = cell.monsterId;
        }
      }
    }
    expect(['boss_a', 'boss_b']).toContain(bossId);
  });

  it('bossPool 为空时 Boss 格子 monsterId 为 undefined', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({
      size: 5,
      bossPool: [],
    }));
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'boss') {
          expect(cell.monsterId).toBeUndefined();
        }
      }
    }
  });

  it('隐藏房间数量在 [HIDDEN_ROOM_MIN, HIDDEN_ROOM_MAX] 范围内（当宝箱足够时）', () => {
    // 使用大网格和高 item 概率确保有足够宝箱
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({
      size: 10,
      eventProbability: makeProbability({
        monster: 0, item: 80, trap: 0, event: 0, empty: 20,
      }),
    }));
    let hiddenCount = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.hidden) hiddenCount++;
      }
    }
    expect(hiddenCount).toBeGreaterThanOrEqual(HIDDEN_ROOM_MIN_COUNT);
    expect(hiddenCount).toBeLessThanOrEqual(HIDDEN_ROOM_MAX_COUNT);
  });
});

describe('findStartPosition 起点定位', () => {
  it('返回网格中 start 格子的坐标', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    const grid = generateGrid(makeGridConfig({ size: 5 }));
    const pos = findStartPosition(grid);
    expect(grid[pos.y][pos.x].type).toBe('start');
  });

  it('无起点时返回 {0, 0}', () => {
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [[
      { x: 0, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
    ]];
    const pos = findStartPosition(grid);
    expect(pos).toEqual({ x: 0, y: 0 });
  });

  it('空网格返回 {0, 0}', () => {
    const pos = findStartPosition([]);
    expect(pos).toEqual({ x: 0, y: 0 });
  });
});

describe('updateAccessibleCells 可访问性扩散', () => {
  it('返回新数组（不修改原数组）', () => {
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [[
      { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true },
      { x: 1, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
    ]];
    const snapshot = JSON.parse(JSON.stringify(grid));
    updateAccessibleCells(grid);
    expect(grid).toEqual(snapshot);
  });

  it('已探索格子周围未探索格子标记为 accessible', () => {
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [
      [
        { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true },
        { x: 1, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
        { x: 2, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
      ],
    ];
    const newGrid = updateAccessibleCells(grid);
    expect(newGrid[0][1].accessible).toBe(true);
    expect(newGrid[0][2].accessible).toBe(false);
  });

  it('未探索格子先被标记为不可访问', () => {
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [
      [
        { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true },
        { x: 1, y: 0, type: 'empty', explored: false, accessible: true, visited: false }, // 故意设为 true
      ],
    ];
    const newGrid = updateAccessibleCells(grid);
    // 相邻已探索 → 应被标记为可访问
    expect(newGrid[0][1].accessible).toBe(true);
  });

  it('远离已探索格子的未探索格子保持不可访问', () => {
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [
      [
        { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true },
        { x: 1, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
        { x: 2, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
        { x: 3, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
      ],
    ];
    const newGrid = updateAccessibleCells(grid);
    expect(newGrid[0][1].accessible).toBe(true);
    expect(newGrid[0][2].accessible).toBe(false);
    expect(newGrid[0][3].accessible).toBe(false);
  });

  it('隐藏房间在相邻格被探索后不自动揭示（阶段三：改由视线揭示）', () => {
    // 阶段三变更：隐藏房间揭示职责从 updateAccessibleCells 移至 applyVision（视线扫到即揭示）。
    // updateAccessibleCells 仅负责 accessible 扩散，不再清除 hidden 标志；
    // 隐藏房间未揭示时 isPassable 返回 false，故不会被标记为 accessible。
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [
      [
        { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true },
        { x: 1, y: 0, type: 'treasure', explored: false, accessible: false, visited: false, hidden: true },
      ],
    ];
    const newGrid = updateAccessibleCells(grid);
    // 隐藏房间保持 hidden=true，需 applyVision 视线扫到后才清除（见 applyVision 测试组）
    expect(newGrid[0][1].hidden).toBe(true);
    expect(newGrid[0][1].explored).toBe(false);
    // 未揭示隐藏房间不可通行，故不标记 accessible
    expect(newGrid[0][1].accessible).toBe(false);
  });

  it('对角相邻不再扩散（4 邻域语义）', () => {
    // [迷宫化] updateAccessibleCells 已从 8 邻域收敛为 4 邻域 + isPassable 墙判断
    // 对角格 (1,1) 不在 (0,0) 的 4 邻域内，不应被标记为 accessible
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [
      [
        { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true },
        { x: 1, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
      ],
      [
        { x: 0, y: 1, type: 'empty', explored: false, accessible: false, visited: false },
        { x: 1, y: 1, type: 'empty', explored: false, accessible: false, visited: false },
      ],
    ];
    const newGrid = updateAccessibleCells(grid);
    // (0,0) 已探索 → 4 邻域 (1,0)、(0,1) 可访问；对角 (1,1) 不可访问
    expect(newGrid[0][1].accessible).toBe(true);
    expect(newGrid[1][0].accessible).toBe(true);
    expect(newGrid[1][1].accessible).toBe(false);
  });

  it('墙阻挡扩散：isPassable=false 的方向不标记 accessible', () => {
    // Arrange：(0,0) 已探索，右侧 (1,0) 与 from 之间有墙 → 不可通行 → 不应 accessible
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [
      [
        { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true, walls: { top: false, right: true, bottom: false, left: false } },
        { x: 1, y: 0, type: 'empty', explored: false, accessible: false, visited: false, walls: { top: false, right: false, bottom: false, left: true } },
      ],
    ];
    // Act
    const newGrid = updateAccessibleCells(grid);
    // Assert：右侧有墙 → (1,0) 不可访问
    expect(newGrid[0][1].accessible).toBe(false);
  });

  it('墙缺失（旧存档）视为全开放，4 邻域正常扩散', () => {
    // Arrange：walls 缺失 → isPassable 视为无墙 → 4 邻域扩散
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [
      [
        { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true },
        { x: 1, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
      ],
    ];
    // Act
    const newGrid = updateAccessibleCells(grid);
    // Assert：无墙 → (1,0) 可访问
    expect(newGrid[0][1].accessible).toBe(true);
  });

  it('隐藏房间在左上角(0,0)且无已探索邻居时遍历到 dx=0&&dy=0 continue 分支', () => {
    // 覆盖 line 489: if (dx === 0 && dy === 0) continue;
    // 隐藏房间在 (0,0)，上方/左方均越界，内层循环会到达 dy=0,dx=0 的 continue
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [
      [
        { x: 0, y: 0, type: 'treasure', explored: false, accessible: false, visited: false, hidden: true },
        { x: 1, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
      ],
      [
        { x: 0, y: 1, type: 'empty', explored: false, accessible: false, visited: false },
        { x: 1, y: 1, type: 'empty', explored: false, accessible: false, visited: false },
      ],
    ];
    const newGrid = updateAccessibleCells(grid);
    // 无已探索邻居 → 隐藏房间保持隐藏
    expect(newGrid[0][0].hidden).toBe(true);
    expect(newGrid[0][0].explored).toBe(false);
  });
});

// ============================================================
// 补充覆盖：多选项事件模板全分支、generateGrid 边界分支
// ============================================================

describe('generateMultiOptionEvent 多选项事件模板覆盖（全模板）', () => {
  it('random=0.25 时选中宝箱守卫模板（含金币选项）', () => {
    // Arrange：Math.floor(0.25 * 4) = 1 → multiOptionEventTemplates[1] 宝箱守卫
    vi.spyOn(Math, 'random').mockReturnValue(0.25);
    // Act
    const result = generateMultiOptionEvent(5);
    // Assert
    expect(result.message).toContain('宝箱');
    expect(result.icon).toBe('game-icons:treasure-map');
    expect(result.choices).toHaveLength(2);
    // 两个选项均为 gold 类型（风险/安全收益）
    expect(result.choices.every(c => c.effect.type === 'gold')).toBe(true);
    // 高风险选项收益应大于安全选项
    const amounts = result.choices.map(c => c.effect.amount);
    expect(Math.max(...amounts)).toBeGreaterThan(Math.min(...amounts));
  });

  it('random=0.5 时选中魔法卷轴模板（mana/exp 选项）', () => {
    // Arrange：Math.floor(0.5 * 4) = 2 → multiOptionEventTemplates[2] 魔法卷轴
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // Act
    const result = generateMultiOptionEvent(5);
    // Assert
    expect(result.message).toContain('卷轴');
    expect(result.icon).toBe('game-icons:scroll-unfurled');
    expect(result.choices).toHaveLength(2);
    const types = result.choices.map(c => c.effect.type);
    expect(types).toContain('mana');
    expect(types).toContain('exp');
  });

  it('random=0.75 时选中黑色药水模板', () => {
    // Arrange：Math.floor(0.75 * 4) = 3 → multiOptionEventTemplates[3] 黑色药水
    // 模板内 effect.type 使用 Math.random() < 0.5 判断 heal/damage，mock=0.75 → damage
    vi.spyOn(Math, 'random').mockReturnValue(0.75);
    // Act
    const result = generateMultiOptionEvent(5);
    // Assert
    expect(result.message).toContain('药水');
    expect(result.icon).toBe('game-icons:potion-ball');
    expect(result.choices).toHaveLength(2);
    // mock=0.75 → 第一个选项 type='damage'（勇敢饮下）
    expect(result.choices[0].effect.type).toBe('damage');
    // 第二个选项始终为 exp（丢弃药水）
    expect(result.choices[1].effect.type).toBe('exp');
  });

  it('黑色药水模板在 random<0.5 时第一个选项为 heal', () => {
    // Arrange：Math.floor(0.74 * 4) = 2? 不对，需要 index=3 → random ∈ [0.75, 1.0)
    // 但模板内部又要 Math.random() < 0.5 → heal。无法用单一 mock 同时满足。
    // 改用 mockImplementation 按调用顺序返回不同值
    const randomSpy = vi.spyOn(Math, 'random');
    // 第一次调用（选模板）：返回 0.75 → index=3 → 黑色药水
    // 第二次调用（模板内 type 判断）：返回 0.4 → < 0.5 → heal
    randomSpy.mockReturnValueOnce(0.75).mockReturnValueOnce(0.4);
    // Act
    const result = generateMultiOptionEvent(5);
    // Assert
    expect(result.choices[0].effect.type).toBe('heal');
  });
});

describe('generateGrid 边界分支覆盖', () => {
  it('eventType=monster 且 monsterPool 为空时 cellMonsterId 保持 undefined', () => {
    // Arrange：mock random=0 使 determineCellEvent 返回 'monster'
    // monsterPool 为空 → 跳过 generateEnemyForCell，cellMonsterId 保持 undefined
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // Act
    const grid = generateGrid(makeGridConfig({
      size: 5,
      monsterPool: [],
      eventProbability: makeProbability({
        monster: 100, item: 0, trap: 0, event: 0, empty: 0,
      }),
    }));
    // Assert：验证有 monster 格子，且 monsterId 均为 undefined
    let monsterCount = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'monster') {
          monsterCount++;
          expect(cell.monsterId).toBeUndefined();
        }
      }
    }
    expect(monsterCount).toBeGreaterThan(0);
  });

  it('eventType=monster 且 monsterPool 非空时调用 generateEnemyForCell 填充 monsterId', () => {
    // Arrange：mock random=0 使 determineCellEvent 返回 'monster'
    // monsterPool 非空 → 调用 generateEnemyForCell（覆盖行 404）
    vi.spyOn(Math, 'random').mockReturnValue(0);
    // Act
    const grid = generateGrid(makeGridConfig({
      size: 5,
      monsterPool: ['goblin', 'spider'],
      eventProbability: makeProbability({
        monster: 100, item: 0, trap: 0, event: 0, empty: 0,
      }),
    }));
    // Assert：验证有 monster 格子，且 monsterId 来自 monsterPool
    let monsterCount = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'monster') {
          monsterCount++;
          expect(cell.monsterId).toBeDefined();
          expect(['goblin', 'spider']).toContain(cell.monsterId);
        }
      }
    }
    expect(monsterCount).toBeGreaterThan(0);
  });

  it('size=2 时固定事件占满网格，触发 findAnyEmptyPosition 兜底返回 {0,0}', () => {
    // Arrange：size=2 共 4 格，起点+商店+任务板+营地占满后 boss 调用 findAnyEmptyPosition
    // 所有格子均被占用时，findAnyEmptyPosition 返回 {0,0} 兜底
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // Act：不应抛错（兜底逻辑生效）
    const grid = generateGrid(makeGridConfig({ size: 2 }));
    // Assert：网格生成成功，且包含 boss 格子（即便位置冲突也会写入）
    expect(grid).toHaveLength(2);
    expect(grid[0]).toHaveLength(2);
    let bossCount = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'boss') bossCount++;
      }
    }
    expect(bossCount).toBe(1);
  });
});

// ============================================================
// 补充覆盖：buildItemPool ?? 回退、findStartPosition/updateAccessibleCells 空数组兜底、
// generateGrid questNormalMonsters 超出空格子 break 分支
// ============================================================

describe('buildItemPool ?? 回退分支覆盖', () => {
  it('item.level 为 undefined 且 rarity 不在 RARITY_LEVEL_MAP 时 itemLevel 回退为 0', () => {
    // Arrange：rarity='legendary' 不在 RARITY_LEVEL_MAP（仅含 common/uncommon/rare/epic）
    // item.level ?? RARITY_LEVEL_MAP[item.rarity] ?? 0 → undefined ?? undefined ?? 0 → 0
    // 0 >= minLevel-1=0 && 0 <= maxLevel+2=7 → 合适
    const items = [
      { id: 'unknown_rarity', rarity: 'legendary' },
    ];
    // Act
    const pool = buildItemPool(items, 1, 5);
    // Assert：itemLevel=0 在 [0, 7] 区间内，应被选中
    expect(pool).toContain('unknown_rarity');
  });
});

describe('generateGrid questNormalMonsters 超出空格子 break 分支', () => {
  it('questNormalMonsters 数量超过空格子时触发 break', () => {
    // Arrange：size=2 共 4 格，固定事件（起点+商店+任务板+营地+Boss）占满后空格子=0
    // questNormalMonsters 有 3 个，但 emptyCells 为空 → 第一个就触发 cellIndex >= emptyCells.length
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // Act：不应抛错，break 分支正常生效
    const grid = generateGrid(makeGridConfig({
      size: 2,
      questNormalMonsters: ['mob_a', 'mob_b', 'mob_c'],
    }));
    // Assert：网格正常生成
    expect(grid).toHaveLength(2);
  });
});

describe('findStartPosition 空数组兜底分支覆盖', () => {
  it('grid[0] 为 undefined 时 ?? 0 兜底（grid 包含 undefined 元素）', () => {
    // Arrange：grid 为 [undefined] 时，grid[0]?.length 为 undefined → ?? 0 → 内层循环不执行
    // 外层循环 y=0 时 grid[0] 为 undefined，但只读取 grid[0]?.length，不访问 grid[y][x]
    const grid = [undefined as any] as import('@/modules/exploration/types').ExplorationCell[][];
    // Act
    const pos = findStartPosition(grid);
    // Assert：未找到起点，返回 {0, 0}
    expect(pos).toEqual({ x: 0, y: 0 });
  });
});

describe('updateAccessibleCells 空数组兜底分支覆盖', () => {
  it('grid 为空数组时 grid[0]?.length ?? 0 兜底为 0', () => {
    // Arrange：空网格 → size=0, colSize=grid[0]?.length ?? 0 = 0
    // grid[0] 为 undefined → ?.length 为 undefined → ?? 0 兜底分支被覆盖
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [];
    // Act
    const newGrid = updateAccessibleCells(grid);
    // Assert：返回空数组，不报错
    expect(newGrid).toEqual([]);
  });
});

// ============================================================
// 迷宫化阶段一：isPassable 通行判定（纯函数）
// ============================================================

/** 构造带 walls 的测试网格（2×2），便于通行判定测试 */
function makeWalledGrid(): ExplorationCell[][] {
  return [
    [
      { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true, walls: { top: false, right: false, bottom: false, left: false } },
      { x: 1, y: 0, type: 'empty', explored: false, accessible: false, visited: false, walls: { top: false, right: false, bottom: false, left: false } },
    ],
    [
      { x: 0, y: 1, type: 'empty', explored: false, accessible: false, visited: false, walls: { top: false, right: false, bottom: false, left: false } },
      { x: 1, y: 1, type: 'empty', explored: false, accessible: false, visited: false, walls: { top: false, right: false, bottom: false, left: false } },
    ],
  ];
}

describe('isPassable 通行判定', () => {
  it('四方向（上/右/下/左）在无墙时均可通行', () => {
    // Arrange：3×3 网格中心 (1,1)，四面均无墙
    const grid: ExplorationCell[][] = Array.from({ length: 3 }, (_, y) =>
      Array.from({ length: 3 }, (_, x) => ({
        x, y, type: 'empty' as const, explored: false, accessible: false, visited: false,
        walls: { top: false, right: false, bottom: false, left: false },
      }))
    );
    // Act & Assert：四方向均可通行
    expect(isPassable(grid, { x: 1, y: 1 }, { x: 1, y: 0 })).toBe(true); // 上
    expect(isPassable(grid, { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(true); // 右
    expect(isPassable(grid, { x: 1, y: 1 }, { x: 1, y: 2 })).toBe(true); // 下
    expect(isPassable(grid, { x: 1, y: 1 }, { x: 0, y: 1 })).toBe(true); // 左
  });

  it('对角线移动不可通行', () => {
    // Arrange
    const grid = makeWalledGrid();
    // Act & Assert：四条对角线方向均不可通行
    expect(isPassable(grid, { x: 0, y: 0 }, { x: 1, y: 1 })).toBe(false);
    expect(isPassable(grid, { x: 1, y: 1 }, { x: 0, y: 0 })).toBe(false);
    expect(isPassable(grid, { x: 1, y: 0 }, { x: 0, y: 1 })).toBe(false);
    expect(isPassable(grid, { x: 0, y: 1 }, { x: 1, y: 0 })).toBe(false);
  });

  it('原地（from === to）不可通行', () => {
    // Arrange
    const grid = makeWalledGrid();
    // Act & Assert
    expect(isPassable(grid, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(false);
  });

  it('目标格越界不可通行', () => {
    // Arrange
    const grid = makeWalledGrid();
    // Act & Assert：(0,0) 向上/向左越界
    expect(isPassable(grid, { x: 0, y: 0 }, { x: 0, y: -1 })).toBe(false);
    expect(isPassable(grid, { x: 0, y: 0 }, { x: -1, y: 0 })).toBe(false);
  });

  it('from.walls[方向]=true 时不可通行', () => {
    // Arrange：(0,0) 右侧有墙
    const grid = makeWalledGrid();
    grid[0][0].walls = { top: false, right: true, bottom: false, left: false };
    // Act & Assert：(0,0) → (1,0) 被 from 的右墙阻挡
    expect(isPassable(grid, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
  });

  it('to.walls[反方向]=true 时不可通行', () => {
    // Arrange：(1,0) 左侧有墙（to 方向墙位）
    const grid = makeWalledGrid();
    grid[0][1].walls = { top: false, right: false, bottom: false, left: true };
    // Act & Assert：(0,0) → (1,0) 被 to 的左墙阻挡
    expect(isPassable(grid, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
  });

  it('walls 缺失（旧存档）视为全开放', () => {
    // Arrange：无 walls 字段（模拟旧存档）
    const grid: ExplorationCell[][] = [
      [
        { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true },
        { x: 1, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
      ],
    ];
    // Act & Assert：四方向无墙位数据 → 视为无墙 → 可通行
    expect(isPassable(grid, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });

  it('隐藏房间未揭示时不可通行', () => {
    // Arrange：(1,0) 为未揭示隐藏房间
    const grid = makeWalledGrid();
    grid[0][1].hidden = true;
    grid[0][1].explored = false;
    // Act & Assert：未揭示隐藏房间不可通行（即使无墙）
    expect(isPassable(grid, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
  });

  it('隐藏房间已揭示（hidden=false）后可正常通行', () => {
    // Arrange：(1,0) 已揭示（hidden=false），无墙
    const grid = makeWalledGrid();
    grid[0][1].hidden = false;
    grid[0][1].explored = true;
    // Act & Assert：已揭示 → 墙判定通过 → 可通行
    expect(isPassable(grid, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
  });
});

// ============================================================
// 迷宫化阶段一：generateMazeWalls 墙结构生成（纯函数）
// ============================================================

/** 从起点 BFS 校验全网格结构连通性（仅墙判定，忽略隐藏房间标志） */
function bfsReachableCount(grid: ExplorationCell[][], start: { x: number; y: number }): number {
  const size = grid.length;
  if (size === 0) return 0;
  const colSize = grid[0]?.length ?? 0;
  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [start];
  visited.add(`${start.x},${start.y}`);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const dirs = [
      { dx: 0, dy: -1, wall: 'top' as const, opp: 'bottom' as const },
      { dx: 1, dy: 0, wall: 'right' as const, opp: 'left' as const },
      { dx: 0, dy: 1, wall: 'bottom' as const, opp: 'top' as const },
      { dx: -1, dy: 0, wall: 'left' as const, opp: 'right' as const },
    ];
    for (const d of dirs) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      if (nx < 0 || nx >= colSize || ny < 0 || ny >= size) continue;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      const a = grid[cur.y][cur.x];
      const b = grid[ny][nx];
      // walls 缺失视为无墙
      const blocked = (!!a.walls?.[d.wall]) || (!!b.walls?.[d.opp]);
      if (blocked) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return visited.size;
}

describe('generateMazeWalls 迷宫墙生成', () => {
  it('返回新数组，不修改原网格', () => {
    // Arrange
    const rng = createSeededRng(12345);
    const grid = generateGrid(makeGridConfig({ size: 5 }));
    const snapshot = JSON.parse(JSON.stringify(grid));
    // Act
    const mazeGrid = generateMazeWalls(grid, 5, rng);
    // Assert：原网格未被修改（事件类型与位置不变）
    expect(grid).toEqual(snapshot);
    // 返回的是新数组实例
    expect(mazeGrid).not.toBe(grid);
  });

  it('每个格子都被赋予 walls 字段（四面墙位）', () => {
    // Arrange
    const rng = createSeededRng(1);
    const grid = generateGrid(makeGridConfig({ size: 5 }));
    // Act
    const mazeGrid = generateMazeWalls(grid, 5, rng);
    // Assert：每个 cell 的 walls 字段存在且为对象
    for (const row of mazeGrid) {
      for (const cell of row) {
        expect(cell.walls).toBeDefined();
        expect(cell.walls).toHaveProperty('top');
        expect(cell.walls).toHaveProperty('right');
        expect(cell.walls).toHaveProperty('bottom');
        expect(cell.walls).toHaveProperty('left');
      }
    }
  });

  it('墙位双向一致性：a.right === b.left 等', () => {
    // Arrange
    const rng = createSeededRng(7);
    const grid = generateGrid(makeGridConfig({ size: 6 }));
    // Act
    const mazeGrid = generateMazeWalls(grid, 6, rng);
    // Assert：横向邻居 right/left 一致；纵向邻居 bottom/top 一致
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 6; x++) {
        const cell = mazeGrid[y][x];
        if (x + 1 < 6) {
          const right = mazeGrid[y][x + 1];
          expect(cell.walls!.right).toBe(right.walls!.left);
        }
        if (y + 1 < 6) {
          const bottom = mazeGrid[y + 1][x];
          expect(cell.walls!.bottom).toBe(bottom.walls!.top);
        }
      }
    }
  });

  it('全网格连通：从起点 BFS 可达所有非隐藏格', () => {
    // Arrange
    const rng = createSeededRng(42);
    const grid = generateGrid(makeGridConfig({ size: 8 }));
    // Act
    const mazeGrid = generateMazeWalls(grid, 8, rng);
    const start = findStartPosition(mazeGrid);
    const reachable = bfsReachableCount(mazeGrid, start);
    // Assert：隐藏房间因 isPassable 视为不可通行，但 BFS 用结构连通性（仅墙判定）
    // 步骤 E 兜底保证全网格结构连通 → 可达数 === 总格数
    expect(reachable).toBe(8 * 8);
  });

  it('多次不同 seed 生成的迷宫均保持连通（连通性硬约束）', () => {
    // Arrange & Act：用 5 个不同 seed 生成迷宫
    for (const seed of [1, 100, 9999, 55555, 888888]) {
      const rng = createSeededRng(seed);
      const grid = generateGrid(makeGridConfig({ size: 7 }));
      const mazeGrid = generateMazeWalls(grid, 7, rng);
      const start = findStartPosition(mazeGrid);
      const reachable = bfsReachableCount(mazeGrid, start);
      // Assert：每个 seed 均保证全网格连通
      expect(reachable).toBe(7 * 7);
    }
  });

  it('保护格（起点/商店/任务板）邻接边不封墙', () => {
    // Arrange
    const rng = createSeededRng(2026);
    const grid = generateGrid(makeGridConfig({ size: 8 }));
    // Act
    const mazeGrid = generateMazeWalls(grid, 8, rng);
    // Assert：遍历所有保护格，其 4 邻域邻接边均应开放（无墙）
    const isProtected = (t: string) => t === 'start' || t === 'shop' || t === 'board';
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const cell = mazeGrid[y][x];
        if (!isProtected(cell.type)) continue;
        const dirs = [
          { dx: 0, dy: -1, wall: 'top' as const, opp: 'bottom' as const },
          { dx: 1, dy: 0, wall: 'right' as const, opp: 'left' as const },
          { dx: 0, dy: 1, wall: 'bottom' as const, opp: 'top' as const },
          { dx: -1, dy: 0, wall: 'left' as const, opp: 'right' as const },
        ];
        for (const d of dirs) {
          const nx = x + d.dx;
          const ny = y + d.dy;
          if (nx < 0 || nx >= 8 || ny < 0 || ny >= 8) continue;
          const neighbor = mazeGrid[ny][nx];
          // 保护格邻接边永不封墙
          expect(cell.walls![d.wall]).toBe(false);
          expect(neighbor.walls![d.opp]).toBe(false);
        }
      }
    }
  });

  it('隐藏房间保留至少 1 个开放方向作为入口（非全封闭死路）', () => {
    // Arrange：高 item 概率 + 大网格确保生成隐藏房间
    const rng = createSeededRng(314);
    const grid = generateGrid(makeGridConfig({
      size: 10,
      eventProbability: makeProbability({
        monster: 0, item: 80, trap: 0, event: 0, empty: 20,
      }),
    }));
    // Act
    const mazeGrid = generateMazeWalls(grid, 10, rng);
    // Assert：每个隐藏房间至少 1 个开放方向（保证揭示后可进入，非全封闭死路）
    // 注：实现会尝试封到 1 个入口，但保护格方向不封、BFS 失败回退的方向不封，
    // 故实际可能保留 1~2 个入口。未揭示时 isPassable 仍拦截进入 → 不可达密室语义成立。
    const hiddenCells = mazeGrid.flat().filter(c => c.hidden);
    expect(hiddenCells.length).toBeGreaterThan(0);
    for (const cell of hiddenCells) {
      const openDirs = [
        { wall: 'top' as const, dx: 0, dy: -1 },
        { wall: 'right' as const, dx: 1, dy: 0 },
        { wall: 'bottom' as const, dx: 0, dy: 1 },
        { wall: 'left' as const, dx: -1, dy: 0 },
      ].filter(d => !cell.walls![d.wall]);
      // 至少 1 个入口（非全封闭），且不超过 2 个（封墙逻辑生效）
      expect(openDirs.length).toBeGreaterThanOrEqual(1);
      expect(openDirs.length).toBeLessThanOrEqual(2);
    }
  });

  it('网格尺寸 1×1 时不抛错（边界防御）', () => {
    // Arrange：1×1 网格，唯一格子作为起点
    const grid: ExplorationCell[][] = [[
      { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true },
    ]];
    const rng = createSeededRng(0);
    // Act：不应抛错
    const mazeGrid = generateMazeWalls(grid, 1, rng);
    // Assert：返回网格尺寸不变，walls 字段存在
    expect(mazeGrid).toHaveLength(1);
    expect(mazeGrid[0]).toHaveLength(1);
    expect(mazeGrid[0][0].walls).toBeDefined();
  });

  it('网格尺寸 2×2 时不抛错且保持连通', () => {
    // Arrange
    const rng = createSeededRng(2);
    const grid = generateGrid(makeGridConfig({ size: 2 }));
    // Act
    const mazeGrid = generateMazeWalls(grid, 2, rng);
    const start = findStartPosition(mazeGrid);
    // Assert：2×2 全部 4 格结构连通
    expect(bfsReachableCount(mazeGrid, start)).toBe(4);
  });

  it('相同 seed 生成结果完全一致（确定性）', () => {
    // Arrange & Act：相同 seed 的 rng 同时驱动 generateGrid 与 generateMazeWalls
    // 注意：generateGrid 默认用 defaultRng(Math.random) 非确定性，需显式注入 seeded rng
    const makeMaze = () => {
      const rng = createSeededRng(13579);
      const grid = generateGrid(makeGridConfig({ size: 6 }), rng);
      return generateMazeWalls(grid, 6, rng);
    };
    const maze1 = makeMaze();
    const maze2 = makeMaze();
    // Assert：事件布局与墙结构完全一致
    expect(JSON.stringify(maze1)).toBe(JSON.stringify(maze2));
  });

  it('旧存档兼容：grid 无 walls 字段也能正常生成迷宫', () => {
    // Arrange：构造无 walls 字段的简单网格（模拟旧存档）
    const grid: ExplorationCell[][] = [
      [
        { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true },
        { x: 1, y: 0, type: 'empty', explored: false, accessible: false, visited: false },
      ],
      [
        { x: 0, y: 1, type: 'empty', explored: false, accessible: false, visited: false },
        { x: 1, y: 1, type: 'empty', explored: false, accessible: false, visited: false },
      ],
    ];
    const rng = createSeededRng(11);
    // Act
    const mazeGrid = generateMazeWalls(grid, 2, rng);
    // Assert：返回网格每个格子都有 walls，且保持连通
    for (const row of mazeGrid) {
      for (const cell of row) {
        expect(cell.walls).toBeDefined();
      }
    }
    expect(bfsReachableCount(mazeGrid, { x: 0, y: 0 })).toBe(4);
  });
});

// ============================================================
// 迷宫化阶段一：generateGrid 集成迷宫生成
// ============================================================

describe('generateGrid 集成迷宫生成', () => {
  it('生成的网格每个格子都带有 walls 字段', () => {
    // Arrange
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // Act
    const grid = generateGrid(makeGridConfig({ size: 5 }));
    // Assert：generateGrid 末尾调用 generateMazeWalls → 每格有 walls
    for (const row of grid) {
      for (const cell of row) {
        expect(cell.walls).toBeDefined();
      }
    }
  });

  it('生成的网格从起点 BFS 全网格连通', () => {
    // Arrange
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    // Act
    const grid = generateGrid(makeGridConfig({ size: 6 }));
    const start = findStartPosition(grid);
    // Assert
    expect(bfsReachableCount(grid, start)).toBe(6 * 6);
  });
});

// ============================================================
// 阶段三：视线与分层揭示（computeVision / applyVision）
// ============================================================

/** 构造 size×size 全开放网格（walls 全 false），可选覆盖部分 cell */
function makeVisionGrid(size: number, overrides: Record<string, Partial<ExplorationCell>> = {}): ExplorationCell[][] {
  const grid: ExplorationCell[][] = [];
  for (let y = 0; y < size; y++) {
    grid[y] = [];
    for (let x = 0; x < size; x++) {
      const key = `${x},${y}`;
      grid[y][x] = {
        x, y,
        type: 'empty',
        explored: false,
        accessible: false,
        visited: false,
        completed: false,
        walls: { top: false, right: false, bottom: false, left: false },
        ...(overrides[key] || {}),
      };
    }
  }
  return grid;
}

/** 在相邻两格之间设置墙（双向同步），hasWall=true 建墙，false 拆墙 */
function setWallBetween(grid: ExplorationCell[][], a: { x: number; y: number }, b: { x: number; y: number }, hasWall: boolean): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const aCell = grid[a.y][a.x];
  const bCell = grid[b.y][b.x];
  if (!aCell.walls || !bCell.walls) return;
  if (dx === 0 && dy === -1) { aCell.walls.top = hasWall; bCell.walls.bottom = hasWall; }
  else if (dx === 1 && dy === 0) { aCell.walls.right = hasWall; bCell.walls.left = hasWall; }
  else if (dx === 0 && dy === 1) { aCell.walls.bottom = hasWall; bCell.walls.top = hasWall; }
  else if (dx === -1 && dy === 0) { aCell.walls.left = hasWall; bCell.walls.right = hasWall; }
}

/** 判断坐标是否在视线结果数组中 */
function isVisible(visible: { x: number; y: number }[], x: number, y: number): boolean {
  return visible.some(v => v.x === x && v.y === y);
}

describe('computeVision 视线计算', () => {
  it('玩家所在格始终可见', () => {
    const grid = makeVisionGrid(5);
    const visible = computeVision(grid, { x: 2, y: 2 }, VISION_RANGE);
    expect(isVisible(visible, 2, 2)).toBe(true);
  });

  it('4 正方向直线视线：range 内无墙时各方向均被扫到', () => {
    // 7×7 网格，玩家在中心 (3,3)，range=3，全开放
    const grid = makeVisionGrid(7);
    const visible = computeVision(grid, { x: 3, y: 3 }, 3);

    // 上方向：(3,2), (3,1), (3,0)
    expect(isVisible(visible, 3, 2)).toBe(true);
    expect(isVisible(visible, 3, 1)).toBe(true);
    expect(isVisible(visible, 3, 0)).toBe(true);
    // 右方向：(4,3), (5,3), (6,3)
    expect(isVisible(visible, 4, 3)).toBe(true);
    expect(isVisible(visible, 5, 3)).toBe(true);
    expect(isVisible(visible, 6, 3)).toBe(true);
    // 下方向：(3,4), (3,5), (3,6)
    expect(isVisible(visible, 3, 4)).toBe(true);
    expect(isVisible(visible, 3, 5)).toBe(true);
    expect(isVisible(visible, 3, 6)).toBe(true);
    // 左方向：(2,3), (1,3), (0,3)
    expect(isVisible(visible, 2, 3)).toBe(true);
    expect(isVisible(visible, 1, 3)).toBe(true);
    expect(isVisible(visible, 0, 3)).toBe(true);
    // 对角格不在视线内（仅 4 正方向）
    expect(isVisible(visible, 4, 4)).toBe(false);
    expect(isVisible(visible, 2, 2)).toBe(false);
  });

  it('墙阻挡：有墙方向视线截止，墙后格子不可见', () => {
    // 7×7 网格，玩家在 (3,3)，在 (3,2) 与 (3,1) 之间建墙
    const grid = makeVisionGrid(7);
    setWallBetween(grid, { x: 3, y: 2 }, { x: 3, y: 1 }, true);
    const visible = computeVision(grid, { x: 3, y: 3 }, 3);

    // 上方向：(3,2) 可见（无墙），(3,1) 不可见（有墙阻挡）
    expect(isVisible(visible, 3, 2)).toBe(true);
    expect(isVisible(visible, 3, 1)).toBe(false);
    expect(isVisible(visible, 3, 0)).toBe(false);
    // 其他方向不受影响
    expect(isVisible(visible, 4, 3)).toBe(true);
    expect(isVisible(visible, 3, 4)).toBe(true);
    expect(isVisible(visible, 2, 3)).toBe(true);
  });

  it('距离衰减：超出 range 的格子不可见', () => {
    // 9×9 网格，玩家在中心 (4,4)，range=2
    const grid = makeVisionGrid(9);
    const visible = computeVision(grid, { x: 4, y: 4 }, 2);

    // 上方向 2 格内可见
    expect(isVisible(visible, 4, 3)).toBe(true);
    expect(isVisible(visible, 4, 2)).toBe(true);
    // 第 3 格不可见（超出 range）
    expect(isVisible(visible, 4, 1)).toBe(false);
    expect(isVisible(visible, 4, 0)).toBe(false);
  });

  it('range ≤ 0：仅玩家所在格可见', () => {
    const grid = makeVisionGrid(5);
    const visible = computeVision(grid, { x: 2, y: 2 }, 0);
    expect(visible).toHaveLength(1);
    expect(visible[0]).toEqual({ x: 2, y: 2 });
  });

  it('边缘/角落：视线向出界方向自然截断', () => {
    // 5×5 网格，玩家在角落 (0,0)，range=3
    const grid = makeVisionGrid(5);
    const visible = computeVision(grid, { x: 0, y: 0 }, 3);

    // 右方向：(1,0), (2,0), (3,0) 可见（range=3，但只有 4 格）
    expect(isVisible(visible, 1, 0)).toBe(true);
    expect(isVisible(visible, 2, 0)).toBe(true);
    expect(isVisible(visible, 3, 0)).toBe(true);
    // 第 4 格超出 range
    expect(isVisible(visible, 4, 0)).toBe(false);
    // 下方向：(0,1), (0,2), (0,3) 可见
    expect(isVisible(visible, 0, 1)).toBe(true);
    expect(isVisible(visible, 0, 2)).toBe(true);
    expect(isVisible(visible, 0, 3)).toBe(true);
    // 上/左方向出界，不抛异常
    expect(isVisible(visible, 0, -1)).toBe(false);
  });

  it('隐藏房间：视线扫到但不穿过（停止该方向）', () => {
    // 7×7 网格，玩家在 (3,3)，(3,1) 为未揭示隐藏房间
    const grid = makeVisionGrid(7, {
      '3,1': { hidden: true, explored: false },
    });
    const visible = computeVision(grid, { x: 3, y: 3 }, 3);

    // 上方向：(3,2) 可见，(3,1) 可见（被扫到），(3,0) 不可见（视线穿过隐藏房间后停止）
    expect(isVisible(visible, 3, 2)).toBe(true);
    expect(isVisible(visible, 3, 1)).toBe(true);
    expect(isVisible(visible, 3, 0)).toBe(false);
  });

  it('视线起点被墙包围：四方向均截断，仅玩家所在格可见', () => {
    // 5×5 网格，玩家在 (2,2)，四周全建墙
    const grid = makeVisionGrid(5);
    setWallBetween(grid, { x: 2, y: 2 }, { x: 2, y: 1 }, true); // 上墙
    setWallBetween(grid, { x: 2, y: 2 }, { x: 3, y: 2 }, true); // 右墙
    setWallBetween(grid, { x: 2, y: 2 }, { x: 2, y: 3 }, true); // 下墙
    setWallBetween(grid, { x: 2, y: 2 }, { x: 1, y: 2 }, true); // 左墙
    const visible = computeVision(grid, { x: 2, y: 2 }, 3);

    expect(visible).toHaveLength(1);
    expect(visible[0]).toEqual({ x: 2, y: 2 });
  });
});

describe('applyVision 视线应用', () => {
  it('视线扫到的格子标记 discovered=true', () => {
    const grid = makeVisionGrid(5);
    const visionCells = [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 1, y: 2 }];
    const result = applyVision(grid, visionCells);

    expect(result[2][2].discovered).toBe(true);
    expect(result[2][3].discovered).toBe(true);
    expect(result[2][1].discovered).toBe(true);
    // 未扫到的格子 discovered 仍为 undefined
    expect(result[0][0].discovered).toBeFalsy();
  });

  it('discovered 只增不减：已发现的格保持可见', () => {
    // 初始网格中 (2,2) 已 discovered=true
    const grid = makeVisionGrid(5, {
      '2,2': { discovered: true },
    });
    // 新视线不包含 (2,2)
    const visionCells = [{ x: 3, y: 2 }];
    const result = applyVision(grid, visionCells);

    // (2,2) 仍 discovered=true（不因未在新视线中而回退）
    expect(result[2][2].discovered).toBe(true);
    expect(result[2][3].discovered).toBe(true);
  });

  it('隐藏房间被视线扫到后清除 hidden 标志（允许通行）', () => {
    const grid = makeVisionGrid(5, {
      '3,2': { hidden: true, explored: false },
    });
    const visionCells = [{ x: 2, y: 2 }, { x: 3, y: 2 }];
    const result = applyVision(grid, visionCells);

    // (3,2) hidden 被清除，但 explored 保持 false
    expect(result[2][3].hidden).toBe(false);
    expect(result[2][3].explored).toBe(false);
    expect(result[2][3].discovered).toBe(true);
  });

  it('已 explored 的隐藏房间不被重置（explored 恒蕴含 discovered）', () => {
    const grid = makeVisionGrid(5, {
      '3,2': { hidden: false, explored: true, discovered: true },
    });
    const visionCells = [{ x: 3, y: 2 }];
    const result = applyVision(grid, visionCells);

    expect(result[2][3].explored).toBe(true);
    expect(result[2][3].discovered).toBe(true);
  });

  it('不修改原网格（纯函数）', () => {
    const grid = makeVisionGrid(5, {
      '3,2': { hidden: true, explored: false },
    });
    const visionCells = [{ x: 2, y: 2 }, { x: 3, y: 2 }];
    const result = applyVision(grid, visionCells);

    // 原网格未被修改
    expect(grid[2][3].discovered).toBeFalsy();
    expect(grid[2][3].hidden).toBe(true);
    // 新网格已修改
    expect(result[2][3].discovered).toBe(true);
    expect(result[2][3].hidden).toBe(false);
  });
});

describe('computeVision + applyVision 集成', () => {
  it('移动后视线重新计算：discovered 只增不减', () => {
    // 7×7 网格，玩家初始在 (3,3)
    const grid = makeVisionGrid(7);
    const pos1 = { x: 3, y: 3 };

    // 第一次视线
    const vision1 = computeVision(grid, pos1, VISION_RANGE);
    const grid1 = applyVision(grid, vision1);

    // (3,2) 在第一次视线中
    expect(grid1[2][3].discovered).toBe(true);

    // 玩家移动到 (3,4)，新视线不包含 (3,2)（距离=2，在 range=3 内，实际包含）
    // 改为移动到 (5,5)，新视线不包含 (3,2)
    const pos2 = { x: 5, y: 5 };
    const vision2 = computeVision(grid1, pos2, VISION_RANGE);
    const grid2 = applyVision(grid1, vision2);

    // (3,2) 仍 discovered=true（只增不减）
    expect(grid2[2][3].discovered).toBe(true);
    // (6,5) 在新视线中
    expect(grid2[5][6].discovered).toBe(true);
  });

  it('隐藏房间被视线扫到后可通过 isPassable（hidden 已清除）', () => {
    // 5×5 网格，玩家在 (2,2)，(2,1) 为未揭示隐藏房间（无墙）
    const grid = makeVisionGrid(5, {
      '2,1': { hidden: true, explored: false, type: 'treasure' },
    });
    const pos = { x: 2, y: 2 };

    // 视线扫到 (2,1)
    const vision = computeVision(grid, pos, VISION_RANGE);
    expect(isVisible(vision, 2, 1)).toBe(true);

    // 应用视线前：isPassable 返回 false（hidden && !explored）
    expect(isPassable(grid, pos, { x: 2, y: 1 })).toBe(false);

    // 应用视线后：hidden 清除，isPassable 返回 true
    const result = applyVision(grid, vision);
    expect(isPassable(result, pos, { x: 2, y: 1 })).toBe(true);
  });
});

// ============================================================
// 阶段四：内容丰富与平衡（Boss 封印 / 陷阱线索 / 怪物索敌 / 区域事件）
// ============================================================

/** 构造测试用单元格（默认 empty 类型，可覆盖字段） */
function makeAlertCell(x: number, y: number, type: ExplorationCell['type'], overrides: Partial<ExplorationCell> = {}): ExplorationCell {
  return { x, y, type, explored: false, accessible: false, visited: false, ...overrides };
}

/** 构造 5×5 测试网格，按 monsterCell.x/y 放置可定制的怪物/Boss 格，其余为 empty */
function makeAlertGrid(monsterCell: ExplorationCell): ExplorationCell[][] {
  const grid: ExplorationCell[][] = [];
  for (let y = 0; y < 5; y++) {
    grid[y] = [];
    for (let x = 0; x < 5; x++) {
      grid[y][x] = makeAlertCell(x, y, 'empty');
    }
  }
  // 按 monsterCell 自身的 x/y 字段放置，确保坐标与网格位置一致
  grid[monsterCell.y][monsterCell.x] = monsterCell;
  return grid;
}

describe('shouldShowEnemyAlert 怪物索敌警告判定（阶段四）', () => {
  it('未发现的怪物格不剧透 → false', () => {
    const grid = makeAlertGrid(makeAlertCell(1, 1, 'monster', { discovered: false, explored: false }));
    expect(shouldShowEnemyAlert(grid, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });

  it('discovered 怪物格且距离 ≤ ENEMY_ALERT_RANGE → true', () => {
    const grid = makeAlertGrid(makeAlertCell(1, 1, 'monster', { discovered: true }));
    // 玩家在 (2,1)，距离=1 ≤ 2
    expect(shouldShowEnemyAlert(grid, { x: 1, y: 1 }, { x: 2, y: 1 })).toBe(true);
  });

  it('discovered 怪物格但距离 > ENEMY_ALERT_RANGE → false', () => {
    const grid = makeAlertGrid(makeAlertCell(1, 1, 'monster', { discovered: true }));
    // 玩家在 (4,1)，距离=3 > 2
    expect(shouldShowEnemyAlert(grid, { x: 1, y: 1 }, { x: 4, y: 1 })).toBe(false);
  });

  it('距离恰好等于 ENEMY_ALERT_RANGE → true（边界包含）', () => {
    const grid = makeAlertGrid(makeAlertCell(1, 1, 'monster', { discovered: true }));
    // 玩家在 (3,1)，距离=2 = ENEMY_ALERT_RANGE
    expect(shouldShowEnemyAlert(grid, { x: 1, y: 1 }, { x: 3, y: 1 })).toBe(true);
  });

  it('explored 怪物格且距离 ≤ ENEMY_ALERT_RANGE → true', () => {
    const grid = makeAlertGrid(makeAlertCell(1, 1, 'monster', { explored: true }));
    expect(shouldShowEnemyAlert(grid, { x: 1, y: 1 }, { x: 1, y: 2 })).toBe(true);
  });

  it('已击败（completed）的怪物格 → false', () => {
    const grid = makeAlertGrid(makeAlertCell(1, 1, 'monster', { discovered: true, completed: true }));
    expect(shouldShowEnemyAlert(grid, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });

  it('Boss 格不触发索敌警告 → false（由封印门单独处理）', () => {
    const grid = makeAlertGrid(makeAlertCell(1, 1, 'boss', { discovered: true }));
    expect(shouldShowEnemyAlert(grid, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });

  it('非怪物格（empty） → false', () => {
    const grid = makeAlertGrid(makeAlertCell(1, 1, 'empty', { discovered: true }));
    expect(shouldShowEnemyAlert(grid, { x: 1, y: 1 }, { x: 1, y: 1 })).toBe(false);
  });

  it('越界坐标 → false', () => {
    const grid = makeAlertGrid(makeAlertCell(1, 1, 'monster', { discovered: true }));
    // (5,5) 越界（5×5 网格索引 0~4）
    expect(shouldShowEnemyAlert(grid, { x: 5, y: 5 }, { x: 1, y: 1 })).toBe(false);
  });

  it('曼哈顿距离计算：斜向距离正确', () => {
    const grid = makeAlertGrid(makeAlertCell(2, 2, 'monster', { discovered: true }));
    // 玩家在 (1,1)，曼哈顿距离=|2-1|+|2-1|=2 ≤ 2 → true
    expect(shouldShowEnemyAlert(grid, { x: 2, y: 2 }, { x: 1, y: 1 })).toBe(true);
    // 玩家在 (0,0)，曼哈顿距离=4 > 2 → false
    expect(shouldShowEnemyAlert(grid, { x: 2, y: 2 }, { x: 0, y: 0 })).toBe(false);
  });
});

describe('generateGrid 阶段四：Boss 封印标记', () => {
  it('生成的网格中 Boss 格 sealed=true', () => {
    const rng = createSeededRng(42);
    const grid = generateGrid(makeGridConfig({ size: 5 }), rng);
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type === 'boss') {
          expect(cell.sealed).toBe(true);
        }
      }
    }
  });

  it('非 Boss 格 sealed 不为 true', () => {
    const rng = createSeededRng(42);
    const grid = generateGrid(makeGridConfig({ size: 5 }), rng);
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type !== 'boss') {
          expect(cell.sealed).not.toBe(true);
        }
      }
    }
  });
});

describe('generateGrid 阶段四：陷阱视觉线索标记', () => {
  it('陷阱格 hint 字段为 true 或 undefined（按概率标记）', () => {
    // 大网格 + 高 trap 概率，确保有足够 trap 格采样
    const rng = createSeededRng(2026);
    const grid = generateGrid(makeGridConfig({
      size: 10,
      eventProbability: makeProbability({
        monster: 0, item: 0, trap: 80, event: 0, empty: 20,
      }),
    }), rng);

    const trapCells = grid.flat().filter(c => c.type === 'trap');
    expect(trapCells.length).toBeGreaterThan(0);
    // 每个 trap 格 hint 只能是 true 或 undefined（markTrapHints 仅在命中概率时设 true）
    for (const cell of trapCells) {
      expect(cell.hint === true || cell.hint === undefined).toBe(true);
    }
  });

  it('非陷阱格 hint 不为 true', () => {
    const rng = createSeededRng(2026);
    const grid = generateGrid(makeGridConfig({ size: 5 }), rng);
    for (const row of grid) {
      for (const cell of row) {
        if (cell.type !== 'trap') {
          expect(cell.hint).not.toBe(true);
        }
      }
    }
  });

  it('大样本下 hint=true 比例近似 TRAP_HINT_PROBABILITY', () => {
    // 统计多个种子的 trap 格 hint 比例，验证概率配置生效
    let totalTraps = 0;
    let hintedTraps = 0;
    for (let seed = 0; seed < 20; seed++) {
      const rng = createSeededRng(seed);
      const grid = generateGrid(makeGridConfig({
        size: 10,
        eventProbability: makeProbability({
          monster: 0, item: 0, trap: 80, event: 0, empty: 20,
        }),
      }), rng);
      for (const row of grid) {
        for (const cell of row) {
          if (cell.type === 'trap') {
            totalTraps++;
            if (cell.hint === true) hintedTraps++;
          }
        }
      }
    }
    expect(totalTraps).toBeGreaterThan(50); // 确保样本足够
    const ratio = hintedTraps / totalTraps;
    // 允许 ±0.15 误差（小样本统计波动）
    expect(ratio).toBeGreaterThan(TRAP_HINT_PROBABILITY - 0.15);
    expect(ratio).toBeLessThan(TRAP_HINT_PROBABILITY + 0.15);
  });
});

describe('generateRandomEvent 区域专属事件混合（阶段四）', () => {
  /** 构造 mock 区域专属事件模板 */
  function makeMockAreaEvents(): AreaEventTemplate[] {
    return [
      (lv) => ({
        message: `区域专属事件 lv${lv}`,
        icon: 'game-icons:test',
        effect: { type: 'exp', amount: lv * 10 },
      }),
    ];
  }

  it('areaEvents 为空时走通用事件（向后兼容）', () => {
    // mockReturnValue(0.1)：areaEvents 为空时短路不消耗 rng，第一次 next()=0.1 < 0.3 → heal
    vi.spyOn(Math, 'random').mockReturnValue(0.1);
    const result = generateRandomEvent(5, undefined, []);
    expect(result.effect.type).toBe('heal');
    expect(result.message).toContain('生命值');
  });

  it('areaEvents 非空且命中混合概率时返回区域专属事件', () => {
    // mockReturnValue(0.3)：第一次 next()=0.3 < AREA_EVENT_MIX_PROBABILITY(0.5) → 走区域事件
    // rng.pick(areaEvents) 调用 random()=0.3，单元素数组直接返回该元素
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const result = generateRandomEvent(5, undefined, makeMockAreaEvents());
    expect(result.message).toBe('区域专属事件 lv5');
    expect(result.effect.type).toBe('exp');
    expect(result.effect.amount).toBe(50);
  });

  it('areaEvents 非空但未命中混合概率时走通用事件', () => {
    // mockReturnValue(0.6)：第一次 next()=0.6 ≥ 0.5 → 不走区域事件
    // 第二次 next()=0.6 → 0.5 ≤ 0.6 < 0.65 → exp 通用事件
    vi.spyOn(Math, 'random').mockReturnValue(0.6);
    const result = generateRandomEvent(5, undefined, makeMockAreaEvents());
    expect(result.effect.type).toBe('exp');
    expect(result.message).toContain('经验值');
    // 确保不是区域专属事件
    expect(result.message).not.toContain('区域专属事件');
  });

  it('区域专属事件复用 RandomEventResult 结构（含 message/icon/effect）', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.3);
    const result = generateRandomEvent(3, undefined, makeMockAreaEvents());
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);
    expect(typeof result.icon).toBe('string');
    expect(result.effect).toHaveProperty('type');
    expect(result.effect).toHaveProperty('amount');
    expect(Number.isInteger(result.effect.amount)).toBe(true);
  });

  it('混合概率边界：next() 恰好等于 AREA_EVENT_MIX_PROBABILITY 时不走区域事件', () => {
    // next() < AREA_EVENT_MIX_PROBABILITY 才走区域事件，等于时不走
    vi.spyOn(Math, 'random').mockReturnValue(AREA_EVENT_MIX_PROBABILITY);
    const result = generateRandomEvent(5, undefined, makeMockAreaEvents());
    // 走通用事件：0.5 ≤ 0.5 < 0.65 → exp
    expect(result.effect.type).toBe('exp');
    expect(result.message).toContain('经验值');
  });
});
