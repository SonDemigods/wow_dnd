/**
 * @fileoverview 探索模块类型定义
 * @description 包含网格状态、探索事件、区域配置、UI 回调、持久化存储等相关类型定义。
 *              本文件是 exploration 模块的类型基石，所有接口和类型别名均在此集中定义。
 * @module exploration
 */

// ============================================================================
// 类型别名
// ============================================================================

/**
 * 格子类型联合类型
 *
 * 定义探索网格中每个单元格的可能类型，直接决定玩家踩中后的交互行为。
 * 与 `GridEventType` 的区别：此类型用于运行时（Cell 对象），
 * `GridEventType` 用于概率计算和事件生成阶段。
 *
 * - `monster`：怪物格子 → 触发战斗（参见 `revealGrid` 路径 1）
 * - `treasure`：宝箱格子 → 发放物品奖励
 * - `trap`：陷阱格子 → 造成伤害（参见 `generateTrapDamage`）
 * - `event`：事件格子 → 触发随机事件（参见 `generateRandomEvent`）
 * - `rest`：营地格子 → 恢复生命/法力（参见 `useCamp`）
 * - `shop`：商店格子 → 打开商店面板，可多次交互
 * - `board`：任务板格子 → 打开任务面板，可多次交互
 * - `boss`：Boss 格子 → 触发 Boss 战（失败允许再次挑战）
 * - `start`：起点格子 → 玩家初始位置
 * - `empty`：空格子 → 仅探索计数，无特殊效果
 *
 * @see ExplorationCell.type 使用此类型
 * @see EVENT_TO_CELL_TYPE GridEventType → CellType 的映射表
 */
export type CellType = 'monster' | 'treasure' | 'trap' | 'event' | 'rest' | 'shop' | 'board' | 'boss' | 'start' | 'empty';

/**
 * 网格事件类型枚举（用于概率计算和事件判定）
 *
 * 此类型用于网格生成阶段的事件概率分配，与 `CellType` 并非一一对应：
 * - `'item'` 映射为 `CellType 'treasure'`
 * - `'camp'` 映射为 `CellType 'rest'`
 * 映射关系集中定义在 `service.ts` 的 `EVENT_TO_CELL_TYPE` 常量中。
 *
 * - `monster`：怪物事件
 * - `item`：物品事件（映射为 `CellType 'treasure'`）
 * - `trap`：陷阱事件
 * - `event`：随机事件
 * - `empty`：空事件
 * - `camp`：营地事件（映射为 `CellType 'rest'`）
 * - `shop`：商店事件
 * - `board`：任务板事件
 * - `boss`：Boss 事件
 *
 * @see computeEventProbability 根据区域等级计算各事件类型的概率分布
 * @see determineCellEvent 根据概率分布随机选择事件类型
 * @see EVENT_TO_CELL_TYPE service.ts 中的映射常量
 */
export type GridEventType = 'monster' | 'item' | 'trap' | 'event' | 'empty' | 'camp' | 'shop' | 'board' | 'boss'

/**
 * 随机事件效果类型
 *
 * 定义探索过程中随机事件可能产生的效果种类。
 * 每种类型在 `generateRandomEvent` 中对应不同的概率区间和数值计算公式。
 *
 * - `heal`：生命恢复（区域等级 * 3 + 随机 0~10）
 * - `mana`：法力恢复（区域等级 * 2 + 随机 0~8）
 * - `exp`：经验奖励（区域等级 * 10 + 随机 0~20）
 * - `damage`：陷阱伤害（区域等级 * 2 + 随机 0~5）
 * - `mpLoss`：法力损失（区域等级 * 1.5 + 随机 0~5）
 * - `gold`：金币奖励（区域等级 * 5 + 随机 0~15）
 *
 * @see generateRandomEvent 生成随机事件的纯函数
 * @see RandomEventResult 包含此类型的效果描述
 */
export type RandomEventEffectType = 'heal' | 'mana' | 'exp' | 'damage' | 'mpLoss' | 'gold';

// ============================================================================
// 核心数据接口
// ============================================================================

/**
 * 探索单元格接口
 *
 * 网格中每个格子的完整状态快照，由 `generateGrid` 创建，
 * 由 `updateAccessibleCells` 更新可访问性，由 `revealGrid` 更新探索/访问状态。
 *
 * @property {number} x - X 坐标（列索引，0 为左边界）
 * @property {number} y - Y 坐标（行索引，0 为上边界）
 * @property {CellType} type - 单元格类型（决定交互行为）
 * @property {boolean} explored - 是否已揭示（相邻格 reveal 后自动设为 true）
 * @property {boolean} accessible - 是否可移动至该格（基于已访问格的邻域扩散）
 * @property {boolean} visited - 是否已被玩家踩过（踩过后标记，影响移动计数）
 * @property {boolean} [completed] - 事件是否已完成（战斗胜利、宝箱已开等），已完成则 UI 褪色显示
 * @property {string} [monsterId] - 分配的怪物 ID（仅在 monster/boss 类型时有值）
 *
 * @see generateGrid 网格生成的纯函数
 * @see updateAccessibleCells 可访问性扩散算法
 * @see revealGrid 揭示格子并触发交互（store.ts）
 */
