/**
 * @fileoverview 探索模块纯函数层
 * @description 提供探索相关的纯计算函数，不持有状态、不调用 DB、不 emit 事件
 * @module exploration
 */
import type { GridEventType, GridEventProbability, ExplorationCell, RandomEventResult, MultiOptionEventResult, GridGenerationConfig, CellType } from './types';
import { defaultRng, type Rng } from '@/utils/rng';
import {
  GRID_SIZE,
  MONSTER_PROBABILITY_BASE,
  MONSTER_PROBABILITY_LEVEL_COEFFICIENT,
  MONSTER_PROBABILITY_MAX,
  ITEM_PROBABILITY_BASE,
  ITEM_PROBABILITY_LEVEL_COEFFICIENT,
  ITEM_PROBABILITY_MIN,
  TRAP_PROBABILITY_BASE,
  TRAP_PROBABILITY_LEVEL_COEFFICIENT,
  TRAP_PROBABILITY_MAX,
  EVENT_PROBABILITY,
  EMPTY_PROBABILITY_BASE,
  EMPTY_PROBABILITY_LEVEL_COEFFICIENT,
  EMPTY_PROBABILITY_MIN,
  PROBABILITY_NORMALIZATION_BASE,
  CAMP_HEAL_HP,
  CAMP_HEAL_MANA,
  TRAP_DAMAGE_BASE,
  TRAP_DAMAGE_VARIANCE,
  TRAP_DAMAGE_MIN,
  RANDOM_EVENT_HEAL_THRESHOLD,
  RANDOM_EVENT_MANA_THRESHOLD,
  RANDOM_EVENT_EXP_THRESHOLD,
  RANDOM_EVENT_DAMAGE_THRESHOLD,
  RANDOM_EVENT_MP_LOSS_THRESHOLD,
  HEAL_AMOUNT_LEVEL_COEFFICIENT,
  HEAL_AMOUNT_RANDOM_MAX,
  MANA_AMOUNT_LEVEL_COEFFICIENT,
  MANA_AMOUNT_RANDOM_MAX,
  EXP_AMOUNT_LEVEL_COEFFICIENT,
  EXP_AMOUNT_RANDOM_MAX,
  DAMAGE_AMOUNT_LEVEL_COEFFICIENT,
  DAMAGE_AMOUNT_RANDOM_MAX,
  MP_LOSS_LEVEL_COEFFICIENT,
  MP_LOSS_RANDOM_MAX,
  GOLD_AMOUNT_LEVEL_COEFFICIENT,
  GOLD_AMOUNT_RANDOM_MAX,
  ITEM_POOL_DEFAULT_MAX_SIZE,
  ITEM_POOL_FALLBACK_ID,
  RARITY_LEVEL_MAP,
  HIDDEN_ROOM_MIN_COUNT,
  HIDDEN_ROOM_MAX_COUNT
} from '@/config/exploration';

/**
 * 默认网格尺寸（从 @/config/exploration 导入并 re-export，保持向后兼容）
 *
 * 原本在 service.ts 中硬编码，CODE-53 修复后迁移到 config 集中管理。
 * 现有代码 `import { GRID_SIZE } from './service'` 无需修改。
 */
export { GRID_SIZE };

/** GridEventType → CellType 映射表 */
export const EVENT_TO_CELL_TYPE: Record<GridEventType, CellType> = {
  monster: 'monster',
  item: 'treasure',
  trap: 'trap',
  event: 'event',
  empty: 'empty',
  camp: 'rest',
  shop: 'shop',
  board: 'board',
  boss: 'boss',
};

/**
 * 从数组中随机选取一个元素
 * @param arr - 候选数组
 * @param rng - 随机数生成器，默认使用基于 Math.random 的 defaultRng
 * @returns 随机元素；数组为空时返回 undefined
 */
export function pickRandomFromArray<T>(arr: T[], rng: Rng = defaultRng): T | undefined {
  if (arr.length === 0) return undefined;
  return rng.pick(arr);
}

// ============================================================
// 导出：区域配置构建纯函数
// ============================================================

/**
 * 根据地点等级动态生成事件概率分布。
 *
 * 设计意图：高等级区域怪物/陷阱概率更高，低等级区域物品/空地概率更高，
 * 从而自然地调节难度曲线。
 *
 * @param avgLevel - 区域平均等级
 * @returns 归一化后的事件概率分布（五项之和恒为 100）
 */
