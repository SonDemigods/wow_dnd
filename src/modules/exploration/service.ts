/**
 * @fileoverview 探索模块纯函数层
 * @description 提供探索相关的纯计算函数，不持有状态、不调用 DB、不 emit 事件
 * @module exploration
 */
import type { GridEventType, GridEventProbability, ExplorationCell, RandomEventResult, MultiOptionEventResult, GridGenerationConfig, CellType, WallSet, AreaEventTemplate } from './types';
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
  HIDDEN_ROOM_MAX_COUNT,
  MAZE_WALL_DENSITY,
  MAZE_MAX_RETRY,
  VISION_RANGE,
  TRAP_HINT_PROBABILITY,
  ENEMY_ALERT_RANGE,
  AREA_EVENT_MIX_PROBABILITY
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
  // P10-014 修复：前四项使用 Math.floor（而非 Math.round），避免四项全部向上取整导致总和超过 100；
  // empty 用 100 减去四者之和兜底（已有 Math.max(0, ...) 保护，不会为负）
  raw.monster = Math.floor(raw.monster / total * PROBABILITY_NORMALIZATION_BASE);
  raw.item = Math.floor(raw.item / total * PROBABILITY_NORMALIZATION_BASE);
  raw.trap = Math.floor(raw.trap / total * PROBABILITY_NORMALIZATION_BASE);
  raw.event = Math.floor(raw.event / total * PROBABILITY_NORMALIZATION_BASE);
  // 最后一项用减法消除舍入误差，确保总和恰好为 100
  // P6-102 修复：归一化后四项之和可能超过 100，empty 可能为负数，用 Math.max 保护
  raw.empty = Math.max(0, PROBABILITY_NORMALIZATION_BASE - raw.monster - raw.item - raw.trap - raw.event);
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
 * 阶段四扩展：区域专属事件混合。`areaEvents` 非空时，按 `AREA_EVENT_MIX_PROBABILITY`
 * 概率从区域专属事件池中选取模板（用 areaLevel 构造），否则走通用事件。
 * `areaEvents` 为空时短路（不消耗 rng），行为与阶段三前完全一致，保证向后兼容。
 * 区域专属事件复用 `RandomEventResult` 结构与 `effectHandlers` 结算，不新增效果类型。
 *
 * @param areaLevel - 区域等级
 * @param rng - 随机数生成器，默认使用基于 Math.random 的 defaultRng
 * @param areaEvents - 区域专属事件模板数组（阶段四，为空时走通用事件）
 * @returns 随机事件的结果，包含消息、图标和效果
 */
export function generateRandomEvent(
  areaLevel: number,
  rng: Rng = defaultRng,
  areaEvents: AreaEventTemplate[] = []
): RandomEventResult {
  // 阶段四：区域专属事件混合。areaEvents 为空时短路，不消耗 rng，保持向后兼容。
  if (areaEvents.length > 0 && rng.next() < AREA_EVENT_MIX_PROBABILITY) {
    return rng.pick(areaEvents)(areaLevel);
  }

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
      // P6-106 修复：安全离开不应回血，改为无效果（amount: 0）
      { label: '安全离开', icon: 'game-icons:walk', effect: { type: 'heal', amount: 0 } },
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

  // 第四步：生成迷宫墙结构（DFS 完美迷宫骨架 + 密度捷径 + 隐藏房间三墙留入口）
  // 返回新网格（仅墙结构变化，事件类型与位置不变），保证全网格连通与旧存档兼容
  const mazeGrid = generateMazeWalls(grid, size, rng);

  // 阶段四：标记 Boss 封印门 + 陷阱视觉线索（仅设置标志，不依赖视线，在视线之前执行）
  markBossSeal(mazeGrid, size);
  markTrapHints(mazeGrid, size, rng);

  // 第五步：初始化起点视线（阶段三）
  // 从起点向 4 正方向发射射线，扫到的格子标记 discovered，隐藏房间被扫到后清除 hidden。
  // store.ts 的 enterArea 后续会调用 updateAccessibleCells 扩散 accessible，
  // 此时被视线扫到的隐藏房间 hidden 已清除，isPassable 不再阻止其被标记为可访问。
  const startPos = findStartPosition(mazeGrid);
  const visionCells = computeVision(mazeGrid, startPos, VISION_RANGE);
  return applyVision(mazeGrid, visionCells);
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

// ============================================================
// 阶段四：内容丰富与平衡（Boss 封印 / 陷阱线索 / 怪物索敌）
// ============================================================

/**
 * 标记 Boss 格为封印状态（阶段四，原地修改）
 *
 * 给所有 `boss` 类型格打 `sealed=true`，触发战斗前需经 `isBossSealBroken` 解锁
 * （`store.ts` 的 `revealGrid` 路径 1 检查）。解锁前点击 Boss 格不触发战斗，
 * UI 显示锁形图标 + 红色警告色，制造"看得见打不到"的目标感。
 *
 * @param grid - 探索网格（原地修改 sealed 字段）
 * @param size - 网格尺寸
 */
function markBossSeal(grid: ExplorationCell[][], size: number): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x].type === 'boss') {
        grid[y][x].sealed = true;
      }
    }
  }
}

