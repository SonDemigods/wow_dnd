export type GridStatus = 'unexplored' | 'revealed' | 'used' | 'camp' | 'shop' | 'board' | 'boss'

export type GridEventType = 'monster' | 'item' | 'trap' | 'event' | 'empty' | 'camp' | 'shop' | 'board' | 'boss'

export interface GridCell {
  x: number
  y: number
  status: GridStatus
  eventType?: GridEventType
  eventData?: {
    shopId?: string
    boardId?: string
    monsterId?: string
    itemId?: string
    trapId?: string
  }
}

export interface ExplorationCell {
  x: number
  y: number
  type: string
  explored: boolean
  accessible: boolean
  visited: boolean
  monsterId?: string
}

export interface ExplorationEventChoice {
  id: string
  text: string
}

export interface ExplorationEvent {
  title: string
  description: string
  choices?: ExplorationEventChoice[]
}

export interface ExplorationState {
  currentAreaId: string | null
  grid: ExplorationCell[][]
  campUsed: boolean
  playerPosition: { x: number; y: number }
  visitedCells: number
  remainingMoves: number
  bossDefeated: boolean
  explorationComplete: boolean
}

export interface GridEventProbability {
  monster: number
  item: number
  trap: number
  event: number
  empty: number
}

export interface AreaConfig {
  areaId: string
  name: string
  level: number
  eventProbability: GridEventProbability
  monsterPool: string[]
  bossPool: string[]
  itemPool: string[]
}

export interface MoveResult {
  success: boolean
  message?: string
  rewards?: {
    gold: number
    exp: number
  }
}

export interface EventChoiceResult {
  success: boolean
  message: string
}

export interface IExplorationService {
  getState(): ExplorationState
  enterArea(areaId: string): Promise<void>
  generateGrid(): void
  movePlayer(direction: 'up' | 'down' | 'left' | 'right'): MoveResult
  canMove(direction: 'up' | 'down' | 'left' | 'right'): boolean
  handleEventChoice(choiceId: string): EventChoiceResult
  getGrid(x: number, y: number): GridCell | null
  revealGrid(x: number, y: number): boolean
  useCamp(): boolean
  triggerBattle(monsterId: string): void
  onBattleResult(victory: boolean): void
  getCurrentAreaId(): string | null
  reset(): void
}