export function computeEventProbability(avgLevel: number): GridEventProbability {
  const raw: GridEventProbability = {
    monster: Math.min(MONSTER_PROBABILITY_MAX, MONSTER_PROBABILITY_BASE + MONSTER_PROBABILITY_LEVEL_COEFFICIENT * avgLevel),
    item: Math.max(ITEM_PROBABILITY_MIN, ITEM_PROBABILITY_BASE - ITEM_PROBABILITY_LEVEL_COEFFICIENT * avgLevel),
    trap: Math.min(TRAP_PROBABILITY_MAX, TRAP_PROBABILITY_BASE + TRAP_PROBABILITY_LEVEL_COEFFICIENT * avgLevel),
    event: EVENT_PROBABILITY,
    empty: Math.max(EMPTY_PROBABILITY_MIN, EMPTY_PROBABILITY_BASE - EMPTY_PROBABILITY_LEVEL_COEFFICIENT * avgLevel)
  };
  // 归一化：因各项独立 clamp，原始总和可能偏离 100，此处重新调整为百分比
  const total = raw.monster + raw.item + raw.trap + raw.event + raw.empty;
  raw.monster = Math.round(raw.monster / total * PROBABILITY_NORMALIZATION_BASE);
  raw.item = Math.round(raw.item / total * PROBABILITY_NORMALIZATION_BASE);
  raw.trap = Math.round(raw.trap / total * PROBABILITY_NORMALIZATION_BASE);
  raw.event = Math.round(raw.event / total * PROBABILITY_NORMALIZATION_BASE);
  // 最后一项用减法消除舍入误差，确保总和恰好为 100
  raw.empty = PROBABILITY_NORMALIZATION_BASE - raw.monster - raw.item - raw.trap - raw.event;
  return raw;
}

/**
 * 根据地点等级筛选合适的物品池（纯函数）
 * @param allItems - 所有物品模板（含 level/rarity 字段的对象）
 * @param minLevel - 区域最低等级
 * @param maxLevel - 区域最高等级
 * @param maxPoolSize - 物品池最大数量
 * @param rng - 随机数生成器，默认使用基于 Math.random 的 defaultRng
 * @returns 筛选后的物品ID列表
 */
export function buildItemPool(
  allItems: Array<{ id: string; level?: number; rarity: string }>,
  minLevel: number,
  maxLevel: number,
  maxPoolSize: number = ITEM_POOL_DEFAULT_MAX_SIZE,
  rng: Rng = defaultRng
): string[] {
  const suitableItems = allItems.filter(item => {
    const itemLevel = item.level ?? RARITY_LEVEL_MAP[item.rarity] ?? 0;
    return itemLevel >= minLevel - 1 && itemLevel <= maxLevel + 2;
  });
  // BIZ-8：使用 Fisher-Yates 洗牌算法，避免 sort(random) 分布不均匀
  // rng.shuffle 返回新数组，不修改原数组，与原手动洗牌行为一致
  const shuffled = rng.shuffle(suitableItems);
  const pool = shuffled.slice(0, maxPoolSize).map(item => item.id);
  // 如果没有合适的物品，至少提供基础药水
  if (pool.length === 0) {
    pool.push(ITEM_POOL_FALLBACK_ID);
  }
  return pool;
}

// ============================================================
// 导出：纯计算函数
// ============================================================

/**
 * 根据概率分布随机选择探索事件类型。
 *
 * 使用累积概率区间法：将 [0, total) 区间按各项概率切分为连续的桶，
 * 随机值落在哪个桶就返回对应事件类型。相比轮盘赌算法更简洁。
 *
 * @param probability - 事件概率配置（五项之和为 100）
 * @param rng - 随机数生成器，默认使用基于 Math.random 的 defaultRng
 * @returns 选中的事件类型
 */
export function determineCellEvent(probability: GridEventProbability, rng: Rng = defaultRng): GridEventType {
  const total = probability.monster + probability.item + probability.trap + probability.event + probability.empty;
  let random = rng.next() * total;

  // 按顺序检查累积概率区间
  if (random < probability.monster) return 'monster';
  random -= probability.monster;
  if (random < probability.item) return 'item';
  random -= probability.item;
  if (random < probability.trap) return 'trap';
  random -= probability.trap;
  if (random < probability.event) return 'event';
  // 剩余部分全部归为 empty
  return 'empty';
}