/**
 * 按概率给陷阱格标记视觉线索（阶段四，原地修改）
 *
 * 遍历所有 `trap` 类型格，按 `TRAP_HINT_PROBABILITY` 概率打 `hint=true`。
 * `discovered` 层：hint 格显示"可疑地面"暗色裂纹图标（弱提示，不明确揭示"陷阱"）；
 * 非 hint 陷阱格完全无提示。落入陷阱的伤害结算逻辑不变（`generateTrapDamage` 不区分 hint）。
 *
 * 设计意图：给读图玩家"技巧空间"，但保留 `1 - TRAP_HINT_PROBABILITY` 的未知风险，
 * 避免陷阱退化为纯信息题。
 *
 * @param grid - 探索网格（原地修改 hint 字段）
 * @param size - 网格尺寸
 * @param rng - 随机数生成器（可注入确定性 RNG 用于测试）
 */
function markTrapHints(grid: ExplorationCell[][], size: number, rng: Rng): void {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (grid[y][x].type === 'trap' && rng.bool(TRAP_HINT_PROBABILITY)) {
        grid[y][x].hint = true;
      }
    }
  }
}

/**
 * 判断怪物格是否触发索敌警告（阶段四，纯函数）
 *
 * monster 格 `discovered` 或 `explored` 后，若玩家与怪物的曼哈顿距离
 * ≤ `ENEMY_ALERT_RANGE`，UI 显示红色跳动警告框。玩家可据此选择绕路还是硬刚，
 * 强化"探索路径选择"。
 *
 * 判定规则：
 * 1. 目标格存在且 `type === 'monster'`（boss 不触发索敌警告，由封印门单独处理）
 * 2. 怪物格已被发现（`discovered` 或 `explored`），未发现的不剧透
 * 3. 怪物格未 `completed`（已击败的不再警告）
 * 4. 玩家与怪物曼哈顿距离 ≤ `ENEMY_ALERT_RANGE`
 *
 * 注：plan.md 提及"且路径可通行"，此处简化为仅距离判定（索敌警告是感知层提示，
 * 墙体阻挡声音/气味不合理）。UI 层调用时可按需用 `isPassable` 进一步过滤。
 *
 * @param grid - 探索网格
 * @param monsterPos - 怪物格坐标
 * @param playerPos - 玩家坐标
 * @returns 是否显示索敌警告
 */
