/**
 * @fileoverview 探索模块实现
 * @description 探索进度管理、地点发现、奖励机制
 * @module modules/exploration/index
 */

import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { eventBus, GameEvents } from '../../services/eventBus'
import { WORLD_LOCATIONS, CONTINENTS } from '../../data'
import { characterService } from '../character'
import type { LocationData } from '../../types'
import type {
  ExplorationState,
  LocationExploration,
  ContinentExploration,
  ExplorationReward,
  ExplorationEvent,
  ExplorationStatus,
  IExplorationService
} from './types'

/**
 * 默认状态
 */
const createInitialState = (): ExplorationState => {
  const locations: Record<string, LocationExploration> = {}
  const continents: Record<string, ContinentExploration> = {}

  // 初始化所有地点
  Object.keys(WORLD_LOCATIONS).forEach(locationId => {
    locations[locationId] = {
      locationId,
      status: 'undiscovered',
      discoveredAt: null,
      exploredAt: null,
      exploredPercentage: 0,
      objectivesCompleted: [],
      secretsFound: [],
      enemiesDefeated: new Set()
    }
  })

  // 初始化大陆数据
  Object.keys(CONTINENTS).forEach(continentId => {
    const continentLocations = Object.values(WORLD_LOCATIONS).filter(
      loc => loc.continent === continentId
    )
    continents[continentId] = {
      continentId,
      locationsExplored: 0,
      totalLocations: continentLocations.length,
      secretsFound: 0,
      totalSecrets: continentLocations.length // 每个地点假设1个秘密
    }
  })

  return {
    locations,
    continents,
    rewards: getInitialRewards(),
    totalExplorationPercentage: 0,
    discoveredLocations: []
  }
}

/**
 * 初始探索奖励
 */
const getInitialRewards = (): ExplorationReward[] => [
  {
    id: 'explore_10',
    title: '初级探险家',
    description: '探索10个地点',
    type: 'exp',
    requirement: {
      type: 'locations',
      threshold: 10
    },
    value: 500,
    granted: false
  },
  {
    id: 'explore_25',
    title: '资深探险家',
    description: '探索25个地点',
    type: 'item',
    requirement: {
      type: 'locations',
      threshold: 25
    },
    value: { id: 'explorer_bag', name: '探险者背包' },
    granted: false
  },
  {
    id: 'explore_50',
    title: '探索大师',
    description: '探索50个地点',
    type: 'exp',
    requirement: {
      type: 'locations',
      threshold: 50
    },
    value: 5000,
    granted: false
  },
  {
    id: 'explore_75_percent',
    title: '世界探索者',
    description: '完成75%探索进度',
    type: 'achievement',
    requirement: {
      type: 'percentage',
      threshold: 75
    },
    value: { title: '世界探索者' },
    granted: false
  }
]

/**
 * 探索状态管理
 */
