/**
 * 任务模块状态管理层
 * 
 * Store 是任务数据的唯一持有者，Service 作为纯业务逻辑层供 Store 调用。
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { QuestDefinition, QuestInstance } from './types';
import { questService } from './service';
import { eventBus, GameEvents } from '../bus/core';

/**
 * 任务状态存储
 */
export const useQuestStore = defineStore('quest', () => {
  /** 可用任务列表 */
  const availableQuests = ref<QuestDefinition[]>([]);
  
  /** 进行中的任务列表 */
  const inProgressQuests = ref<(QuestDefinition & { progress: QuestInstance['progress'] })[]>([]);
  
  /** 已完成的任务列表 */
  const completedQuests = ref<QuestDefinition[]>([]);
  
  /** 已完成（待提交奖励）的任务列表 */
  const turnedInQuests = ref<QuestDefinition[]>([]);

  /** 从 Service 同步任务列表到 Store */
  function syncFromService(): void {
    updateQuestLists();
  }
  
  /**
   * 获取可用任务
   */
  const getAvailableQuests = computed(() => availableQuests.value);
  
  /**
   * 获取进行中的任务
   */
  const getInProgressQuests = computed(() => inProgressQuests.value);
  
  /**
   * 获取已完成的任务
   */
  const getCompletedQuests = computed(() => completedQuests.value);
  
  /**
   * 获取已提交的任务
   */
  const getTurnedInQuests = computed(() => turnedInQuests.value);
  
  /**
   * 更新任务列表
   */
  function updateQuestLists(): void {
    // 更新可用任务
    const availableIds = questService.getAvailableQuests();
    availableQuests.value = availableIds
      .map(id => questService.getQuestDefinition(id))
      .filter((q): q is QuestDefinition => q !== null);
    
    // 更新进行中的任务
    const inProgressIds = questService.getInProgressQuests();
    inProgressQuests.value = inProgressIds
      .map(id => {
        const definition = questService.getQuestDefinition(id);
        const instance = questService.getQuestInstance(id);
        if (definition && instance) {
          return { ...definition, progress: instance.progress };
        }
        return null;
      })
      .filter((q): q is QuestDefinition & { progress: QuestInstance['progress'] } => q !== null);
    
    // 更新已完成的任务
    const completedIds = questService.getCompletedQuests();
    completedQuests.value = completedIds
      .map(id => questService.getQuestDefinition(id))
      .filter((q): q is QuestDefinition => q !== null);
    
    // 更新已提交的任务
    const turnedInIds = questService.getCompletedQuests();
    turnedInQuests.value = turnedInIds
      .map(id => questService.getQuestDefinition(id))
      .filter((q): q is QuestDefinition => q !== null);
  }
  
  /**
   * 接受任务
   * @param questId - 任务ID
   * @returns 是否成功接受
   */
  function acceptQuest(questId: string): boolean {
    const success = questService.acceptQuest(questId);
    if (success) {
      syncFromService();
    }
    return success;
  }
  
  /**
   * 提交任务
   * @param questId - 任务ID
   * @returns 是否成功提交
   */
  function turnInQuest(questId: string): boolean {
    const success = questService.turnInQuest(questId);
    if (success) {
      syncFromService();
    }
    return success;
  }
  
  /**
   * 放弃任务
   * @param questId - 任务ID
   * @returns 是否成功放弃
   */
  function abandonQuest(questId: string): boolean {
    const success = questService.abandonQuest(questId);
    if (success) {
      syncFromService();
    }
    return success;
  }
  
  /**
   * 获取任务定义
   * @param questId - 任务ID
   * @returns 任务定义
   */
  function getQuestDefinition(questId: string): QuestDefinition | null {
    return questService.getQuestDefinition(questId);
  }
  
  /**
   * 获取任务实例
   * @param questId - 任务ID
   * @returns 任务实例
   */
  function getQuestInstance(questId: string): QuestInstance | null {
    return questService.getQuestInstance(questId);
  }
  
  /**
   * 获取指定任务板的任务
   * @param boardId - 任务板ID
   * @returns 任务定义列表
   */
  function getQuestsFromBoard(boardId: string): QuestDefinition[] {
    return questService.getQuestsFromBoard(boardId);
  }
  
  /**
   * 获取指定任务板上可提交的任务
   * @param boardId - 任务板ID
   * @returns 任务定义列表
   */
  function getQuestsToTurnIn(boardId: string): QuestDefinition[] {
    return questService.getQuestsToTurnIn(boardId);
  }
  
  /**
   * 从任务板接受任务
   * @param boardId - 任务板ID
   * @param questId - 任务ID
   * @returns 是否成功接受
   */
  function acceptQuestFromBoard(boardId: string, questId: string): boolean {
    const success = questService.acceptQuestFromBoard(boardId, questId);
    if (success) {
      syncFromService();
    }
    return success;
  }
  
  /**
   * 在任务板提交任务
   * @param boardId - 任务板ID
   * @param questId - 任务ID
   * @returns 是否成功提交
   */
  function turnInQuestToBoard(boardId: string, questId: string): boolean {
    const success = questService.turnInQuestToBoard(boardId, questId);
    if (success) {
      syncFromService();
    }
    return success;
  }

  /**
   * 跨模块事件监听
   */
  function setupCrossModuleListeners(): void {
    eventBus.clearGroup('questStore');

    // 角色选中时重新加载对应角色的任务数据
    eventBus.onGroup('questStore', GameEvents.CHARACTER_SELECTED, async () => {
      await questService.init();
      syncFromService();
    });

    // 角色登出时只清除UI状态，不删除数据库数据
    eventBus.onGroup('questStore', GameEvents.CHARACTER_LOGOUT, () => {
      availableQuests.value = [];
      inProgressQuests.value = [];
      completedQuests.value = [];
      turnedInQuests.value = [];
    });
  }

  /**
   * 清理事件监听
   */
  function dispose(): void {
    eventBus.clearGroup('questStore');
  }
  
  /**
   * 初始化
   */
  async function init(): Promise<void> {
    await questService.init();
    syncFromService();
  }
  
  /**
   * 重置
   */
  function reset(): void {
    questService.reset();
    syncFromService();
  }
  
  return {
    // 状态
    availableQuests,
    inProgressQuests,
    completedQuests,
    turnedInQuests,
    
    // 计算属性
    getAvailableQuests,
    getInProgressQuests,
    getCompletedQuests,
    getTurnedInQuests,
    
    // 方法
    acceptQuest,
    turnInQuest,
    abandonQuest,
    getQuestDefinition,
    getQuestInstance,
    getQuestsFromBoard,
    getQuestsToTurnIn,
    acceptQuestFromBoard,
    turnInQuestToBoard,
    init,
    reset,
    updateQuestLists,
    setupCrossModuleListeners,
    dispose
  };
});