export function shouldShowEnemyAlert(
  grid: ExplorationCell[][],
  monsterPos: { x: number; y: number },
  playerPos: { x: number; y: number }
): boolean {
  const monsterCell = grid[monsterPos.y]?.[monsterPos.x];
  if (!monsterCell || monsterCell.type !== 'monster') return false;
  // 未发现的怪物格不剧透
  if (!monsterCell.discovered && !monsterCell.explored) return false;
  // 已击败的怪物格不再警告
  if (monsterCell.completed) return false;
  // 曼哈顿距离判定
  const distance = Math.abs(monsterPos.x - playerPos.x) + Math.abs(monsterPos.y - playerPos.y);
  return distance <= ENEMY_ALERT_RANGE;
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
 *
 * 阶段三职责拆分后，本函数仅负责 `accessible` 扩散，不再管理 `discovered`：
 * - `accessible` 扩散：已探索格的 4 邻域未探索格，仅当 `isPassable`（无墙 且 非未揭示隐藏房间）
 *   时标记为可访问。语义不变（"下一步可走到的格子"），对 UI 透明。
 * - `discovered` 由 `applyVision` 独立维护（基于视线计算），调用方须在 `updateAccessibleCells`
 *   之前先调用 `applyVision` 清除被视线扫到的隐藏房间 `hidden` 标志，否则 `isPassable` 会
 *   继续阻止这些格子被标记为 accessible。
 *
 * 隐藏房间揭示规则（阶段三变更）：原"相邻格探索后自动揭示"逻辑已移除，
 * 改为"被视线扫到即清除 hidden 标志"（由 `applyVision` 处理）。
 *
 * 旧存档 `walls` 缺失时 `isPassable` 视为全开放，行为近似原版 4 邻域扩散。
 *
 * @param grid - 需要更新的网格
 * @returns 更新后的网格副本（浅拷贝，explored 状态同步到新网格）
 */
export function updateAccessibleCells(grid: ExplorationCell[][]): ExplorationCell[][] {
  const size = grid.length;
  const colSize = grid[0]?.length ?? 0;

  // 深拷贝网格
  // [性能敏感] 对 10x10 网格（100 个 cell）做全文浅拷贝，每次状态更新都触发。
  // 当前规模下开销可接受（~0.1ms 级别）。若未来扩展至 16x16（256 cell）以上，
  // 可考虑改为按需更新（dirty flag + 仅更新变化的 cell）。
  const newGrid: ExplorationCell[][] = grid.map(row => row.map(cell => ({ ...cell })));

  // 先将所有未探索格子标记为不可访问
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < colSize; x++) {
      if (!newGrid[y][x].explored) {
        newGrid[y][x].accessible = false;
      }
    }
  }

  // 遍历所有已探索格子，将其 4 邻域未探索且可通行的格子标记为可访问
  // [迷宫化] 从 8 邻域收敛为 4 邻域 + isPassable 墙判断
  const fourDirs = [
    { dx: 0, dy: -1 }, // 上
    { dx: 1, dy: 0 },  // 右
    { dx: 0, dy: 1 },  // 下
    { dx: -1, dy: 0 }, // 左
  ];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < colSize; x++) {
      if (!newGrid[y][x].explored) continue;
      for (const { dx, dy } of fourDirs) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || nx >= colSize || ny < 0 || ny >= size) continue;
        if (newGrid[ny][nx].explored) continue; // 仅扩散到未探索格
        // isPassable 检查墙位与隐藏房间（未揭示隐藏房间不可通行）
        if (isPassable(newGrid, { x, y }, { x: nx, y: ny })) {
          newGrid[ny][nx].accessible = true;
        }
      }
    }
  }

  return newGrid;
}

// ============================================================
// 视线与分层揭示（阶段三）
// ============================================================

/**
 * 计算玩家当前位置的可见格子集合（纯函数）
 *
 * 从玩家位置向上下左右四个正方向发射直线射线（卡丁视线）：
 * - 每步推进前检查"从当前格到下一格是否被墙阻挡"（仅墙判定，不检查隐藏房间标志），
 *   有墙则终止该方向——这与 `isPassable` 不同，`isPassable` 会额外阻止视线到达未揭示
 *   隐藏房间，导致"被视线扫到即 revealed"无法实现。
 * - 无墙时下一格被扫到（加入可见坐标）；若下一格是未揭示隐藏房间，视线停止推进
 *   （扫到但不穿过），形成"从入口方向发现密室"的体验。
 * - 玩家所在格本身始终可见。
 * - 超出 range 或越界时终止该方向。
 *
 * 纯函数不直接修改网格，结果坐标数组供 `applyVision` 使用。
 *
 * @param grid - 网格
 * @param playerPosition - 玩家坐标
 * @param range - 视线最大距离（格数）
 * @returns 被扫到的格子坐标数组（含玩家所在格）
 */
