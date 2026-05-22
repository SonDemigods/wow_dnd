import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { characterService } from '@/modules/character.module';
import { combatService } from '@/modules/combat.module';
import { inventoryService } from '@/modules/inventory.module';

export type CellType = 'empty' | 'monster' | 'treasure' | 'shop' | 'rest' | 'boss' | 'event' | 'start' | 'exit';

export interface ExplorationCell {
  id: string;
  x: number;
  y: number;
  type: CellType;
  explored: boolean;
  accessible: boolean;
  content?: any;
  visited: boolean;
}

export interface ExplorationEvent {
  id: string;
  type: ExplorationEventType;
  title: string;
  description: string;
  icon: string;
  choices?: EventChoice[];
  rewards?: EventReward;
  difficulty?: 'easy' | 'normal' | 'hard';
}

export type ExplorationEventType = 
  | 'combat' | 'treasure' | 'shop' | 'rest' | 'boss' 
  | 'merchant' | 'trap' | 'puzzle' | 'story' | 'random';

export interface EventChoice {
  id: string;
  text: string;
  successRate: number;
  successResult: string;
  failureResult: string;
  rewards?: EventReward;
  failurePenalty?: EventPenalty;
}

export interface EventReward {
  gold?: number;
  exp?: number;
  items?: ItemReward[];
  healthRestore?: number;
}

export interface EventPenalty {
  gold?: number;
  health?: number;
}

export interface ItemReward {
  itemId: string;
  count: number;
}

export interface ExplorationState {
  grid: ExplorationCell[][];
  playerPosition: { x: number; y: number };
  currentEvent: ExplorationEvent | null;
  visitedCells: number;
  totalCells: number;
  remainingMoves: number;
  explorationComplete: boolean;
  bossDefeated: boolean;
}

export interface ExplorationResult {
  success: boolean;
  message: string;
  rewards?: EventReward;
}

export interface GridGenerationConfig {
  size: number;
  monsterCount: number;
  treasureCount: number;
  shopCount: number;
  restCount: number;
  bossEnabled: boolean;
  eventCount: number;
}

export interface IExplorationService {
  generateGrid(config?: Partial<GridGenerationConfig>): void;
  movePlayer(direction: 'up' | 'down' | 'left' | 'right'): ExplorationResult;
  getState(): ExplorationState;
  exploreCell(x: number, y: number): ExplorationEvent | null;
  handleEventChoice(choiceId: string): ExplorationResult;
  resetExploration(): void;
  canMove(direction: 'up' | 'down' | 'left' | 'right'): boolean;
}

const DEFAULT_CONFIG: GridGenerationConfig = {
  size: 10,
  monsterCount: 10,
  treasureCount: 5,
  shopCount: 2,
  restCount: 2,
  bossEnabled: true,
  eventCount: 3
};