export interface ExplorationCell {
  x: number
  y: number
  type: CellType
  explored: boolean
  accessible: boolean
  visited: boolean
  /** 事件是否已完成（战斗胜利、宝箱已开等），已完成则褪色显示 */
  completed?: boolean
  monsterId?: string
}

/**
 * 探索状态接口
 *
 * 探索模块的核心运行时状态对象，作为 `useExplorationStore` 的唯一数据源。
 * 所有探索相关的 UI 渲染均从此对象读取数据。
 *
 * 数据流转：
 * 1. `startExploration(areaId)` → 调用 `generateGrid()` 填充 `grid`
 * 2. 玩家移动 → `revealGrid()` 更新 `playerPosition`、`visitedCells`
 * 3. 战斗结果回调 → `onBattleResult()` 更新 `bossDefeated`
 * 4. 探索完成判定 → `explorationComplete` 由 `checkExplorationComplete()` 自动推导
 *
 * @property {string | null} currentAreaId - 当前区域 ID（null 表示未在探索中）
 * @property {ExplorationCell[][]} grid - 网格数据（10×10 二维数组，grid[y][x] 访问）
 * @property {boolean} campUsed - 营地是否已使用（每次探索仅可使用一次营地）
 * @property {{ x: number; y: number }} playerPosition - 玩家当前位置坐标
 * @property {number} visitedCells - 已访问（踩过）的单元格数量
 * @property {boolean} bossDefeated - Boss 是否已被击败
 * @property {boolean} explorationComplete - 探索是否已完成
 *
 * @see useExplorationStore 状态管理的 Pinia Store
 * @see startExploration 初始化探索会话
 * @see revealGrid 玩家移动和交互的核心 Action
 */
export interface ExplorationState {
  currentAreaId: string | null
  grid: ExplorationCell[][]
  campUsed: boolean
  playerPosition: { x: number; y: number }
  visitedCells: number
  bossDefeated: boolean
  explorationComplete: boolean
}

/**
 * 网格事件概率接口
 *
 * 定义每种事件类型在网格生成时的出现概率（百分比值）。
 * 五项之和恒为 100，由 `computeEventProbability` 保证归一化。
 *
 * 概率设计意图：
 * - 高等级区域：怪物概率 ↑、陷阱概率 ↑、物品概率 ↓、空地概率 ↓
 * - 低等级区域：怪物概率 ↓、陷阱概率 ↓、物品概率 ↑、空地概率 ↑
 *
 * @property {number} monster - 怪物事件概率（等级 + 20，上限 30%）
 * @property {number} item - 物品事件概率（25 - 等级，下限 15%）
 * @property {number} trap - 陷阱事件概率（等级 + 12，上限 22%）
 * @property {number} event - 随机事件概率（固定 15%）
 * @property {number} empty - 空事件概率（30 - 等级，下限 15%，用减法消除累计舍入误差）
 *
 * @see computeEventProbability 动态概率计算公式
 * @see determineCellEvent 累积概率区间法选择事件类型
 */
export interface GridEventProbability {
  monster: number
  item: number
  trap: number
  event: number
  empty: number
}

/**
 * 区域配置接口
 *
 * 每个可探索区域的完整配置，由 `buildAreaConfig` 从地点数据（Location）动态构建。
 *
 * @property {string} areaId - 区域 ID（与前端的 Location.locationId 对应）
 * @property {string} name - 区域名称（用于日志和 UI 标题）
 * @property {number} level - 区域等级（影响事件概率、怪物强度、陷阱伤害等）
 * @property {GridEventProbability} eventProbability - 事件概率配置（由等级动态计算）
 * @property {string[]} monsterPool - 普通怪物池（怪物 ID 列表，供 random 分配）
 * @property {string[]} bossPool - Boss 怪物池（Boss ID 列表，随机选一个放置）
 * @property {string[]} itemPool - 物品池（物品 ID 列表，宝箱和兜底奖励从中选取）
 *
 * @see buildAreaConfig 从 Location 数据构建此配置（store.ts）
 */
export interface AreaConfig {
  areaId: string
  name: string
  level: number
  eventProbability: GridEventProbability
  monsterPool: string[]
  bossPool: string[]
  itemPool: string[]
}

/**
 * 随机事件结果接口
 *
 * 一次随机事件的完整结果快照，由 `generateRandomEvent` 生成。
 * 携带消息文本、图标和量化效果，供 UI 直接展示。
 *
 * @property {string} message - 事件消息文本（如 "发现神秘泉水，恢复了 15 点生命值"）
 * @property {string} icon - 事件图标（Iconify 格式，如 `game-icons:water-drop`）
 * @property {{ type: RandomEventEffectType; amount: number }} effect - 事件产生的量化效果
 *
 * @see generateRandomEvent 随机事件生成逻辑
 */
