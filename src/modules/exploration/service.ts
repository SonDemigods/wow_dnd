/**
 * @fileoverview 探索模块纯函数层
 * @description 提供探索相关的纯计算函数，不持有状态、不调用 DB、不 emit 事件
 * @module exploration
 */
import type { GridEventType, GridEventProbability, ExplorationCell, RandomEventResult, GridGenerationConfig } from './types';

/** 默认网格尺寸 */
const GRID_SIZE = 10;

// ============================================================
// 导出：区域配置构建纯函数
// ============================================================

/**
 * 根据地点等级动态生成事件概率分布
 * @param avgLevel - 区域平均等级
 * @returns 归一化后的事件概率分布
 */
export function computeEventProbability(avgLevel: number): GridEventProbability {
  const raw: GridEventProbability = {
    monster: Math.min(30, 20 + avgLevel),
    item: Math.max(15, 25 - avgLevel),
    trap: Math.min(22, 12 + avgLevel),
    event: 15,
    empty: Math.max(15, 30 - avgLevel)
  };
  // 归一化确保总和为 100
  const total = raw.monster + raw.item + raw.trap + raw.event + raw.empty;
  raw.monster = Math.round(raw.monster / total * 100);
  raw.item = Math.round(raw.item / total * 100);
  raw.trap = Math.round(raw.trap / total * 100);
  raw.event = Math.round(raw.event / total * 100);
  raw.empty = 100 - raw.monster - raw.item - raw.trap - raw.event;
  return raw;
}

/**
 * 根据地点等级筛选合适的物品池（纯函数）
 * @param allItems - 所有物品模板（含 level/rarity 字段的对象）
 * @param minLevel - 区域最低等级
 * @param maxLevel - 区域最高等级
 * @param maxPoolSize - 物品池最大数量
 * @returns 筛选后的物品ID列表
 */
export function buildItemPool(
  allItems: Array<{ id: string; level?: number; rarity: string }>,
  minLevel: number,
  maxLevel: number,
  maxPoolSize: number = 5
): string[] {
  const rarityLevelMap: Record<string, number> = { common: 1, uncommon: 3, rare: 5, epic: 7 };
  const suitableItems = allItems.filter(item => {
    const itemLevel = item.level ?? rarityLevelMap[item.rarity] ?? 0;
    return itemLevel >= minLevel - 1 && itemLevel <= maxLevel + 2;
  });
  // 随机打乱后取指定数量
  const shuffled = suitableItems.sort(() => Math.random() - 0.5);
  const pool = shuffled.slice(0, maxPoolSize).map(item => item.id);
  // 如果没有合适的物品，至少提供基础药水
  if (pool.length === 0) {
    pool.push('small_health_potion');
  }
  return pool;
}

// ============================================================
// 导出：纯计算函数
// ============================================================

/**
 * 根据概率分布随机选择探索事件类型
 * @param probability - 事件概率配置
 * @returns 选中的事件类型
 */
export function determineCellEvent(probability: GridEventProbability): GridEventType {
  const total = probability.monster + probability.item + probability.trap + probability.event + probability.empty;
  let random = Math.random() * total;

  if (random < probability.monster) return 'monster';
  random -= probability.monster;
  if (random < probability.item) return 'item';
  random -= probability.item;
  if (random < probability.trap) return 'trap';
  random -= probability.trap;
  if (random < probability.event) return 'event';
  return 'empty';
}

/**
 * 根据区域等级计算陷阱伤害值
 * @param areaLevel - 区域等级
 * @returns 伤害值（最小为1）
 */
export function generateTrapDamage(areaLevel: number): number {
  const baseDamage = areaLevel * 5;
  const variance = (Math.random() - 0.5) * 10;
  return Math.max(1, Math.floor(baseDamage + variance));
}

/**
 * 计算营地恢复量（完全恢复，由角色模块根据自身上限处理）
 * @param _areaLevel - 区域等级（暂未使用，保留以保持接口一致性）
 * @returns 恢复量（hp 和 mana 均为最大值，由调用方根据上限裁剪）
 */
export function generateCampHeal(_areaLevel: number): { hp: number; mana: number } {
  return { hp: 9999, mana: 9999 };
}

