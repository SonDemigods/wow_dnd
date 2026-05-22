import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { characterService } from '@/modules/character.module';
import { inventoryService } from '@/modules/inventory.module';
import { QUESTS } from '@/data';

export type QuestStatus = 'not_available' | 'available' | 'in_progress' | 'completed' | 'turned_in' | 'abandoned';

export type QuestType = 'kill' | 'collect';

export interface QuestReward {
  gold: number;
  exp: number;
  items?: QuestRewardItem[];
  reputation?: number;
}

export interface QuestRewardItem {
  itemId: string;
  count: number;
}

export interface QuestObjective {
  id: string;
  description: string;
  targetType: QuestTargetType;
  targetId?: string;
  targetName?: string;
  required: number;
  current: number;
  completed: boolean;
}

export type QuestTargetType = 'kill' | 'collect';

export interface Quest {
  id: string;
  title: string;
  description: string;
  type: QuestType;
  status: QuestStatus;
  level: number;
  requiredLevel: number;
  objectives: QuestObjective[];
  rewards: QuestReward;
  zoneId?: string;
  giverName: string;
  giverIcon: string;
  storyText?: string;
}

export interface QuestState {
  quests: Quest[];
  activeQuests: string[];
  completedQuests: string[];
  currentQuestId: string | null;
}

export interface QuestProgressUpdate {
  questId: string;
  objectiveId: string;
  newCurrent: number;
  completed: boolean;
}

export interface QuestAcceptResult {
  success: boolean;
  message: string;
  quest?: Quest;
}

export interface QuestCompleteResult {
  success: boolean;
  message: string;
  rewards?: QuestReward;
}

export interface IQuestService {
  getQuests(): Quest[];
  getQuestById(questId: string): Quest | undefined;
  getActiveQuests(): Quest[];
  getAvailableQuests(): Quest[];
  acceptQuest(questId: string): QuestAcceptResult;
  completeQuest(questId: string): QuestCompleteResult;
  claimReward(questId: string): QuestCompleteResult;
  updateObjective(questId: string, objectiveId: string, progress: number): void;
  isQuestCompleted(questId: string): boolean;
  isQuestActive(questId: string): boolean;
  getState(): QuestState;
  updateQuestFromEvent(eventType: string, targetId: string, count: number): void;
  reset(): void;
}

function convertQuests(): Quest[] {
  const questList: Quest[] = [];
  for (const [id, def] of Object.entries(QUESTS)) {
    questList.push({
      id,
      title: def.title,
      description: def.description,
      type: def.type,
      status: 'available',
      level: def.levelRequirement,
      requiredLevel: def.levelRequirement,
      objectives: def.objectives.map((obj, index) => ({
        id: `obj_${index}`,
        description: obj.description,
        targetType: obj.type,
        targetId: obj.enemyId,
        targetName: obj.description.split('杀死')[1]?.trim() || '',
        required: obj.target,
        current: 0,
        completed: false
      })),
      rewards: { gold: def.goldReward, exp: def.xpReward },
      zoneId: def.boardId,
      giverName: '任务发布者',
      giverIcon: 'quest'
    });
  }
  return questList;
}

const INITIAL_QUESTS: Quest[] = convertQuests();