const RANDOM_EVENTS: Omit<ExplorationEvent, 'id'>[] = [
  {
    type: 'story',
    title: '神秘的宝箱',
    description: '你发现了一个闪闪发光的宝箱，上面布满了灰尘。',
    icon: 'chest',
    choices: [
      {
        id: 'open',
        text: '打开宝箱',
        successRate: 0.8,
        successResult: '宝箱里装满了金币和装备！',
        failureResult: '宝箱是个陷阱！你受到了伤害。',
        rewards: { gold: 50, exp: 20 },
        failurePenalty: { health: 10 }
      },
      {
        id: 'leave',
        text: '离开',
        successRate: 1,
        successResult: '你谨慎地离开了。',
        failureResult: ''
      }
    ]
  },
  {
    type: 'story',
    title: '受伤的旅行者',
    description: '一位受伤的旅行者躺在路边，看起来急需帮助。',
    icon: 'npc',
    choices: [
      {
        id: 'help',
        text: '给予治疗',
        successRate: 1,
        successResult: '旅行者感激地送给你一些金币作为回报。',
        failureResult: '',
        rewards: { gold: 30, exp: 15 }
      },
      {
        id: 'ignore',
        text: '无视离开',
        successRate: 1,
        successResult: '你选择了无视。',
        failureResult: ''
      }
    ]
  },
  {
    type: 'trap',
    title: '陷阱！',
    description: '你不小心触发了一个陷阱！',
    icon: 'trap',
    choices: [
      {
        id: 'dodge',
        text: '尝试闪避',
        successRate: 0.6,
        successResult: '你成功躲开了陷阱！',
        failureResult: '你被陷阱击中，受到了伤害。',
        failurePenalty: { health: 15 }
      }
    ]
  },
  {
    type: 'merchant',
    title: '神秘商人',
    description: '一位神秘的商人出现在你面前，似乎有好东西出售。',
    icon: 'merchant',
    choices: [
      {
        id: 'trade',
        text: '交易',
        successRate: 1,
        successResult: '商人向你展示了他的商品。',
        failureResult: ''
      },
      {
        id: 'leave',
        text: '离开',
        successRate: 1,
        successResult: '你离开了商人。',
        failureResult: ''
      }
    ]
  },
  {
    type: 'puzzle',
    title: '神秘符文',
    description: '墙上刻着神秘的符文，似乎需要解开谜题。',
    icon: 'puzzle',
    choices: [
      {
        id: 'solve',
        text: '尝试解读',
        successRate: 0.5,
        successResult: '你成功解开了谜题，获得了奖励！',
        failureResult: '你没能解开谜题。',
        rewards: { gold: 80, exp: 30 }
      },
      {
        id: 'skip',
        text: '跳过',
        successRate: 1,
        successResult: '你决定离开。',
        failureResult: ''
      }
    ]
  }
];