export const useExplorationStore = defineStore('exploration', () => {
  // 状态
  const state = ref<ExplorationState>(createInitialState())

  // 计算属性
  const totalPercentage = computed(() => calculateTotalExplorationPercentage())
  const discoveredCount = computed(() => state.value.discoveredLocations.length)
  const totalLocations = computed(() => Object.keys(WORLD_LOCATIONS).length)

  // ==================== 公共方法 ====================

  /**
   * 获取当前状态
   */
  const getState = (): ExplorationState => {
    return JSON.parse(JSON.stringify(state.value))
  }

  /**
   * 获取地点探索数据
   */
  const getLocationExploration = (locationId: string): LocationExploration => {
    return state.value.locations[locationId] || {
      locationId,
      status: 'undiscovered',
      discoveredAt: null,
      exploredAt: null,
      exploredPercentage: 0,
      objectivesCompleted: [],
      secretsFound: [],
      enemiesDefeated: new Set()
    }
  }

  /**
   * 获取大陆探索数据
   */
  const getContinentExploration = (continentId: string): ContinentExploration => {
    if (!state.value.continents[continentId]) {
      const continentLocations = Object.values(WORLD_LOCATIONS).filter(
        loc => loc.continent === continentId
      )
      state.value.continents[continentId] = {
        continentId,
        locationsExplored: 0,
        totalLocations: continentLocations.length,
        secretsFound: 0,
        totalSecrets: continentLocations.length
      }
    }
    return state.value.continents[continentId]
  }

  /**
   * 检查地点是否已发现
   */
  const isDiscovered = (locationId: string): boolean => {
    const exploration = state.value.locations[locationId]
    return exploration && exploration.status !== 'undiscovered'
  }

  /**
   * 发现地点
   */
  const discoverLocation = (locationId: string): boolean => {
    const exploration = state.value.locations[locationId]
    if (!exploration || exploration.status !== 'undiscovered') {
      return false
    }

    exploration.status = 'discovered'
    exploration.discoveredAt = Date.now()

    // 添加到已发现列表
    if (!state.value.discoveredLocations.includes(locationId)) {
      state.value.discoveredLocations.push(locationId)
    }

    // 更新百分比
    updateExplorationPercentage()

    // 发送事件
    emitExplorationEvent({
      type: 'discover',
      locationId,
      data: { location: WORLD_LOCATIONS[locationId] }
    })

    return true
  }

  /**
   * 完全探索地点
   */
  const exploreLocation = (locationId: string): boolean => {
    const exploration = state.value.locations[locationId]
    if (!exploration || exploration.status === 'mastered') {
      return false
    }

    exploration.status = 'explored'
    exploration.exploredAt = Date.now()
    exploration.exploredPercentage = 100

    // 更新大陆数据
    updateContinentExploration(WORLD_LOCATIONS[locationId].continent)

    // 更新百分比
    updateExplorationPercentage()

    // 检查奖励
    checkRewards()

    // 发送事件
    emitExplorationEvent({
      type: 'explore',
      locationId,
      data: { location: WORLD_LOCATIONS[locationId] }
    })

    return true
  }

  /**
   * 发现秘密
   */
  const findSecret = (locationId: string, secretId: string): boolean => {
    const exploration = state.value.locations[locationId]
    if (!exploration || exploration.secretsFound.includes(secretId)) {
      return false
    }

    exploration.secretsFound.push(secretId)

    // 更新大陆数据
    const continent = WORLD_LOCATIONS[locationId]?.continent
    if (continent && state.value.continents[continent]) {
      state.value.continents[continent].secretsFound++
    }

    // 更新百分比
    updateExplorationPercentage()

    // 发送事件
    emitExplorationEvent({
      type: 'secret_found',
      locationId,
      data: { secretId }
    })

    return true
  }

  /**
   * 完成目标
   */
  const completeObjective = (locationId: string, objectiveId: string): boolean => {
    const exploration = state.value.locations[locationId]
    if (!exploration || exploration.objectivesCompleted.includes(objectiveId)) {
      return false
    }

    exploration.objectivesCompleted.push(objectiveId)
    updateLocationExplorationPercentage(locationId)

    return true
  }

  /**
   * 击败敌人
   */
  const defeatEnemy = (locationId: string, enemyId: string): boolean => {
    const exploration = state.value.locations[locationId]
    if (!exploration || exploration.enemiesDefeated.has(enemyId)) {
      return false
    }

    exploration.enemiesDefeated.add(enemyId)
    updateLocationExplorationPercentage(locationId)

    return true
  }

  /**
   * 获取总探索进度百分比
   */
  const getTotalExplorationPercentage = (): number => {
    return totalPercentage.value
  }

  /**
   * 获取地点探索百分比
   */
  const getLocationExplorationPercentage = (locationId: string): number => {
    const exploration = state.value.locations[locationId]
    return exploration?.exploredPercentage || 0
  }

  /**
   * 领取奖励
   */
  const claimReward = (rewardId: string): boolean => {
    const reward = state.value.rewards.find(r => r.id === rewardId)
    if (!reward || reward.granted) {
      return false
    }

    if (!isRewardAvailable(reward)) {
      return false
    }

    reward.granted = true
    grantReward(reward)

    return true
  }

  /**
   * 获取可领取的奖励
   */
  const getAvailableRewards = (): ExplorationReward[] => {
    return state.value.rewards.filter(r => isRewardAvailable(r) && !r.granted)
  }

  /**
   * 获取已领取的奖励
   */
  const getClaimedRewards = (): ExplorationReward[] => {
    return state.value.rewards.filter(r => r.granted)
  }

  /**
   * 重置探索进度
   */
  const resetExploration = (): void => {
    state.value = createInitialState()
  }

  /**
   * 保存到本地存储
   */
  const saveToStorage = (): void => {
    try {
      const data = {
        ...state.value,
        locations: Object.fromEntries(
          Object.entries(state.value.locations).map(([id, loc]) => [
            id,
            {
              ...loc,
              enemiesDefeated: Array.from(loc.enemiesDefeated)
            }
          ])
        )
      }
      localStorage.setItem('wow_exploration', JSON.stringify(data))
    } catch (error) {
      console.error('Failed to save exploration:', error)
    }
  }

  /**
   * 从本地存储加载
   */
  const loadFromStorage = (): void => {
    try {
      const saved = localStorage.getItem('wow_exploration')
      if (saved) {
        const data = JSON.parse(saved)
        state.value = {
          ...data,
          locations: Object.fromEntries(
            Object.entries(data.locations).map(([id, loc]: [string, any]) => [
              id,
              {
                ...loc,
                enemiesDefeated: new Set(loc.enemiesDefeated || [])
              }
            ])
          )
        }
      }
    } catch (error) {
      console.error('Failed to load exploration:', error)
    }
  }

  // ==================== 私有方法 ====================

  /**
   * 计算总探索百分比
   */
  const calculateTotalExplorationPercentage = (): number => {
    const allLocations = Object.values(state.value.locations)
    if (allLocations.length === 0) return 0

    const totalPercentage = allLocations.reduce(
      (sum, loc) => sum + loc.exploredPercentage,
      0
    )

    return Math.round(totalPercentage / allLocations.length)
  }

  /**
   * 更新总探索百分比
   */
  const updateExplorationPercentage = (): void => {
    state.value.totalExplorationPercentage = calculateTotalExplorationPercentage()
  }

  /**
   * 更新地点探索百分比
   */
  const updateLocationExplorationPercentage = (locationId: string): void => {
    const exploration = state.value.locations[locationId]
    if (!exploration) return

    // 简单计算：敌人 + 目标 + 秘密
    const totalObjectives = 5 // 假设每个地点有5个目标
    const completedObjectives =
      exploration.enemiesDefeated.size +
      exploration.objectivesCompleted.length +
      exploration.secretsFound.length

    exploration.exploredPercentage = Math.min(
      100,
      Math.round((completedObjectives / totalObjectives) * 100)
    )

    if (exploration.exploredPercentage >= 100 && exploration.status === 'discovered') {
      exploration.status = 'explored'
    }

    updateExplorationPercentage()
  }

  /**
   * 更新大陆探索数据
   */
  const updateContinentExploration = (continentId: string): void => {
    if (!state.value.continents[continentId]) return

    const continentLocations = Object.values(WORLD_LOCATIONS).filter(
      loc => loc.continent === continentId
    )

    let exploredCount = 0
    continentLocations.forEach(loc => {
      const exploration = state.value.locations[loc.name]
      if (exploration && exploration.status === 'explored') {
        exploredCount++
      }
    })

    state.value.continents[continentId].locationsExplored = exploredCount
  }

  /**
   * 检查奖励条件
   */
  const checkRewards = (): void => {
    state.value.rewards.forEach(reward => {
      if (!reward.granted && isRewardAvailable(reward)) {
        eventBus.emit('exploration:rewardAvailable', { reward })
      }
    })
  }

  /**
   * 检查奖励是否可领取
   */
  const isRewardAvailable = (reward: ExplorationReward): boolean => {
    switch (reward.requirement.type) {
      case 'locations':
        return state.value.discoveredLocations.length >= reward.requirement.threshold
      case 'percentage':
        return totalPercentage.value >= reward.requirement.threshold
      case 'secret':
        const totalSecrets = Object.values(state.value.continents).reduce(
          (sum, c) => sum + c.secretsFound,
          0
        )
        return totalSecrets >= reward.requirement.threshold
      default:
        return false
    }
  }

  /**
   * 发放奖励
   */
  const grantReward = (reward: ExplorationReward): void => {
    switch (reward.type) {
      case 'exp':
        characterService.addExp(reward.value)
        eventBus.emit(GameEvents.NOTIFICATION, {
          type: 'success',
          title: '探索奖励',
          message: `获得 ${reward.value} 经验值！`
        })
        break
      case 'gold':
        // TODO: 添加金币系统
        break
      case 'item':
        // TODO: 添加到背包
        eventBus.emit(GameEvents.NOTIFICATION, {
          type: 'success',
          title: '探索奖励',
          message: `获得 ${reward.value.name}！`
        })
        break
      case 'achievement':
        eventBus.emit(GameEvents.NOTIFICATION, {
          type: 'success',
          title: '成就解锁！',
          message: `获得成就：${reward.title}`
        })
        break
    }
  }

  /**
   * 发送探索事件
   */
  const emitExplorationEvent = (event: ExplorationEvent): void => {
    eventBus.emit('exploration:event', event)
  }

  return {
    state,
    totalPercentage,
    discoveredCount,
    totalLocations,
    getState,
    getLocationExploration,
    getContinentExploration,
    isDiscovered,
    discoverLocation,
    exploreLocation,
    findSecret,
    completeObjective,
    defeatEnemy,
    getTotalExplorationPercentage,
    getLocationExplorationPercentage,
    claimReward,
    getAvailableRewards,
    getClaimedRewards,
    resetExploration,
    saveToStorage,
    loadFromStorage
  }
})