export function computeVision(
  grid: ExplorationCell[][],
  playerPosition: { x: number; y: number },
  range: number
): { x: number; y: number }[] {
  const size = grid.length;
  const colSize = grid[0]?.length ?? 0;
  const visible: { x: number; y: number }[] = [];

  // 玩家所在格始终可见
  visible.push({ x: playerPosition.x, y: playerPosition.y });

  // range ≤ 0 时仅玩家所在格可见
  if (range <= 0) return visible;

  // 4 正方向射线（上/右/下/左）
  const dirs = [
    { dx: 0, dy: -1 }, // 上
    { dx: 1, dy: 0 },  // 右
    { dx: 0, dy: 1 },  // 下
    { dx: -1, dy: 0 }, // 左
  ];

  for (const dir of dirs) {
    let cur = { x: playerPosition.x, y: playerPosition.y };
    for (let step = 0; step < range; step++) {
      const next = { x: cur.x + dir.dx, y: cur.y + dir.dy };
      // 边界检查
      if (next.x < 0 || next.x >= colSize || next.y < 0 || next.y >= size) break;
      // 墙判定：仅检查结构可通行性（不检查隐藏房间标志），墙后格子不可见
      if (!isStructurallyPassable(grid, cur, next)) break;
      // 下一格被视线扫到
      visible.push(next);
      // 未揭示隐藏房间：视线扫到但不穿过（停止该方向）
      const nextCell = grid[next.y]?.[next.x];
      if (nextCell?.hidden && !nextCell.explored) break;
      cur = next;
    }
  }

  return visible;
}

/**
 * 将视线扫到的格子标记为 discovered（纯函数，返回新网格）
 *
 * 处理规则：
 * 1. `discovered` 只增不减：已发现的格保持可见，不因玩家远离而回退。
 *    符合地牢探索直觉，避免"反复走动重新记忆"的挫败。
 * 2. 隐藏房间被视线扫到后清除 `hidden` 标志（不再隐藏），但保持 `explored=false`：
 *    - 清除 hidden 使 `isPassable` 不再阻止通行，后续 `updateAccessibleCells` 可将其
 *      标记为 accessible，玩家可走入。
 *    - 保持 explored=false 确保 UI 仍显示模糊图标（discovered 层），玩家走入后才
 *      完全揭示（explored 层）。
 * 3. `explored` 恒蕴含 `discovered`：已到达的格自然已发现。
 *
 * @param grid - 原始网格（不会被修改）
 * @param visionCells - 视线扫到的格子坐标数组（由 `computeVision` 返回）
 * @returns 新网格（discovered/hidden 状态已更新）
 */
export function applyVision(
  grid: ExplorationCell[][],
  visionCells: { x: number; y: number }[]
): ExplorationCell[][] {
  const newGrid = grid.map(row => row.map(cell => ({ ...cell })));
  for (const { x, y } of visionCells) {
    const cell = newGrid[y]?.[x];
    if (!cell) continue;
    // discovered 只增不减
    cell.discovered = true;
    // 隐藏房间被视线扫到后清除 hidden 标志（允许通行），但保持 explored=false
    if (cell.hidden && !cell.explored) {
      cell.hidden = false;
    }
  }
  return newGrid;
}

// ============================================================
// 迷宫生成（墙结构与通行判定）
// ============================================================

/** 四方向位移常量（上/右/下/左），附带墙位字段名映射 */
const FOUR_DIRECTIONS = [
  { dx: 0, dy: -1, wall: 'top' as const, opposite: 'bottom' as const },
  { dx: 1, dy: 0, wall: 'right' as const, opposite: 'left' as const },
  { dx: 0, dy: 1, wall: 'bottom' as const, opposite: 'top' as const },
  { dx: -1, dy: 0, wall: 'left' as const, opposite: 'right' as const },
];