export const useQuestStore = defineStore('quest', () => {
  const quests = ref<Quest[]>(JSON.parse(JSON.stringify(INITIAL_QUESTS)));
  const activeQuests = ref<string[]>([]);
  const completedQuests = ref<string[]>([]);
  const currentQuestId = ref<string | null>(null);

  const state = computed<QuestState>(() => ({
    quests: quests.value,
    activeQuests: activeQuests.value,
    completedQuests: completedQuests.value,
    currentQuestId: currentQuestId.value
  }));

  function getQuests(): Quest[] {
    return quests.value;
  }

  function getQuestById(questId: string): Quest | undefined {
    return quests.value.find(quest => quest.id === questId);
  }

  function getActiveQuests(): Quest[] {
    return quests.value.filter(quest => 
      activeQuests.value.includes(quest.id) && 
      quest.status !== 'completed' && 
      quest.status !== 'turned_in'
    );
  }

  function getAvailableQuests(): Quest[] {
    const playerLevel = characterService.getLevel();
    return quests.value.filter(quest => 
      quest.status === 'available' && 
      playerLevel >= quest.requiredLevel
    );
  }

  function acceptQuest(questId: string): QuestAcceptResult {
    const quest = getQuestById(questId);
    if (!quest) {
      return { success: false, message: '任务不存在！' };
    }

    if (quest.status !== 'available') {
      return { success: false, message: '该任务不可接受！' };
    }

    const playerLevel = characterService.getLevel();
    if (playerLevel < quest.requiredLevel) {
      return { success: false, message: `需要等级 ${quest.requiredLevel} 才能接受此任务！` };
    }

    quest.status = 'in_progress';
    activeQuests.value.push(questId);

    eventBus.emit(GameEvents.QUEST_ACCEPTED, { quest });

    return {
      success: true,
      message: `成功接受任务：${quest.title}`,
      quest
    };
  }

  function completeQuest(questId: string): QuestCompleteResult {
    const quest = getQuestById(questId);
    if (!quest) {
      return { success: false, message: '任务不存在！' };
    }

    if (quest.status === 'turned_in') {
      return { success: false, message: '该任务奖励已领取！' };
    }

    const allCompleted = quest.objectives.every(obj => obj.completed);
    if (!allCompleted) {
      return { success: false, message: '任务目标尚未全部完成！' };
    }

    quest.status = 'completed';

    eventBus.emit(GameEvents.QUEST_COMPLETED, { quest });

    return {
      success: true,
      message: `任务完成：${quest.title}`,
      rewards: quest.rewards
    };
  }

  function claimReward(questId: string): QuestCompleteResult {
    const quest = getQuestById(questId);
    if (!quest) {
      return { success: false, message: '任务不存在！' };
    }

    if (quest.status !== 'completed') {
      return { success: false, message: '任务尚未完成！' };
    }

    if (quest.rewards.gold) {
      characterService.addGold(quest.rewards.gold);
    }
    if (quest.rewards.exp) {
      characterService.addExp(quest.rewards.exp);
    }
    if (quest.rewards.items) {
      for (const item of quest.rewards.items) {
        inventoryService.addItem({ id: item.itemId, count: item.count } as any);
      }
    }

    quest.status = 'turned_in';
    activeQuests.value = activeQuests.value.filter(id => id !== questId);
    completedQuests.value.push(questId);

    eventBus.emit(GameEvents.QUEST_REWARD_CLAIMED, { quest, rewards: quest.rewards });

    return {
      success: true,
      message: `领取奖励：${quest.rewards.gold} 金币，${quest.rewards.exp} 经验值`,
      rewards: quest.rewards
    };
  }

  function updateObjective(questId: string, objectiveId: string, progress: number): void {
    const quest = getQuestById(questId);
    if (!quest) return;

    const objective = quest.objectives.find(obj => obj.id === objectiveId);
    if (!objective) return;

    objective.current = Math.min(objective.current + progress, objective.required);
    objective.completed = objective.current >= objective.required;

    const allCompleted = quest.objectives.every(obj => obj.completed);
    
    if (allCompleted && quest.status === 'in_progress') {
      quest.status = 'completed';
    }

    eventBus.emit(GameEvents.QUEST_PROGRESS, {
      questId,
      objectiveId,
      newCurrent: objective.current,
      completed: objective.completed
    });
  }

  function isQuestCompleted(questId: string): boolean {
    return completedQuests.value.includes(questId);
  }

  function isQuestActive(questId: string): boolean {
    return activeQuests.value.includes(questId);
  }

  function getState(): QuestState {
    return state.value;
  }

  function updateQuestFromEvent(_eventType: string, targetId: string, count: number): void {
    const active = getActiveQuests();
    
    for (const quest of active) {
      for (const objective of quest.objectives) {
        if (!objective.completed) {
          if (objective.targetType === 'kill' && objective.targetId === targetId) {
            updateObjective(quest.id, objective.id, count);
          } else if (objective.targetType === 'collect' && objective.targetId === targetId) {
            updateObjective(quest.id, objective.id, count);
          }
        }
      }
    }
  }

  function setCurrentQuest(questId: string | null): void {
    currentQuestId.value = questId;
  }

  function resetQuests(): void {
    quests.value = JSON.parse(JSON.stringify(INITIAL_QUESTS));
    activeQuests.value = [];
    completedQuests.value = [];
    currentQuestId.value = null;
  }

  function reset(): void {
    resetQuests();
  }

  return {
    quests,
    activeQuests,
    completedQuests,
    currentQuestId,
    state,
    getQuests,
    getQuestById,
    getActiveQuests,
    getAvailableQuests,
    acceptQuest,
    completeQuest,
    claimReward,
    updateObjective,
    isQuestCompleted,
    isQuestActive,
    getState,
    updateQuestFromEvent,
    setCurrentQuest,
    resetQuests,
    reset
  };
});

export const questService: IQuestService = {
  getQuests: () => useQuestStore().getQuests(),
  getQuestById: (questId: string) => useQuestStore().getQuestById(questId),
  getActiveQuests: () => useQuestStore().getActiveQuests(),
  getAvailableQuests: () => useQuestStore().getAvailableQuests(),
  acceptQuest: (questId: string) => useQuestStore().acceptQuest(questId),
  completeQuest: (questId: string) => useQuestStore().completeQuest(questId),
  claimReward: (questId: string) => useQuestStore().claimReward(questId),
  updateObjective: (questId: string, objectiveId: string, progress: number) => 
    useQuestStore().updateObjective(questId, objectiveId, progress),
  isQuestCompleted: (questId: string) => useQuestStore().isQuestCompleted(questId),
  isQuestActive: (questId: string) => useQuestStore().isQuestActive(questId),
  getState: () => useQuestStore().getState(),
  updateQuestFromEvent: (eventType: string, targetId: string, count: number) => 
    useQuestStore().updateQuestFromEvent(eventType, targetId, count),
  reset: () => useQuestStore().reset()
};