/**
 * 从物品池中随机选取一个物品
 * @param itemPool - 可用的物品 ID 列表
 * @returns 选中的物品 ID，池为空时返回空字符串
 */
export function generateItemForCell(itemPool: string[]): string {
  if (itemPool.length === 0) return '';
  return itemPool[Math.floor(Math.random() * itemPool.length)];
}

/**
 * 从怪物池中随机选取一个怪物
 * @param monsterPool - 可用的怪物 ID 列表
 * @returns 选中的怪物 ID，池为空时返回空字符串
 */
export function generateEnemyForCell(monsterPool: string[]): string {
  if (monsterPool.length === 0) return '';
  return monsterPool[Math.floor(Math.random() * monsterPool.length)];
}



/**
 * 生成随机事件（纯计算，不含副作用）
 * @param areaLevel - 区域等级
 * @returns 随机事件的结果，包含消息、图标和效果
 */
export function generateRandomEvent(areaLevel: number): RandomEventResult {
  const random = Math.random();

  // 30% 概率恢复生命值
  if (random < 0.3) {
    const healAmount = Math.floor(areaLevel * 3 + Math.random() * 10);
    return {
      message: `发现神秘泉水，恢复了 ${healAmount} 点生命值`,
      icon: '💧',
      effect: { type: 'heal', amount: healAmount }
    };
  }
  // 20% 概率恢复魔法值
  if (random < 0.5) {
    const mpAmount = Math.floor(areaLevel * 2 + Math.random() * 8);
    return {
      message: `发现魔法水晶，恢复了 ${mpAmount} 点魔法值`,
      icon: '💎',
      effect: { type: 'mana', amount: mpAmount }
    };
  }
  // 15% 概率获得经验值
  if (random < 0.65) {
    const expAmount = Math.floor(areaLevel * 10 + Math.random() * 20);
    return {
      message: `发现古代石碑，获得了 ${expAmount} 点经验值`,
      icon: '📚',
      effect: { type: 'exp', amount: expAmount }
    };
  }
  // 15% 概率减少生命值（陷阱）
  if (random < 0.8) {
    const trapDamage = Math.floor(areaLevel * 2 + Math.random() * 5);
    return {
      message: `触发了隐藏陷阱，受到 ${trapDamage} 点伤害`,
      icon: '⚠️',
      effect: { type: 'damage', amount: trapDamage }
    };
  }
  // 10% 概率减少魔法值
  if (random < 0.9) {
    const mpLoss = Math.floor(areaLevel * 1.5 + Math.random() * 5);
    return {
      message: `遭遇魔法干扰，损失了 ${mpLoss} 点魔法值`,
      icon: '🌀',
      effect: { type: 'mpLoss', amount: mpLoss }
    };
  }
  // 10% 概率获得金币
  const goldAmount = Math.floor(areaLevel * 5 + Math.random() * 15);
  return {
    message: `发现宝箱，获得了 ${goldAmount} 金币`,
    icon: '💰',
    effect: { type: 'gold', amount: goldAmount }
  };
}

// ============================================================
// 导出：网格生成纯函数
// ============================================================

/**
 * 生成完整的探索网格（纯函数）
 * 随机生成指定尺寸的探索网格，放置起点、商店、任务板、营地和 BOSS 等固定事件，
 * 并根据区域配置的概率分布随机填充怪物、物品、陷阱等事件格子。
 * @param config - 网格生成配置
 * @returns 完整的探索网格二维数组
 */