/**
 * 判断两个相邻格子之间是否可通行（纯函数）
 *
 * 迷宫化后的通行判定规则：
 * 1. 仅允许上下左右四方向移动（曼哈顿距离为 1），对角线与原地不可通行
 * 2. 目标格必须在网格内
 * 3. 墙判定：from.walls[方向] 或 to.walls[反方向] 任一为 true 即阻挡；
 *    walls 缺失（旧存档）视为全开放，保证旧存档可玩
 * 4. 隐藏房间格（hidden && !explored）不可通行——需先经相邻格揭示后方可进入
 *
 * @param grid - 网格
 * @param from - 起点坐标
 * @param to - 终点坐标
 * @returns 是否可通行
 */
export function isPassable(
  grid: ExplorationCell[][],
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  // 规则 1：仅允许四方向（曼哈顿距离为 1），禁止对角与原地
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;

  // 规则 2：边界检查
  const size = grid.length;
  const colSize = grid[0]?.length ?? 0;
  if (to.x < 0 || to.x >= colSize || to.y < 0 || to.y >= size) return false;

  const fromCell = grid[from.y]?.[from.x];
  const toCell = grid[to.y]?.[to.x];
  if (!fromCell || !toCell) return false;

  // 规则 4：隐藏房间未揭示时不可通行
  if (toCell.hidden && !toCell.explored) return false;

  // 规则 3：墙判定（walls 缺失视为无墙=开放，兼容旧存档）
  const dir = FOUR_DIRECTIONS.find(d => d.dx === dx && d.dy === dy);
  if (!dir) return false;
  if (fromCell.walls?.[dir.wall] || toCell.walls?.[dir.opposite]) return false;

  return true;
}

/**
 * 生成迷宫墙结构（纯函数）
 *
 * 在已放置固定事件与随机事件的网格上追加墙结构，将"格子集合"转化为"迷宫通道"。
 *
 * 生成流程：
 *   A. DFS 骨架：从起点出发的深度优先生成树。全墙起步，沿树边雕刻通路，
 *      保证全网格连通（任意两格至少一条路径）。
 *   B. 保护格开放：起点/商店/任务板邻接边强制开放（永不封墙）。
 *   C. 密度捷径：对剩余封墙的非树边，按 MAZE_WALL_DENSITY 概率开通为捷径（环路）。
 *      density=0 → 完美迷宫（最多死路）；density=0.15 → 约 85% 非树边保持封墙。
 *   D. 隐藏房间三墙留入口：每个隐藏房间保留 1 个开放方向作为入口，其余开放方向
 *      尝试封墙（BFS 校验连通性，失败则回退）。树叶位置的隐藏房间天然达成 3 墙 + 1 入口。
 *   E. 连通性兜底：BFS 校验全网格连通，失败则回退到全开放并 console.warn。
 *
 * 墙数据四方向冗余存储：给 (x,y) 设 right 墙时同步给 (x+1,y) 设 left 墙。
 * walls 缺失（旧存档）视为全开放。
 *
 * @param grid - 已放置固定事件与随机事件的网格（不会被修改）
 * @param size - 网格尺寸
 * @param rng - 随机数生成器
 * @returns 新网格（仅墙结构变化，事件类型与位置不变）
 */
