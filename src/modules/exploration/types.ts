/**
 * @fileoverview 探索模块类型定义
 * @description 探索进度、地点发现、探索奖励系统
 * @module modules/exploration/types
 */

/**
 * 探索状态
 */
export type ExplorationStatus = 'undiscovered' | 'discovered' | 'explored' | 'mastered'

/**
 * 地点探索数据
 */
export interface LocationExploration {
  locationId: string
  status: ExplorationStatus
  discoveredAt: number | null
  exploredAt: number | null
  exploredPercentage: number
  objectivesCompleted: string[]
  secretsFound: string[]
  enemiesDefeated: Set<string>
}

/**
 * 大陆探索数据
 */
export interface ContinentExploration {
  continentId: string
  locationsExplored: number
  totalLocations: number
  secretsFound: number
  totalSecrets: number
}

/**
 * 探索奖励
 */
export interface ExplorationReward {
  id: string
  title: string
  description: string
  type: 'achievement' | 'item' | 'exp' | 'gold'
  requirement: {
    type: 'locations' | 'percentage' | 'secret'
    threshold: number
  }
  value: any
  granted: boolean
}

/**
 * 探索模块状态
 */
export interface ExplorationState {
  locations: Record<string, LocationExploration>
  continents: Record<string, ContinentExploration>
  rewards: ExplorationReward[]
  totalExplorationPercentage: number
  discoveredLocations: string[]
}

/**
 * 探索事件数据
 */
export interface ExplorationEvent {
  type: 'discover' | 'explore' | 'secret_found' | 'objective_completed'
  locationId: string
  data?: any
}

/**
 * 探索服务接口
 */
export interface IExplorationService {
  getState(): ExplorationState
  getLocationExploration(locationId: string): LocationExploration
  getContinentExploration(continentId: string): ContinentExploration
  isDiscovered(locationId: string): boolean
  discoverLocation(locationId: string): boolean
  exploreLocation(locationId: string): boolean
  findSecret(locationId: string, secretId: string): boolean
  completeObjective(locationId: string, objectiveId: string): boolean
  defeatEnemy(locationId: string, enemyId: string): boolean
  getTotalExplorationPercentage(): number
  getLocationExplorationPercentage(locationId: string): number
  claimReward(rewardId: string): boolean
  getAvailableRewards(): ExplorationReward[]
  getClaimedRewards(): ExplorationReward[]
  resetExploration(): void
  saveToStorage(): void
  loadFromStorage(): void
}