export const useExplorationStore = defineStore('exploration', () => {
  const grid = ref<ExplorationCell[][]>([]);
  const playerPosition = ref({ x: 0, y: 0 });
  const currentEvent = ref<ExplorationEvent | null>(null);
  const visitedCells = ref(0);
  const remainingMoves = ref(20);
  const explorationComplete = ref(false);
  const bossDefeated = ref(false);
  const size = ref(10);

  const state = computed<ExplorationState>(() => ({
    grid: grid.value,
    playerPosition: playerPosition.value,
    currentEvent: currentEvent.value,
    visitedCells: visitedCells.value,
    totalCells: size.value * size.value,
    remainingMoves: remainingMoves.value,
    explorationComplete: explorationComplete.value,
    bossDefeated: bossDefeated.value
  }));

  function generateId(): string {
    return 'cell_' + Math.random().toString(36).substr(2, 9);
  }

  function generateGrid(config: Partial<GridGenerationConfig> = {}) {
    const mergedConfig = { ...DEFAULT_CONFIG, ...config };
    size.value = mergedConfig.size;

    grid.value = [];
    for (let y = 0; y < mergedConfig.size; y++) {
      const row: ExplorationCell[] = [];
      for (let x = 0; x < mergedConfig.size; x++) {
        row.push({
          id: generateId(),
          x,
          y,
          type: 'empty',
          explored: x === 0 && y === 0,
          accessible: false,
          visited: x === 0 && y === 0,
          content: null
        });
      }
      grid.value.push(row);
    }

    const startCell = grid.value[0][0];
    startCell.type = 'start';
    startCell.accessible = true;
    startCell.explored = true;
    startCell.visited = true;

    const exitCell = grid.value[mergedConfig.size - 1][mergedConfig.size - 1];
    exitCell.type = 'exit';

    if (mergedConfig.bossEnabled) {
      const bossY = Math.floor(mergedConfig.size / 2);
      const bossX = Math.floor(mergedConfig.size / 2);
      grid.value[bossY][bossX].type = 'boss';
      grid.value[bossY][bossX].content = {
        name: 'BOSS',
        icon: 'boss',
        maxHp: 200,
        damage: [20, 35],
        xp: 100,
        gold: 200,
        dangerLevel: 'legendary'
      };
    }

    placeCells('monster', mergedConfig.monsterCount, mergedConfig.size);
    placeCells('treasure', mergedConfig.treasureCount, mergedConfig.size);
    placeCells('shop', mergedConfig.shopCount, mergedConfig.size);
    placeCells('rest', mergedConfig.restCount, mergedConfig.size);
    placeCells('event', mergedConfig.eventCount, mergedConfig.size);

    updateAccessibleCells();

    playerPosition.value = { x: 0, y: 0 };
    visitedCells.value = 1;
    remainingMoves.value = 20 + mergedConfig.size;
    explorationComplete.value = false;
    bossDefeated.value = false;
    currentEvent.value = null;
  }

  function placeCells(type: CellType, count: number, gridSize: number) {
    const reservedPositions = [
      { x: 0, y: 0 },
      { x: gridSize - 1, y: gridSize - 1 },
      { x: Math.floor(gridSize / 2), y: Math.floor(gridSize / 2) }
    ];

    for (let i = 0; i < count; i++) {
      let placed = false;
      let attempts = 0;
      
      while (!placed && attempts < 100) {
        const x = Math.floor(Math.random() * gridSize);
        const y = Math.floor(Math.random() * gridSize);
        
        const isReserved = reservedPositions.some(pos => pos.x === x && pos.y === y);
        const isEmpty = grid.value[y][x].type === 'empty';
        
        if (!isReserved && isEmpty) {
          grid.value[y][x].type = type;
          
          if (type === 'monster') {
            grid.value[y][x].content = generateMonster();
          } else if (type === 'treasure') {
            grid.value[y][x].content = generateTreasure();
          } else if (type === 'event') {
            grid.value[y][x].content = generateRandomEvent();
          }
          
          placed = true;
        }
        attempts++;
      }
    }
  }

  function generateMonster() {
    const monsters = [
      { name: '哥布林', icon: 'goblin', maxHp: 30, damage: [5, 12], xp: 15, gold: 10, dangerLevel: 'normal' },
      { name: '骷髅兵', icon: 'skeleton', maxHp: 40, damage: [8, 15], xp: 20, gold: 15, dangerLevel: 'normal' },
      { name: '暗影刺客', icon: 'assassin', maxHp: 35, damage: [10, 20], xp: 25, gold: 20, dangerLevel: 'danger' },
      { name: '石像鬼', icon: 'golem', maxHp: 60, damage: [12, 18], xp: 30, gold: 25, dangerLevel: 'danger' },
      { name: '火焰元素', icon: 'fire_elemental', maxHp: 50, damage: [15, 25], xp: 35, gold: 30, dangerLevel: 'danger' }
    ];
    return monsters[Math.floor(Math.random() * monsters.length)];
  }

  function generateTreasure() {
    const treasures = [
      { gold: 20, exp: 10, items: [{ itemId: 'potion_small', count: 1 }] },
      { gold: 50, exp: 20, items: [{ itemId: 'potion_medium', count: 1 }] },
      { gold: 100, exp: 30, items: [{ itemId: 'weapon_common', count: 1 }] },
      { gold: 150, exp: 40, items: [{ itemId: 'armor_common', count: 1 }] },
      { gold: 50, exp: 15, items: [{ itemId: 'scroll', count: 2 }] }
    ];
    return treasures[Math.floor(Math.random() * treasures.length)];
  }

  function generateRandomEvent(): ExplorationEvent {
    const eventTemplate = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
    return {
      ...eventTemplate,
      id: generateId()
    };
  }

  function updateAccessibleCells() {
    const px = playerPosition.value.x;
    const py = playerPosition.value.y;

    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    for (let y = 0; y < size.value; y++) {
      for (let x = 0; x < size.value; x++) {
        grid.value[y][x].accessible = false;
      }
    }

    for (const dir of directions) {
      const nx = px + dir.dx;
      const ny = py + dir.dy;
      
      if (nx >= 0 && nx < size.value && ny >= 0 && ny < size.value) {
        grid.value[ny][nx].accessible = true;
      }
    }
  }

  function movePlayer(direction: 'up' | 'down' | 'left' | 'right'): ExplorationResult {
    if (explorationComplete.value) {
      return { success: false, message: '探索已经完成！' };
    }

    if (remainingMoves.value <= 0) {
      return { success: false, message: '移动次数已用完！' };
    }

    let nx = playerPosition.value.x;
    let ny = playerPosition.value.y;

    switch (direction) {
      case 'up': ny--; break;
      case 'down': ny++; break;
      case 'left': nx--; break;
      case 'right': nx++; break;
    }

    if (nx < 0 || nx >= size.value || ny < 0 || ny >= size.value) {
      return { success: false, message: '无法移动到那里！' };
    }

    if (!grid.value[ny][nx].accessible) {
      return { success: false, message: '该方向不可移动！' };
    }

    playerPosition.value = { x: nx, y: ny };
    remainingMoves.value--;

    const cell = grid.value[ny][nx];
    cell.explored = true;
    
    if (!cell.visited) {
      cell.visited = true;
      visitedCells.value++;
    }

    updateAccessibleCells();

    return handleCellInteraction(cell);
  }

  function handleCellInteraction(cell: ExplorationCell): ExplorationResult {
    switch (cell.type) {
      case 'monster':
        eventBus.emit(GameEvents.COMBAT_START, { enemy: { ...cell.content, id: generateId(), level: 1, hp: cell.content.maxHp, loot: [] } });
        combatService.startCombat({ ...cell.content, id: generateId(), level: 1, hp: cell.content.maxHp, loot: [] });
        return { success: true, message: `\u906D\u9047\u4E86 ${cell.content.name}！` };
      
      case 'treasure':
        const treasure = cell.content;
        if (treasure.gold) characterService.addGold(treasure.gold);
        if (treasure.exp) characterService.addExp(treasure.exp);
        if (treasure.items) {
          for (const item of treasure.items) {
            inventoryService.addItem({ id: item.itemId, count: item.count } as any);
          }
        }
        cell.type = 'empty';
        cell.content = null;
        return { 
          success: true, 
          message: `\u53D1\u73B0\u4E86\u5B9D\u7BB1\uFF01\u83B7\u5F97\u4E86 ${treasure.gold} 金币和 ${treasure.exp} 经验值！`,
          rewards: treasure
        };
      
      case 'rest':
        const maxHp = characterService.getAttributes().maxHp;
        characterService.addHp(maxHp);
        cell.type = 'empty';
        return { success: true, message: '你休息了一下，恢复了全部生命值！' };
      
      case 'shop':
        currentEvent.value = {
          id: generateId(),
          type: 'shop',
          title: '商店',
          description: '欢迎光临！',
          icon: 'shop'
        };
        return { success: true, message: '你进入了商店。' };
      
      case 'boss':
        if (!bossDefeated.value) {
          eventBus.emit(GameEvents.COMBAT_START, { enemy: { ...cell.content, id: generateId(), level: 5, hp: cell.content.maxHp, loot: [] } });
          combatService.startCombat({ ...cell.content, id: generateId(), level: 5, hp: cell.content.maxHp, loot: [] });
          return { success: true, message: `\u906D\u9047\u4E86 BOSS：${cell.content.name}！` };
        }
        return { success: true, message: 'BOSS已经被击败。' };
      
      case 'event':
        currentEvent.value = cell.content;
        return { success: true, message: cell.content.title };
      
      case 'exit':
        if (bossDefeated.value) {
          explorationComplete.value = true;
          eventBus.emit(GameEvents.EXPLORATION_COMPLETE, {});
          return { success: true, message: '探索完成！你找到了出口！' };
        }
        return { success: false, message: 'BOSS还未被击败，无法离开！' };
      
      default:
        return { success: true, message: '' };
    }
  }

  function exploreCell(x: number, y: number): ExplorationEvent | null {
    if (x < 0 || x >= size.value || y < 0 || y >= size.value) {
      return null;
    }
    
    const cell = grid.value[y][x];
    cell.explored = true;
    
    if (cell.type === 'event' && cell.content) {
      currentEvent.value = cell.content;
      return cell.content;
    }
    
    return null;
  }

  function handleEventChoice(choiceId: string): ExplorationResult {
    if (!currentEvent.value || !currentEvent.value.choices) {
      return { success: false, message: '没有事件需要处理！' };
    }

    const choice = currentEvent.value.choices.find(c => c.id === choiceId);
    if (!choice) {
      return { success: false, message: '无效的选择！' };
    }

    const success = Math.random() < choice.successRate;
    const message = success ? choice.successResult : choice.failureResult;

    if (success && choice.rewards) {
      if (choice.rewards.gold) characterService.addGold(choice.rewards.gold);
      if (choice.rewards.exp) characterService.addExp(choice.rewards.exp);
      if (choice.rewards.healthRestore) characterService.addHp(choice.rewards.healthRestore);
      if (choice.rewards.items) {
        for (const item of choice.rewards.items) {
          inventoryService.addItem({ id: item.itemId, count: item.count } as any);
        }
      }
    } else if (!success && choice.failurePenalty) {
      if (choice.failurePenalty.gold) characterService.addGold(-choice.failurePenalty.gold);
      if (choice.failurePenalty.health) characterService.addHp(-choice.failurePenalty.health);
    }

    const cell = grid.value[playerPosition.value.y][playerPosition.value.x];
    if (cell.type === 'event') {
      cell.type = 'empty';
      cell.content = null;
    }
    
    currentEvent.value = null;

    return {
      success: true,
      message,
      rewards: success ? choice.rewards : undefined
    };
  }

  function resetExploration() {
    grid.value = [];
    playerPosition.value = { x: 0, y: 0 };
    currentEvent.value = null;
    visitedCells.value = 0;
    remainingMoves.value = 20;
    explorationComplete.value = false;
    bossDefeated.value = false;
    size.value = 10;
  }

  function canMove(direction: 'up' | 'down' | 'left' | 'right'): boolean {
    if (explorationComplete.value || remainingMoves.value <= 0) {
      return false;
    }

    let nx = playerPosition.value.x;
    let ny = playerPosition.value.y;

    switch (direction) {
      case 'up': ny--; break;
      case 'down': ny++; break;
      case 'left': nx--; break;
      case 'right': nx++; break;
    }

    if (nx < 0 || nx >= size.value || ny < 0 || ny >= size.value) {
      return false;
    }

    return grid.value[ny][nx].accessible;
  }

  function setBossDefeated(value: boolean) {
    bossDefeated.value = value;
    const bossPos = Math.floor(size.value / 2);
    grid.value[bossPos][bossPos].type = value ? 'empty' : 'boss';
    updateAccessibleCells();
  }

  return {
    grid,
    playerPosition,
    currentEvent,
    visitedCells,
    remainingMoves,
    explorationComplete,
    bossDefeated,
    size,
    state,
    generateGrid,
    movePlayer,
    exploreCell,
    handleEventChoice,
    resetExploration,
    canMove,
    setBossDefeated
  };
});

export const explorationService: IExplorationService = {
  generateGrid: (config?: Partial<GridGenerationConfig>) => useExplorationStore().generateGrid(config),
  movePlayer: (direction: 'up' | 'down' | 'left' | 'right') => useExplorationStore().movePlayer(direction),
  getState: () => useExplorationStore().state,
  exploreCell: (x: number, y: number) => useExplorationStore().exploreCell(x, y),
  handleEventChoice: (choiceId: string) => useExplorationStore().handleEventChoice(choiceId),
  resetExploration: () => useExplorationStore().resetExploration(),
  canMove: (direction: 'up' | 'down' | 'left' | 'right') => useExplorationStore().canMove(direction)
};