/**
 * 根据区域等级计算陷阱伤害值
 * @param areaLevel - 区域等级
 * @param rng - 随机数生成器，默认使用基于 Math.random 的 defaultRng
 * @returns 伤害值（最小为1）
 */
export function generateTrapDamage(areaLevel: number, rng: Rng = defaultRng): number {
  const baseDamage = areaLevel * TRAP_DAMAGE_BASE;
  const variance = (rng.next() - 0.5) * TRAP_DAMAGE_VARIANCE;
  return Math.max(TRAP_DAMAGE_MIN, Math.floor(baseDamage + variance));
}

/**
 * 计算营地恢复量（完全恢复，由角色模块根据自身上限处理）
 * @param _areaLevel - 区域等级（暂未使用，保留以保持接口一致性）
 * @returns 恢复量（hp 和 mana 均为最大值，由调用方根据上限裁剪）
 */
export function generateCampHeal(_areaLevel: number): { hp: number; mana: number } {
  return { hp: CAMP_HEAL_HP, mana: CAMP_HEAL_MANA };
}

/**
 * 从物品池中随机选取一个物品（委托给通用随机选取函数）
 * @param itemPool - 可用的物品 ID 列表
 * @returns 选中的物品 ID，池为空时返回空字符串
 */
export function generateItemForCell(itemPool: string[]): string {
  return pickRandomFromArray(itemPool) ?? '';
}

/**
 * 从怪物池中随机选取一个怪物（委托给通用随机选取函数）
 * @param monsterPool - 可用的怪物 ID 列表
 * @returns 选中的怪物 ID，池为空时返回空字符串
 */
export function generateEnemyForCell(monsterPool: string[], rng: Rng = defaultRng): string {
  return pickRandomFromArray(monsterPool, rng) ?? '';
}



/**
 * 生成随机事件（纯计算，不含副作用）。
 *
 * 采用累进概率区间分布：每个分支检查 [0, 1) 中的特定区间，
 * 区间大小即为该事件的触发概率。分支按概率从高到低排列，
 * 最后一个分支作为兜底。
 *
 * @param areaLevel - 区域等级
 * @param rng - 随机数生成器，默认使用基于 Math.random 的 defaultRng
 * @returns 随机事件的结果，包含消息、图标和效果
 */
export function generateRandomEvent(areaLevel: number, rng: Rng = defaultRng): RandomEventResult {
  const random = rng.next();

  // [0, 0.3) → 30% 概率恢复生命值
  if (random < RANDOM_EVENT_HEAL_THRESHOLD) {
    const healAmount = Math.floor(areaLevel * HEAL_AMOUNT_LEVEL_COEFFICIENT + rng.next() * HEAL_AMOUNT_RANDOM_MAX);
    return {
      message: `发现神秘泉水，恢复了 ${healAmount} 点生命值`,
      icon: 'game-icons:water-drop',
      effect: { type: 'heal', amount: healAmount }
    };
  }
  // [0.3, 0.5) → 20% 概率恢复魔法值
  if (random < RANDOM_EVENT_MANA_THRESHOLD) {
    const mpAmount = Math.floor(areaLevel * MANA_AMOUNT_LEVEL_COEFFICIENT + rng.next() * MANA_AMOUNT_RANDOM_MAX);
    return {
      message: `发现魔法水晶，恢复了 ${mpAmount} 点魔法值`,
      icon: 'game-icons:emerald',
      effect: { type: 'mana', amount: mpAmount }
    };
  }
  // [0.5, 0.65) → 15% 概率获得经验值
  if (random < RANDOM_EVENT_EXP_THRESHOLD) {
    const expAmount = Math.floor(areaLevel * EXP_AMOUNT_LEVEL_COEFFICIENT + rng.next() * EXP_AMOUNT_RANDOM_MAX);
    return {
      message: `发现古代石碑，获得了 ${expAmount} 点经验值`,
      icon: 'game-icons:spell-book',
      effect: { type: 'exp', amount: expAmount }
    };
  }
  // [0.65, 0.8) → 15% 概率受到陷阱伤害
  if (random < RANDOM_EVENT_DAMAGE_THRESHOLD) {
    const trapDamage = Math.floor(areaLevel * DAMAGE_AMOUNT_LEVEL_COEFFICIENT + rng.next() * DAMAGE_AMOUNT_RANDOM_MAX);
    return {
      message: `触发了隐藏陷阱，受到 ${trapDamage} 点伤害`,
      icon: 'game-icons:caltrops',
      effect: { type: 'damage', amount: trapDamage }
    };
  }
  // [0.8, 0.9) → 10% 概率损失魔法值
  if (random < RANDOM_EVENT_MP_LOSS_THRESHOLD) {
    const mpLoss = Math.floor(areaLevel * MP_LOSS_LEVEL_COEFFICIENT + rng.next() * MP_LOSS_RANDOM_MAX);
    return {
      message: `遭遇魔法干扰，损失了 ${mpLoss} 点魔法值`,
      icon: 'game-icons:magic-swirl',
      effect: { type: 'mpLoss', amount: mpLoss }
    };
  }
  // [0.9, 1.0) → 10% 概率获得金币
  const goldAmount = Math.floor(areaLevel * GOLD_AMOUNT_LEVEL_COEFFICIENT + rng.next() * GOLD_AMOUNT_RANDOM_MAX);
  return {
    message: `发现宝箱，获得了 ${goldAmount} 金币`,
    icon: 'game-icons:two-coins',
    effect: { type: 'gold', amount: goldAmount }
  };
}

