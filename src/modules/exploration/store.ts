/**
 * @fileoverview 探索模块状态管理层（Store 核心架构）
 * @description Store 是探索数据的唯一持有者，所有响应式状态集中管理。
 * Action 负责编排：调用 Service 纯函数 → 更新 Store 状态 → 调用 DB 持久化 → 通知其他模块。
 * 跨模块通信全部改为直接 Store Action 调用，不再通过 EventBus 发射数据变更事件。
 * @module exploration
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { ExplorationCell, ExplorationState, AreaConfig, ExplorationUICallbacks } from './types';
import type { LocationData } from '../map/types';
import { explorationDbService } from './db';
import { mapDbService } from '../map/db';
import { inventoryDbService } from '../inventory/db';
import { questDbService } from '../quest/db';
import { shopDbService } from '../shop/db';
import { eventBus, GameEvents } from '../bus/core';
import { useLogStore } from '../log/store';
import { generateLogId } from '../log/service';
import { useCharacterStore } from '../character/store';
import { useInventoryStore } from '../inventory/store';
import {
  generateGrid,
  findStartPosition,
  updateAccessibleCells,
  generateTrapDamage,
  generateRandomEvent,
  generateCampHeal,
  generateItemForCell,
  computeEventProbability,
  buildItemPool
} from './service';

/** 默认网格尺寸 */
const GRID_SIZE = 10;
/** 初始移动步数 */
const INITIAL_MOVES = 20;

/**
 * 探索 UI 回调接口 —— 供 GameMain 等 UI 组件注册，替代 EventBus 跨模块监听。
 * 当探索 Store 内部触发格子探索、战斗、物品发现、陷阱、随机事件时，
 * 同步调用已注册的回调，避免 UI 组件直接依赖 EventBus 进行数据通信。
 * @deprecated 类型定义已迁移到 ./types.ts，此处保留注释供参考
 */