export function generateGrid(config: GridGenerationConfig): ExplorationCell[][] {
  const size = config.size ?? GRID_SIZE;

  // 初始化空网格
  const grid: ExplorationCell[][] = [];
  for (let y = 0; y < size; y++) {
    grid[y] = [];
    for (let x = 0; x < size; x++) {
      grid[y][x] = { x, y, type: 'empty', explored: false, accessible: false, visited: false, completed: false };
    }
  }

  // 放置固定事件（起点、商店、任务板、营地、Boss）
  placeFixedEvents(grid, size, config.bossPool);

  // 收集所有空格子坐标
  const emptyCells: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x].type === 'empty') {
        emptyCells.push({ x, y });
      }
    }
  }

  // 打乱空格子顺序
  for (let i = emptyCells.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [emptyCells[i], emptyCells[j]] = [emptyCells[j], emptyCells[i]];
  }

  let cellIndex = 0;

  // 第一步：优先放置任务所需的怪物
  for (const monsterId of config.questNormalMonsters) {
    if (cellIndex >= emptyCells.length) break;
    const pos = emptyCells[cellIndex];
    grid[pos.y][pos.x] = { x: pos.x, y: pos.y, type: 'monster', explored: false, accessible: false, visited: false, completed: false, monsterId };
    cellIndex++;
  }

  // 第二步：对剩余空格子按概率随机分配事件类型
  const probability = config.eventProbability;
  const monsterPool = config.monsterPool;
  for (let i = cellIndex; i < emptyCells.length; i++) {
    const pos = emptyCells[i];
    const eventType = determineCellEvent(probability);

    let cellType = 'empty';
    let cellMonsterId: string | undefined;
    switch (eventType) {
      case 'monster':
        cellType = 'monster';
        if (monsterPool.length > 0) {
          cellMonsterId = generateEnemyForCell(monsterPool);
        }
        break;
      case 'item':
        cellType = 'treasure';
        break;
      case 'trap':
        cellType = 'trap';
        break;
      case 'event':
        cellType = 'event';
        break;
    }

    grid[pos.y][pos.x] = { x: pos.x, y: pos.y, type: cellType, explored: false, accessible: false, visited: false, completed: false, monsterId: cellMonsterId };
  }

  return grid;
}

/**
 * 从生成的网格中找到起点位置
 * @param grid - 探索网格
 * @returns 起点坐标，未找到时返回 {0,0}
 */
export function findStartPosition(grid: ExplorationCell[][]): { x: number; y: number } {
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < (grid[0]?.length ?? 0); x++) {
      if (grid[y][x].type === 'start') {
        return { x, y };
      }
    }
  }
  return { x: 0, y: 0 };
}

/**
 * 更新网格中所有格子的可访问状态（返回新数组，不修改原数组）
 * 已探索格子周围的未探索格子标记为可访问
 * @param grid - 需要更新的网格
 * @returns 更新后的网格副本
 */
export function updateAccessibleCells(grid: ExplorationCell[][]): ExplorationCell[][] {
  const size = grid.length;
  const colSize = grid[0]?.length ?? 0;

  // 深拷贝网格
  const newGrid: ExplorationCell[][] = grid.map(row => row.map(cell => ({ ...cell })));

  // 先将所有未探索格子标记为不可访问
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < colSize; x++) {
      if (!newGrid[y][x].explored) {
        newGrid[y][x].accessible = false;
      }
    }
  }

  // 遍历所有已探索格子，将其周围未探索格子标记为可访问
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < colSize; x++) {
      if (newGrid[y][x].explored) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < colSize && ny >= 0 && ny < size && !newGrid[ny][nx].explored) {
              newGrid[ny][nx].accessible = true;
            }
          }
        }
      }
    }
  }

  return newGrid;
}

// ============================================================
// 内部辅助：网格生成工具函数
// ============================================================

/** 获取网格所有边缘坐标 */
function getEdgePositions(size: number): { x: number; y: number }[] {
  const positions: { x: number; y: number }[] = [];
  for (let x = 0; x < size; x++) positions.push({ x, y: 0 });
  for (let x = 0; x < size; x++) positions.push({ x, y: size - 1 });
  for (let y = 1; y < size - 1; y++) positions.push({ x: 0, y });
  for (let y = 1; y < size - 1; y++) positions.push({ x: size - 1, y });
  return positions;
}

/** 判断指定坐标是否已被占用 */
function isOccupied(grid: ExplorationCell[][], x: number, y: number): boolean {
  return grid[y][x].type !== 'empty';
}

/** 判断两个坐标是否相邻（含对角） */
function isAdjacent(pos1: { x: number; y: number }, pos2: { x: number; y: number }): boolean {
  return Math.abs(pos1.x - pos2.x) <= 1 && Math.abs(pos1.y - pos2.y) <= 1;
}