// ============================================================
// 多选项事件
// ============================================================

/**
 * 多选项事件模板
 *
 * 每个模板为函数，接收 areaLevel 和 rng 返回完整的事件描述与选项列表。
 * 选项设计遵循风险/收益权衡原则：高收益选项附带风险，安全选项收益较低。
 * 模板签名统一接收 rng 参数，确保所有随机性均可注入确定性源。
 */
const multiOptionEventTemplates: Array<(areaLevel: number, rng: Rng) => MultiOptionEventResult> = [
  // 神秘祭坛：献祭 HP 换取经验，或直接离开
  (lv) => ({
    message: '发现一座古老祭坛，表面泛着幽幽蓝光',
    icon: 'game-icons:altar',
    choices: [
      { label: '触碰祭坛（献祭生命换取经验）', icon: 'game-icons:bleeding-heart', effect: { type: 'exp', amount: lv * 15 + 20 } },
      { label: '安全离开', icon: 'game-icons:walk', effect: { type: 'heal', amount: lv * 2 } },
    ],
  }),
  // 宝箱守卫：战斗风险 vs 高额金币
  (lv) => ({
    message: '路边宝箱散发着诱人光芒，但隐约听到守护兽的呼吸声',
    icon: 'game-icons:treasure-map',
    choices: [
      { label: '强行开启（可能受伤但金币更多）', icon: 'game-icons:two-coins', effect: { type: 'gold', amount: lv * 12 + 25 } },
      { label: '悄悄拿走少量金币', icon: 'game-icons:coin', effect: { type: 'gold', amount: lv * 4 + 5 } },
    ],
  }),
  // 魔法卷轴：恢复 MP 或获得经验
  (lv) => ({
    message: '地上散落着几张魔法卷轴，墨迹未干',
    icon: 'game-icons:scroll-unfurled',
    choices: [
      { label: '诵读卷轴恢复法力', icon: 'game-icons:emerald', effect: { type: 'mana', amount: lv * 3 + 10 } },
      { label: '研究卷轴获取经验', icon: 'game-icons:spell-book', effect: { type: 'exp', amount: lv * 8 + 10 } },
    ],
  }),
  // 黑色药水：未知效果
  (lv, rng) => ({
    message: '发现一瓶冒着黑烟的神秘药水',
    icon: 'game-icons:potion-ball',
    choices: [
      { label: '勇敢饮下（可能恢复或受伤）', icon: 'game-icons:drink-me', effect: { type: rng.bool(0.5) ? 'heal' : 'damage', amount: lv * 4 + 8 } },
      { label: '丢弃药水', icon: 'game-icons:trash', effect: { type: 'exp', amount: lv * 2 } },
    ],
  }),
];

/**
 * 生成多选项事件（纯计算，不含副作用）
 *
 * 从模板池中随机选取一个模板，根据区域等级生成具体的事件数据。
 * 多选项事件让玩家做出策略性选择，每个选项有不同的风险/收益。
 *
 * @param areaLevel - 区域等级
 * @param rng - 随机数生成器，默认使用基于 Math.random 的 defaultRng
 * @returns 多选项事件结果
 */
export function generateMultiOptionEvent(areaLevel: number, rng: Rng = defaultRng): MultiOptionEventResult {
  const template = rng.pick(multiOptionEventTemplates);
  return template(areaLevel, rng);
}

