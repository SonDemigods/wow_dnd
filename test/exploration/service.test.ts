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
  GRID_SIZE,
} from '@/modules/exploration/service';
import type { GridEventProbability, GridGenerationConfig } from '@/modules/exploration/types';
import {
  CAMP_HEAL_HP,
  CAMP_HEAL_MANA,
  TRAP_DAMAGE_BASE,
  TRAP_DAMAGE_MIN,
  ITEM_POOL_FALLBACK_ID,
  HIDDEN_ROOM_MIN_COUNT,
  HIDDEN_ROOM_MAX_COUNT,
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

  it('隐藏房间在相邻格被探索后揭示', () => {
    const grid: import('@/modules/exploration/types').ExplorationCell[][] = [
      [
        { x: 0, y: 0, type: 'start', explored: true, accessible: true, visited: true },
        { x: 1, y: 0, type: 'treasure', explored: false, accessible: false, visited: false, hidden: true },
      ],
    ];
    const newGrid = updateAccessibleCells(grid);
    expect(newGrid[0][1].hidden).toBe(false);
    expect(newGrid[0][1].explored).toBe(true);
  });

  it('对角相邻也算相邻（8 邻域）', () => {
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
    // (0,0) 已探索 → (1,0)、(0,1)、(1,1) 都应可访问
    expect(newGrid[0][1].accessible).toBe(true);
    expect(newGrid[1][0].accessible).toBe(true);
    expect(newGrid[1][1].accessible).toBe(true);
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