/** 计算两个坐标的切比雪夫距离 */
function getDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
  return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
}

/** 查找一个不与任何已占用位置相邻的空位 */
function findNonAdjacentPosition(grid: ExplorationCell[][], size: number, occupiedPositions: { x: number; y: number }[]): { x: number; y: number } {
  const candidates: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isOccupied(grid, x, y)) {
        const nonAdjacent = occupiedPositions.every(pos => !isAdjacent({ x, y }, pos));
        if (nonAdjacent) candidates.push({ x, y });
      }
    }
  }
  if (candidates.length === 0) return findAnyEmptyPosition(grid, size);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** 在中心区域查找适合放置 Boss 的位置（与其他位置保持至少2格距离） */
function findBossPosition(grid: ExplorationCell[][], size: number, occupiedPositions: { x: number; y: number }[]): { x: number; y: number } {
  const candidates: { x: number; y: number }[] = [];
  const centerStart = Math.floor(size / 4);
  const centerEnd = Math.floor(size * 3 / 4);
  for (let y = centerStart; y <= centerEnd; y++) {
    for (let x = centerStart; x <= centerEnd; x++) {
      if (!isOccupied(grid, x, y)) {
        const isFarEnough = occupiedPositions.every(pos => getDistance({ x, y }, pos) >= 2);
        if (isFarEnough) candidates.push({ x, y });
      }
    }
  }
  if (candidates.length === 0) return findAnyEmptyPosition(grid, size);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** 查找任意一个空位 */
function findAnyEmptyPosition(grid: ExplorationCell[][], size: number): { x: number; y: number } {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isOccupied(grid, x, y)) return { x, y };
    }
  }
  return { x: 0, y: 0 };
}

/** 在网格上放置固定事件：起点、商店、任务板、营地、Boss */
function placeFixedEvents(grid: ExplorationCell[][], size: number, bossPool: string[]): void {
  // 起点：随机选一个边缘位置，已探索、已访问、可访问
  const edgePositions = getEdgePositions(size);
  const startPos = edgePositions[Math.floor(Math.random() * edgePositions.length)];
  grid[startPos.y][startPos.x] = {
    x: startPos.x, y: startPos.y,
    type: 'start', explored: true, accessible: true, visited: true, completed: false
  };

  // 商店 + 任务板：放置在两个不同的角落，默认可见
  const corners = [[0, 0], [0, size - 1], [size - 1, 0], [size - 1, size - 1]];
  const availableCorners = corners.filter(c => !isOccupied(grid, c[0], c[1]));

  const shopCornerIndex = Math.floor(Math.random() * availableCorners.length);
  const shopPos = availableCorners[shopCornerIndex];
  grid[shopPos[1]][shopPos[0]] = {
    x: shopPos[0], y: shopPos[1],
    type: 'shop', explored: true, accessible: true, visited: true, completed: false
  };
  availableCorners.splice(shopCornerIndex, 1);

  const boardPos = availableCorners[Math.floor(Math.random() * availableCorners.length)];
  grid[boardPos[1]][boardPos[0]] = {
    x: boardPos[0], y: boardPos[1],
    type: 'board', explored: true, accessible: true, visited: true, completed: false
  };

  // 营地：放置在非相邻位置
  const campPos = findNonAdjacentPosition(grid, size, [startPos, { x: shopPos[0], y: shopPos[1] }, { x: boardPos[0], y: boardPos[1] }]);
  grid[campPos.y][campPos.x] = {
    x: campPos.x, y: campPos.y,
    type: 'rest', explored: false, accessible: false, visited: false, completed: false
  };

  // Boss：放置在中心区域
  const bossPos = findBossPosition(grid, size, [startPos, { x: shopPos[0], y: shopPos[1] }, { x: boardPos[0], y: boardPos[1] }, campPos]);
  const bossMonsterId = bossPool.length > 0 ? bossPool[Math.floor(Math.random() * bossPool.length)] : undefined;
  grid[bossPos.y][bossPos.x] = {
    x: bossPos.x, y: bossPos.y,
    type: 'boss', explored: false, accessible: false, visited: false, completed: false, monsterId: bossMonsterId
  };
}
