/**
 * @fileoverview NPC服务模块
 * @description 提供NPC交互、对话等功能
 * @module modules/npc
 */

import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { eventBus, GameEvents } from '@/services/eventBus';
import { WORLD_LOCATIONS } from '@/data/locations';
import type {
  NPCType,
  NPCData,
  NPCInteractionState,
  NPCDialogueEvent,
  INPCService,
} from './types';

/**
 * 本地存储键名
 */
const NPC_INTERACTION_STORAGE_KEY = 'wow_npc_interaction';

/**
 * 示例NPC数据
 */
const NPCS: Record<string, NPCData> = {
  stormwind_quest_giver: {
    id: 'stormwind_quest_giver',
    name: '卫兵队长',
    icon: '👮',
    type: NPCType.QUEST_GIVER,
    locationKey: 'stormwind',
    questKeys: ['elwynn_bandits', 'elwynn_goblins'],
    dialogue: [
      '欢迎来到暴风城，冒险者！',
      '我们有一些任务需要你的帮助。',
      '艾尔文森林最近不太平静...',
    ],
  },
  orgrimmar_quest_giver: {
    id: 'orgrimmar_quest_giver',
    name: '督军',
    icon: '⚔️',
    type: NPCType.QUEST_GIVER,
    locationKey: 'orgrimmar',
    questKeys: ['durotar_quilboars', 'durotar_boars'],
    dialogue: [
      '为了部落！',
      '我们需要勇士去解决一些麻烦。',
      '杜隆塔尔的野猪人越来越嚣张了！',
    ],
  },
};

/**
 * NPC状态管理Store
 */
export const useNPCStore = defineStore('npc', () => {
  /**
   * NPC交互状态
   */
  const interactionState = ref<NPCInteractionState>({
    currentNPCId: null,
    interactionStep: 0,
    availableQuests: [],
  });

  /**
   * 从本地存储加载NPC状态
   */
  function loadFromStorage() {
    try {
      const data = localStorage.getItem(NPC_INTERACTION_STORAGE_KEY);
      if (data) {
        interactionState.value = JSON.parse(data);
      }
    } catch (e) {
      console.error('Failed to load NPC state:', e);
    }
  }

  /**
   * 保存NPC状态到本地存储
   */
  function saveToStorage() {
    try {
      localStorage.setItem(
        NPC_INTERACTION_STORAGE_KEY,
        JSON.stringify(interactionState.value)
      );
    } catch (e) {
      console.error('Failed to save NPC state:', e);
    }
  }

  /**
   * 获取NPC数据
   */
  const getNPC = (npcId: string): NPCData | null => {
    return NPCS[npcId] || null;
  };

  /**
   * 获取指定地点的所有NPC
   */
  const getNPCsAtLocation = (locationKey: string): NPCData[] => {
    return Object.values(NPCS).filter(npc => npc.locationKey === locationKey);
  };

  /**
   * 获取当前交互状态
   */
  const getCurrentInteraction = computed((): NPCInteractionState => {
    return { ...interactionState.value };
  });

  /**
   * 开始与NPC交互
   */
  const interactWithNPC = (npcId: string): boolean => {
    const npc = getNPC(npcId);
    if (!npc) {
      return false;
    }

    interactionState.value = {
      currentNPCId: npcId,
      interactionStep: 0,
      availableQuests: npc.questKeys || [],
    };
    saveToStorage();

    if (npc.dialogue && npc.dialogue.length > 0) {
      const event: NPCDialogueEvent = {
        npcId,
        npcName: npc.name,
        message: npc.dialogue[0],
      };
      eventBus.emit(GameEvents.NPC_DIALOGUE, event);
    }

    return true;
  };

  /**
   * 结束NPC交互
   */
  const endInteraction = () => {
    interactionState.value = {
      currentNPCId: null,
      interactionStep: 0,
      availableQuests: [],
    };
    localStorage.removeItem(NPC_INTERACTION_STORAGE_KEY);
  };

  /**
   * 与NPC对话
   */
  const talkToNPC = () => {
    const npcId = interactionState.value.currentNPCId;
    if (!npcId) return;

    const npc = getNPC(npcId);
    if (!npc || !npc.dialogue) return;

    const step = interactionState.value.interactionStep;
    if (step < npc.dialogue.length - 1) {
      interactionState.value.interactionStep++;
      saveToStorage();

      const event: NPCDialogueEvent = {
        npcId,
        npcName: npc.name,
        message: npc.dialogue[interactionState.value.interactionStep],
      };
      eventBus.emit(GameEvents.NPC_DIALOGUE, event);
    }
  };

  /**
   * 从NPC接受任务
   */
  const acceptQuestFromNPC = (questKey: string): boolean => {
    if (!interactionState.value.currentNPCId) {
      return false;
    }

    if (!interactionState.value.availableQuests.includes(questKey)) {
      return false;
    }

    // 这里我们依赖任务模块来处理实际的任务接受逻辑
    eventBus.emit(GameEvents.NPC_QUEST_ACCEPTED, {
      questKey,
      npcId: interactionState.value.currentNPCId,
    });

    return true;
  };

  /**
   * 向NPC交任务
   */
  const turnInQuestToNPC = (questKey: string): boolean => {
    if (!interactionState.value.currentNPCId) {
      return false;
    }

    // 同样依赖任务模块处理
    eventBus.emit(GameEvents.NPC_QUEST_TURNED_IN, {
      questKey,
      npcId: interactionState.value.currentNPCId,
    });

    return true;
  };

  /**
   * 重置NPC状态
   */
  const reset = () => {
    endInteraction();
  };

  // 初始化
  loadFromStorage();

  return {
    interactionState,
    getNPC,
    getNPCsAtLocation,
    getCurrentInteraction,
    interactWithNPC,
    endInteraction,
    talkToNPC,
    acceptQuestFromNPC,
    turnInQuestToNPC,
    reset,
  };
});

/**
 * NPC服务实现
 */
export const npcService: INPCService = {
  interactWithNPC: (npcId: string) => useNPCStore().interactWithNPC(npcId),
  endInteraction: () => useNPCStore().endInteraction(),
  getNPC: (npcId: string) => useNPCStore().getNPC(npcId),
  getNPCsAtLocation: (locationKey: string) =>
    useNPCStore().getNPCsAtLocation(locationKey),
  getCurrentInteraction: () => useNPCStore().getCurrentInteraction,
  talkToNPC: () => useNPCStore().talkToNPC(),
  acceptQuestFromNPC: (questKey: string) =>
    useNPCStore().acceptQuestFromNPC(questKey),
  turnInQuestToNPC: (questKey: string) =>
    useNPCStore().turnInQuestToNPC(questKey),
  reset: () => useNPCStore().reset(),
};
