/**
 * @fileoverview 游戏状态管理
 * @description 魔兽世界风格RPG游戏的核心Pinia Store，管理游戏主状态和通知
 * @module stores/game
 */

import { defineStore } from 'pinia'
import { ref } from 'vue'
import { characterService } from '@/modules/character'
import { inventoryService } from '@/modules/inventory'
import { questService } from '@/modules/quests'
import { equipmentService } from '@/modules/equipment'
import { npcService } from '@/modules/npc'
import { skillsService } from '@/modules/skills'
import { mapService } from '@/modules/map'
import { explorationService } from '@/modules/exploration'
import { adventureLogService } from '@/modules/adventureLog'

/**
 * 游戏状态管理Store
 */
export const useGameStore = defineStore('game', () => {
  // ==================== 游戏状态 ====================
  
  /** 游戏主状态 */
  const gameState = ref<'start' | 'creation' | 'playing'>('start')
  /** 通知消息 */
  const notification = ref<string | null>(null)
  
  // ==================== 通用动作 ====================
  
  /**
   * 设置游戏主状态
   * @param state - 新的游戏状态
   */
  function setGameState(state: 'start' | 'creation' | 'playing') {
    gameState.value = state
  }
  
  /**
   * 显示通知消息（3秒后自动消失）
   * @param message - 要显示的消息
   */
  function showNotification(message: string) {
    notification.value = message
    setTimeout(() => {
      notification.value = null
    }, 3000)
  }
  
  // ==================== 存档/读档 ====================
  
  /**
   * 保存游戏到localStorage（调用各模块的保存方法）
   */
  function saveGame() {
    // 调用各模块的保存方法
    // 各模块会自动保存，无需手动调用
  }
  
  /**
   * 从localStorage加载游戏（调用各模块的加载方法）
   * @returns 是否成功加载
   */
  function loadGame(): boolean {
    try {
      // 游戏状态已经在各模块初始化时自动加载
      return true
    } catch (e) {
      console.error('Failed to load game:', e)
      return false
    }
  }
  
  /**
   * 重置游戏（清空所有存档）
   */
  function resetGame() {
    // 重置各模块
    characterService.reset()
    inventoryService.reset()
    questService.reset()
    equipmentService.reset()
    npcService.reset()
    skillsService.reset()
    mapService.reset()
    explorationService.reset()
    adventureLogService.reset()
    
    // 重置游戏状态
    gameState.value = 'start'
  }
  
  /**
   * 开始新游戏
   */
  function startNewGame() {
    resetGame()
    gameState.value = 'creation'
  }
  
  /**
   * 继续游戏
   * @returns 是否成功继续
   */
  function continueGame() {
    if (loadGame()) {
      gameState.value = 'playing'
      return true
    }
    return false
  }
  
  /**
   * 完成角色创建，进入游戏
   */
  function finishCharacterCreation() {
    gameState.value = 'playing'
    saveGame()
    adventureLogService.addLog('冒险开始！', 'info')
  }
  
  return {
    // 状态
    gameState,
    notification,
    
    // 动作
    setGameState,
    showNotification,
    saveGame,
    loadGame,
    resetGame,
    startNewGame,
    continueGame,
    finishCharacterCreation
  }
})