export function generateMazeWalls(
  grid: ExplorationCell[][],
  size: number,
  rng: Rng
): ExplorationCell[][] {
  // 深拷贝网格并初始化四面墙（全封闭），后续步骤逐步雕刻开放
  const newGrid: ExplorationCell[][] = grid.map(row =>
    row.map(cell => ({
      ...cell,
      walls: { top: true, right: true, bottom: true, left: true } as WallSet,
    }))
  );

  const start = findStartPosition(newGrid);

  // ---------- 步骤 A：DFS 生成树（全墙起步，沿树边雕刻通路） ----------
  const treeEdges = new Set<string>();
  const visited = new Set<string>();
  visited.add(`${start.x},${start.y}`);
  const stack: { x: number; y: number }[] = [start];
  // 防御性迭代上限（DFS 自然受格子数约束，此处仅兜底，避免极端情况死循环）
  const iterCap = Math.max(size * size * 4, MAZE_MAX_RETRY);
  let iterations = 0;
  while (stack.length > 0 && iterations < iterCap) {
    iterations++;
    const current = stack[stack.length - 1];
    const unvisited = getFourNeighbors(current, size).filter(n => !visited.has(`${n.x},${n.y}`));
    if (unvisited.length === 0) {
      stack.pop();
      continue;
    }
    const next = rng.pick(unvisited);
    treeEdges.add(edgeKey(current, next));
    carvePassage(newGrid, current, next);
    visited.add(`${next.x},${next.y}`);
    stack.push(next);
  }

  // ---------- 步骤 B：保护格邻接边强制开放（起点/商店/任务板不封墙） ----------
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!isProtectedCell(newGrid[y][x])) continue;
      for (const n of getFourNeighbors({ x, y }, size)) {
        carvePassage(newGrid, { x, y }, n);
      }
    }
  }

  // ---------- 步骤 C：密度捷径（按概率开通封墙的非树边） ----------
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = newGrid[y][x];
      // 遍历右、下两个方向避免重复处理
      for (const dir of [{ dx: 1, dy: 0 }, { dx: 0, dy: 1 }]) {
        const nx = x + dir.dx;
        const ny = y + dir.dy;
        if (nx >= size || ny >= size) continue;
        const neighbor = newGrid[ny][nx];
        // 跳过保护格与隐藏房间邻接边（保护格已在 B 步开放；隐藏房间在 D 步处理）
        if (isProtectedCell(cell) || isProtectedCell(neighbor)) continue;
        if (isHiddenRoom(cell) || isHiddenRoom(neighbor)) continue;
        // 跳过树边（已在 A 步开放）
        if (treeEdges.has(edgeKey({ x, y }, { x: nx, y: ny }))) continue;
        // 当前为封墙状态（A 步未雕刻的非树边），按密度概率开通为捷径
        if (hasWallBetween(newGrid, { x, y }, { x: nx, y: ny }) && rng.bool(MAZE_WALL_DENSITY)) {
          carvePassage(newGrid, { x, y }, { x: nx, y: ny });
        }
      }
    }
  }

  // ---------- 步骤 D：隐藏房间三墙留入口 ----------
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cell = newGrid[y][x];
      if (!isHiddenRoom(cell)) continue;

      // 收集当前开放方向（无墙的 4 邻域）
      const openDirs = getFourNeighbors({ x, y }, size).filter(
        n => !hasWallBetween(newGrid, { x, y }, n)
      );
      if (openDirs.length <= 1) continue; // 已是 1 入口或无入口，无需封闭

      // 随机保留 1 个开放方向作为入口，其余尝试封墙
      const entrance = rng.pick(openDirs);
      for (const dir of openDirs) {
        if (dir.x === entrance.x && dir.y === entrance.y) continue;
        // 不封保护格方向的墙
        if (isProtectedCell(newGrid[dir.y][dir.x])) continue;
        // 试探性封墙，BFS 校验全网格连通，失败则回退
        buildWall(newGrid, { x, y }, dir);
        if (!isFullyConnected(newGrid, start, size)) {
          carvePassage(newGrid, { x, y }, dir); // 回退
        }
      }
    }
  }

  // ---------- 步骤 E：连通性兜底 ----------
  if (!isFullyConnected(newGrid, start, size)) {
    console.warn('[exploration] 迷宫连通性校验失败，回退到全开放');
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        newGrid[y][x].walls = { top: false, right: false, bottom: false, left: false };
      }
    }
  }

  return newGrid;
}

// ============================================================
// 内部辅助：迷宫生成工具函数
// ============================================================