/**
 * 探索服务实现
 */
export const explorationService: IExplorationService = {
  getState: () => useExplorationStore().getState(),
  getLocationExploration: (id) => useExplorationStore().getLocationExploration(id),
  getContinentExploration: (id) => useExplorationStore().getContinentExploration(id),
  isDiscovered: (id) => useExplorationStore().isDiscovered(id),
  discoverLocation: (id) => useExplorationStore().discoverLocation(id),
  exploreLocation: (id) => useExplorationStore().exploreLocation(id),
  findSecret: (locId, secId) => useExplorationStore().findSecret(locId, secId),
  completeObjective: (locId, objId) => useExplorationStore().completeObjective(locId, objId),
  defeatEnemy: (locId, enId) => useExplorationStore().defeatEnemy(locId, enId),
  getTotalExplorationPercentage: () => useExplorationStore().getTotalExplorationPercentage(),
  getLocationExplorationPercentage: (id) => useExplorationStore().getLocationExplorationPercentage(id),
  claimReward: (id) => useExplorationStore().claimReward(id),
  getAvailableRewards: () => useExplorationStore().getAvailableRewards(),
  getClaimedRewards: () => useExplorationStore().getClaimedRewards(),
  resetExploration: () => useExplorationStore().resetExploration(),
  saveToStorage: () => useExplorationStore().saveToStorage(),
  loadFromStorage: () => useExplorationStore().loadFromStorage()
}