export const useExplorationStore = defineStore('exploration', () => {
  // ==================== 响应式状态（Store 是唯一数据源） ====================

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
  /** 剩余移动步数 */
  const remainingMoves = ref(INITIAL_MOVES);
  /** Boss 是否已被击败 */
  const bossDefeated = ref(false);
  /** 探索是否完成 */
  const explorationComplete = ref(false);

  /** 当前选中的角色 ID */
  const currentCharacterId = ref<string | null>(null);
  /** 当前等待战斗结果的格子坐标 */
  const pendingBattleCell = ref<{ x: number; y: number } | null>(null);
  /** 本次探索随机选取的商店 ID */
  const assignedShopId = ref('');
  /** 当前区域配置（缓存） */
  const currentAreaConfig = ref<AreaConfig | null>(null);

  // ==================== UI 回调（替代 EventBus 跨模块数据事件） ====================

  /** 注册的 UI 回调集（由 GameMain 等 UI 组件设置） */
  let uiCallbacks: ExplorationUICallbacks | null = null;

  /** 注册 UI 回调 */
  function registerUICallbacks(callbacks: ExplorationUICallbacks): void {
    uiCallbacks = callbacks;
  }

  /** 取消注册 UI 回调 */
  function unregisterUICallbacks(): void {
    uiCallbacks = null;
  }

  // ==================== 计算属性 ====================

  /** 探索状态对象（兼容旧 API，供 ExplorationView 使用 */
  const state = computed<ExplorationState>(() => ({
    currentAreaId: currentAreaId.value,
    grid: grid.value,
    campUsed: campUsed.value,
    playerPosition: playerPosition.value,
    visitedCells: visitedCells.value,
    remainingMoves: remainingMoves.value,
    bossDefeated: bossDefeated.value,
    explorationComplete: explorationComplete.value
  }));

  /** 是否已开始探索 */
  const hasStartedExploration = computed(() => currentAreaId.value !== null);

  /** 获取指定坐标的格子数据 */
  function getGridCell(x: number, y: number): ExplorationCell | null {
    return grid.value[y]?.[x] || null;
  }

  // ==================== 内部辅助方法 ====================

  /** 持久化当前探索状态到数据库 */
  async function persistState(): Promise<void> {
    if (currentCharacterId.value) {
      await explorationDbService.saveExplorationData(
        currentCharacterId.value,
        state.value,
        assignedShopId.value
      );
    }
  }

  /** 检查探索是否完成（所有格子已探索 且 Boss 被击败） */
  function checkCompletion(): void {
    const totalCells = GRID_SIZE * GRID_SIZE;
    if (visitedCells.value >= totalCells || bossDefeated.value) {
      explorationComplete.value = true;
    }
  }

  /**
   * 根据地点数据构建区域配置（含 DB 查询）   * @param location - 地点数据
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
    const allItems = await inventoryDbService.getAllItemTemplates();
    const itemPool = buildItemPool(allItems, minLevel, maxLevel);

    return {
      areaId: location.name,
      name: location.name,
      level: minLevel,
      eventProbability,
      monsterPool,
      bossPool,
      itemPool
    };
  }

  /**
   * 从数据库加载区域配置并缓存
   * @param areaId - 区域 ID
   */
  async function loadAreaConfig(areaId: string): Promise<void> {
    const location = await mapDbService.getLocationData(areaId);
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

  /** 从数据库加载所有商店配置，随机选取一个作为本次探索的商店 */
  async function pickRandomShop(): Promise<void> {
    const shops = await shopDbService.getAllShopConfigs();
    if (shops && shops.length > 0) {
      const idx = Math.floor(Math.random() * shops.length);
      assignedShopId.value = shops[idx].id;
    }
  }

  /**
   * 获取当前区域任务所需的非 Boss 怪物 ID 列表（去重后的优先怪物池）
   * @param areaId - 区域 ID
   * @returns 任务所需的怪物 ID 数组
   */
  async function getQuestRequiredMonsters(areaId: string): Promise<string[]> {
    const required: string[] = [];
    const quests = await questDbService.getQuestDefinitionsByBoard(areaId);
    for (const quest of quests) {
      for (const obj of quest.objectives) {
        if (obj.type === 'kill' && obj.enemyId) {
          for (let i = 0; i < obj.target; i++) {
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
   * @param characterId - 角色 ID
   */
  async function init(characterId: string): Promise<void> {
    currentCharacterId.value = characterId;

    // 确保日志 Store 已初始化
    useLogStore().initialize(characterId);

    // 确保背包 Store 已初始化
    const inventoryStore = useInventoryStore();
    await inventoryStore.initialize(characterId);

    const stored = await explorationDbService.getExplorationData(characterId);

    if (stored && stored.currentAreaId && stored.grid && stored.grid.length > 0) {
      // 从数据库恢复完整的探索状态
      currentAreaId.value = stored.currentAreaId;
      grid.value = stored.grid as unknown as ExplorationCell[][];
      campUsed.value = stored.campUsed;
      playerPosition.value = stored.playerPosition;
      visitedCells.value = stored.visitedCells;
      remainingMoves.value = stored.remainingMoves;
      bossDefeated.value = stored.bossDefeated;
      explorationComplete.value = stored.explorationComplete;
      assignedShopId.value = stored.assignedShopId || '';
      isExploring.value = currentAreaId.value !== null;

      // 恢复区域配置
      await loadAreaConfig(stored.currentAreaId);
    } else {
      currentAreaId.value = null;
      grid.value = [];
      campUsed.value = false;
      isExploring.value = false;
      playerPosition.value = { x: 0, y: 0 };
      visitedCells.value = 0;
      remainingMoves.value = INITIAL_MOVES;
      bossDefeated.value = false;
      explorationComplete.value = false;
    }

    // 设置跨模块监听（仅 COMBAT_END 战斗结算）
    setupCombatListener();
  }

  // ==================== Action：进入区域 / 开始探索 ====================

  /**
   * 进入指定区域进行探索（兼容旧 API，等同于 startExploration）
   * 加载区域配置 → 生成网格 → 持久化 → 发射探索开始事件   * @param areaId - 区域 ID
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
    visitedCells.value = 3; // 起点、商店、任务板默认已访问
    remainingMoves.value = INITIAL_MOVES;
    campUsed.value = false;
    bossDefeated.value = false;
    explorationComplete.value = false;
    isExploring.value = true;

    // 6. 更新可访问状态
    grid.value = updateAccessibleCells(grid.value);

    // 7. 持久化
    await persistState();

    // 8. 发射 UI/音效事件
    eventBus.emit(GameEvents.EXPLORATION_START, { characterId: currentCharacterId.value, areaId });

    // 获取地点数据并发射区域进入事件
    const location = await mapDbService.getLocationData(areaId);
    if (location) {
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
   * 揭示指定坐标的格子并触发对应事件（兼容旧 API）
   * 根据格子类型：怪物/BOSS 触发战斗、商店/任务板打开交互。
   * 宝箱发放物品、陷阱造成伤害、营地提供恢复、事件触发随机效果
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

    // 怪物/BOSS 格子：未被击败时可触发战斗
    if (cell.type === 'monster' || cell.type === 'boss') {
      const battleId = cell.monsterId || (cell.type === 'boss' ? 'dragon_whelp' : 'goblin');
      triggerBattle(battleId);
      pendingBattleCell.value = { x, y };
      return true;
    }

    // 商店和任务看板：可多次交互，始终标记为已探索但保持可访问
    if (cell.type === 'shop' || cell.type === 'board') {
      const isNewlyVisited = !cell.visited;
      cell.explored = true;
      cell.visited = true;
      if (isNewlyVisited) {
        visitedCells.value++;
      }

      grid.value = updateAccessibleCells(grid.value);

      const interactionId = cell.type === 'shop' ? assignedShopId.value : 'board_main';
      eventBus.emit(GameEvents.EXPLORATION_CELL_EXPLORED, {
        characterId: currentCharacterId.value,
        x,
        y,
        cellType: cell.type,
        interactionId
      });

      // 同步通知已注册的 UI 回调（替代 EventBus 跨模块监听）
      uiCallbacks?.onCellExplored?.({ cellType: cell.type, interactionId });

      await persistState();
      return true;
    }

    // 其他格子：正常揭示逻辑（已探索且未完成则允许再次交互，如 revealAll 后点击宝箱/陷阱）
    if (cell.explored && cell.completed) {
      return false;
    }

    const isFirstVisit = !cell.explored;
    cell.explored = true;
    cell.visited = true;
    if (isFirstVisit) {
      visitedCells.value++;
    }

    // 先处理格子事件（必须在 updateAccessibleCells 之前，
    // 否则 completed 状态无法通过浅拷贝同步到新网格中）
    switch (cell.type) {
      case 'treasure': {
        const areaConfig = getAreaConfig();
        const randomItemId = generateItemForCell(areaConfig.itemPool);
        if (randomItemId) {
          await handleItemFound(randomItemId, inventoryStore);
        }
        cell.completed = true;
        break;
      }
      case 'trap': {
        await handleTrapTriggered(characterStore);
        cell.completed = true;
        break;
      }
      case 'event': {
        await handleRandomEventTriggered(characterStore);
        cell.completed = true;
        break;
      }
      case 'rest': {
        await useCampInternal(characterStore);
        cell.completed = true;
        break;
      }
    }

    // 更新可访问格子（浅拷贝会将上面设置的 completed 状态同步到新网格）
    grid.value = updateAccessibleCells(grid.value);

    // 发射格子探索事件
    eventBus.emit(GameEvents.EXPLORATION_CELL_EXPLORED, {
      characterId: currentCharacterId.value,
      x,
      y
    });

    // 同步通知已注册的 UI 回调（无 cellType 的普通格子探索）
    uiCallbacks?.onCellExplored?.({});

    checkCompletion();
    await persistState();
    return true;
  }

  // ==================== Action：战斗结果 ====================

  /**
   * 处理战斗结果（供 COMBAT_END 事件监听调用）
   * 胜利时清空怪物/Boss 格子；失败或逃跑时揭示格子内容但保留怪物允许再次挑战
   * @param victory - 是否胜利
   */
  async function onBattleResult(victory: boolean): Promise<void> {
    const cellCoords = pendingBattleCell.value;
    if (!cellCoords) return;

    const { x, y } = cellCoords;
    const cell = grid.value[y]?.[x];

    if (!cell) {
      pendingBattleCell.value = null;
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
      }
      cell.completed = true; // 击败后标记为已完成，前端显示褪色
      cell.accessible = false;

      grid.value = updateAccessibleCells(grid.value);
      checkCompletion();
      await persistState();
    } else {
      // 战斗失败或逃跑：揭示格子内容，但保持可再次挑战
      if (!cell.explored) {
        cell.explored = true;
        cell.visited = true;
        visitedCells.value++;
      }
      grid.value = updateAccessibleCells(grid.value);
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
    uiCallbacks?.onBattleTriggered?.({ eventData: { monsterId, areaLevel } });
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
    visitedCells.value = 0;
    remainingMoves.value = INITIAL_MOVES;
    bossDefeated.value = false;
    explorationComplete.value = false;
    pendingBattleCell.value = null;
    currentAreaConfig.value = null;
    assignedShopId.value = '';

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

  /** 退出探索（兼容旧 exitExploration() API） */
  function exitExploration(): void {
    reset();
  }

  // ==================== 内部处理：物品、陷阱、营地、随机事件 ====================

  /**
   * 处理发现物品事件
   * 检查物品模板是否存在，存在则添加到背包；不存在则发放金币/经验作为兜底补偿
   */
  async function handleItemFound(itemId: string, inventoryStore: ReturnType<typeof useInventoryStore>): Promise<void> {
    const item = inventoryStore.getItemInfo(itemId);
    if (item) {
      // 先记录"发现"日志，再触发物品入包
      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'item',
        message: `发现物品: ${item.name}`,
        icon: 'game-icons:chest'
      });

      // 直接调用 Inventory Store Action 添加物品
      inventoryStore.addItem(itemId, 1);

      eventBus.emit(GameEvents.EXPLORATION_ITEM_FOUND, {
        characterId: currentCharacterId.value,
        itemId,
        count: 1,
        itemName: item.name
      });

      // 同步通知已注册的 UI 回调（替代 EventBus 跨模块监听）
      uiCallbacks?.onItemFound?.({ itemId, count: 1, itemName: item.name });
    } else {
      // 兜底：物品模板不存在时，发放金币和经验作为补偿
      console.warn(`[探索] 物品模板 "${itemId}" 不存在，发放兜底奖励`);
      const gold = Math.floor(Math.random() * 30) + 5;
      const exp = Math.floor(Math.random() * 15) + 3;

      const characterStore = useCharacterStore();
      await characterStore.gainGold(gold);
      await characterStore.gainExp(exp);

      useLogStore().addLogEntry({
        id: generateLogId(),
        timestamp: Date.now(),
        type: 'item',
        message: `发现宝箱，获得 ${gold} 金币、${exp} 经验`,
        icon: 'game-icons:chest'
      });

      eventBus.emit(GameEvents.EXPLORATION_ITEM_FOUND, {
        characterId: currentCharacterId.value,
        itemId,
        count: 0,
        itemName: `未知物品（已转换为 ${gold} 金币 + ${exp} 经验）`
      });

      // 同步通知已注册的 UI 回调（替代 EventBus 跨模块监听）
      uiCallbacks?.onItemFound?.({ itemId, count: 0, itemName: `未知物品（已转换为 ${gold} 金币 + ${exp} 经验）` });
    }
  }

  /** 处理陷阱触发事件 */
  async function handleTrapTriggered(characterStore: ReturnType<typeof useCharacterStore>): Promise<void> {
    const areaConfig = getAreaConfig();
    const damage = generateTrapDamage(areaConfig.level);

    // 直接调用 Character Store Action 扣除生命值
    await characterStore.takeDamage(damage);

    eventBus.emit(GameEvents.EXPLORATION_TRAP_TRIGGERED, {
      characterId: currentCharacterId.value,
      damage,
      trapType: '普通陷阱'
    });

    // 同步通知已注册的 UI 回调（替代 EventBus 跨模块监听）
    uiCallbacks?.onTrapTriggered?.({ damage, trapType: '普通陷阱' });

    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'combat',
      message: `触发陷阱，受到 ${damage} 点伤害`,
      icon: '⚠️'
    });
  }

  /** 处理随机事件触发 */
  async function handleRandomEventTriggered(characterStore: ReturnType<typeof useCharacterStore>): Promise<void> {
    const areaConfig = getAreaConfig();
    const eventResult = generateRandomEvent(areaConfig.level);

    // 根据随机事件效果类型调用对应的 Character Store Action
    switch (eventResult.effect.type) {
      case 'heal':
        await characterStore.receiveHeal(eventResult.effect.amount);
        break;
      case 'mana':
        await characterStore.changeMp(eventResult.effect.amount);
        break;
      case 'exp':
        await characterStore.gainExp(eventResult.effect.amount);
        break;
      case 'damage':
        await characterStore.takeDamage(eventResult.effect.amount);
        break;
      case 'mpLoss':
        await characterStore.changeMp(-eventResult.effect.amount);
        break;
      case 'gold':
        await characterStore.gainGold(eventResult.effect.amount);
        break;
    }

    eventBus.emit(GameEvents.EXPLORATION_RANDOM_EVENT, {
      characterId: currentCharacterId.value,
      message: eventResult.message,
      icon: eventResult.icon
    });

    // 同步通知已注册的 UI 回调（替代 EventBus 跨模块监听）
    uiCallbacks?.onRandomEvent?.({ message: eventResult.message, icon: eventResult.icon });

    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'info',
      message: eventResult.message,
      icon: eventResult.icon
    });
  }

  /** 使用营地休息 */
  async function useCampInternal(characterStore: ReturnType<typeof useCharacterStore>): Promise<void> {
    if (campUsed.value) {
      return;
    }

    const heal = generateCampHeal(0);

    // 直接调用 Character Store Action 恢复生命值和法力值
    await characterStore.receiveHeal(heal.hp);
    await characterStore.changeMp(heal.mana);

    campUsed.value = true;

    await persistState();

    eventBus.emit(GameEvents.EXPLORATION_CAMP_USED, {
      characterId: currentCharacterId.value
    });

    useLogStore().addLogEntry({
      id: generateLogId(),
      timestamp: Date.now(),
      type: 'exploration',
      message: '在营地休息，恢复了全部生命值和法力值',
      icon: 'game-icons:campfire'
    });
  }

  /** 使用营地（兼容旧 API，探索格子触发的营地使用） */
  function useCamp(): boolean {
    if (campUsed.value) {
      return false;
    }
    const characterStore = useCharacterStore();
    useCampInternal(characterStore);
    return true;
  }

  // ==================== 跨模块监听（仅 COMBAT_END） ====================

  /** COMBAT_END 监听器注册标记 */
  let combatListenerRegistered = false;

  /** 监听战斗结束事件，处理探索中的战斗结果 */
  function setupCombatListener(): void {
    if (combatListenerRegistered) return;
    combatListenerRegistered = true;

    eventBus.on(GameEvents.COMBAT_END, (data: { result: string }) => {
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
    checkCompletion();
    await persistState();
  }

  // ==================== 清洁 ====================

  /** 清理资源（在新架构下不再需要事件分组清理） */
  function dispose(): void {
    // COMBAT_END 监听器使用简单的 on，不需要分组清理
    // 如需完全清理，可调用 eventBus.off，但通常不需要
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
    remainingMoves,
    bossDefeated,
    explorationComplete,

    // 计算属性
    state,
    hasStartedExploration,
    getGridCell,

    // Action（核心流程）
    init,
    enterArea,
    revealGrid,
    revealAllCells,
    onBattleResult,
    triggerBattle,
    reset,
    exitExploration,
    useCamp,

    // 生命周期
    dispose,

    // 回调注册（替代 EventBus 跨模块数据事件）
    registerUICallbacks,
    unregisterUICallbacks
  };
});