/** 获取网格内 4 邻域坐标（上/右/下/左，不含越界） */
function getFourNeighbors(pos: { x: number; y: number }, size: number): { x: number; y: number }[] {
  const dirs = [
    { x: pos.x, y: pos.y - 1 }, // 上
    { x: pos.x + 1, y: pos.y }, // 右
    { x: pos.x, y: pos.y + 1 }, // 下
    { x: pos.x - 1, y: pos.y }, // 左
  ];
  return dirs.filter(p => p.x >= 0 && p.x < size && p.y >= 0 && p.y < size);
}

/** 生成两格间的规范边键（坐标排序后拼接，确保 a-b 与 b-a 得到相同 key） */
function edgeKey(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const p1 = a.x < b.x || (a.x === b.x && a.y <= b.y) ? a : b;
  const p2 = p1 === a ? b : a;
  return `${p1.x},${p1.y}-${p2.x},${p2.y}`;
}

/** 判断格子是否为受保护格（起点/商店/任务板，邻接边永不封墙） */
function isProtectedCell(cell: ExplorationCell): boolean {
  return cell.type === 'start' || cell.type === 'shop' || cell.type === 'board';
}

/** 判断格子是否为未揭示的隐藏房间 */
function isHiddenRoom(cell: ExplorationCell): boolean {
  return !!cell.hidden && !cell.explored;
}

/** 判断两相邻格之间是否有墙（任一侧墙位为 true 即视为有墙；非四方向视为有墙） */
function hasWallBetween(
  grid: ExplorationCell[][],
  a: { x: number; y: number },
  b: { x: number; y: number }
): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dir = FOUR_DIRECTIONS.find(d => d.dx === dx && d.dy === dy);
  if (!dir) return true; // 非四方向视为有墙（不可通行）
  const aCell = grid[a.y]?.[a.x];
  const bCell = grid[b.y]?.[b.x];
  if (!aCell?.walls || !bCell?.walls) return false; // walls 缺失视为无墙
  return !!aCell.walls[dir.wall] || !!bCell.walls[dir.opposite];
}

/** 雕刻通路：移除两相邻格之间的墙（双向同步） */
function carvePassage(
  grid: ExplorationCell[][],
  a: { x: number; y: number },
  b: { x: number; y: number }
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dir = FOUR_DIRECTIONS.find(d => d.dx === dx && d.dy === dy);
  if (!dir) return;
  const aCell = grid[a.y]?.[a.x];
  const bCell = grid[b.y]?.[b.x];
  if (!aCell?.walls || !bCell?.walls) return;
  aCell.walls[dir.wall] = false;
  bCell.walls[dir.opposite] = false;
}

/** 建墙：在两相邻格之间设置墙（双向同步） */
function buildWall(
  grid: ExplorationCell[][],
  a: { x: number; y: number },
  b: { x: number; y: number }
): void {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dir = FOUR_DIRECTIONS.find(d => d.dx === dx && d.dy === dy);
  if (!dir) return;
  const aCell = grid[a.y]?.[a.x];
  const bCell = grid[b.y]?.[b.x];
  if (!aCell?.walls || !bCell?.walls) return;
  aCell.walls[dir.wall] = true;
  bCell.walls[dir.opposite] = true;
}

/** 判定两相邻格之间是否结构可通行（仅墙判定，忽略隐藏房间标志；用于生成期连通性校验） */
function isStructurallyPassable(
  grid: ExplorationCell[][],
  from: { x: number; y: number },
  to: { x: number; y: number }
): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  return !hasWallBetween(grid, from, to);
}

/** BFS 校验从起点出发能否结构可达全部格子（仅墙判定，忽略隐藏房间标志） */
function isFullyConnected(
  grid: ExplorationCell[][],
  start: { x: number; y: number },
  size: number
): boolean {
  if (size === 0) return true;
  const total = size * size;
  const visited = new Set<string>();
  const queue: { x: number; y: number }[] = [start];
  visited.add(`${start.x},${start.y}`);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const n of getFourNeighbors(cur, size)) {
      const key = `${n.x},${n.y}`;
      if (visited.has(key)) continue;
      if (!isStructurallyPassable(grid, cur, n)) continue;
      visited.add(key);
      queue.push(n);
    }
  }
  return visited.size === total;
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
