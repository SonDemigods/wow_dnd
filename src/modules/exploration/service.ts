/**
 * @fileoverview 探索模块服务层
 * @description 提供探索管理的核心业务逻辑，包括网格生成、玩家移动、事件处理等
 * @module exploration
 */
import type { GridCell, GridEventType, ExplorationState, GridEventProbability, AreaConfig, IExplorationService, ExplorationCell, MoveResult, EventChoiceResult } from './types';
import type { LocationData } from '../map/types';
import { inventoryDbService } from '../inventory/db';
import { explorationDbService } from './db';
import { mapDbService } from '../map/db';
import { enemyDbService } from '../enemy/db';
import { questDbService } from '../quest/db';
import { shopDbService } from '../shop/db';
import { eventBus, GameEvents } from '../bus/core';
import { inventoryService } from '../inventory/service';
import { logService } from '../log/service';

const GRID_SIZE = 10;
const INITIAL_MOVES = 20;

export class ExplorationService implements IExplorationService {
  private state: ExplorationState = {
    currentAreaId: null,
    grid: [],
    campUsed: false,
    playerPosition: { x: 0, y: 0 },
    visitedCells: 0,
    remainingMoves: INITIAL_MOVES,
    bossDefeated: false,
    explorationComplete: false
  };

  private currentCharacterId: string | null = null;
  private pendingBattleCell: { x: number; y: number } | null = null;
  private currentAreaConfig: AreaConfig | null = null;
  /** 当前探索区域随机选取的商店ID */
  private assignedShopId: string = '';

  constructor() {
    this.setupCrossModuleListeners();
  }

  /**
   * 注册跨模块事件监听——处理战斗模块发出的 COMBAT_END 事件
   */
  private setupCrossModuleListeners(): void {
    eventBus.on(GameEvents.COMBAT_END, (data) => {
      // 战斗结束后，如果是探索中触发的战斗，更新对应格子状态
      const isVictory = data.result === 'victory';
      this.onBattleResult(isVictory);
    });
  }

