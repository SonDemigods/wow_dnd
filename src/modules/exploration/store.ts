/**
 * @fileoverview 探索模块状态管理层（Store 核心架构）
 * @description Store 是探索数据的唯一持有者，所有响应式状态集中管理。
 * Action 负责编排：调用 Service 纯函数 → 更新 Store 状态 → 调用 DB 持久化 → 通知其他模块。
 * 跨模块通信全部改为直接 Store Action 调用，不再通过 EventBus 发射数据变更事件。
 * @module exploration
 */
import { defineStore } from 'pinia';
import { ref, computed, shallowRef } from 'vue';
import type { ExplorationCell, ExplorationState, AreaConfig, ExplorationUICallbacks, EventChoice } from './types';
import type { LocationData } from '@/modules/map/types';
import { explorationDbService } from './db';
import { crossModuleQuery } from '@/services/CrossModuleQuery';
import { errorReporter } from '@/utils/errorReport';
import { eventBus, GameEvents } from '@/modules/bus';
import { useLogStore } from '@/modules/log/store';
import { generateLogId } from '@/modules/log/service';
import { useGameStore } from '@/modules/game';
import { useCharacterStore } from '@/modules/character/store';
import { useInventoryStore } from '@/modules/inventory/store';
import { useQuestStore } from '@/modules/quest';
import {
  generateGrid,
  findStartPosition,
  updateAccessibleCells,
  computeEventProbability,
  buildItemPool,
  isPassable,
  computeVision,
  applyVision,
  GRID_SIZE
} from './service';
import { VISION_RANGE, BOSS_SEAL_REQUIRED_CELLS } from '@/config/exploration';
import { AREA_EVENT_TEMPLATES } from '@/data/config_area_events';
import { dispatchCellEvent, applyEventEffect } from './events';

/** P5-014 修复：新区域默认已访问格子数（起点+商店+任务板） */
const DEFAULT_VISITED_CELLS = 3;
import { defaultRng, type Rng } from '@/utils/rng';