export interface RandomEventResult {
  message: string;
  icon: string;
  effect: { type: RandomEventEffectType; amount: number };
}

/**
 * 网格生成配置参数接口
 *
 * 聚合了生成探索网格所需的所有输入参数，由 `buildAreaConfig` 构建后传入 `generateGrid`。
 * `questNormalMonsters` 字段用于任务系统——任务要求的普通怪物会在网格中优先放置。
 *
 * @property {number} [size] - 网格尺寸（默认 10，即 10×10 的二维网格）
 * @property {GridEventProbability} eventProbability - 事件概率分布（决定各类型格子的比例）
 * @property {string[]} monsterPool - 普通怪物池（怪物 ID 列表，供随机分配）
 * @property {string[]} bossPool - Boss 怪物池（Boss ID 列表，随机选一个放置）
 * @property {string[]} questNormalMonsters - 任务所需的普通怪物列表（优先放置，确保任务可完成）
 *
 * @see generateGrid 网格生成纯函数
 * @see buildAreaConfig 构建此配置（store.ts）
 */
export interface GridGenerationConfig {
  size?: number;
  eventProbability: GridEventProbability;
  monsterPool: string[];
  bossPool: string[];
  questNormalMonsters: string[];
}

// ============================================================================
// 回调接口
// ============================================================================

/**
 * 探索 UI 回调接口
 *
 * 供 GameMain 等 UI 组件注册的回调集合，替代 EventBus 跨模块监听。
 * 当探索 Store 内部触发格子探索、战斗、物品发现、陷阱、随机事件时，
 * 同步调用已注册的回调，避免 UI 组件直接依赖 EventBus 进行数据通信。
 *
 * 所有回调均为可选——UI 组件按需注册自己关心的回调即可，
 * 未注册的回调对应的探索行为静默执行，不会抛出异常。
 *
 * @property {Function} [onCellExplored] - 格子被揭示时触发（携带格子类型和交互 ID）
 * @property {Function} [onBattleTriggered] - 战斗被触发时通知 UI 切换战斗场景
 * @property {Function} [onItemFound] - 获得物品时通知 UI 展示获取动画/提示
 * @property {Function} [onTrapTriggered] - 触发陷阱时通知 UI 展示伤害动画
 * @property {Function} [onRandomEvent] - 触发随机事件时通知 UI 展示事件弹窗
 *
 * @see useExplorationStore.registerCallbacks 注册回调
 */
export interface ExplorationUICallbacks {
  onCellExplored?: (data: { cellType?: string; interactionId?: string }) => void;
  onBattleTriggered?: (data: { eventData: { monsterId: string; areaLevel: number } }) => void;
  onItemFound?: (data: { itemId: string; count: number; itemName: string }) => void;
  onTrapTriggered?: (data: { damage: number; trapType: string }) => void;
  onRandomEvent?: (data: { message: string; icon: string }) => void;
}

// ============================================================================
// 存储/持久化接口
// ============================================================================

/**
 * 探索进度存储接口
 *
 * 探索数据的持久化格式，存入 IndexedDB 的 `char_exploration` 表。
 * 所有字段由 `persistState()` 每次状态变更时自动写入，
 * 页面刷新后通过 `getExplorationData()` 恢复完整的探索会话。
 *
 * 兼容性处理：
 * - `assignedShopId` / `currentShopId` 为商店分配的 ID，新旧两个字段共存以确保升级兼容
 * - `updatedAt` 为可选的更新时间戳，用于判断存档新鲜度
 *
 * @property {string} characterId - 角色 ID（主键，一个角色仅保存一份探索进度）
 * @property {string | null} currentAreaId - 当前区域 ID
 * @property {string} [assignedShopId] - 当前探索网格中分配的商店 ID（新字段）
 * @property {string} [currentShopId] - 旧版本兼容字段（读取时自动迁移到 assignedShopId）
 * @property {ExplorationCell[][]} grid - 完整网格数据
 * @property {{ x: number; y: number }} playerPosition - 玩家位置坐标
 * @property {number} visitedCells - 已访问单元格数量
 * @property {boolean} bossDefeated - Boss 是否已被击败
 * @property {boolean} explorationComplete - 探索是否完成
 * @property {boolean} campUsed - 营地是否已使用
 * @property {number} [updatedAt] - 最后更新时间戳（毫秒）
 *
 * @see explorationDbService.saveExplorationData 写入数据库
 * @see explorationDbService.getExplorationData 从数据库读取并恢复为运行时状态
 */
export interface ExplorationStorage {
  characterId: string;
  currentAreaId: string | null;
  assignedShopId?: string;
  currentShopId?: string;
  grid: ExplorationCell[][];
  playerPosition: { x: number; y: number };
  visitedCells: number;
  bossDefeated: boolean;
  explorationComplete: boolean;
  campUsed: boolean;
  updatedAt?: number;
}