  /**
   * 根据地点数据构建区域配置（异步，从数据库获取敌人和物品数据）
   */
  private async buildAreaConfig(location: LocationData): Promise<AreaConfig> {
    const [minLevel, maxLevel] = location.levelRange;
    const avgLevel = Math.floor((minLevel + maxLevel) / 2);

    // 根据地点等级动态生成事件概率
    const eventProbability: GridEventProbability = {
      monster: Math.min(30, 20 + avgLevel),
      item: Math.max(15, 25 - avgLevel),
      trap: Math.min(22, 12 + avgLevel),
      event: 15,
      empty: Math.max(15, 30 - avgLevel)
    };
    // 归一化确保总和为100
    const total = eventProbability.monster + eventProbability.item + eventProbability.trap + eventProbability.event + eventProbability.empty;
    eventProbability.monster = Math.round(eventProbability.monster / total * 100);
    eventProbability.item = Math.round(eventProbability.item / total * 100);
    eventProbability.trap = Math.round(eventProbability.trap / total * 100);
    eventProbability.event = Math.round(eventProbability.event / total * 100);
    eventProbability.empty = 100 - eventProbability.monster - eventProbability.item - eventProbability.trap - eventProbability.event;

    // 怪物池：直接使用地点数据中的敌人列表
    const monsterPool = location.enemies || [];

    // Boss池：从数据库查询敌人数据，筛选标记为Boss的敌人
    const bossPool: string[] = [];
    for (const enemyId of monsterPool) {
      const enemy = await enemyDbService.getEnemyTemplate(enemyId);
      if (enemy && enemy.isBoss) {
        bossPool.push(enemyId);
      }
    }

    // 物品池：从数据库获取所有物品模板，根据地点等级筛选合适的物品
    const allItems = await inventoryDbService.getAllItemTemplates();
    // 稀有度默认等级映射（兼容旧数据中缺少 level 字段的物品）
    const rarityLevelMap: Record<string, number> = { common: 1, uncommon: 3, rare: 5, epic: 7 };
    const suitableItems = allItems.filter(item => {
      const itemLevel = item.level ?? rarityLevelMap[item.rarity] ?? 0;
      return itemLevel >= minLevel - 1 && itemLevel <= maxLevel + 2;
    });
    // 随机打乱后取最多5个，保证每次探索的物品池有变化
    const shuffled = suitableItems.sort(() => Math.random() - 0.5);
    const itemPool = shuffled.slice(0, 5).map(item => item.id);
    // 如果没有合适的物品，至少提供基础药水
    if (itemPool.length === 0) {
      itemPool.push('small_health_potion');
    }

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
   * 从数据库加载当前区域配置并缓存
   */
  private async loadAreaConfig(areaId: string): Promise<void> {
    const location = await mapDbService.getLocationData(areaId);
    if (location) {
      this.currentAreaConfig = await this.buildAreaConfig(location);
    } else {
      // 回退：使用默认配置
      this.currentAreaConfig = {
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

  private getAreaConfig(_areaId?: string): AreaConfig {
    return this.currentAreaConfig || {
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
   */
  private async pickRandomShop(): Promise<void> {
    const shops = await shopDbService.getAllShopConfigs();
    if (shops && shops.length > 0) {
      const idx = Math.floor(Math.random() * shops.length);
      this.assignedShopId = shops[idx].id;
    }
  }

  private getEdgePositions(): { x: number; y: number }[] {
    const positions: { x: number; y: number }[] = [];
    for (let x = 0; x < GRID_SIZE; x++) positions.push({ x, y: 0 });
    for (let x = 0; x < GRID_SIZE; x++) positions.push({ x, y: GRID_SIZE - 1 });
    for (let y = 1; y < GRID_SIZE - 1; y++) positions.push({ x: 0, y });
    for (let y = 1; y < GRID_SIZE - 1; y++) positions.push({ x: GRID_SIZE - 1, y });
    return positions;
  }

  private isOccupied(grid: ExplorationCell[][], x: number, y: number): boolean {
    return grid[y][x].type !== 'empty';
  }

  private isAdjacent(pos1: { x: number; y: number }, pos2: { x: number; y: number }): boolean {
    return Math.abs(pos1.x - pos2.x) <= 1 && Math.abs(pos1.y - pos2.y) <= 1;
  }

  private getDistance(pos1: { x: number; y: number }, pos2: { x: number; y: number }): number {
    return Math.max(Math.abs(pos1.x - pos2.x), Math.abs(pos1.y - pos2.y));
  }

  private findNonAdjacentPosition(grid: ExplorationCell[][], occupiedPositions: { x: number; y: number }[]): { x: number; y: number } {
    const candidates: { x: number; y: number }[] = [];
    
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (!this.isOccupied(grid, x, y)) {
          const isNonAdjacent = occupiedPositions.every(pos => !this.isAdjacent({ x, y }, pos));
          if (isNonAdjacent) {
            candidates.push({ x, y });
          }
        }
      }
    }
    
    if (candidates.length === 0) {
      return this.findAnyEmptyPosition(grid);
    }
    
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private findBossPosition(grid: ExplorationCell[][], occupiedPositions: { x: number; y: number }[]): { x: number; y: number } {
    const centerPositions: { x: number; y: number }[] = [];
    
    for (let y = 3; y <= 6; y++) {
      for (let x = 3; x <= 6; x++) {
        if (!this.isOccupied(grid, x, y)) {
          const isFarEnough = occupiedPositions.every(pos => this.getDistance({ x, y }, pos) >= 2);
          if (isFarEnough) {
            centerPositions.push({ x, y });
          }
        }
      }
    }
    
    if (centerPositions.length === 0) {
      return this.findAnyEmptyPosition(grid);
    }
    
    return centerPositions[Math.floor(Math.random() * centerPositions.length)];
  }

  private findAnyEmptyPosition(grid: ExplorationCell[][]): { x: number; y: number } {
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (!this.isOccupied(grid, x, y)) {
          return { x, y };
        }
      }
    }
    return { x: 0, y: 0 };
  }

  private selectEventType(probability: GridEventProbability): GridEventType {
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

  private placeFixedEvents(grid: ExplorationCell[][]): void {
    const edgePositions = this.getEdgePositions();
    const startPos = edgePositions[Math.floor(Math.random() * edgePositions.length)];
    grid[startPos.y][startPos.x] = { x: startPos.x, y: startPos.y, type: 'start', explored: true, accessible: true, visited: true, completed: false };
    this.state.playerPosition = startPos;

    const corners = [[0, 0], [0, GRID_SIZE - 1], [GRID_SIZE - 1, 0], [GRID_SIZE - 1, GRID_SIZE - 1]];
    const availableCorners = corners.filter(c => !this.isOccupied(grid, c[0], c[1]));
    
    // 放置商店（角落位置，默认可见）
    const shopCornerIndex = Math.floor(Math.random() * availableCorners.length);
    const shopPos = availableCorners[shopCornerIndex];
    grid[shopPos[1]][shopPos[0]] = { x: shopPos[0], y: shopPos[1], type: 'shop', explored: true, accessible: true, visited: true, completed: false };
    availableCorners.splice(shopCornerIndex, 1);
    
    // 放置任务看板（另一个角落位置，默认可见）
    const boardPos = availableCorners[Math.floor(Math.random() * availableCorners.length)];
    grid[boardPos[1]][boardPos[0]] = { x: boardPos[0], y: boardPos[1], type: 'board', explored: true, accessible: true, visited: true, completed: false };

    // 放置营地（非相邻位置）
    const campPos = this.findNonAdjacentPosition(grid, [startPos, { x: shopPos[0], y: shopPos[1] }, { x: boardPos[0], y: boardPos[1] }]);
    grid[campPos.y][campPos.x] = { x: campPos.x, y: campPos.y, type: 'rest', explored: false, accessible: false, visited: false, completed: false };

    // 放置BOSS（中心区域），从boss池中随机选择一个boss
    const bossPos = this.findBossPosition(grid, [startPos, { x: shopPos[0], y: shopPos[1] }, { x: boardPos[0], y: boardPos[1] }, campPos]);
    const bossPool = this.currentAreaConfig?.bossPool || [];
    const bossMonsterId = bossPool.length > 0 ? bossPool[Math.floor(Math.random() * bossPool.length)] : undefined;
    grid[bossPos.y][bossPos.x] = { x: bossPos.x, y: bossPos.y, type: 'boss', explored: false, accessible: false, visited: false, completed: false, monsterId: bossMonsterId };
  }

  /**
   * 获取当前区域任务所需的怪物ID列表（去重后的优先怪物池）
   * 从数据库查询任务定义
   */
  private async getQuestRequiredMonsters(areaId: string): Promise<string[]> {
    const required: string[] = [];
    // 从数据库获取当前区域的任务定义
    const quests = await questDbService.getQuestDefinitionsByBoard(areaId);
    for (const quest of quests) {
      for (const obj of quest.objectives) {
        if (obj.type === 'kill' && obj.enemyId) {
          // 根据目标数量添加对应数量的怪物ID
          for (let i = 0; i < obj.target; i++) {
            required.push(obj.enemyId);
          }
        }
      }
    }
    return required;
  }

  private async generateGridInternal(areaConfig: AreaConfig): Promise<ExplorationCell[][]> {
    const grid: ExplorationCell[][] = [];
    
    for (let y = 0; y < GRID_SIZE; y++) {
      grid[y] = [];
      for (let x = 0; x < GRID_SIZE; x++) {
        grid[y][x] = {
          x,
          y,
          type: 'empty',
          explored: false,
          accessible: false,
          visited: false,
          completed: false
        };
      }
    }

    this.placeFixedEvents(grid);

    const probability = areaConfig.eventProbability;
    const monsterPool = areaConfig.monsterPool;

    // 获取当前区域任务所需的怪物列表，作为优先放置的怪物池
    const questMonsters = await this.getQuestRequiredMonsters(areaConfig.areaId);
    // 过滤掉boss类型（boss由固定事件放置），只保留普通怪物
    const questNormalMonsters: string[] = [];
    for (const id of questMonsters) {
      const data = await enemyDbService.getEnemyTemplate(id);
      if (data && !data.isBoss) {
        questNormalMonsters.push(id);
      }
    }

    // 收集所有空格子坐标
    const emptyCells: { x: number; y: number }[] = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
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
    for (const monsterId of questNormalMonsters) {
      if (cellIndex >= emptyCells.length) break;
      const pos = emptyCells[cellIndex];
      grid[pos.y][pos.x] = { x: pos.x, y: pos.y, type: 'monster', explored: false, accessible: false, visited: false, completed: false, monsterId };
      cellIndex++;
    }

    // 第二步：对剩余空格子按概率随机分配事件类型
    for (let i = cellIndex; i < emptyCells.length; i++) {
      const pos = emptyCells[i];
      const eventType = this.selectEventType(probability);
      
      let cellType = 'empty';
      let cellMonsterId: string | undefined;
      switch (eventType) {
        case 'monster':
          cellType = 'monster';
          // 从怪物池中随机选择一个怪物
          if (monsterPool.length > 0) {
            cellMonsterId = monsterPool[Math.floor(Math.random() * monsterPool.length)];
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
   * 生成探索网格
   * 随机生成10x10的探索网格，放置起点、商店、任务板、营地和BOSS等固定事件，
   * 并根据区域配置的概率分布随机填充怪物、物品、陷阱等事件格子
   */
  async generateGrid(): Promise<void> {
    const areaConfig = this.getAreaConfig(this.state.currentAreaId || 'village');
    const grid = await this.generateGridInternal(areaConfig);
    
    // 从生成的网格中找到起点位置
    let startPos = { x: 0, y: 0 };
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (grid[y][x].type === 'start') {
          startPos = { x, y };
          break;
        }
      }
    }
    
    this.state = {
      currentAreaId: this.state.currentAreaId,
      grid,
      campUsed: false,
      playerPosition: startPos,
      visitedCells: 3,
      remainingMoves: INITIAL_MOVES,
      bossDefeated: false,
      explorationComplete: false
    };

    this.updateAccessibleCells();
    this.saveState();
    
    eventBus.emit(GameEvents.EXPLORATION_START, { characterId: this.currentCharacterId });

    // 记录冒险日志
    const areaName = this.currentAreaConfig?.name || '未知区域';
    logService.addLog({
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type: 'exploration',
      message: `开始探索：${areaName}`,
      icon: '🗺️'
    });
  }

  private updateAccessibleCells(): void {
    // 先将所有未探索格子标记为不可访问
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (!this.state.grid[y][x].explored) {
          this.state.grid[y][x].accessible = false;
        }
      }
    }
    
    // 遍历所有已探索格子，将其周围未探索格子标记为可访问
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (this.state.grid[y][x].explored) {
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (dx === 0 && dy === 0) continue;
              const nx = x + dx;
              const ny = y + dy;
              
              if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                if (!this.state.grid[ny][nx].explored) {
                  this.state.grid[ny][nx].accessible = true;
                }
              }
            }
          }
        }
      }
    }
  }

  /**
   * 判断玩家是否可以朝指定方向移动
   * @param direction - 移动方向：'up' | 'down' | 'left' | 'right'
   * @returns 是否可以移动，剩余步数不足或目标格不可访问时返回false
   */
  canMove(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    if (this.state.remainingMoves <= 0) return false;
    
    const { x, y } = this.state.playerPosition;
    let nx = x, ny = y;
    
    switch (direction) {
      case 'up': ny--; break;
      case 'down': ny++; break;
      case 'left': nx--; break;
      case 'right': nx++; break;
    }
    
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) return false;
    
    return this.state.grid[ny][nx].accessible;
  }

  /**
   * 玩家朝指定方向移动
   * 根据目标格类型触发对应事件（战斗、宝箱、营地、BOSS、商店、随机事件等），
   * 更新可访问格子、检查探索完成状态并保存进度
   * @param direction - 移动方向：'up' | 'down' | 'left' | 'right'
   * @returns 移动结果，包含是否成功、消息和可能的奖励
   */
  movePlayer(direction: 'up' | 'down' | 'left' | 'right'): MoveResult {
    if (!this.canMove(direction)) {
      return { success: false, message: '无法移动到该位置' };
    }

    const { x, y } = this.state.playerPosition;
    let nx = x, ny = y;
    
    switch (direction) {
      case 'up': ny--; break;
      case 'down': ny++; break;
      case 'left': nx--; break;
      case 'right': nx++; break;
    }

    const targetCell = this.state.grid[ny][nx];
    targetCell.explored = true;
    targetCell.visited = true;
    
    this.state.playerPosition = { x: nx, y: ny };
    this.state.remainingMoves--;
    this.state.visitedCells++;

    const result: MoveResult = { success: true };

    switch (targetCell.type) {
      case 'monster':
        result.message = '遭遇怪物！';
        this.triggerBattle(targetCell.monsterId || 'goblin');
        break;
      case 'treasure':
        const gold = Math.floor(Math.random() * 50) + 10;
        const exp = Math.floor(Math.random() * 20) + 5;
        eventBus.emit(GameEvents.CHARACTER_GAIN_GOLD, { amount: gold, source: '探索宝箱' });
        eventBus.emit(GameEvents.CHARACTER_GAIN_EXP, { amount: exp, source: '探索宝箱' });
        result.rewards = { gold, exp };
        targetCell.completed = true;
        break;
      case 'rest':
        if (!this.state.campUsed) {
          // 营地恢复：通知角色模块完全恢复HP和MP
          const maxHp = 9999; // 角色模块会根据自身上限处理
          const maxMp = 9999;
          eventBus.emit(GameEvents.CHARACTER_RECEIVE_HEAL, { amount: maxHp, source: '营地休息' });
          eventBus.emit(GameEvents.CHARACTER_RECEIVE_MP, { amount: maxMp, source: '营地休息' });
          this.state.campUsed = true;
          result.message = '休息完成，恢复全部状态';
          targetCell.completed = true;
        } else {
          result.message = '营地已使用过';
        }
        break;
      case 'boss':
        result.message = '遭遇BOSS！';
        this.triggerBattle(targetCell.monsterId || 'dragon_whelp');
        break;
      case 'shop':
        result.message = '发现商店';
        break;
      case 'event':
        result.message = '触发随机事件';
        targetCell.completed = true;
        break;
    }

    this.updateAccessibleCells();
    this.checkExplorationComplete();
    this.saveState();

    return result;
  }

  private checkExplorationComplete(): void {
    const totalCells = GRID_SIZE * GRID_SIZE;
    if (this.state.visitedCells >= totalCells || this.state.bossDefeated) {
      this.state.explorationComplete = true;
    }
  }

  /**
   * 处理随机事件的玩家选择
   * 根据选择ID触发对应效果（战斗、逃跑、搜索、休息等）
   * @param choiceId - 选项ID：'fight' | 'flee' | 'search' | 'rest'
   * @returns 事件选择结果
   */
  handleEventChoice(choiceId: string): EventChoiceResult {
    const responses: Record<string, string> = {
      fight: '战斗胜利！获得奖励',
      flee: '成功逃跑',
      search: '发现了一些金币',
      rest: '恢复了一些生命值'
    };
    
    if (choiceId === 'search') {
      eventBus.emit(GameEvents.CHARACTER_GAIN_GOLD, { amount: 20, source: '随机事件' });
    } else if (choiceId === 'rest') {
      eventBus.emit(GameEvents.CHARACTER_RECEIVE_HEAL, { amount: 20, source: '随机事件' });
    }

    const message = responses[choiceId] || '操作完成';

    // 记录冒险日志
    logService.addLog({
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type: 'exploration',
      message: `随机事件：${message}`,
      icon: '🎲'
    });

    return { success: true, message };
  }

  /**
   * 初始化探索服务
   * 从数据库加载角色的探索状态，若存在未完成的探索则恢复，
   * 否则初始化为空状态
   * @param characterId - 角色ID
   */
  async init(characterId: string): Promise<void> {
    this.currentCharacterId = characterId;
    
    // 确保日志服务和背包服务已初始化（否则物品获取和日志记录会静默失败）
    await logService.init(characterId);
    await inventoryService.initialize(characterId);
    
    const stored = await explorationDbService.getExplorationData(characterId);
    
    if (stored && stored.currentAreaId && stored.grid && stored.grid.length > 0) {
      // 从数据库恢复完整的探索状态
      this.state = {
        currentAreaId: stored.currentAreaId,
        grid: stored.grid as unknown as ExplorationCell[][],
        campUsed: stored.campUsed,
        playerPosition: stored.playerPosition,
        visitedCells: stored.visitedCells,
        remainingMoves: stored.remainingMoves,
        bossDefeated: stored.bossDefeated,
        explorationComplete: stored.explorationComplete
      };
      // 恢复本次探索随机选取的商店ID（用于点击商店格子时传递正确的 interactionId）
      this.assignedShopId = stored.assignedShopId || '';
      // 恢复区域配置
      await this.loadAreaConfig(stored.currentAreaId);
    } else {
      this.state = {
        currentAreaId: null,
        grid: [],
        campUsed: false,
        playerPosition: { x: 0, y: 0 },
        visitedCells: 0,
        remainingMoves: INITIAL_MOVES,
        bossDefeated: false,
        explorationComplete: false
      };
    }
  }

  /**
   * 获取当前探索状态的副本
   * @returns 探索状态对象（浅拷贝）
   */
  getState(): ExplorationState {
    return { ...this.state };
  }

  /**
   * 进入指定区域进行探索
   * 加载区域配置并生成新的探索网格
   * @param areaId - 区域ID
   */
  async enterArea(areaId: string): Promise<void> {
    this.state.currentAreaId = areaId;
    await this.loadAreaConfig(areaId);
    // 进入探索区域时随机选取一个商店
    await this.pickRandomShop();
    await this.generateGrid();
    // 立即持久化网格数据和商店ID，防止刷新丢失
    this.saveState();
  }

  /**
   * 获取指定坐标的格子信息
   * 将内部存储格式的格子数据转换为对外的GridCell格式
   * @param x - X坐标
   * @param y - Y坐标
   * @returns 格子信息，坐标越界或无数据时返回null
   */
  getGrid(x: number, y: number): GridCell | null {
    if (y < 0 || y >= GRID_SIZE || x < 0 || x >= GRID_SIZE) {
      return null;
    }
    const cell = this.state.grid[y]?.[x];
    if (!cell) return null;
    
    return {
      x: cell.x,
      y: cell.y,
      status: cell.explored ? 'revealed' : 'unexplored',
      eventType: this.getEventType(cell.type),
      eventData: {
        monsterId: cell.monsterId
      }
    };
  }

  private getEventType(cellType: string): GridEventType {
    const typeMap: Record<string, GridEventType> = {
      empty: 'empty',
      monster: 'monster',
      treasure: 'item',
      shop: 'shop',
      rest: 'camp',
      boss: 'boss',
      trap: 'trap',
      event: 'event',
      start: 'empty',
      board: 'board'
    };
    return typeMap[cellType] || 'empty';
  }

  /**
   * 揭示指定坐标的格子
   * 根据格子类型触发对应事件：怪物/BOSS触发战斗、商店/任务板打开交互、
   * 宝箱发放物品、陷阱造成伤害、营地提供恢复、事件触发随机效果
   * @param x - X坐标
   * @param y - Y坐标
   * @returns 是否成功揭示
   */
  async revealGrid(x: number, y: number): Promise<boolean> {
    const cell = this.state.grid[y]?.[x];
    if (!cell || !cell.accessible) {
      return false;
    }

    // 怪物和BOSS格子：未被击败时可触发战斗
    if (cell.type === 'monster' || cell.type === 'boss') {
      // 已击败的怪物 accessible 为 false，不会进入此分支
      // 逃跑/失败后 explored=true 但 type 仍为 monster/boss，可再次挑战
      const battleId = cell.monsterId || (cell.type === 'boss' ? 'dragon_whelp' : 'goblin');
      this.triggerBattle(battleId);
      this.pendingBattleCell = { x, y };
      return true;
    }

    // 商店和任务看板：可多次交互，始终标记为已探索但保持可访问
    if (cell.type === 'shop' || cell.type === 'board') {
      const isNewlyVisited = !cell.visited;
      cell.explored = true;
      cell.visited = true;
      if (isNewlyVisited) {
        this.state.visitedCells++;
      }
      
      this.updateAccessibleCells();
      
      const interactionId = cell.type === 'shop' ? this.assignedShopId : 'board_main';
      eventBus.emit(GameEvents.EXPLORATION_CELL_EXPLORED, {
        characterId: this.currentCharacterId,
        x,
        y,
        cellType: cell.type,
        interactionId
      });
      
      this.saveState();
      return true;
    }

    // 其他格子：正常揭示逻辑
    if (cell.explored) {
      return false;
    }

    cell.explored = true;
    cell.visited = true;
    this.state.visitedCells++;
    
    // 更新可访问格子
    this.updateAccessibleCells();

    eventBus.emit(GameEvents.EXPLORATION_CELL_EXPLORED, {
      characterId: this.currentCharacterId,
      x,
      y
    });

    if (cell.type === 'treasure') {
      // 从当前区域的物品池中随机选择一个物品
      const areaConfig = this.getAreaConfig(this.state.currentAreaId || 'village');
      const itemPool = areaConfig.itemPool;
      if (itemPool.length > 0) {
        const randomItemId = itemPool[Math.floor(Math.random() * itemPool.length)];
        this.handleItemFound(randomItemId);
      }
      cell.completed = true;
    } else if (cell.type === 'trap') {
      await this.handleTrapTriggered();
      cell.completed = true;
    } else if (cell.type === 'event') {
      await this.handleRandomEvent();
      cell.completed = true;
    } else if (cell.type === 'rest') {
      this.useCamp();
      cell.completed = true;
    }

    this.checkExplorationComplete();
    this.saveState();
    return true;
  }

  /**
   * 使用营地休息恢复全部HP和MP
   * 每个营地只能使用一次，使用后营地变灰表示已使用
   * @returns 是否成功使用，已使用过时返回false
   */
  useCamp(): boolean {
    if (this.state.campUsed) {
      return false;
    }

    eventBus.emit(GameEvents.CHARACTER_RECEIVE_HEAL, { amount: 9999, source: '营地休息' });
    eventBus.emit(GameEvents.CHARACTER_RECEIVE_MP, { amount: 9999, source: '营地休息' });
    
    this.state.campUsed = true;

    this.saveState();
    
    eventBus.emit(GameEvents.EXPLORATION_CAMP_USED, {
      characterId: this.currentCharacterId
    });

    // 记录冒险日志
    logService.addLog({
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type: 'exploration',
      message: `在营地休息，恢复了全部生命值和法力值`,
      icon: '🏕️'
    });

    return true;
  }

  /**
   * 触发战斗事件
   * 通过事件总线通知战斗模块开启战斗
   * @param monsterId - 怪物ID
   */
  triggerBattle(monsterId: string): void {
    eventBus.emit(GameEvents.EXPLORATION_BATTLE_TRIGGERED, {
      characterId: this.currentCharacterId,
      eventData: { monsterId }
    });
  }

  /**
   * 处理战斗结果
   * 胜利时清空怪物格子并检查BOSS是否被击败；失败或逃跑时揭示格子内容但保留怪物允许再次挑战
   * @param victory - 是否胜利
   */
  onBattleResult(victory: boolean): void {
    if (!this.pendingBattleCell) return;
    
    const { x, y } = this.pendingBattleCell;
    const cell = this.state.grid[y]?.[x];
    
    if (!cell) {
      this.pendingBattleCell = null;
      return;
    }

    if (victory) {
      // 战斗胜利：标记格子为已探索
      if (cell.type === 'boss') {
        this.state.bossDefeated = true;
      }
      if (!cell.explored) {
        cell.explored = true;
        cell.visited = true;
        this.state.visitedCells++;
      }
      cell.completed = true; // 击败后标记为已完成，前端显示褪色
      cell.accessible = false;
      
      this.updateAccessibleCells();
      this.checkExplorationComplete();
      this.saveState();
    } else {
      // 战斗失败或逃跑：揭示格子内容，但保持可再次挑战
      if (!cell.explored) {
        cell.explored = true;
        cell.visited = true;
        this.state.visitedCells++;
      }
      this.updateAccessibleCells();
      this.saveState();
    }
    
    this.pendingBattleCell = null;
  }

  /**
   * 获取当前探索区域ID
   * @returns 当前区域ID，未进入任何区域时返回null
   */
  getCurrentAreaId(): string | null {
    return this.state.currentAreaId;
  }

  /**
   * 重置探索内存状态（不删除数据库数据，保留各角色的探索进度）
   */
  reset(): void {
    const hadActiveExploration = this.state.currentAreaId !== null;

    this.state = {
      currentAreaId: null,
      grid: [],
      campUsed: false,
      playerPosition: { x: 0, y: 0 },
      visitedCells: 0,
      remainingMoves: INITIAL_MOVES,
      bossDefeated: false,
      explorationComplete: false
    };
    this.pendingBattleCell = null;
    this.currentAreaConfig = null;
    this.assignedShopId = '';
    
    // 不再删除数据库中的探索数据，各角色的探索进度独立保留
    // 切换角色时通过 init(characterId) 加载对应角色的数据
    
    eventBus.emit(GameEvents.EXPLORATION_END, { characterId: this.currentCharacterId });

    // 只在真正有探索进行中时才记录日志，避免切换角色/清理 UI 时产生重复日志
    if (hadActiveExploration) {
      logService.addLog({
        id: logService.generateLogId(),
        timestamp: Date.now(),
        type: 'exploration',
        message: `探索结束`,
        icon: '🏁'
      });
    }
  }

  private handleItemFound(itemId: string): void {
    const item = inventoryService.getItemInfo(itemId);
    if (item) {
      // 先记录"发现"日志，再触发物品入包（入包时会同步记录"获得"日志，保证先发现后获得的顺序）
      logService.addLog({
        id: logService.generateLogId(),
        timestamp: Date.now(),
        type: 'item',
        message: `发现物品: ${item.name}`,
        icon: '📦'
      });

      eventBus.emit(GameEvents.INVENTORY_ADD_ITEM, { itemId, quantity: 1 });
      eventBus.emit(GameEvents.EXPLORATION_ITEM_FOUND, {
        characterId: this.currentCharacterId,
        itemId: itemId,
        count: 1,
        itemName: item.name
      });
    } else {
      // 兜底：物品模板不存在时，发放金币和经验作为补偿，避免用户空手而归
      console.warn(`[探索] 物品模板 "${itemId}" 不存在，发放兜底奖励`);
      const gold = Math.floor(Math.random() * 30) + 5;
      const exp = Math.floor(Math.random() * 15) + 3;
      eventBus.emit(GameEvents.CHARACTER_GAIN_GOLD, { amount: gold, source: '探索宝箱' });
      eventBus.emit(GameEvents.CHARACTER_GAIN_EXP, { amount: exp, source: '探索宝箱' });

      logService.addLog({
        id: logService.generateLogId(),
        timestamp: Date.now(),
        type: 'item',
        message: `发现宝箱，获得 ${gold} 金币和 ${exp} 经验`,
        icon: '📦'
      });

      eventBus.emit(GameEvents.EXPLORATION_ITEM_FOUND, {
        characterId: this.currentCharacterId,
        itemId: itemId,
        count: 0,
        itemName: `未知物品（已转换为 ${gold} 金币 + ${exp} 经验）`
      });
    }
  }

  private async handleTrapTriggered(): Promise<void> {
    if (!this.state.currentAreaId) return;
    
    const areaConfig = this.getAreaConfig(this.state.currentAreaId);
    const baseDamage = areaConfig.level * 5;
    const variance = (Math.random() - 0.5) * 10;
    const damage = Math.max(1, Math.floor(baseDamage + variance));
    
    eventBus.emit(GameEvents.CHARACTER_TAKE_DAMAGE, { amount: damage, source: '陷阱' });
    
    eventBus.emit(GameEvents.EXPLORATION_TRAP_TRIGGERED, {
      characterId: this.currentCharacterId,
      damage: damage,
      trapType: '普通陷阱'
    });
    
    logService.addLog({
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type: 'combat',
      message: `触发陷阱，受到 ${damage} 点伤害`,
      icon: '⚠️'
    });
  }

  private async handleRandomEvent(): Promise<void> {
    if (!this.state.currentAreaId) return;
    
    const areaConfig = this.getAreaConfig(this.state.currentAreaId);
    const random = Math.random();
    let eventMessage = '';
    let eventIcon = '🎲';
    
    // 30% 概率恢复生命值
    if (random < 0.3) {
      const healAmount = Math.floor(areaConfig.level * 3 + Math.random() * 10);
      eventBus.emit(GameEvents.CHARACTER_RECEIVE_HEAL, { amount: healAmount, source: '神秘泉水' });
      eventMessage = `发现神秘泉水，恢复了 ${healAmount} 点生命值`;
      eventIcon = '💧';
    }
    // 20% 概率恢复魔法值
    else if (random < 0.5) {
      const mpAmount = Math.floor(areaConfig.level * 2 + Math.random() * 8);
      eventBus.emit(GameEvents.CHARACTER_RECEIVE_MP, { amount: mpAmount, source: '魔法水晶' });
      eventMessage = `发现魔法水晶，恢复了 ${mpAmount} 点魔法值`;
      eventIcon = '💎';
    }
    // 15% 概率获得经验值
    else if (random < 0.65) {
      const expAmount = Math.floor(areaConfig.level * 10 + Math.random() * 20);
      eventBus.emit(GameEvents.CHARACTER_GAIN_EXP, { amount: expAmount, source: '古代石碑' });
      eventMessage = `发现古代石碑，获得了 ${expAmount} 点经验值`;
      eventIcon = '📚';
    }
    // 15% 概率减少生命值（陷阱）
    else if (random < 0.8) {
      const trapDamage = Math.floor(areaConfig.level * 2 + Math.random() * 5);
      eventBus.emit(GameEvents.CHARACTER_TAKE_DAMAGE, { amount: trapDamage, source: '隐藏陷阱' });
      eventMessage = `触发了隐藏陷阱，受到 ${trapDamage} 点伤害`;
      eventIcon = '⚠️';
    }
    // 10% 概率减少魔法值
    else if (random < 0.9) {
      const mpLoss = Math.floor(areaConfig.level * 1.5 + Math.random() * 5);
      eventBus.emit(GameEvents.CHARACTER_RECEIVE_MP, { amount: -mpLoss, source: '魔法干扰' });
      eventMessage = `遭遇魔法干扰，损失了 ${mpLoss} 点魔法值`;
      eventIcon = '🌀';
    }
    // 10% 概率获得金币
    else {
      const goldAmount = Math.floor(areaConfig.level * 5 + Math.random() * 15);
      eventBus.emit(GameEvents.CHARACTER_GAIN_GOLD, { amount: goldAmount, source: '宝箱' });
      eventMessage = `发现宝箱，获得了 ${goldAmount} 金币`;
      eventIcon = '💰';
    }
    
    eventBus.emit(GameEvents.EXPLORATION_RANDOM_EVENT, {
      characterId: this.currentCharacterId,
      message: eventMessage,
      icon: eventIcon
    });
    
    logService.addLog({
      id: logService.generateLogId(),
      timestamp: Date.now(),
      type: 'info',
      message: eventMessage,
      icon: eventIcon
    });
  }

  private saveState(): void {
    if (this.currentCharacterId) {
      explorationDbService.saveExplorationData(this.currentCharacterId, this.state, this.assignedShopId);
    }
  }
}

export const explorationService = new ExplorationService();