// ============================================================
// 导出：网格生成纯函数
// ============================================================

/**
 * 生成完整的探索网格（纯函数）
 * 随机生成指定尺寸的探索网格，放置起点、商店、任务板、营地和 BOSS 等固定事件，
 * 并根据区域配置的概率分布随机填充怪物、物品、陷阱等事件格子。
 * @param config - 网格生成配置
 * @param rng - 随机数生成器，默认使用基于 Math.random 的 defaultRng
 * @returns 完整的探索网格二维数组
 */
export function generateGrid(config: GridGenerationConfig, rng: Rng = defaultRng): ExplorationCell[][] {
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
  placeFixedEvents(grid, size, config.bossPool, rng);

  // 收集所有空格子坐标
  const emptyCells: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x].type === 'empty') {
        emptyCells.push({ x, y });
      }
    }
  }

  // 打乱空格子顺序（rng.shuffle 返回新数组）
  const shuffledEmptyCells = rng.shuffle(emptyCells);

  let cellIndex = 0;

  // 第一步：优先放置任务所需的怪物
  for (const monsterId of config.questNormalMonsters) {
    if (cellIndex >= shuffledEmptyCells.length) break;
    const pos = shuffledEmptyCells[cellIndex];
    grid[pos.y][pos.x] = { x: pos.x, y: pos.y, type: 'monster', explored: false, accessible: false, visited: false, completed: false, monsterId };
    cellIndex++;
  }

  // 第二步：对剩余空格子按概率随机分配事件类型
  const probability = config.eventProbability;
  const monsterPool = config.monsterPool;
  for (let i = cellIndex; i < shuffledEmptyCells.length; i++) {
    const pos = shuffledEmptyCells[i];
    const eventType = determineCellEvent(probability, rng);

    const cellType: CellType = EVENT_TO_CELL_TYPE[eventType];
    let cellMonsterId: string | undefined;
    if (eventType === 'monster' && monsterPool.length > 0) {
      cellMonsterId = generateEnemyForCell(monsterPool, rng);
    }

    grid[pos.y][pos.x] = { x: pos.x, y: pos.y, type: cellType, explored: false, accessible: false, visited: false, completed: false, monsterId: cellMonsterId };
  }

  // 第三步：随机选取 2~3 个宝箱格标记为隐藏房间（含更丰厚奖励，相邻格探索后揭示）
  markHiddenRooms(grid, size, rng);

  return grid;
}

/**
 * 随机将 2~3 个宝箱格子标记为隐藏房间
 *
 * 隐藏房间在生成时不可见、不可访问，当任意相邻格被探索后自动揭示。
 * 隐藏房间通常包含更高等级的物品奖励，鼓励玩家探索地图边缘。
 *
 * @param grid - 探索网格
 * @param size - 网格尺寸
 * @param rng - 随机数生成器
 */
function markHiddenRooms(grid: ExplorationCell[][], size: number, rng: Rng): void {
  const treasureCells: { x: number; y: number }[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x].type === 'treasure' && !grid[y][x].visited) {
        treasureCells.push({ x, y });
      }
    }
  }

  // 打乱顺序（rng.shuffle 返回新数组，不修改原数组）
  const shuffled = rng.shuffle(treasureCells);

  // 标记 2~3 个为隐藏（不超过宝箱总数）
  const hiddenCount = Math.min(
    shuffled.length,
    rng.int(HIDDEN_ROOM_MIN_COUNT, HIDDEN_ROOM_MAX_COUNT)
  );
  for (let i = 0; i < hiddenCount; i++) {
    const { x, y } = shuffled[i];
    grid[y][x].hidden = true;
    grid[y][x].explored = false;
    grid[y][x].accessible = false;
  }
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
  // [性能敏感] 对 8x8 网格（64 个 cell）做全文浅拷贝，每次状态更新都触发。
  // 当前规模下开销可接受（~0.1ms 级别）。若未来扩展至 16x16（256 cell）以上，
  // 可考虑改为按需更新（dirty flag + 仅更新变化的 cell）。
  const newGrid: ExplorationCell[][] = grid.map(row => row.map(cell => ({ ...cell })));

  // 揭示隐藏房间：当任意相邻格已被探索时，隐藏房间变为可见
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < colSize; x++) {
      if (newGrid[y][x].hidden && !newGrid[y][x].explored) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = x + dx;
            const ny = y + dy;
            if (nx >= 0 && nx < colSize && ny >= 0 && ny < size && newGrid[ny][nx].explored) {
              // 相邻格已探索，揭示隐藏房间
              newGrid[y][x].hidden = false;
              newGrid[y][x].explored = true;
              break;
            }
          }
          if (!newGrid[y][x].hidden) break;
        }
      }
    }
  }

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

