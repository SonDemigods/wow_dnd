/**
 * @fileoverview 任务服务模块
 * @description 提供任务进度管理、任务接受和完成等功能
 * @module modules/quests
 */

import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { QUESTS } from '@/data/quests';
import type {
  QuestState,
  QuestStatus,
  QuestObjectiveProgress,
  QuestProgress,
  QuestAcceptedEvent,
  QuestCompletedEvent,
  QuestProgressUpdatedEvent,
  IQuestService,
} from './types';

/**
 * 本地存储键名前缀
 */
const QUEST_STORAGE_KEY = 'wow_quests_';

/**
 * 任务状态管理Store
 */
export const useQuestStore = defineStore('quests', () => {
  /**
   * 所有任务的状态
   */
  const questStates = ref<Record<string, QuestState>>({});

  /**
   * 从本地存储加载任务状态
   */
  function loadFromStorage() {
    try {
      const allKeys = Object.keys(localStorage).filter(key => key.startsWith(QUEST_STORAGE_KEY));
      const states: Record<string, QuestState> = {};
      
      for (const key of allKeys) {
        const questKey = key.replace(QUEST_STORAGE_KEY, '');
        const data = localStorage.getItem(key);
        if (data) {
          states[questKey] = JSON.parse(data);
        }
      }
      
      questStates.value = states;
    } catch (e) {
      console.error('Failed to load quest states:', e);
    }
  }

  /**
   * 保存单个任务状态到本地存储
   */
  function saveQuestState(questKey: string, state: QuestState) {
    try {
      localStorage.setItem(`${QUEST_STORAGE_KEY}${questKey}`, JSON.stringify(state));
    } catch (e) {
      console.error('Failed to save quest state:', e);
    }
  }

  /**
   * 清除所有任务状态
   */
  function clearStorage() {
    const allKeys = Object.keys(localStorage).filter(key => key.startsWith(QUEST_STORAGE_KEY));
    for (const key of allKeys) {
      localStorage.removeItem(key);
    }
  }

  /**
   * 初始化任务状态
   */
  function initializeQuest(questKey: string): QuestState {
    const quest = QUESTS[questKey];
    if (!quest) {
      throw new Error(`Quest not found: ${questKey}`);
    }

    const progress: QuestProgress = {};
    quest.objectives.forEach((objective, index) => {
      const objKey = objective.enemyKey || `objective_${index}`;
      progress[objKey] = {
        current: 0,
        target: objective.target,
      };
    });

    return {
      questKey,
      status: QuestStatus.AVAILABLE,
      progress,
      acceptedAt: Date.now(),
    };
  }

  /**
   * 获取任务状态
   */
  const getQuestState = (questKey: string): QuestState | null => {
    if (!questStates.value[questKey]) {
      if (QUESTS[questKey]) {
        questStates.value[questKey] = initializeQuest(questKey);
      }
    }
    return questStates.value[questKey] || null;
  };

  /**
   * 接受任务
   */
  const acceptQuest = (questKey: string): boolean => {
    const quest = QUESTS[questKey];
    if (!quest) return false;

    let state = getQuestState(questKey);
    if (!state) {
      state = initializeQuest(questKey);
    }

    if (state.status !== QuestStatus.AVAILABLE) {
      return false;
    }

    state.status = QuestStatus.IN_PROGRESS;
    questStates.value[questKey] = state;
    saveQuestState(questKey, state);

    const event: QuestAcceptedEvent = {
      questKey,
      questName: quest.name,
    };
    eventBus.emit(GameEvents.QUEST_ACCEPTED, event);

    return true;
  };

  /**
   * 更新任务进度
   */
  const updateQuestProgress = (questKey: string, objectiveKey: string, amount: number = 1) => {
    const state = getQuestState(questKey);
    if (!state || state.status !== QuestStatus.IN_PROGRESS) {
      return;
    }

    const objectiveProgress = state.progress[objectiveKey];
    if (!objectiveProgress) {
      return;
    }

    const oldValue = objectiveProgress.current;
    const newValue = Math.min(objectiveProgress.current + amount, objectiveProgress.target);
    
    if (newValue > oldValue) {
      objectiveProgress.current = newValue;
      questStates.value[questKey] = { ...state };
      saveQuestState(questKey, state);

      const progressEvent: QuestProgressUpdatedEvent = {
        questKey,
        objectiveKey,
        current: newValue,
        target: objectiveProgress.target,
      };
      eventBus.emit(GameEvents.QUEST_PROGRESS_UPDATED, progressEvent);

      if (newValue >= objectiveProgress.target) {
        checkQuestCompletion(questKey);
      }
    }
  };

  /**
   * 检查任务是否全部完成
   */
  const checkQuestCompletion = (questKey: string) => {
    const state = getQuestState(questKey);
    if (!state || state.status !== QuestStatus.IN_PROGRESS) {
      return;
    }

    const allObjectivesComplete = Object.values(state.progress).every(
      progress => progress.current >= progress.target
    );

    if (allObjectivesComplete) {
      state.status = QuestStatus.COMPLETED;
      state.completedAt = Date.now();
      questStates.value[questKey] = { ...state };
      saveQuestState(questKey, state);
    }
  };

  /**
   * 交任务
   */
  const turnInQuest = (questKey: string): boolean => {
    const state = getQuestState(questKey);
    const quest = QUESTS[questKey];
    
    if (!state || !quest || state.status !== QuestStatus.COMPLETED) {
      return false;
    }

    state.status = QuestStatus.TURNED_IN;
    questStates.value[questKey] = { ...state };
    saveQuestState(questKey, state);

    const event: QuestCompletedEvent = {
      questKey,
      questName: quest.name,
      xpReward: quest.reward.xp,
      goldReward: quest.reward.gold,
    };
    eventBus.emit(GameEvents.QUEST_COMPLETED, event);

    return true;
  };

  /**
   * 判断任务是否可接
   */
  const isQuestAvailable = (questKey: string): boolean => {
    const state = getQuestState(questKey);
    if (!state) return !!QUESTS[questKey];
    return state.status === QuestStatus.AVAILABLE;
  };

  /**
   * 判断任务是否进行中
   */
  const isQuestInProgress = (questKey: string): boolean => {
    const state = getQuestState(questKey);
    return state?.status === QuestStatus.IN_PROGRESS;
  };

  /**
   * 判断任务是否已完成
   */
  const isQuestCompleted = (questKey: string): boolean => {
    const state = getQuestState(questKey);
    return state?.status === QuestStatus.COMPLETED || state?.status === QuestStatus.TURNED_IN;
  };

  /**
   * 获取所有可接任务
   */
  const getAvailableQuests = computed((): string[] => {
    return Object.keys(QUESTS).filter(key => isQuestAvailable(key));
  });

  /**
   * 获取所有进行中的任务
   */
  const getInProgressQuests = computed((): string[] => {
    return Object.keys(questStates.value).filter(
      key => questStates.value[key].status === QuestStatus.IN_PROGRESS
    );
  });

  /**
   * 获取所有已完成的任务
   */
  const getCompletedQuests = computed((): string[] => {
    return Object.keys(questStates.value).filter(key => isQuestCompleted(key));
  });

  /**
   * 重置所有任务状态
   */
  const reset = () => {
    questStates.value = {};
    clearStorage();
  };

  // 初始化时加载存储
  loadFromStorage();

  return {
    questStates,
    getQuestState,
    acceptQuest,
    updateQuestProgress,
    turnInQuest,
    isQuestAvailable,
    isQuestInProgress,
    isQuestCompleted,
    getAvailableQuests,
    getInProgressQuests,
    getCompletedQuests,
    reset,
  };
});

/**
 * 任务服务实现
 */
export const questService: IQuestService = {
  acceptQuest: (questKey: string) => useQuestStore().acceptQuest(questKey),
  updateQuestProgress: (questKey: string, objectiveKey: string, amount?: number) =>
    useQuestStore().updateQuestProgress(questKey, objectiveKey, amount),
  turnInQuest: (questKey: string) => useQuestStore().turnInQuest(questKey),
  isQuestAvailable: (questKey: string) => useQuestStore().isQuestAvailable(questKey),
  isQuestInProgress: (questKey: string) => useQuestStore().isQuestInProgress(questKey),
  isQuestCompleted: (questKey: string) => useQuestStore().isQuestCompleted(questKey),
  getQuestState: (questKey: string) => useQuestStore().getQuestState(questKey),
  getAvailableQuests: () => useQuestStore().getAvailableQuests,
  getInProgressQuests: () => useQuestStore().getInProgressQuests,
  getCompletedQuests: () => useQuestStore().getCompletedQuests,
  reset: () => useQuestStore().reset(),
};