export const useExplorationStore = defineStore('exploration', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================

  // P3-153 修复：currentCharacterId 收敛到 GameStore，explorationStore 通过只读 computed 代理访问。
  // 所有修改必须通过 gameStore.setCurrentCharacterId() 完成（触发持久化），
  // 不能直接赋值 currentCharacterId.value（只读 computed 会触发 Vue 警告且不生效）。
  // 调用方（GameBootstrap/ExplorationView）在调用 init 前已通过 character 模块设置好 gameStore.currentCharacterId。
  const gameStore = useGameStore();

  /** 当前探索区域 ID */
  const currentAreaId = ref<string | null>(null);
  /** 探索网格 */
  const grid = ref<ExplorationCell[][]>([]);
  /** 营地是否已使用 */
  const campUsed = ref(false);
  /** 是否正在探索中 */
  const isExploring = ref(false);
  /** 玩家当前位置 */
  const playerPosition = ref({ x: 0, y: 0 });
  /** 已访问格子数 */
  const visitedCells = ref(0);
  /** Boss 是否已被击败 */
  const bossDefeated = ref(false);
  /** 探索是否完成 */
  const explorationComplete = ref(false);

  /** 当前选中的角色 ID（只读代理，由 GameStore 统一管理） */
  const currentCharacterId = computed<string | null>(() => gameStore.currentCharacterId);
  /** 当前等待战斗结果的格子坐标 */
  const pendingBattleCell = ref<{ x: number; y: number } | null>(null);
  /**
   * 战斗前玩家原位置（阶段二：战斗落点回退）
   *
   * movePlayer 移动到怪物/Boss 格时立即推进 playerPosition 并记录原位到此；
   * onBattleResult 胜利时清空（保持怪物格），失败/逃跑时用此回退 playerPosition。
   * 仅在战斗挂起期间有值，不持久化（运行时态）。
   */
  const previousPosition = ref<{ x: number; y: number } | null>(null);
  /** 本次探索随机选取的商店 ID */
  const assignedShopId = ref('');
  /** 当前区域配置（缓存） */
  const currentAreaConfig = ref<AreaConfig | null>(null);
  /**
   * P9-036 修复：当前等待多选项事件选择的格子坐标
   *
   * revealGrid 遇到 event 格时记录坐标，applyEventChoice 据此精确定位目标格，
   * 替代原先搜索整个网格的回退逻辑。
   */
  const pendingEventCell = ref<{ x: number; y: number } | null>(null);

  // ==================== UI 回调（替代 EventBus 跨模块数据事件） ====================

  /** 注册的 UI 回调集（由 GameMain 等 UI 组件设置，使用 shallowRef 确保响应式追踪，EXP-3/7 修复） */
  const uiCallbacks = shallowRef<ExplorationUICallbacks | null>(null);

  /** 注册 UI 回调 */
  function registerUICallbacks(callbacks: ExplorationUICallbacks): void {
    uiCallbacks.value = callbacks;
  }

  /** 取消注册 UI 回调 */
  function unregisterUICallbacks(): void {
    uiCallbacks.value = null;
  }

  // ==================== 计算属性 ====================

  /** 探索状态对象（兼容旧 API，供 ExplorationView 使用） */
  const state = computed<ExplorationState>(() => ({
    currentAreaId: currentAreaId.value,
    grid: grid.value,
    campUsed: campUsed.value,
    playerPosition: playerPosition.value,
    visitedCells: visitedCells.value,
    bossDefeated: bossDefeated.value,
    explorationComplete: explorationComplete.value
  }));

  /** 是否已开始探索 */
  const hasStartedExploration = computed(() => currentAreaId.value !== null);

  /**
   * Boss 封印是否已解除（阶段四）
   *
   * 解锁条件A：visitedCells >= BOSS_SEAL_REQUIRED_CELLS（约 1/3 网格，强制充分探索）。
   * 解锁条件B（选配）：守卫怪击败数 >= GUARD_MONSTER_COUNT；GUARD_MONSTER_COUNT=0 时不启用。
   * 未解锁时 Boss 格 sealed=true，movePlayer 拒绝推进、不触发战斗。
   */
  const bossSealBroken = computed<boolean>(() => {
    // 条件A：已探索格数达标
    if (visitedCells.value >= BOSS_SEAL_REQUIRED_CELLS) return true;
    // 条件B（选配）：守卫怪击败数达标。GUARD_MONSTER_COUNT=0 表示不启用守卫怪方案
    // 启用该方案时需额外维护 guardsDefeated 计数并持久化（本阶段默认不启用）
    return false;
  });

  /** 获取指定坐标的格子数据 */
  function getGridCell(x: number, y: number): ExplorationCell | null {
    return grid.value[y]?.[x] || null;
  }

  // ==================== 内部辅助方法 ====================

  /**
   * 持久化当前探索状态到数据库
   *
   * P3-151：补齐 try-catch + errorReporter 上报，参考 inventory/store.ts 的最佳实践。
   * persist 失败时 UI 与 DB 状态可能不一致，需通过 errorReporter 记录便于监测。
   */
  async function persistState(): Promise<void> {
    if (currentCharacterId.value) {
      try {
        await explorationDbService.saveExplorationData(
          currentCharacterId.value,
          state.value,
          assignedShopId.value
        );
      } catch (err) {
        errorReporter.report(err, 'manual', {
          context: '探索数据持久化失败，UI 与 DB 状态可能不一致',
          characterId: currentCharacterId.value,
        });
      }
    }
  }

  /** 检查探索是否完成（Boss 被击败 且 已充分探索网格） */
  function checkCompletion(): void {
    // P7-015 修复：放宽 visited 要求——boss 击败后即使有少量未访问格也允许完成，
    // 防止运行期连通性问题导致探索永远无法完成（网格生成期保证连通，但无运行期兜底）
    if (bossDefeated.value && visitedCells.value >= BOSS_SEAL_REQUIRED_CELLS) {
      explorationComplete.value = true;
    }
  }

  /**
   * 阶段三：刷新探索网格（视线 + 可访问性）
   *
   * 调用顺序固定为"先视线后扩散"：
   * 1. `applyVision`：基于玩家当前位置计算视线，标记 discovered（只增不减），
   *    被扫到的隐藏房间清除 hidden 标志（允许通行）。
   * 2. `updateAccessibleCells`：扩散 accessible，此时被视线扫到的隐藏房间 hidden 已清除，
   *    `isPassable` 不再阻止其被标记为可访问。
   *
   * 必须在 `playerPosition` 更新后调用，确保视线基于最新位置。
   */
  function refreshGrid(): void {
    const visionCells = computeVision(grid.value, playerPosition.value, VISION_RANGE);
    const visionedGrid = applyVision(grid.value, visionCells);
    grid.value = updateAccessibleCells(visionedGrid);
  }

  /**
   * 根据地点数据构建区域配置（含 DB 查询）
   * @param location - 地点数据
   * @returns 区域配置对象
   */
  async function buildAreaConfig(location: LocationData): Promise<AreaConfig> {
    const [minLevel, maxLevel] = location.levelRange;
    const avgLevel = Math.floor((minLevel + maxLevel) / 2);

    // 委托给 service 纯函数计算事件概率
    const eventProbability = computeEventProbability(avgLevel);

    // 怪物池和 Boss 池：直接使用地点数据，两者天然分离
    const monsterPool = location.enemies || [];
    const bossPool = location.bosses || [];

    // 物品池：委托给 service 纯函数筛选
    const allItems = await crossModuleQuery.getAllItemTemplates();
    const itemPool = buildItemPool(allItems, minLevel, maxLevel);

    return {
      // P6-105 修复：areaId 存储 location.id 而非 location.name，保持语义一致
      areaId: location.id,
      name: location.name,
      level: minLevel,
      eventProbability,
      monsterPool,
      bossPool,
      itemPool,
      // 阶段四：区域专属事件池，按 location.id 查找；未命中时为空（走通用事件）
      areaEvents: AREA_EVENT_TEMPLATES[location.id] ?? []
    };
  }

  /**
   * 从数据库加载区域配置并缓存
   * @param areaId - 区域 ID
   */
  async function loadAreaConfig(areaId: string): Promise<void> {
    const location = await crossModuleQuery.getLocationData(areaId);
    if (location) {
      currentAreaConfig.value = await buildAreaConfig(location);
    } else {
      // 回退：使用默认配置
      currentAreaConfig.value = {
        areaId,
        name: areaId,
        level: 1,
        eventProbability: { monster: 25, item: 20, trap: 15, event: 15, empty: 25 },
        monsterPool: [],
        bossPool: [],
        itemPool: ['small_health_potion']
      };
    }
  }

  /** 获取当前区域配置（优先使用缓存的，否则返回默认配置） */
  function getAreaConfig(): AreaConfig {
    return currentAreaConfig.value || {
      areaId: 'unknown',
      name: '未知区域',
      level: 1,
      eventProbability: { monster: 25, item: 20, trap: 15, event: 15, empty: 25 },
      monsterPool: [],
      bossPool: [],
      itemPool: ['small_health_potion']
    };
  }

  /**
   * 从数据库加载所有商店配置，随机选取一个作为本次探索的商店
   * @param rng - 随机数生成器，默认使用 defaultRng（DB-6 修复：支持注入确定性 RNG 用于测试与回放）
   */
  async function pickRandomShop(rng: Rng = defaultRng): Promise<void> {
    const shops = await crossModuleQuery.getAllShopConfigs();
    if (shops && shops.length > 0) {
      assignedShopId.value = rng.pick(shops).id;
    }
  }

  /**
   * 获取当前区域任务所需的非 Boss 怪物 ID 列表（去重后的优先怪物池）
   * @param areaId - 区域 ID
   * @returns 任务所需的怪物 ID 数组
   */
  async function getQuestRequiredMonsters(areaId: string): Promise<string[]> {
    const required: string[] = [];
    const seen = new Set<string>();
    // P10-040 说明：areaId 即 location.id，quest 数据中 boardId 与 location.id 取相同值
    // （如 'teldrassil'、'azuremyst'、'elwynn' 等），config_quests 的 boardId 字段是
    // 专门为匹配 location.id 而设计的，因此 areaId 可直接作为 boardId 查询。
    const quests = await crossModuleQuery.getQuestDefinitionsByBoard(areaId);
    for (const quest of quests) {
      for (const obj of quest.objectives) {
        if (obj.type === 'kill' && obj.enemyId) {
          // P10-047 修复：对同一 enemyId 去重，仅 push 一次。
          // generateGrid 通过遍历 questNormalMonsters 逐个占格放置怪物，
          // 数组长度决定占格数量。按 target 重复 push 会导致同一 enemyId 占用
          // 多个格子（如 target=5 会放 5 个相同怪物格），挤占网格空位。
          // generateGrid 只需知道该 enemyId 需要放置，击杀数量由任务 target 决定。
          if (!seen.has(obj.enemyId)) {
            seen.add(obj.enemyId);
            required.push(obj.enemyId);
          }
        }
      }
    }
    return required;
  }

  // ==================== Action：初始化 ====================

  /**
   * 初始化探索模块——从数据库加载角色探索状态
   *
   * P3-153 修复：currentCharacterId 已由 GameStore 统一管理（只读 computed 代理），
   * 调用方（GameBootstrap/ExplorationView）在调用 init 前已通过 character 模块的
   * selectCharacter/createCharacter 设置好 gameStore.currentCharacterId。
   * 此处保留 characterId 参数用于从 DB 加载该角色的探索数据。
   *
   * @param characterId - 角色 ID（应与 gameStore.currentCharacterId 一致）
   */
  async function init(characterId: string): Promise<void> {
    // P3-153：currentCharacterId 为只读 computed，由 GameStore 代理，无需在此赋值

    // 日志、背包等依赖 Store 已由 GameBootstrap 预先初始化（EXP-5 修复），此处仅加载自身状态
    const stored = await explorationDbService.getExplorationData(characterId);

    if (stored && stored.currentAreaId && stored.grid && stored.grid.length > 0) {
      // 从数据库恢复完整的探索状态
      currentAreaId.value = stored.currentAreaId;
      grid.value = stored.grid;
      campUsed.value = stored.campUsed;
      playerPosition.value = stored.playerPosition;
      visitedCells.value = stored.visitedCells;
      bossDefeated.value = stored.bossDefeated;
      explorationComplete.value = stored.explorationComplete;
      assignedShopId.value = stored.assignedShopId || '';
      isExploring.value = currentAreaId.value !== null;

      // 恢复区域配置
      await loadAreaConfig(stored.currentAreaId);

      // 恢复后基于玩家当前位置刷新视线与可访问性
      // refreshGrid 基于当前 playerPosition 重新计算视线，确保 discovered 状态正确。
      refreshGrid();
    } else {
      currentAreaId.value = null;
      grid.value = [];
      campUsed.value = false;
      isExploring.value = false;
      playerPosition.value = { x: 0, y: 0 };
      visitedCells.value = 1; // P5-014 修复：无网格时为 1（起点占位，与 enterArea 的 3 区分）
      bossDefeated.value = false;
      explorationComplete.value = false;
    }

    // 设置跨模块监听（仅 COMBAT_END 战斗结算）
    setupCombatListener();
  }

  // ==================== Action：进入区域 / 开始探索 ====================

  /**
   * 进入指定区域进行探索（兼容旧 API，等同于 startExploration）
   * 加载区域配置 → 生成网格 → 持久化 → 发射探索开始事件
   * @param areaId - 区域 ID
   */
  async function enterArea(areaId: string): Promise<void> {
    currentAreaId.value = areaId;

    // 1. 加载区域配置（含怪物池、Boss 池、物品池）
    await loadAreaConfig(areaId);

    // 2. 随机选取商店
    await pickRandomShop();

    // 3. 获取任务所需的怪物列表，并过滤掉 Boss（Boss 由固定事件放置，不应出现在普通怪物格子中）
    const questMonsters = await getQuestRequiredMonsters(areaId);
    const areaConfig = getAreaConfig();
    const bossPool = areaConfig.bossPool;
    const questNormalMonsters: string[] = questMonsters.filter(id => !bossPool.includes(id));

    // 4. 调用纯函数生成网格
    const newGrid = generateGrid({
      size: GRID_SIZE,
      eventProbability: areaConfig.eventProbability,
      monsterPool: areaConfig.monsterPool,
      bossPool: areaConfig.bossPool,
      questNormalMonsters
    });

    // 5. 找到起点并更新状态
    const startPos = findStartPosition(newGrid);
    grid.value = newGrid;
    playerPosition.value = startPos;
    visitedCells.value = DEFAULT_VISITED_CELLS; // P5-014 修复：统一默认值
    campUsed.value = false;
    bossDefeated.value = false;
    explorationComplete.value = false;
    isExploring.value = true;

    // 6. 更新可访问状态
    refreshGrid();

    // 7. 持久化
    await persistState();

    // 8. 发射 UI/音效事件
    eventBus.emit(GameEvents.EXPLORATION_START, { characterId: currentCharacterId.value, areaId });

    // 获取地点数据并发射区域进入事件
    const location = await crossModuleQuery.getLocationData(areaId);
    if (location) {
      // P3 BIZ-7 审计决策（2026-07-31）：
      // - 消费者清单：audio/service.ts:369 监听 ZONE_ENTERED 但不读 data（仅 playSfx('door_open')）
      // - 当前无消费者读取 data.location，理论上可移除该字段
      // - 保留原因：测试中存在断言 location 字段的用例（test/exploration/store.test.ts:252），
      //   且未来 UI 可能需要展示地点信息（如区域名称提示）
      // - 后续清理：若确认无 UI 消费者，可移除 location 字段并更新对应测试
      eventBus.emit(GameEvents.ZONE_ENTERED, { locationId: areaId, location });
    }

    // 9. 记录冒险日志
    const areaName = currentAreaConfig.value?.name || '未知区域';
    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'exploration',
      message: `开始探索：${areaName}`,
      icon: 'game-icons:treasure-map'
    });
  }

  // ==================== Action：探索格子 ====================

  /**
   * 揭示指定坐标的格子并触发对应事件。
   *
   * 处理逻辑分为三条路径：
   * 1. 怪物/BOSS 格子 → 触发战斗，挂起等待 COMBAT_END 事件回调
   * 2. 商店/任务板 → 可直接交互，发射探索事件通知 UI 打开对应面板
   * 3. 宝箱/陷阱/事件/营地 → 立即结算效果（物品/伤害/随机事件/恢复）
   *
   * @param x - X 坐标
   * @param y - Y 坐标
   * @returns 是否成功揭示
   */
  async function revealGrid(x: number, y: number): Promise<boolean> {
    const cell = grid.value[y]?.[x];
    // 允许 accessible 的格子（新探索）以及已探索但未完成的格子（商店/任务板/未击败怪物）交互
    if (!cell || (!cell.accessible && !cell.explored) || cell.completed) {
      return false;
    }

    const characterStore = useCharacterStore();
    const inventoryStore = useInventoryStore();

    // ===== 路径 1：怪物/BOSS 格子 → 触发战斗 =====
    if (cell.type === 'monster' || cell.type === 'boss') {
      // 阶段四：Boss 封印防御——movePlayer 已检查，但 revealGrid 作为公共入口
      // （revealAllCells/控制台）可能被直接调用，此处二次拦截避免绕过封印
      if (cell.type === 'boss' && cell.sealed && !bossSealBroken.value) {
        return false;
      }
      // P3-137 阶段 0.7 + 阶段 3：兜底 ID 使用新命名规范
      // 优先取当前区域怪物池/Boss 池首个 ID 作为兜底，避免硬编码
      const areaConfig = getAreaConfig();
      const battleId = cell.monsterId || (cell.type === 'boss'
        ? (areaConfig.bossPool[0] ?? 'boss_dragon_whelp')
        : (areaConfig.monsterPool[0] ?? 'mob_gnoll'));
      triggerBattle(battleId);
      // 记录待处理的战斗格子，COMBAT_END 事件回调会消费此坐标
      pendingBattleCell.value = { x, y };
      return true;
    }

    // ===== 路径 2：商店/任务板 → 发射交互事件 =====
    if (cell.type === 'shop' || cell.type === 'board') {
      // P7-014 修复：shop/board 在 placeFixedEvents 时已设 visited:true，无需重复计数
      cell.explored = true;
      cell.visited = true;

      refreshGrid();

      const interactionId = cell.type === 'shop' ? assignedShopId.value : 'board_main';
      eventBus.emit(GameEvents.EXPLORATION_CELL_EXPLORED, {
        characterId: currentCharacterId.value,
        x,
        y,
        cellType: cell.type,
        interactionId
      });

      // 同步通知已注册的 UI 回调（替代 EventBus 跨模块监听）
      uiCallbacks.value?.onCellExplored?.({ cellType: cell.type, interactionId });

      await persistState();
      return true;
    }

    // ===== 路径 3：宝箱/陷阱/事件/营地 → 立即结算 =====
    // 已探索且已完成的格子不允许再次交互
    if (cell.explored && cell.completed) {
      return false;
    }

    const isFirstVisit = !cell.explored;
    cell.explored = true;
    cell.visited = true;
    if (isFirstVisit) {
      visitedCells.value++;
      // P3-149：探索新格触发 explore 任务进度
      await useQuestStore().onCellExplored(currentAreaId.value ?? undefined);
    }

    // P9-036 修复：记录事件格坐标，供 applyEventChoice 精确定位
    if (cell.type === 'event') {
      pendingEventCell.value = { x, y };
    }

    // 通过事件处理器注册表分发格子事件（ARCH-11 修复）
    // 处理逻辑迁移至 events.ts 的 cellEventHandlers，store.ts 不再硬编码每个 cell 类型。
    // 必须在 updateAccessibleCells 之前完成，否则 completed 状态无法通过浅拷贝同步到新网格中。
    const cellResult = await dispatchCellEvent(cell.type, {
      cell,
      characterStore,
      inventoryStore,
      areaConfig: getAreaConfig(),
      uiCallbacks: uiCallbacks.value,
      characterId: currentCharacterId.value,
      campUsed: campUsed.value
    });

    if (cellResult.completed) {
      cell.completed = true;
    }
    if (cellResult.campUsed) {
      campUsed.value = true;
      await persistState();
    }
    if (cellResult.shouldHandleDeath) {
      // BIZ-9 修复：探索中死亡需手动触发 handleDeath（战斗中由 endCombat 统一处理）
      // 先更新网格状态以反映 cell.completed，再触发死亡处理
      refreshGrid();
      await persistState();
      await characterStore.handleDeath();
      return true;
    }

    // 更新可访问格子（浅拷贝会将上面设置的 completed 状态同步到新网格）
    refreshGrid();

    // 发射格子探索事件
    eventBus.emit(GameEvents.EXPLORATION_CELL_EXPLORED, {
      characterId: currentCharacterId.value,
      x,
      y
    });

    // 同步通知已注册的 UI 回调（无 cellType 的普通格子探索）
    uiCallbacks.value?.onCellExplored?.({});

    checkCompletion();
    await persistState();
    return true;
  }

  // ==================== Action：玩家移动（阶段二） ====================

  /**
   * 玩家实体化移动到 4 邻域可通行格（阶段二主入口）。
   *
   * 校验链：目标格存在 → 非战斗挂起 → 4 邻域 + isPassable → 目标格类型分发。
   * 落点决策（用户确认：立即推进，失败时回退）：
   *   - 怪物/Boss：先记录 previousPosition 并推进 playerPosition 到目标格，再调 revealGrid
   *     触发战斗；胜利保持位置，失败/逃跑由 onBattleResult 回退到 previousPosition。
   *   - 商店/任务板/营地/宝箱/陷阱/事件/空地：推进 playerPosition 后调 revealGrid 结算。
   *   - 点击玩家当前格：仅驻留格（商店/任务板/营地）允许打开面板，不消耗移动。
   *
   * revealGrid 保留旧 accessible||explored 校验作为兼容入口（revealAllCells/控制台），
   * movePlayer 通过 isPassable 把关后确保目标格 accessible=true 以通过 revealGrid 入口。
   *
   * @param x - 目标格 X 坐标
   * @param y - 目标格 Y 坐标
   * @returns 是否成功移动（触发战斗/结算事件）
   */
  async function movePlayer(x: number, y: number): Promise<boolean> {
    const cell = grid.value[y]?.[x];
    if (!cell) return false;

    // 战斗未结束时拒绝新移动，防止状态错乱
    if (pendingBattleCell.value) return false;

    // 点击玩家当前格：仅驻留格（商店/任务板/营地）允许打开面板，不消耗移动
    if (x === playerPosition.value.x && y === playerPosition.value.y) {
      if (cell.type === 'shop' || cell.type === 'board' || cell.type === 'rest') {
        return revealGrid(x, y);
      }
      return false;
    }

    // 移动校验：4 邻域 + isPassable（墙判断 + 隐藏房间未揭示拦截）
    if (!isPassable(grid.value, playerPosition.value, { x, y })) return false;

    // 阶段四：Boss 封印判定——未解锁时不推进位置、不触发战斗
    // UI 层（ExplorationView）通过 bossSealBroken computed 判断是否显示封印提示
    if (cell.type === 'boss' && cell.sealed && !bossSealBroken.value) {
      return false;
    }

    // 未击败的怪物/Boss：立即推进，记录 previousPosition 供战斗落点回退
    if ((cell.type === 'monster' || cell.type === 'boss') && !cell.completed) {
      previousPosition.value = { ...playerPosition.value };
      playerPosition.value = { x, y };
      // 确保 revealGrid 入口校验通过（isPassable 已确认可通行）
      cell.accessible = true;
      await revealGrid(x, y); // 触发战斗，设置 pendingBattleCell
      return true;
    }

    // 其他格（含已击败怪物/已开宝箱等 completed 格）：推进位置后结算
    // completed 格 revealGrid 入口拒绝（无事件），但位置推进成功，玩家可穿过已清理区域
    playerPosition.value = { x, y };
    cell.accessible = true;
    const revealed = await revealGrid(x, y);
    // P9-034 修复：revealGrid 对 completed 格返回 false，但仍需刷新视线以更新可见区域
    if (!revealed) {
      refreshGrid();
    }
    return true;
  }

  // ==================== Action：战斗结果 ====================

  /**
   * 处理战斗结果（供 COMBAT_END 事件监听调用）。
   *
   * 三条分支（阶段二新增位置回退）：
   * - 胜利 → 格子标记已完成/不可访问，Boss 格额外设置 bossDefeated 标志；
   *   playerPosition 保持怪物格（movePlayer 已推进），清空 previousPosition。
   * - 失败/逃跑 → 揭示格子内容，保留 monsterId 允许再次挑战；
   *   playerPosition 回退到 previousPosition（原位），清空 previousPosition。
   * - 无 previousPosition（兼容旧路径直接调 revealGrid 触发的战斗）→ 位置不变。
   *
   * @param victory - 是否胜利
   */
  async function onBattleResult(victory: boolean): Promise<void> {
    const cellCoords = pendingBattleCell.value;
    if (!cellCoords) return;

    const { x, y } = cellCoords;
    const cell = grid.value[y]?.[x];

    if (!cell) {
      pendingBattleCell.value = null;
      previousPosition.value = null;
      return;
    }

    if (victory) {
      // 战斗胜利：标记格子为已探索
      if (cell.type === 'boss') {
        bossDefeated.value = true;
      }
      if (!cell.explored) {
        cell.explored = true;
        cell.visited = true;
        visitedCells.value++;
        // P3-149：探索新格触发 explore 任务进度
        await useQuestStore().onCellExplored(currentAreaId.value ?? undefined);
      }
      cell.completed = true; // 击败后标记为已完成，前端显示褪色
      cell.accessible = false;
      // 胜利保持 playerPosition（已在怪物格），清空 previousPosition
      previousPosition.value = null;

      refreshGrid();
      checkCompletion();
      await persistState();
    } else {
      // 战斗失败或逃跑：揭示格子内容，但保持可再次挑战
      if (!cell.explored) {
        cell.explored = true;
        cell.visited = true;
        visitedCells.value++;
        // P6-101 修复：战斗失败/逃跑不应触发 explore 任务进度（仅胜利才算探索成功）
      }
      // 失败/逃跑：回退到 previousPosition（movePlayer 记录的原位）
      if (previousPosition.value) {
        playerPosition.value = { ...previousPosition.value };
        previousPosition.value = null;
      }
      refreshGrid();
      // P9-092 修复：失败路径也触发 checkCompletion，确保已满足条件时能正确标记探索完成
      checkCompletion();
      await persistState();
    }

    pendingBattleCell.value = null;
  }

  // ==================== Action：触发战斗 ====================

  /** 触发战斗事件（通过 EventBus 通知战斗模块） */
  function triggerBattle(monsterId: string): void {
    const areaConfig = getAreaConfig();
    const areaLevel = areaConfig.level;

    eventBus.emit(GameEvents.EXPLORATION_BATTLE_TRIGGERED, {
      characterId: currentCharacterId.value,
      eventData: { monsterId, areaLevel }
    });

    // 同步通知已注册的 UI 回调（替代 EventBus 跨模块监听）
    uiCallbacks.value?.onBattleTriggered?.({ eventData: { monsterId, areaLevel } });
  }

  // ==================== Action：结束探索 ====================

  /** 重置探索内存状态（兼容旧 reset() API） */
  function reset(): void {
    const hadActiveExploration = currentAreaId.value !== null;

    currentAreaId.value = null;
    grid.value = [];
    campUsed.value = false;
    isExploring.value = false;
    playerPosition.value = { x: 0, y: 0 };
    visitedCells.value = 1; // P5-014 修复：无网格时为 1（起点占位，与 enterArea 的 3 区分）
    bossDefeated.value = false;
    explorationComplete.value = false;
    pendingBattleCell.value = null;
    previousPosition.value = null;
    currentAreaConfig.value = null;
    assignedShopId.value = '';
    pendingEventCell.value = null;

    eventBus.emit(GameEvents.EXPLORATION_END, { characterId: currentCharacterId.value });

    // 只在真正有探索进行中时才记录日志
    if (hadActiveExploration) {
      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'exploration',
        message: '探索结束',
        icon: 'game-icons:entry-door'
      });
    }
  }

  /** 退出探索（reset 的别名，保留以兼容外部旧调用） */
  function exitExploration(): void {
    reset();
  }

  // ==================== 内部处理：营地、事件选择（ARCH-11 修复后物品/陷阱/随机事件逻辑迁移至 events.ts） ====================

  /**
   * 应用多选项事件中玩家选择的选项效果
   *
   * 玩家在多选项事件弹窗中选择某个选项后，UI 调用此方法应用对应效果。
   * 通过 effectHandlers 注册表分发，避免硬编码每个效果类型的 switch。
   *
   * @param choice - 玩家选择的事件选项
   */
  async function applyEventChoice(choice: EventChoice): Promise<void> {
    const characterStore = useCharacterStore();
    const { type, amount } = choice.effect;

    // 通过效果处理器注册表分发（ARCH-11 修复）
    // P2 TS-6 修复：参数类型已使用 EventChoice，effect.type 已是 RandomEventEffectType，消除断言
    const shouldHandleDeath = await applyEventEffect(
      type,
      {
        characterStore,
        inventoryStore: useInventoryStore(),
        areaConfig: getAreaConfig(),
        uiCallbacks: uiCallbacks.value,
        characterId: currentCharacterId.value
      },
      amount
    );

    // P5-013 修复：玩家做出选择后，标记当前格子为已完成
    // P9-036 修复：优先使用 pendingEventCell 精确定位事件格，替代全网格搜索
    const coords = pendingEventCell.value;
    const pos = playerPosition.value;
    const cell = coords
      ? grid.value[coords.y]?.[coords.x]
      : grid.value[pos.y]?.[pos.x];

    if (cell && cell.type === 'event' && !cell.completed) {
      cell.completed = true;
      refreshGrid();
      await persistState();
    } else if (!cell || cell.type !== 'event') {
      // 兜底：pendingEventCell 未记录时搜索整个 grid 找到第一个未完成的事件格
      let targetCell: ExplorationCell | null = null;
      for (const row of grid.value) {
        for (const c of row) {
          if (c.type === 'event' && !c.completed) {
            targetCell = c;
            break;
          }
        }
        if (targetCell) break;
      }
      if (targetCell) {
        targetCell.completed = true;
        refreshGrid();
        await persistState();
      }
    }
    pendingEventCell.value = null;

    if (shouldHandleDeath) {
      // BIZ-9 修复：探索中死亡需手动触发 handleDeath
      await characterStore.handleDeath();
      return;
    }

    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'info',
      message: `选择：${choice.label}`,
      icon: choice.icon || 'game-icons:choice'
    });
  }

  /**
   * 使用营地休息，恢复全部生命值和法力值
   *
   * 通过 cellEventHandlers.rest 注册表分发，复用与 revealGrid 路径 3 相同的恢复逻辑。
   * 营地只能使用一次：campUsed 已为 true 时直接返回。
   */
  async function useCamp(): Promise<void> {
    if (campUsed.value) {
      return;
    }

    const characterStore = useCharacterStore();
    // 通过事件处理器注册表分发营地事件（ARCH-11 修复）
    // 传入最小 cell 对象（rest handler 不依赖坐标等字段）
    const result = await dispatchCellEvent('rest', {
      cell: { x: 0, y: 0, type: 'rest', explored: true, accessible: false, visited: true },
      characterStore,
      inventoryStore: useInventoryStore(),
      areaConfig: getAreaConfig(),
      uiCallbacks: uiCallbacks.value,
      characterId: currentCharacterId.value,
      campUsed: campUsed.value
    });

    if (result.campUsed) {
      campUsed.value = true;
      // P8-021 修复：通过 playerPosition 获取真实营地格并标记 completed
      const pos = playerPosition.value;
      const cell = grid.value[pos.y]?.[pos.x];
      if (cell) {
        cell.completed = true;
        refreshGrid();
      }
      await persistState();
    }
  }

  // ==================== 跨模块监听（仅 COMBAT_END） ====================

  /** 监听战斗结束事件，处理探索中的战斗结果。
   *
   * 使用分组订阅（'exploration'），便于在 dispose() 中一次性清理所有监听器，
   * 避免角色切换或组件重挂载时监听器累积导致的状态错乱（EXP-1 修复）。
   */
  function setupCombatListener(): void {
    // 先清理旧监听器，确保 init 多次调用时不会累积（EXP-1）
    eventBus.clearGroup('exploration');
    eventBus.onGroup('exploration', GameEvents.COMBAT_END, (data: { result: string }) => {
      const isVictory = data.result === 'victory';
      onBattleResult(isVictory);
    });
  }

  // ==================== 调试 / 开发用 ====================

  /**
   * 揭示当前探索区域的所有格子（调试/控制台命令专用）
   * 构建全新网格对象，将所有格子的 explored/visited 设为 true，accessible 设为 false
   */
  async function revealAllCells(): Promise<void> {
    if (!currentAreaId.value || grid.value.length === 0) {
      console.warn('[探索] 当前没有激活的探索区域');
      return;
    }

    // 构建全新网格 — 每个 cell 都是新对象，确保 Vue computed 能追踪到引用变化
    const newGrid: ExplorationCell[][] = grid.value.map(row =>
      row.map(cell => ({
        ...cell,
        explored: true,
        visited: true,
        accessible: false,
      }))
    );

    grid.value = newGrid;
    visitedCells.value = GRID_SIZE * GRID_SIZE;
    // P6-100 修复：revealAllCells 同时设置 bossDefeated，使 checkCompletion 能正常触发
    bossDefeated.value = true;
    checkCompletion();
    await persistState();
  }

  // ==================== 清洁 ====================

  /** 清理资源：清除探索模块的所有 EventBus 监听器与 UI 回调，重置挂起状态（EXP-2 修复）
   *
   * P4-018 说明：dispose() 清除 COMBAT_END 监听后不会自动重挂。
   * 调用方（GameBootstrap）须确保 dispose 后重新调用 init() 才能恢复监听。
   * 当前架构中 dispose 仅在角色切换/退出时调用，随后 init 会被重新调用，
   * 属于配对使用模式。若未来出现 dispose 后不 init 但继续探索的场景，需显式重调 init。
   */
  function dispose(): void {
    // 1. 清理 EventBus 监听器（分组订阅一次性移除，避免监听器累积）
    eventBus.clearGroup('exploration');

    // 2. 清理 UI 回调
    uiCallbacks.value = null;

    // 3. 重置挂起的战斗格子坐标与战斗前位置
    pendingBattleCell.value = null;
    previousPosition.value = null;
    pendingEventCell.value = null;
  }

  // ==================== 导出 ====================

  return {
    // 响应式状态
    currentAreaId,
    grid,
    campUsed,
    isExploring,
    playerPosition,
    visitedCells,
    bossDefeated,
    explorationComplete,

    // 计算属性
    state,
    hasStartedExploration,
    bossSealBroken,
    getGridCell,

    // Action（核心流程）
    init,
    enterArea,
    revealGrid,
    movePlayer,
    revealAllCells,
    onBattleResult,
    triggerBattle,
    reset,
    exitExploration,
    useCamp,
    applyEventChoice,

    // 生命周期
    dispose,

    // 回调注册（替代 EventBus 跨模块数据事件）
    registerUICallbacks,
    unregisterUICallbacks
  };
});
