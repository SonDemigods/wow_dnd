import type { GridCell, GridEventType, ExplorationState, GridEventProbability, AreaConfig, IExplorationService, ExplorationCell, MoveResult, EventChoiceResult } from './types';
import { explorationDbService } from './db';
import { eventBus, GameEvents } from '../bus/core';
import { characterService } from '../character/service';

const GRID_SIZE = 10;
const INITIAL_MOVES = 20;

const DEFAULT_EVENT_PROBABILITY: GridEventProbability = {
  monster: 35,
  item: 20,
  trap: 20,
  empty: 25
};

const AREA_CONFIGS: Record<string, AreaConfig> = {
  village: {
    areaId: 'village',
    name: '宁静村庄',
    level: 1,
    eventProbability: { monster: 20, item: 30, trap: 10, empty: 40 },
    monsterPool: ['enemy_goblin', 'enemy_wolf'],
    bossPool: [],
    itemPool: ['item_potion_minor_heal', 'item_gold_coin']
  },
  goblin_camp: {
    areaId: 'goblin_camp',
    name: '哥布林营地',
    level: 2,
    eventProbability: { monster: 40, item: 15, trap: 20, empty: 25 },
    monsterPool: ['enemy_goblin'],
    bossPool: ['enemy_goblin_boss'],
    itemPool: ['item_potion_minor_heal', 'item_gold_coin', 'item_herb']
  },
  forest: {
    areaId: 'forest',
    name: '幽暗森林',
    level: 3,
    eventProbability: { monster: 35, item: 20, trap: 20, empty: 25 },
    monsterPool: ['enemy_wolf', 'enemy_spider'],
    bossPool: ['enemy_wolf_boss'],
    itemPool: ['item_potion_heal', 'item_gold_coin', 'item_herb']
  },
  mine: {
    areaId: 'mine',
    name: '废弃矿洞',
    level: 6,
    eventProbability: { monster: 45, item: 15, trap: 25, empty: 15 },
    monsterPool: ['enemy_orc', 'enemy_golem'],
    bossPool: ['enemy_orc_boss'],
    itemPool: ['item_potion_heal', 'item_potion_mana', 'item_gold_coin']
  }
};

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

  private getAreaConfig(areaId: string): AreaConfig {
    return AREA_CONFIGS[areaId] || {
      areaId,
      name: areaId,
      level: 1,
      eventProbability: DEFAULT_EVENT_PROBABILITY,
      monsterPool: [],
      bossPool: [],
      itemPool: []
    };
  }

  private getDefaultShopId(): string {
    // 根据当前区域返回默认商店ID
    const areaShopMap: Record<string, string> = {
      'village': 'shop_inn',
      'goblin_camp': 'shop_inn',
      'forest': 'shop_potion',
      'mine': 'shop_weapon'
    };
    return areaShopMap[this.state.currentAreaId || 'village'] || 'shop_inn';
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
    const total = probability.monster + probability.item + probability.trap + probability.empty;
    let random = Math.random() * total;

    if (random < probability.monster) return 'monster';
    random -= probability.monster;

    if (random < probability.item) return 'item';
    random -= probability.item;

    if (random < probability.trap) return 'trap';
    return 'empty';
  }

  private placeFixedEvents(grid: ExplorationCell[][]): void {
    const edgePositions = this.getEdgePositions();
    const startPos = edgePositions[Math.floor(Math.random() * edgePositions.length)];
    grid[startPos.y][startPos.x] = { x: startPos.x, y: startPos.y, type: 'start', explored: true, accessible: true, visited: true };
    this.state.playerPosition = startPos;

    const corners = [[0, 0], [0, GRID_SIZE - 1], [GRID_SIZE - 1, 0], [GRID_SIZE - 1, GRID_SIZE - 1]];
    const availableCorners = corners.filter(c => !this.isOccupied(grid, c[0], c[1]));
    
    // 放置商店（角落位置）
    const shopCornerIndex = Math.floor(Math.random() * availableCorners.length);
    const shopPos = availableCorners[shopCornerIndex];
    grid[shopPos[1]][shopPos[0]] = { x: shopPos[0], y: shopPos[1], type: 'shop', explored: false, accessible: false, visited: false };
    availableCorners.splice(shopCornerIndex, 1);
    
    // 放置任务看板（另一个角落位置）
    const boardPos = availableCorners[Math.floor(Math.random() * availableCorners.length)];
    grid[boardPos[1]][boardPos[0]] = { x: boardPos[0], y: boardPos[1], type: 'board', explored: false, accessible: false, visited: false };

    // 放置营地（非相邻位置）
    const campPos = this.findNonAdjacentPosition(grid, [startPos, { x: shopPos[0], y: shopPos[1] }, { x: boardPos[0], y: boardPos[1] }]);
    grid[campPos.y][campPos.x] = { x: campPos.x, y: campPos.y, type: 'rest', explored: false, accessible: false, visited: false };

    // 放置BOSS（中心区域）
    const bossPos = this.findBossPosition(grid, [startPos, { x: shopPos[0], y: shopPos[1] }, { x: boardPos[0], y: boardPos[1] }, campPos]);
    grid[bossPos.y][bossPos.x] = { x: bossPos.x, y: bossPos.y, type: 'boss', explored: false, accessible: false, visited: false };
  }

  private generateGridInternal(areaConfig: AreaConfig): ExplorationCell[][] {
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
          visited: false
        };
      }
    }

    this.placeFixedEvents(grid);

    const probability = areaConfig.eventProbability;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (grid[y][x].type === 'empty') {
          const eventType = this.selectEventType(probability);
          
          let cellType = 'empty';
          switch (eventType) {
            case 'monster':
              cellType = 'monster';
              break;
            case 'item':
              cellType = 'treasure';
              break;
            case 'trap':
              cellType = 'event';
              break;
          }
          
          grid[y][x] = { x, y, type: cellType, explored: false, accessible: false, visited: false };
        }
      }
    }

    return grid;
  }

  generateGrid(): void {
    const areaConfig = this.getAreaConfig(this.state.currentAreaId || 'village');
    const grid = this.generateGridInternal(areaConfig);
    
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
      visitedCells: 1,
      remainingMoves: INITIAL_MOVES,
      bossDefeated: false,
      explorationComplete: false
    };

    this.updateAccessibleCells();
    this.saveState();
    
    eventBus.emit(GameEvents.EXPLORATION_START, { characterId: this.currentCharacterId });
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
        this.triggerBattle('enemy_goblin');
        break;
      case 'treasure':
        const gold = Math.floor(Math.random() * 50) + 10;
        const exp = Math.floor(Math.random() * 20) + 5;
        characterService.addGold(gold);
        characterService.addExp(exp);
        result.rewards = { gold, exp };
        targetCell.type = 'empty';
        break;
      case 'rest':
        if (!this.state.campUsed) {
          characterService.setHp(characterService.getAttributes().maxHp);
          characterService.setMp(characterService.getAttributes().maxMana);
          this.state.campUsed = true;
          result.message = '休息完成，恢复全部状态';
        } else {
          result.message = '营地已使用过';
        }
        break;
      case 'boss':
        result.message = '遭遇BOSS！';
        this.triggerBattle('enemy_boss');
        break;
      case 'shop':
        result.message = '发现商店';
        break;
      case 'event':
        result.message = '触发随机事件';
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

  handleEventChoice(choiceId: string): EventChoiceResult {
    const responses: Record<string, string> = {
      fight: '战斗胜利！获得奖励',
      flee: '成功逃跑',
      search: '发现了一些金币',
      rest: '恢复了一些生命值'
    };
    
    if (choiceId === 'search') {
      characterService.addGold(20);
    } else if (choiceId === 'rest') {
      characterService.addHp(20);
    }

    return { success: true, message: responses[choiceId] || '操作完成' };
  }

  async init(characterId: string): Promise<void> {
    this.currentCharacterId = characterId;
    const stored = await explorationDbService.getExplorationData(characterId);
    
    if (stored) {
      this.state = {
        currentAreaId: stored.currentAreaId,
        grid: stored.grid as unknown as ExplorationCell[][],
        campUsed: stored.campUsed,
        playerPosition: { x: 0, y: 0 },
        visitedCells: 0,
        remainingMoves: INITIAL_MOVES,
        bossDefeated: false,
        explorationComplete: false
      };
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

  getState(): ExplorationState {
    return { ...this.state };
  }

  enterArea(areaId: string): void {
    this.state.currentAreaId = areaId;
    this.generateGrid();
  }

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
      eventType: this.getEventType(cell.type)
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
      event: 'trap',
      start: 'empty',
      board: 'board'
    };
    return typeMap[cellType] || 'empty';
  }

  revealGrid(x: number, y: number): boolean {
    const cell = this.state.grid[y]?.[x];
    if (!cell || !cell.accessible) {
      return false;
    }

    // 怪物和BOSS格子：允许重复挑战
    if (cell.type === 'monster' || cell.type === 'boss') {
      // 触发战斗，战斗结果由 onBattleResult 处理
      this.triggerBattle(cell.type === 'boss' ? 'enemy_boss' : 'enemy_goblin');
      // 记录当前挑战的格子位置
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
      
      if (cell.type === 'shop') {
        // 根据区域选择商店ID
        const shopId = this.getDefaultShopId();
        this.triggerShopInteraction(shopId);
      } else {
        this.triggerBoardInteraction('board_main');
      }
      
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

    eventBus.emit(GameEvents.EXPLORATION_EVENT, {
      characterId: this.currentCharacterId,
      x,
      y,
      eventType: this.getEventType(cell.type),
      eventData: {}
    });

    if (cell.type === 'treasure') {
      this.handleItemFound('item_gold_coin');
    } else if (cell.type === 'event') {
      this.handleTrapTriggered();
    } else if (cell.type === 'rest') {
      this.useCamp();
    }

    this.checkExplorationComplete();
    this.saveState();
    return true;
  }

  useCamp(): boolean {
    if (this.state.campUsed) {
      return false;
    }

    characterService.setHp(characterService.getAttributes().maxHp);
    characterService.setMp(characterService.getAttributes().maxMana);
    
    this.state.campUsed = true;

    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        if (this.state.grid[y]?.[x]?.type === 'rest') {
          this.state.grid[y][x].type = 'empty';
          break;
        }
      }
    }

    this.saveState();
    
    eventBus.emit(GameEvents.EXPLORATION_EVENT, {
      characterId: this.currentCharacterId,
      eventType: 'camp',
      eventData: {}
    });

    return true;
  }

  triggerShopInteraction(shopId: string): void {
    eventBus.emit(GameEvents.SHOP_OPENED, { characterId: this.currentCharacterId, shopId });
  }

  triggerBoardInteraction(boardId: string): void {
    eventBus.emit(GameEvents.QUEST_ACCEPTED, { characterId: this.currentCharacterId, boardId });
  }

  triggerBattle(monsterId: string): void {
    eventBus.emit(GameEvents.EXPLORATION_EVENT, {
      characterId: this.currentCharacterId,
      eventType: 'battle',
      eventData: { monsterId }
    });
  }

  onBattleResult(victory: boolean): void {
    if (!this.pendingBattleCell) return;
    
    const { x, y } = this.pendingBattleCell;
    const cell = this.state.grid[y]?.[x];
    
    if (!cell) {
      this.pendingBattleCell = null;
      return;
    }

    if (victory) {
      // 战斗胜利：标记格子为已探索，更新可访问区域
      if (!cell.explored) {
        cell.explored = true;
        cell.visited = true;
        this.state.visitedCells++;
      }
      
      if (cell.type === 'boss') {
        this.state.bossDefeated = true;
      }
      
      this.updateAccessibleCells();
      this.checkExplorationComplete();
      this.saveState();
    }
    // 战斗失败或逃跑：不标记为已探索，可再次挑战
    
    this.pendingBattleCell = null;
  }

  getCurrentAreaId(): string | null {
    return this.state.currentAreaId;
  }

  reset(): void {
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
    
    if (this.currentCharacterId) {
      explorationDbService.deleteExplorationData(this.currentCharacterId);
    }
    
    eventBus.emit(GameEvents.EXPLORATION_END, { characterId: this.currentCharacterId });
  }

  private handleItemFound(itemId: string): void {
    eventBus.emit(GameEvents.INVENTORY_CHANGE, {
      characterId: this.currentCharacterId,
      itemId,
      count: 1
    });
  }

  private handleTrapTriggered(): void {
    if (!this.state.currentAreaId) return;
    
    const areaConfig = this.getAreaConfig(this.state.currentAreaId);
    const baseDamage = areaConfig.level * 5;
    const variance = (Math.random() - 0.5) * 10;
    const damage = Math.max(1, Math.floor(baseDamage + variance));
    
    characterService.addHp(-damage);
    
    eventBus.emit(GameEvents.CHARACTER_HP_CHANGE, {
      characterId: this.currentCharacterId,
      damage,
      source: 'trap'
    });
  }

  private saveState(): void {
    if (this.currentCharacterId) {
      explorationDbService.saveExplorationData(this.currentCharacterId, this.state);
    }
  }
}

export const explorationService = new ExplorationService();