/**
 * 获取网格所有边缘坐标（四条边的并集，不含重复角）。
 * 用于随机放置起点——起点必须在网格边缘，玩家从边界进入地图。
 */
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

/**
 * 查找一个不与任何已占用位置相邻的空位。
 * 用于放置营地——营地应与其他固定事件保持一定距离，
 * 避免起点/商店/任务板紧挨着营地。
 *
 * @param rng - 随机数生成器，用于从候选位置中随机选取
 */
function findNonAdjacentPosition(grid: ExplorationCell[][], size: number, occupiedPositions: { x: number; y: number }[], rng: Rng): { x: number; y: number } {
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
  return rng.pick(candidates);
}

/**
 * 在中心区域查找适合放置 Boss 的位置。
 * Boss 需与所有已有固定事件保持至少 2 格的切比雪夫距离，
 * 且限定在网格中央 1/4～3/4 区域，确保玩家需要探索一定深度才能遭遇。
 *
 * @param rng - 随机数生成器，用于从候选位置中随机选取
 */
function findBossPosition(grid: ExplorationCell[][], size: number, occupiedPositions: { x: number; y: number }[], rng: Rng): { x: number; y: number } {
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
  return rng.pick(candidates);
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

/**
 * 在网格上放置固定事件：起点、商店、任务板、营地、Boss。
 *
 * 放置策略：
 * 1. 起点 — 随机边缘位置（玩家从边界进入）
 * 2. 商店 — 随机角落（方便随时访问）
 * 3. 任务板 — 另一随机角落
 * 4. 营地 — 不与上述三者相邻的空位
 * 5. Boss — 中心区域，与其他事件保持距离
 *
 * @param rng - 随机数生成器，用于所有随机选取
 */
function placeFixedEvents(grid: ExplorationCell[][], size: number, bossPool: string[], rng: Rng): void {
  // 起点：随机选一个边缘位置，已探索、已访问、可访问
  const edgePositions = getEdgePositions(size);
  const startPos = rng.pick(edgePositions);
  grid[startPos.y][startPos.x] = {
    x: startPos.x, y: startPos.y,
    type: 'start', explored: true, accessible: true, visited: true, completed: false
  };

  // 商店 + 任务板：放置在两个不同的角落，默认可见
  const corners = [[0, 0], [0, size - 1], [size - 1, 0], [size - 1, size - 1]];
  const availableCorners = corners.filter(c => !isOccupied(grid, c[0], c[1]));

  // 保留索引用于 splice 移除已选角落
  const shopCornerIndex = rng.int(0, availableCorners.length - 1);
  const shopPos = availableCorners[shopCornerIndex];
  grid[shopPos[1]][shopPos[0]] = {
    x: shopPos[0], y: shopPos[1],
    type: 'shop', explored: true, accessible: true, visited: true, completed: false
  };
  availableCorners.splice(shopCornerIndex, 1);

  const boardPos = rng.pick(availableCorners);
  grid[boardPos[1]][boardPos[0]] = {
    x: boardPos[0], y: boardPos[1],
    type: 'board', explored: true, accessible: true, visited: true, completed: false
  };

  // 营地：放置在非相邻位置
  const campPos = findNonAdjacentPosition(grid, size, [startPos, { x: shopPos[0], y: shopPos[1] }, { x: boardPos[0], y: boardPos[1] }], rng);
  grid[campPos.y][campPos.x] = {
    x: campPos.x, y: campPos.y,
    type: 'rest', explored: false, accessible: false, visited: false, completed: false
  };

  // Boss：放置在中心区域
  const bossPos = findBossPosition(grid, size, [startPos, { x: shopPos[0], y: shopPos[1] }, { x: boardPos[0], y: boardPos[1] }, campPos], rng);
  const bossMonsterId = bossPool.length > 0 ? rng.pick(bossPool) : undefined;
  grid[bossPos.y][bossPos.x] = {
    x: bossPos.x, y: bossPos.y,
    type: 'boss', explored: false, accessible: false, visited: false, completed: false, monsterId: bossMonsterId
  };
}
